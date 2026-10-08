# Workflows (approvals)

Admins design approval workflows under **Workflows**; everyone uses **My Approvals**.

## How it works

- A workflow is a list of **steps**. Each step names who approves it (a role, where any one holder may decide, or a named
  person), an optional response time in hours, and an optional escalation target.
- A workflow is **opt-in per process**. Until one is activated for a process it behaves exactly as before. Only one
  workflow can be active per process.
- Processes available now:
  - **General approval request**: any user starts one from *My Approvals > My requests*.
  - **Exemption / external assessment requests**: starts when the trainee submits. While a workflow is running, staff
    can no longer approve or reject the request from the old screen (other status changes still work); the decision is
    written back to the request when the workflow finishes. RPL is not routed through a workflow because the assessment
    itself decides it.
  - **Delivery plans**: starts when the trainer submits the plan.
- Adding a process: insert a row in `workflow_process_types`, call `workflow_on_submit(...)` from a trigger on the source
  table, and add a branch for it in `workflow_apply_result(...)`. If the source table has its own approval guard, honour
  the `app.workflow_apply` setting as `assessment_request_status_changed()` does.

## Decisions

Approvers can **approve**, **reject** (comment required) or **ask for information** (comment required). The requester
replies from *My Approvals > My requests* and the same step reopens. Requesters cannot approve their own request unless
the step explicitly allows it.

## Email

Each approver gets an email with the request details and Approve / Reject / Ask-for-information links. Links are single
use, expire after 14 days, and open a confirmation page: nothing is decided until a button is pressed.
Set the website address under *Workflows > Alerts & settings*; without it, emails are sent without action links.
Emails are delivered by the dispatcher described in `docs/messaging-setup.md`.

## Delegation

Under *My Approvals > Delegation* a user schedules a colleague to cover their approvals for a period, for all processes or
one. The delegate sees the tasks, is emailed about new ones, and the audit trail records who actually decided.

## Escalation

Steps with a response time and an escalation target add that target as an approver once the task is overdue.
Escalation runs when `workflow_escalate_overdue(<organization id>)` is called: from the admin screen
("Check for overdue approvals now"), or on a schedule, for example every 30 minutes:

```sql
select cron.schedule('workflow-escalation', '*/30 * * * *', $$
  select public.workflow_escalate_overdue(id) from public.organizations where active;
$$);
```

(pg_cron runs as a database role; the function also accepts the service role.)

## Audit trail

Every start, step, decision, escalation, information request and completion is recorded with who did it and whether it
came from the app, an email link or the system. View it under *Workflows > Activity*.

## Changing a workflow

Steps cannot be edited while requests are running through that workflow: finish or cancel them first. Steps are saved
atomically.
