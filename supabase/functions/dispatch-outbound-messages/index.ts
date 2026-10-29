import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';
import { getM365Token, sendM365Mail, type M365Credentials } from '../_shared/m365.ts';

// Drains the outbound_messages queue: email through each centre's own Microsoft 365 settings (Microsoft Graph), SMS through Twilio.
// Called on a schedule with the header  x-dispatch-secret  (the Vault job secret, or the DISPATCH_SECRET edge secret if one is set).
//
// Email: configured per centre by its Organization Admin (email_settings). A centre whose email is not set up or not switched on
// keeps its messages queued. SMS secrets: TWILIO_ACCOUNT_SID + TWILIO_AUTH_TOKEN + TWILIO_FROM.

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

interface Message {
  id: string;
  organization_id: string;
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
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const sent = req.headers.get('x-dispatch-secret') ?? '';
  const envSecret = Deno.env.get('DISPATCH_SECRET');
  let allowed = !!envSecret && safeEqual(sent, envSecret);
  if (!allowed && sent) {
    const { data } = await supabase.rpc('verify_dispatch_secret', { _candidate: sent });
    allowed = data === true;
  }
  if (!allowed) return json({ error: 'Unauthorized' }, 401);

  const twilioSid = Deno.env.get('TWILIO_ACCOUNT_SID');
  const twilioToken = Deno.env.get('TWILIO_AUTH_TOKEN');
  const twilioFrom = Deno.env.get('TWILIO_FROM');
  const smsReady = !!(twilioSid && twilioToken && twilioFrom);

  const { data, error } = await supabase.rpc('claim_outbound_messages', { _limit: 50 });
  if (error) return json({ error: error.message }, 500);

  // One lookup per centre and one Microsoft sign-in per connection per run (centres on the same tenant share it)
  type Creds = M365Credentials & { enabled: boolean; connection_id: string };
  const tokens = new Map<string, { token?: string; error?: string }>();
  const centres = new Map<string, { creds: Creds | null; token?: string; tokenError?: string }>();
  const centre = async (org: string) => {
    let c = centres.get(org);
    if (!c) {
      const { data: creds } = await supabase.rpc('email_settings_credentials', { _org: org });
      c = { creds: (creds as Creds | null) ?? null };
      if (c.creds?.enabled && c.creds.client_secret) {
        let t = tokens.get(c.creds.connection_id);
        if (!t) {
          t = {};
          try { t.token = await getM365Token(c.creds); } catch (e) { t.error = e instanceof Error ? e.message : String(e); }
          tokens.set(c.creds.connection_id, t);
        }
        c.token = t.token; c.tokenError = t.error;
      }
      centres.set(org, c);
    }
    return c;
  };

  const result = { sent: 0, failed: 0, deferred: 0 };
  const defer = async (id: string, reason: string) => {
    // Not set up for this channel/centre: put it back without burning a retry
    await supabase.from('outbound_messages').update({ status: 'queued', attempts: 0, error: reason }).eq('id', id);
    result.deferred++;
  };
  for (const m of (data ?? []) as Message[]) {
    try {
      if (m.channel === 'email') {
        const c = await centre(m.organization_id);
        if (!c.creds || !c.creds.enabled || !c.creds.client_secret) { await defer(m.id, 'Email is not switched on for this centre (Email Settings)'); continue; }
        if (!c.token) throw new Error(c.tokenError ?? 'Could not sign in to Microsoft 365');
        await sendM365Mail(c.token, c.creds, m.recipient, m.subject ?? 'Notification', m.body);
      } else {
        if (!smsReady) { await defer(m.id, 'sms provider not configured'); continue; }
        await sendSms(m, twilioSid!, twilioToken!, twilioFrom!);
      }
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
