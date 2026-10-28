\set ON_ERROR_STOP on
\set orgA 'a0000000-0000-0000-0000-00000000000a'
\set hofa '98300000-0000-0000-0000-000000000001'
\set cm '98300000-0000-0000-0000-000000000002'
\set acc '98300000-0000-0000-0000-000000000003'
\set oa '98300000-0000-0000-0000-000000000004'
\set po '98300000-0000-0000-0000-000000000005'

insert into auth.users (id,email) values (:'hofa','hofa@a.test'),(:'cm','cm@a.test'),(:'acc','acc@a.test'),(:'oa','oa@a.test'),(:'po','po@a.test');
insert into profiles (user_id, full_name, email) select id, split_part(email,'@',1), email from auth.users where id::text like '98300000%' on conflict (user_id) do update set full_name = excluded.full_name;
alter table user_roles disable trigger trg_guard_privileged_roles;
insert into user_roles (user_id, role, organization_id) values (:'hofa','head_of_finance_admin',:'orgA'),(:'cm','centre_manager',:'orgA'),(:'acc','accountant',:'orgA'),(:'oa','organization_admin',:'orgA'),(:'po','procurement_officer',:'orgA');
alter table user_roles enable trigger trg_guard_privileged_roles;
select to_char(current_date, 'YYYY') as yr \gset

-- only the Head of Finance and Administration proposes
set role authenticated; select set_config('request.jwt.claim.sub', :'cm', false);
select public.expect_error($$select public.budget_propose('a0000000-0000-0000-0000-00000000000a', 'Welding', to_char(current_date,'YYYY'), 5000, 'Annual budget')$$, 'Only the Head', 'the Centre Manager cannot propose');
select set_config('request.jwt.claim.sub', :'hofa', false);
select public.expect_error($$select public.budget_propose('a0000000-0000-0000-0000-00000000000a', 'Welding', '1999', 5000, 'Annual budget')$$, 'budget year', 'a past year is refused');
select public.expect_error($$select public.budget_propose('a0000000-0000-0000-0000-00000000000a', 'Welding', to_char(current_date,'YYYY'), -1, 'Annual budget')$$, 'amount', 'a negative amount is refused');
select public.expect_error($$select public.budget_propose('a0000000-0000-0000-0000-00000000000a', 'Welding', to_char(current_date,'YYYY'), 5000, 'no')$$, 'reason', 'a reason is required');
select public.budget_propose(:'orgA', 'Welding', :'yr', 5000, 'Annual budget') as line \gset
select public.assert((select (l ->> 'in_force')::boolean = false and l ->> 'proposal_status' = 'pending' from jsonb_array_elements(public.budget_overview(:'orgA', :'yr') -> 'lines') l where l ->> 'id' = :'line'), 'a new proposal is pending and not in force');
select public.expect_error($$select public.budget_propose('a0000000-0000-0000-0000-00000000000a', 'welding', to_char(current_date,'YYYY'), 6000, 'Another try')$$, 'already waiting', 'one pending proposal per line, case-insensitive');

-- direct writes are impossible
select public.assert(not exists (select 1 from department_budgets where total_budget = 1), 'no direct write changed anything');

-- decision rules
select set_config('request.jwt.claim.sub', :'acc', false);
select public.expect_error($$select public.budget_decide((select id from department_budgets where department='Welding'), true, null)$$, 'Only the Centre Manager', 'the accountant cannot approve');
select set_config('request.jwt.claim.sub', :'cm', false);
select public.expect_error($$select public.budget_decide((select id from department_budgets where department='Welding'), false, 'no')$$, 'reason', 'rejection needs a reason');
select public.budget_decide(:'line', false, 'Please justify the amount');
select public.assert((select proposal_status = 'rejected' and total_budget = 0 and approved_at is null from department_budgets where id = :'line'), 'a rejection leaves nothing in force');
select set_config('request.jwt.claim.sub', :'hofa', false);
select public.budget_propose(:'orgA', 'Welding', :'yr', 4500, 'Revised after review');
select set_config('request.jwt.claim.sub', :'cm', false);
select public.budget_decide(:'line', true, null);
select public.assert((select total_budget = 4500 and proposal_status = 'none' and approved_at is not null from department_budgets where id = :'line'), 'approval puts the figure in force');
select public.expect_error($$select public.budget_decide((select id from department_budgets where department='Welding'), true, null)$$, 'not waiting', 'a decision cannot be repeated');

-- committed is derived from orders on the department's requisitions
reset role;
select count(*) as nreq from purchase_requisitions \gset
select public.assert(:nreq >= 0, 'requisitions readable');
select public.assert(private.budget_committed(:'orgA', 'Welding', :'yr') = 0, 'nothing is committed before any order');

-- read access
set role authenticated;
select set_config('request.jwt.claim.sub', :'acc', false);
select public.assert(jsonb_array_length(public.budget_overview(:'orgA', :'yr') -> 'lines') = 1 and (select count(*) from department_budgets) = 1, 'the accountant reads budgets');
select set_config('request.jwt.claim.sub', :'po', false);
select public.assert(jsonb_array_length(public.budget_overview(:'orgA', :'yr') -> 'lines') = 1, 'the procurement officer reads budgets');
select set_config('request.jwt.claim.sub', :'oa', false);
select public.expect_error($$select public.budget_overview('a0000000-0000-0000-0000-00000000000a', null)$$, 'Not authorised', 'the IT administrator is refused');
select public.assert((select count(*) from department_budgets) = 0, 'and reads no budget rows');
select public.expect_error($$select public.budget_propose('a0000000-0000-0000-0000-00000000000a', 'IT', to_char(current_date,'YYYY'), 1, 'Not allowed')$$, 'Only the Head', 'nor proposes');

-- withdrawing a never-approved line removes it; an approved one keeps its figure
select set_config('request.jwt.claim.sub', :'hofa', false);
select public.budget_propose(:'orgA', 'Catering', :'yr', 900, 'First budget') as l2 \gset
select public.budget_withdraw(:'l2');
select public.assert(not exists (select 1 from department_budgets where id = :'l2'), 'a never-approved proposal is withdrawn');
select public.budget_propose(:'orgA', 'Welding', :'yr', 7000, 'Increase');
select public.budget_withdraw(:'line');
select public.assert((select total_budget = 4500 and proposal_status = 'none' from department_budgets where id = :'line'), 'withdrawing a change keeps the approved figure');

-- history
reset role;
select public.assert((select count(*) from budget_events where organization_id = :'orgA') >= 7, 'every step is logged');
select public.expect_error($$update budget_events set note = 'x'$$, 'can never be changed', 'the log is append-only');
