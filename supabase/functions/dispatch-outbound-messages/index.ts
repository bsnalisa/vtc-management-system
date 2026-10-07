import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';

// Drains the outbound_messages queue: email through Resend, SMS through Twilio.
// Call it on a schedule (e.g. every few minutes) with the header  x-dispatch-secret: $DISPATCH_SECRET.
//
// Secrets:  DISPATCH_SECRET (required), RESEND_API_KEY + EMAIL_FROM (email),
//           TWILIO_ACCOUNT_SID + TWILIO_AUTH_TOKEN + TWILIO_FROM (SMS).
// A channel without credentials is skipped and its messages stay queued.

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

interface Message {
  id: string;
  channel: 'email' | 'sms';
  attempts: number;
  recipient: string;
  subject: string | null;
  body: string;
}

// Constant-time string comparison so the secret cannot be probed byte by byte
function safeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const x = enc.encode(a);
  const y = enc.encode(b);
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

async function sendEmail(m: Message, apiKey: string, from: string): Promise<void> {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from,
      to: [m.recipient],
      subject: m.subject ?? 'Notification',
      text: m.body,
      html: `<div style="font-family:Arial,sans-serif;white-space:pre-line">${escapeHtml(m.body)}</div>`,
    }),
  });
  if (!res.ok) throw new Error(`Resend ${res.status}: ${(await res.text()).slice(0, 300)}`);
}

async function sendSms(m: Message, sid: string, token: string, from: string): Promise<void> {
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${btoa(`${sid}:${token}`)}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ To: m.recipient, From: from, Body: m.body }),
  });
  if (!res.ok) throw new Error(`Twilio ${res.status}: ${(await res.text()).slice(0, 300)}`);
}

Deno.serve(async (req) => {
  const secret = Deno.env.get('DISPATCH_SECRET');
  if (!secret) return json({ error: 'DISPATCH_SECRET is not configured' }, 500);
  if (!safeEqual(req.headers.get('x-dispatch-secret') ?? '', secret)) return json({ error: 'Unauthorized' }, 401);

  const resendKey = Deno.env.get('RESEND_API_KEY');
  const emailFrom = Deno.env.get('EMAIL_FROM') ?? 'onboarding@resend.dev';
  const twilioSid = Deno.env.get('TWILIO_ACCOUNT_SID');
  const twilioToken = Deno.env.get('TWILIO_AUTH_TOKEN');
  const twilioFrom = Deno.env.get('TWILIO_FROM');
  const emailReady = !!resendKey;
  const smsReady = !!(twilioSid && twilioToken && twilioFrom);

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const { data, error } = await supabase.rpc('claim_outbound_messages', { _limit: 50 });
  if (error) return json({ error: error.message }, 500);

  const result = { sent: 0, failed: 0, deferred: 0 };
  for (const m of (data ?? []) as Message[]) {
    const ready = m.channel === 'email' ? emailReady : smsReady;
    if (!ready) {
      // No credentials for this channel: put it back without burning a retry
      await supabase.from('outbound_messages')
        .update({ status: 'queued', attempts: 0, error: `${m.channel} provider not configured` }).eq('id', m.id);
      result.deferred++;
      continue;
    }
    try {
      if (m.channel === 'email') await sendEmail(m, resendKey!, emailFrom);
      else await sendSms(m, twilioSid!, twilioToken!, twilioFrom!);
      await supabase.from('outbound_messages')
        .update({ status: 'sent', sent_at: new Date().toISOString(), error: null }).eq('id', m.id);
      result.sent++;
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      // claim_outbound_messages stops picking a row up after 3 attempts, so mark it failed then
      await supabase.from('outbound_messages')
        .update({ status: m.attempts >= 3 ? 'failed' : 'queued', error: message }).eq('id', m.id);
      result.failed++;
    }
  }
  return json(result);
});
