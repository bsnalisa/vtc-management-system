# Organisational structure, dynamic roles and end-to-end requisitions: reviewed approach

Review of the "Master Implementation Prompt" against the system as it is today (production schema, migrations to `20261103090000`, and the supplied *Internal Quotation Request Form*).

## 1. Verdict

The prompt is sound in intent and most of it can be delivered, but written as one instruction it would push the build towards duplicating things that already exist and towards three risks: a second workflow engine, free-form role creation that quietly widens access, and a template builder that can reshape the approval chain. The best approach is to **extend the existing workflow engine and reporting hierarchy**, deliver in **six small phases** that each ship and can be reversed on their own, and make three structural decisions up front (section 4).

## 2. What already exists (reuse, do not rebuild)

| Prompt asks for | Already in the system | Use it as |
|---|---|---|
| Sequential approval workflow, tasks, decisions, history | Workflow engine (`workflow_definitions/steps/instances/tasks/events`, `workflow_act_as`, `WF-YYYY-NNNNNN` references, append-only `workflow_events`, no self-approval, SLA and escalation, e-mail action links) | The approval stages (supervisor, accountant, head of finance, centre manager) become one new process type, `purchase_requisition`. |
| Dynamic line-supervisor routing | `reporting_lines` (per centre, per role) plus `user_supervisors` (per person), approver `@supervisor` / `@supervisor2`, fallback to Centre Manager | Already routes by configured supervisor, never "Head of Training". Needs validation, effective dates and an org-chart UI, not a new model. |
| Delegation, amount limits, supporting documents | `workflow_delegations`, `workflow_escalation_limits`, `workflow_attachments` | Reuse unchanged. |
| Requisition, items, purchase order, receiving | `purchase_requisitions`, `purchase_requisition_items`, `purchase_orders`, `receiving_reports` (+ items). All have **0 rows in production**, so they can be reshaped safely. | Extend them. Do not create parallel tables. |
| Letterhead | `proof_of_registration_settings` (logo, name, address, contacts, colours) and the single template in `src/lib/proofOfRegistration.ts` | Extract the header and footer into a shared letterhead helper used by both documents. Proof output must not change (snapshot test). |
| Role records | `custom_roles` (32 rows), `role_permissions`, `validate_role_assignment`, Role Management page | Extend with versions, job description and approval status. |
| AI analysis | `ai-chat` edge function (Lovable AI gateway) | Possible engine for job-description analysis, behind a Super Admin-only function. |
| Audit | `admin_audit_log`, `workflow_events`, `role_activity_logs` | Reuse. Add requisition and template events. |

Two supplied assets: the form's header image is the **VTC Nakayale logo** and its footer is a second graphic (both are inside the `.docx`). The production letterhead currently holds only a placeholder, so the real logo must be uploaded once through the existing settings page (the logo can only enter via that page by design). Nothing needs to be invented.

## 3. Problems in the prompt and how I would handle them

1. **"Dynamic roles with no code changes" is not literally possible today.** `user_roles.role` is a database enum (`app_role`, 36 values) and role names are written into hundreds of policies, `has_role(...)` calls, route guards and navigation lists. Converting it to free text would touch every policy and is the most dangerous change on offer.
   *Approach:* leave the enum and every existing role exactly as is. Super Admin-created roles live in a new layer: a role definition plus a **capability set**, assigned through `user_custom_roles`, checked by a new `has_capability(user, centre, capability)` function. Only **new** tables and screens use capabilities. Old policies never mention a custom role, so a new role is closed by default and cannot inherit existing access by accident. This also satisfies "generated permissions are proposals".
2. **Free-form template layout vs. mandatory approvals.** If the template controls the approval sections, a template edit could reorder or remove a stage.
   *Approach:* the template owns **fields, item-table columns, labels, validation, instructions and mandatory documents**. The approval stages and their decision options are fixed by the workflow definition and always printed from it. The print layout is the supplied form, not a drag-and-drop canvas.
3. **Organisational Admin can reroute approvals.** Anyone who can change supervisors can change who approves money.
   *Approach:* the admin edits reporting lines within their centre, with impact preview and audit, but changes to the supervisor of the Accountant, Head of Finance and Administration or Centre Manager need Super Admin confirmation, and admins can never set themselves as a supervisor. Pending tasks are listed and moved only through an explicit, audited reassignment.
4. **Segregation of duties is not defined.** What if the requester's supervisor is also the Accountant, or the Centre Manager is the requester?
   *Approach:* one person never decides two stages of the same requisition; if the same person would, that later stage goes to their own supervisor (`@supervisor2`). A Centre Manager's own requisition goes to the person the Super Admin configures as their supervisor, and is blocked with a clear message if none is set.
5. **Status model vs. workflow statuses.** The 18 requisition statuses mix approval states and procurement/receipt states.
   *Approach:* the engine keeps owning approval progress; the requisition's own `status` is changed **only** by SECURITY DEFINER functions (a trigger refuses direct updates) that map engine events, procurement events and receipt events onto the 18 statuses. Receipt and discrepancy facts are separate linked rows, never only a status string.
6. **"Fund Not Available" and "Do Not Recommend" are undefined.** Policy is needed, not code. Default: both stop progression, notify requester and supervisor, and the requester may revise and resubmit (history kept) or cancel. Nothing is auto-rejected and nothing auto-approves on timeout.
7. **Job-description analysis.** An AI call is possible, but the output must be a *proposal validated against a fixed capability list* so it cannot invent permissions. Record `analysis_method` as `ai`, `rules` or `manual` so the screen never claims AI ran when it did not. `ai-chat` should be confirmed to require a signed-in user before it is reused.
8. **Scope.** The prompt contains four products: org chart and reporting, role factory with generated dashboards, a template builder, and requisition-to-receipt. They should not be one release.

## 4. Decisions I need from you (with my recommendation)

1. **Role model:** capability layer on top of the enum (recommended) vs. converting roles to free text (not recommended).
2. **Template publishing:** the Procurement Officer publishes (as written) or publishing also needs the Head of Finance and Administration to confirm. *Recommend the second for a form that controls spending.*
3. **Supervisor changes for the approval chain:** Super Admin confirmation (recommended) vs. Organisational Admin alone.
4. **Return for correction:** enabled at every stage (recommended) or only supervisor and Centre Manager.
5. **Over-receipt:** blocked outright (recommended) or allowed with a Centre Manager-approved exception.

## 5. Delivery plan (each phase ships, is tested and can be rolled back alone)

| # | Phase | Content | Key tests |
|---|---|---|---|
| 1 | **Requisition workflow core** | New process type; requisition becomes versioned and engine-driven; fixed stages in the order given; decision data (fund available, GL code) on the task; guarded status function; requester and approver dashboards; reference number; audit. Includes the form as the A4 print using the shared letterhead. | Routing to the configured supervisor (Head of Training case and another department); no supervisor = blocked with message; order cannot be skipped; self-approval refused; same person never decides two stages; direct API calls refused; proof of registration output unchanged. |
| 2 | **Procurement and receipt** | Procurement progress, quotation and order references, expected delivery; goods receipt per item row with partial deliveries, outstanding quantity, condition, discrepancies, documents; closure rules; Procurement Officer queue. Retires the unused flat tables' gaps rather than adding new ones. | Partial deliveries add up; over-receipt refused; cannot be received before an order; cannot close with outstanding items; receipt linked to requisition. |
| 3 | **Template manager** | Versioned template (fields, columns, labels, validation, mandatory documents); requisition stores the version it was created on; publishing rules from decision 2. | Changing the template leaves old requisitions untouched; mandatory business rules cannot be removed. |
| 4 | **Reporting structure** | Validations (no self, no cycles, centre boundary, inactive supervisors), effective dates, org chart, impact preview, pending-work reassignment, admin dashboard gaps list. | Cycle and self-report rejected; future routing uses new line; affected pending tasks listed and reassigned without altering past decisions. |
| 5 | **Role factory** | Job description (mandatory), analysis proposal, review and edit, versions, approval, activation, capability assignment. | Cannot activate without description or review; organisation admin refused; generated proposal grants nothing until approved. |
| 6 | **Configurable dashboards** | One reusable widget renderer driven by role configuration; every widget reads through functions that filter by the caller's centre and capabilities. | New role gets a dashboard but no access to anything it was not granted. |

Phase 1 and 2 deliver the working requisition you described, using the supplied form. Phases 4 to 6 are the organisational and role features and are lower risk once the requisition flow is live.

## 6. Cross-cutting rules for every phase

- Backend enforcement first (SECURITY DEFINER functions with centre and role checks, no direct write policies); the UI only reflects it.
- RESTRICTIVE "Centre isolation" policy on every new table with an organisation column; new functions closed to anonymous users (the existing guard test must stay green).
- Migrations are additive and applied on their own after a rehearsal; existing data (including the 234 reporting lines) is preserved.
- SQL tests for every permission check, transition and receipt calculation; an end-to-end run on the live system per phase, as done for earlier releases.
- Mobile-first screens built from the shared UI primitives, A4 print tested for long item lists.

## 7. Revised master prompt (replace the original with this)

> Extend the existing VMS; do not rebuild or duplicate. Deliver in the six phases below, each independently releasable and reversible, starting with Phase 1. Reuse the workflow engine, `reporting_lines` / `user_supervisors`, `purchase_requisitions` and related tables, `custom_roles`, the shared letterhead and the existing audit tables.
>
> **Requisition workflow (Phases 1-2).** Add a `purchase_requisition` process type on the existing engine with the fixed stages Requester, Requester's Line Supervisor (Recommend / Do Not Recommend / Return), Accountant (Fund Available / Not Available, GL code), Head of Finance and Administration (Recommend / Do Not Recommend / Return), Centre Manager (Approve / Do Not Approve / Return). The supervisor is resolved from the configured reporting line and is never chosen by the requester; submission is blocked with an explanatory message if none is valid. One person never decides two stages of the same requisition. Requisition status changes only through server functions that map workflow, procurement and receipt events onto the specified statuses. Procurement and goods receipt are linked rows per item, with partial deliveries, outstanding quantities, discrepancies and documents; over-receipt is refused; closure needs every item accounted for. Print the supplied *Internal Quotation Request Form* on A4 with the centre letterhead from the shared letterhead helper, showing the actual people and roles for each stage; flag the logo as a required upload if it is missing.
>
> **Template manager (Phase 3).** Versioned requisition template (fields, item columns, labels, validation, instructions, mandatory documents) maintained by the Procurement Officer. Approval stages and decision options are not template-controlled. Requisitions pin the template version they were created on.
>
> **Reporting structure (Phase 4).** Organisational Admin manages reporting lines in their centre with validation (no self, no cycles, centre boundary, active supervisors), effective dates, org chart, impact preview and an audited reassignment process for pending work. Changing the supervisor of Accountant, Head of Finance and Administration or Centre Manager needs Super Admin confirmation.
>
> **Role factory and dashboards (Phases 5-6).** Super Admin only. Mandatory job description; analysis produces a proposal (AI when available, otherwise rules or manual, always labelled) validated against a fixed capability list; versioned; nothing is active until reviewed and approved. Roles run on a capability layer beside the existing roles and grant nothing by default. Dashboards are rendered from configuration by one reusable component and every widget reads server-side data filtered by the viewer's centre and capabilities.
>
> **Always:** backend enforcement, centre isolation, anonymous lockdown, audit of every configuration and workflow change, additive migrations with preserved data, SQL tests plus a live end-to-end check per phase, responsive and accessible screens.
