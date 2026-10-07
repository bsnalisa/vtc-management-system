# Email & SMS delivery setup

Messages (graduation invitations, survey links, ...) are queued in `outbound_messages`.
The `dispatch-outbound-messages` edge function sends them; `sms-inbound` records SMS replies.

## Secrets (Supabase > Edge Functions > Secrets)

| Secret | Used for |
|---|---|
| `DISPATCH_SECRET` | Required. Shared secret the scheduler sends in `x-dispatch-secret` |
| `RESEND_API_KEY`, `EMAIL_FROM` | Email via Resend (`EMAIL_FROM` must be a verified sender/domain) |
| `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM` | SMS via Twilio |
| `SMS_WEBHOOK_URL` | Exact public URL of `sms-inbound`, as entered in Twilio (used to verify signatures) |

A channel with no credentials is skipped and its messages stay queued.

## Scheduling

Call the dispatcher every few minutes, e.g. with `pg_cron` + `pg_net`:

```sql
select cron.schedule('dispatch-outbound', '*/5 * * * *', $$
  select net.http_post(
    url := 'https://<project>.supabase.co/functions/v1/dispatch-outbound-messages',
    headers := jsonb_build_object('x-dispatch-secret', '<DISPATCH_SECRET>')
  );
$$);
```

Failed sends are retried up to 3 times, then marked `failed` with the provider error in `outbound_messages.error`.

## SMS replies

In Twilio, set the number's "A message comes in" webhook (HTTP POST) to the `sms-inbound` URL.
A graduate replying `1` (attending) or `2` (not attending) to a graduation invitation is matched by phone
number (last 9 digits) to their next open invitation.

## Idle session lock

The app locks after 15 minutes of inactivity (password to unlock) and signs out after a further 30 minutes.
Override with `VITE_IDLE_LOCK_MINUTES` and `VITE_IDLE_SIGNOUT_MINUTES`.
