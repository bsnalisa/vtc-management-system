# Scheduled jobs

Everything else is event-driven; these four need a schedule. Each can also be run by hand from the screen shown.

| Job | What it does | Run by hand | Suggested schedule |
|---|---|---|---|
| Message dispatcher (edge function `dispatch-outbound-messages`) | Sends queued emails and SMS. Every email in the system goes through this queue: application and screening notices, exam timetable notices, event reminders, workflow approvals, graduation invitations. | n/a | every 5 minutes |
| `workflow_escalate_overdue(org)` | Escalates approvals past their response time | Workflows > Alerts & settings | every 30 minutes |
| `library_process_overdue(org)` | Marks overdue loans, adds fines, sends due-soon and overdue notices | Resource Centre > Circulation | daily |
| `extracurricular_send_reminders(org)` | Sends each event's reminder once, inside its reminder window | Trainee Affairs > Extra-curricular | hourly |

Set-up for the dispatcher is in `docs/messaging-setup.md`.

## How they are scheduled

Migration `20261010120000_schedule_recurring_jobs.sql` schedules all four with pg_cron (when the extension is installed):

| pg_cron job | Schedule (UTC) | Calls |
|---|---|---|
| `vms-workflow-escalation` | every 30 minutes | `run_scheduled_job('workflow_escalation')` |
| `vms-library-overdue` | daily 04:00 | `run_scheduled_job('library_overdue')` |
| `vms-event-reminders` | hourly at :15 | `run_scheduled_job('event_reminders')` |
| `vms-message-dispatcher` | every 5 minutes | `invoke_message_dispatcher()` |

`run_scheduled_job` loops over active organisations and isolates failures per organisation. The scheduler runs as the database
owner with no signed-in user; `is_job_runner()` recognises that (or the service-role key) and the functions refuse everyone else.

Check with `select jobname, schedule from cron.job where jobname like 'vms-%';` and `supabase/verify/post_apply_checks.sql`.

### Dispatcher set-up (one time)

The dispatcher job does nothing until it knows where the edge function lives. Store two Vault secrets:

```sql
select vault.create_secret('https://<project-ref>.supabase.co/functions/v1', 'vms_functions_url');
select vault.create_secret('<long random string>', 'vms_dispatch_secret');
```

and set the same random string as the edge-function secret `DISPATCH_SECRET`, plus the provider secrets listed in
`docs/messaging-setup.md`. Queued messages older than 7 days are marked failed rather than sent late.

## Notifications that need no schedule

These are sent the moment the event happens, as an in-app notification plus a queued email (delivered by the dispatcher):

- an online application is submitted (applicant, and registration officers for online applications)
- an application is screened (applicant)
- an exam timetable is published, or its date, time or venue changes afterwards (candidates, Head of Training, class trainers, the invigilator)
