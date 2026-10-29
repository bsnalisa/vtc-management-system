import { identifyCaller, jsonResponse, serviceClient } from '../_shared/caller.ts';
import { getM365Token, sendM365Mail, type M365Credentials } from '../_shared/m365.ts';

// Sends one test email through the centre's own Microsoft 365 settings and records the outcome.
// Only the Super Admin (platform staff) sets up email, so only they may call it, and only to their own address or the sender
// mailbox, so it cannot be used to send mail to anyone else.
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
  const admin = serviceClient();
  const caller = await identifyCaller(req, admin);
  if (!caller || caller.kind !== 'user') return jsonResponse({ error: 'Sign in to send a test email' }, 401, cors);
  let body: { organization_id?: string; to?: string };
  try { body = await req.json(); } catch { return jsonResponse({ error: 'Invalid request' }, 400, cors); }
  const org = body.organization_id;
  if (!org || !caller.platform) return jsonResponse({ error: 'Not authorised' }, 403, cors);

  const { data: creds } = await admin.rpc('email_settings_credentials', { _org: org });
  const c = creds as (M365Credentials & { enabled: boolean }) | null;
  if (!c) return jsonResponse({ error: 'Save the Microsoft 365 settings first' }, 400, cors);
  if (!c.client_secret) return jsonResponse({ error: 'The client secret is not stored. Enter it and save again.' }, 400, cors);

  const { data: u } = await admin.auth.admin.getUserById(caller.userId);
  const own = u?.user?.email?.toLowerCase() ?? '';
  const to = (body.to ?? own).trim().toLowerCase();
  if (!to || (to !== own && to !== c.sender_address.toLowerCase())) return jsonResponse({ error: 'A test email can only go to your own address or the sending mailbox' }, 400, cors);

  try {
    const token = await getM365Token(c);
    await sendM365Mail(token, c, to, 'Test email from your VTC system', 'This is a test message. If you can read it, Microsoft 365 email is set up correctly for your centre.');
    await admin.rpc('email_settings_record_test', { _org: org, _ok: true, _error: null, _to: to, _by: caller.userId });
    return jsonResponse({ ok: true, to }, 200, cors);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await admin.rpc('email_settings_record_test', { _org: org, _ok: false, _error: message, _to: to, _by: caller.userId });
    return jsonResponse({ ok: false, error: message }, 200, cors);
  }
});
