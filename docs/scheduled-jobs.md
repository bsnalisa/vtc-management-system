# Scheduled jobs

Everything else is event-driven; these four need a schedule. Each can also be run by hand from the screen shown.

| Job | What it does | Run by hand | Suggested schedule |
|---|---|---|---|
| Message dispatcher (edge function `dispatch-outbound-messages`) | Sends queued emails and SMS. Every email in the system goes through this queue: application and screening notices, exam timetable notices, event reminders, workflow approvals, graduation invitations. | n/a | every 5 minutes |
| `workflow_escalate_overdue(org)` | Escalates approvals past their response time | Workflows > Alerts & settings | every 30 minutes |
| `library_process_overdue(org)` | Marks overdue loans, adds fines, sends due-soon and overdue notices | Resource Centre > Circulation | daily |
| `extracurricular_send_reminders(org)` | Sends each event's reminder once, inside its reminder window | Trainee Affairs > Extra-curricular | hourly |

Set-up for the dispatcher is in `docs/messaging-setup.md`.

## Example (pg_cron)

```sql
select cron.schedule('workflow-escalation', '*/30 * * * *', $$
  select public.workflow_escalate_overdue(id) from public.organizations where active;
$$);

select cron.schedule('library-overdue', '0 6 * * *', $$
  select public.library_process_overdue(id) from public.organizations where active;
$$);

select cron.schedule('event-reminders', '0 * * * *', $$
  select public.extracurricular_send_reminders(id) from public.organizations where active;
$$);
```

These run as the database owner (not a signed-in user), which each function accepts. If your scheduler calls them through the
API instead, use the service-role key.

## Notifications that need no schedule

These are sent the moment the event happens, as an in-app notification plus a queued email (delivered by the dispatcher):

- an online application is submitted (applicant, and registration officers for online applications)
- an application is screened (applicant)
- an exam timetable is published, or its date, time or venue changes afterwards (candidates, Head of Training, class trainers, the invigilator)
