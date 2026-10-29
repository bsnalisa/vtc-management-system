// Sending email through Microsoft 365 (Microsoft Graph, application permission Mail.Send).
// Each centre registers its own app in its own tenant; nothing here is specific to one centre.

export interface M365Credentials {
  tenant_id: string; client_id: string; client_secret: string; sender_address: string; sender_name?: string | null; reply_to?: string | null;
}

// Turns Microsoft's error codes into something an administrator can act on
export function explainM365Error(status: number, body: string): string {
  const text = body.slice(0, 600);
  const has = (s: string) => text.includes(s);
  if (has('AADSTS7000215') || has('AADSTS7000222')) return 'Microsoft rejected the client secret (wrong value, or it has expired). Create a new secret in the app registration and paste its VALUE.';
  if (has('AADSTS700016')) return 'Microsoft does not know this application (client) ID in this tenant. Check the client ID and the tenant ID.';
  if (has('AADSTS90002') || has('AADSTS900023')) return 'Microsoft could not find this tenant. Check the tenant ID or domain.';
  if (has('AADSTS50034') || has('AADSTS7000112')) return 'The application is disabled or the account does not exist in this tenant.';
  if (has('ErrorAccessDenied') || has('Authorization_RequestDenied') || status === 403) return 'Microsoft refused to send as this mailbox. Add the Mail.Send application permission, grant admin consent, and make sure no application access policy blocks this mailbox.';
  if (has('ErrorInvalidUser') || has('MailboxNotFound') || has('ResourceNotFound') || status === 404) return 'The sending mailbox was not found in this tenant. Check the sender address; it must be a real mailbox or shared mailbox.';
  if (has('MailboxNotEnabledForRESTAPI')) return 'The sending mailbox is not an Exchange Online mailbox (for example it has no licence).';
  if (status === 401) return 'Microsoft did not accept the sign-in. Check the tenant ID, client ID and client secret.';
  if (status === 429) return 'Microsoft is throttling this mailbox; it will be retried.';
  return `Microsoft returned ${status}: ${text.replace(/\s+/g, ' ').slice(0, 300)}`;
}

export async function getM365Token(c: M365Credentials): Promise<string> {
  const res = await fetch(`https://login.microsoftonline.com/${encodeURIComponent(c.tenant_id)}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: c.client_id, client_secret: c.client_secret, scope: 'https://graph.microsoft.com/.default', grant_type: 'client_credentials' }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(explainM365Error(res.status, text));
  const token = JSON.parse(text).access_token as string | undefined;
  if (!token) throw new Error('Microsoft did not return an access token');
  return token;
}

const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export async function sendM365Mail(token: string, c: M365Credentials, to: string, subject: string, body: string): Promise<void> {
  const message: Record<string, unknown> = {
    subject,
    body: { contentType: 'HTML', content: `<div style="font-family:Arial,sans-serif;white-space:pre-line">${escapeHtml(body)}</div>` },
    toRecipients: [{ emailAddress: { address: to } }],
  };
  if (c.reply_to) message.replyTo = [{ emailAddress: { address: c.reply_to } }];
  const res = await fetch(`https://graph.microsoft.com/v1.0/users/${encodeURIComponent(c.sender_address)}/sendMail`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, saveToSentItems: false }),
  });
  if (res.status !== 202 && !res.ok) throw new Error(explainM365Error(res.status, await res.text()));
}
