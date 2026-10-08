import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';

// Twilio inbound-SMS webhook: a graduate replies "1" (attending) or "2" (not attending)
// to a graduation invitation. Point the Twilio number's "A message comes in" webhook here.
// Secrets: TWILIO_AUTH_TOKEN (used to verify the request really came from Twilio),
//          SMS_WEBHOOK_URL (the exact public URL configured in Twilio).

const twiml = (message: string) =>
  new Response(`<?xml version="1.0" encoding="UTF-8"?><Response><Message>${message
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</Message></Response>`,
  { headers: { 'Content-Type': 'text/xml' } });

// Twilio signature: base64(HMAC-SHA1(authToken, url + sorted key/value pairs))
async function validSignature(url: string, params: URLSearchParams, token: string, signature: string): Promise<boolean> {
  const sorted = [...params.keys()].sort().map((k) => k + (params.get(k) ?? '')).join('');
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(token), { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']);
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(url + sorted));
  const expected = btoa(String.fromCharCode(...new Uint8Array(mac)));
  if (expected.length !== signature.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  return diff === 0;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  const token = Deno.env.get('TWILIO_AUTH_TOKEN');
  const webhookUrl = Deno.env.get('SMS_WEBHOOK_URL');
  if (!token || !webhookUrl) return new Response('SMS webhook not configured', { status: 500 });

  const params = new URLSearchParams(await req.text());
  if (!(await validSignature(webhookUrl, params, token, req.headers.get('x-twilio-signature') ?? ''))) {
    return new Response('Invalid signature', { status: 403 });
  }

  const from = params.get('From') ?? '';
  const reply = (params.get('Body') ?? '').trim();
  if (reply !== '1' && reply !== '2') {
    return twiml('Please reply 1 if you will attend the graduation ceremony, or 2 if you cannot attend.');
  }

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const { data: title, error } = await supabase.rpc('respond_graduation_invitation_by_phone', {
    _phone: from,
    _code: Number(reply),
  });
  if (error) {
    console.error('respond_graduation_invitation_by_phone failed:', error.message);
    return twiml('Sorry, we could not record your reply. Please contact the training centre.');
  }
  if (!title) return twiml('We could not find an open graduation invitation for this number.');
  return twiml(reply === '1'
    ? `Thank you. We have recorded that you will attend ${title}.`
    : `Thank you. We have recorded that you cannot attend ${title}.`);
});
