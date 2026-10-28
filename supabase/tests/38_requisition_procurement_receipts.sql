\set ON_ERROR_STOP on
\set orgA 'a0000000-0000-0000-0000-00000000000a'
\set orgB 'b0000000-0000-0000-0000-00000000000b'
\set rq '97b00000-0000-0000-0000-000000000001'
\set hot '97b00000-0000-0000-0000-000000000002'
\set acc '97b00000-0000-0000-0000-000000000003'
\set hof '97b00000-0000-0000-0000-000000000004'
\set cm '97b00000-0000-0000-0000-000000000005'
\set po '97b00000-0000-0000-0000-000000000006'
\set stk '97b00000-0000-0000-0000-000000000007'
\set poB '97b00000-0000-0000-0000-000000000008'
\set cmB '97b00000-0000-0000-0000-000000000009'

insert into auth.users (id,email) values (:'rq','rq@a.test'),(:'hot','hot@a.test'),(:'acc','acc@a.test'),(:'hof','hof@a.test'),(:'cm','cm@a.test'),(:'po','po@a.test'),(:'stk','stk@a.test'),(:'poB','pob@b.test'),(:'cmB','cmb@b.test');
insert into profiles (user_id, full_name, email) select id, split_part(email,'@',1), email from auth.users where id::text like '97b00000%' on conflict (user_id) do update set full_name = excluded.full_name;
alter table user_roles disable trigger trg_guard_privileged_roles;
insert into user_roles (user_id, role, organization_id) values (:'rq','trainer',:'orgA'),(:'hot','head_of_training',:'orgA'),(:'acc','accountant',:'orgA'),(:'hof','head_of_finance_admin',:'orgA'),(:'cm','centre_manager',:'orgA'),
  (:'po','procurement_officer',:'orgA'),(:'stk','stock_control_officer',:'orgA'),(:'poB','procurement_officer',:'orgB'),(:'cmB','centre_manager',:'orgB');
alter table user_roles enable trigger trg_guard_privileged_roles;
select public.seed_requisition_workflow(:'orgA');
insert into user_supervisors (organization_id, user_id, supervisor_user_id) values (:'orgA', :'rq', :'hot');

select public.assert(private.requisition_can_receive(:'stk', :'orgA') and not private.requisition_can_receive(:'po', :'orgA'), 'ordering and receiving stay with different people where a receiving officer exists');
select public.assert(private.requisition_can_receive(:'poB', :'orgB'), 'a centre with no receiving officer lets the Procurement Officer receive');

-- ===== an approved requisition with two items =====
set role authenticated; select set_config('request.jwt.claim.sub', :'rq', false);
select requisition_save_draft(null, :'orgA', 'Welding practice consumables', 'Training', '[{"description":"Welding rods","quantity":10,"specifications":"E6013"},{"description":"Safety gloves","quantity":5}]'::jsonb) as r1 \gset
select requisition_submit(:'r1');
select set_config('request.jwt.claim.sub', :'hot', false);
select requisition_decide((requisition_view(:'r1') ->> 'task_id')::uuid, 'recommend', 'ok');
select set_config('request.jwt.claim.sub', :'acc', false);
select requisition_decide((requisition_view(:'r1') ->> 'task_id')::uuid, 'fund_available', 'ok', 'GL-1');
select set_config('request.jwt.claim.sub', :'hof', false);
select requisition_decide((requisition_view(:'r1') ->> 'task_id')::uuid, 'recommend', 'ok');
select set_config('request.jwt.claim.sub', :'cm', false);
select requisition_decide((requisition_view(:'r1') ->> 'task_id')::uuid, 'approve', 'ok');

-- ===== nothing can be received before the order =====
select set_config('request.jwt.claim.sub', :'stk', false);
select public.assert((select count(*) from purchase_requisitions) = 0, 'the receiving officer does not see it before an order exists');
select set_config('request.jwt.claim.sub', :'po', false);
select (requisition_view(:'r1') -> 'items' -> 0 ->> 'no') as n1 \gset
select public.expect_error(format('select public.requisition_place_order(%L, %L, %L, %L, %L)', :'r1', 'Weld Supplies', '', current_date, current_date + 5), 'order or purchase order reference', 'an order needs a reference');
select public.expect_error(format('select public.requisition_place_order(%L, %L, %L, %L, %L)', :'r1', 'Weld Supplies', 'PO-1', current_date, current_date - 1), 'before the order date', 'delivery cannot precede the order');
select public.expect_error(format('select public.requisition_record_receipt(%L, %L, %L, %L)', :'r1', current_date, 'x', '[]'), 'Not authorised|Enter what', 'the Procurement Officer cannot receive where a receiving officer exists');
select requisition_procurement_save(:'r1', null, 'Weld Supplies', 'Q-77', 'Two quotes compared');
select public.assert((select status from purchase_requisitions where id = :'r1') = 'procurement_in_progress', 'recording a quotation starts procurement');
select requisition_place_order(:'r1', 'Weld Supplies', 'PO-2026-001', current_date, current_date + 5);
select public.assert((select status from purchase_requisitions where id = :'r1') = 'order_placed', 'the order is placed, nothing is received');
select public.assert((requisition_fulfilment(:'r1') -> 'items' -> 0 ->> 'accepted')::int = 0 and (requisition_fulfilment(:'r1') -> 'items' -> 0 ->> 'outstanding')::int = 10, 'placing an order does not receive anything');
select public.expect_error(format('select public.requisition_close(%L, %L)', :'r1', 'x'), 'cannot close', 'it cannot be closed before delivery');

-- ===== partial deliveries =====
select set_config('request.jwt.claim.sub', :'stk', false);
select public.assert((select count(*) from purchase_requisitions) = 1, 'the receiving officer sees it once ordered');
select (requisition_fulfilment(:'r1') -> 'items' -> 0 ->> 'item_id') as a1 \gset
select (requisition_fulfilment(:'r1') -> 'items' -> 1 ->> 'item_id') as b1 \gset
select public.expect_error(format('select public.requisition_record_receipt(%L, %L, %L, %L::jsonb)', :'r1', current_date + 1, 'x', format('[{"item_id":"%s","accepted":1}]', :'a1')), 'future', 'a delivery cannot be dated in the future');
select public.expect_error(format('select public.requisition_record_receipt(%L, %L, %L, %L::jsonb)', :'r1', current_date, 'x', format('[{"item_id":"%s","accepted":11}]', :'a1')), 'more than the 10 still outstanding', 'receiving more than is outstanding is refused');
select public.assert((requisition_record_receipt(:'r1', current_date, 'First van', format('[{"item_id":"%s","accepted":6},{"item_id":"%s","accepted":0,"damaged":1,"note":"cracked"}]', :'a1', :'b1')::jsonb) ->> 'status') = 'partially_received', 'a partial delivery makes it partially received');
select public.assert((requisition_fulfilment(:'r1') -> 'items' -> 0 ->> 'outstanding')::int = 4 and (requisition_fulfilment(:'r1') -> 'items' -> 1 ->> 'outstanding')::int = 5, 'outstanding quantities are calculated per item');
select public.expect_error(format('select public.requisition_record_receipt(%L, %L, %L, %L::jsonb)', :'r1', current_date, 'x', format('[{"item_id":"%s","accepted":5}]', :'a1')), 'more than the 4 still outstanding', 'the outstanding quantity shrinks with each delivery');
select requisition_record_receipt(:'r1', current_date, 'Second van', format('[{"item_id":"%s","accepted":4},{"item_id":"%s","accepted":4}]', :'a1', :'b1')::jsonb);
select public.assert((select status from purchase_requisitions where id = :'r1') = 'partially_received' and (select count(*) from (select 1) x) = 1, 'still partially received with one item outstanding');
select public.expect_error(format('select public.requisition_close(%L, %L)', :'r1', 'x'), 'Not authorised|cannot close', 'it cannot be closed while items are outstanding');
select requisition_record_receipt(:'r1', current_date, 'Last bits', format('[{"item_id":"%s","accepted":1}]', :'b1')::jsonb);
select public.assert((select status from purchase_requisitions where id = :'r1') = 'fully_received', 'every item accounted for: fully received');
select public.assert((select count(*) from jsonb_array_elements(requisition_fulfilment(:'r1') -> 'receipts')) = 3, 'three receipts are linked to the requisition');

-- ===== discrepancies block closure until resolved =====
select set_config('request.jwt.claim.sub', :'po', false);
select public.assert(not (requisition_fulfilment(:'r1') ->> 'can_close')::boolean, 'an open discrepancy blocks closure');
select public.expect_error(format('select public.requisition_close(%L, %L)', :'r1', 'x'), 'open delivery discrepancies', 'closing needs the discrepancy resolved');
select (requisition_fulfilment(:'r1') -> 'discrepancies' -> 0 ->> 'id') as d1 \gset
select public.expect_error(format('select public.requisition_resolve_discrepancy(%L, %L, %L)', :'d1', 'replaced', ''), 'Describe how', 'a resolution needs a note');
select requisition_resolve_discrepancy(:'d1', 'replaced', 'Supplier replaced the cracked gloves on the last van');
select public.assert((requisition_fulfilment(:'r1') ->> 'can_close')::boolean, 'resolved: it can be closed');
select requisition_close(:'r1', 'All received and checked');
select public.assert((select status from purchase_requisitions where id = :'r1') = 'closed', 'closed');
reset role;
select public.assert((select closed_by from purchase_requisitions where id = :'r1') = :'po' and (select closed_at from purchase_requisitions where id = :'r1') is not null, 'the closing user and date are recorded');
set role authenticated; select set_config('request.jwt.claim.sub', :'stk', false);
select public.expect_error(format('select public.requisition_record_receipt(%L, %L, %L, %L::jsonb)', :'r1', current_date, 'x', format('[{"item_id":"%s","accepted":1}]', :'a1')), 'only after the order|closed', 'nothing can be received on a closed requisition');

-- ===== shortage resolved by cancelling the rest =====
select set_config('request.jwt.claim.sub', :'rq', false);
select requisition_save_draft(null, :'orgA', 'Cables', 'Training', '[{"description":"Cable reel","quantity":5}]'::jsonb) as r2 \gset
select requisition_submit(:'r2');
select set_config('request.jwt.claim.sub', :'hot', false);
select requisition_decide((requisition_view(:'r2') ->> 'task_id')::uuid, 'recommend', 'ok');
select set_config('request.jwt.claim.sub', :'acc', false);
select requisition_decide((requisition_view(:'r2') ->> 'task_id')::uuid, 'fund_available', 'ok', 'GL-1');
select set_config('request.jwt.claim.sub', :'hof', false);
select requisition_decide((requisition_view(:'r2') ->> 'task_id')::uuid, 'recommend', 'ok');
select set_config('request.jwt.claim.sub', :'cm', false);
select requisition_decide((requisition_view(:'r2') ->> 'task_id')::uuid, 'approve', 'ok');
select set_config('request.jwt.claim.sub', :'po', false);
select requisition_place_order(:'r2', 'Cable Co', 'PO-2026-002', current_date - 10, current_date - 2);
select public.assert((requisition_fulfilment(:'r2') ->> 'overdue')::boolean, 'a past expected date shows as overdue');
select public.expect_error(format('select public.requisition_record_delay(%L, %L, %L)', :'r2', current_date - 1, 'late'), 'not in the past', 'a delay needs a future date');
select requisition_record_delay(:'r2', current_date + 3, 'Courier strike');
select public.assert((select status from purchase_requisitions where id = :'r2') = 'delivery_outstanding' and not (requisition_fulfilment(:'r2') ->> 'overdue')::boolean, 'a recorded delay moves it to delivery outstanding');
select set_config('request.jwt.claim.sub', :'stk', false);
select (requisition_fulfilment(:'r2') -> 'items' -> 0 ->> 'item_id') as c1 \gset
select requisition_record_receipt(:'r2', current_date, 'Short delivery', format('[{"item_id":"%s","accepted":3,"missing":2}]', :'c1')::jsonb);
select public.assert((select status from purchase_requisitions where id = :'r2') = 'partially_received', 'a short delivery is partially received');
select (requisition_fulfilment(:'r2') -> 'discrepancies' -> 0 ->> 'id') as d2 \gset
select requisition_resolve_discrepancy(:'d2', 'cancelled', 'Supplier cannot supply the remaining two; cancelled');
select public.assert((select status from purchase_requisitions where id = :'r2') = 'fully_received', 'cancelling the shortage accounts for every item');
select public.assert((requisition_fulfilment(:'r2') -> 'items' -> 0 ->> 'ordered')::int = 3, 'the ordered quantity was reduced by the cancellation');

-- ===== cancel an order before delivery; access boundaries =====
select set_config('request.jwt.claim.sub', :'rq', false);
select requisition_save_draft(null, :'orgA', 'Paper', 'Training', '[{"description":"Paper","quantity":1}]'::jsonb) as r3 \gset
select requisition_submit(:'r3');
select set_config('request.jwt.claim.sub', :'hot', false);
select requisition_decide((requisition_view(:'r3') ->> 'task_id')::uuid, 'recommend', 'ok');
select set_config('request.jwt.claim.sub', :'acc', false);
select requisition_decide((requisition_view(:'r3') ->> 'task_id')::uuid, 'fund_available', 'ok', 'GL-1');
select set_config('request.jwt.claim.sub', :'hof', false);
select requisition_decide((requisition_view(:'r3') ->> 'task_id')::uuid, 'recommend', 'ok');
select set_config('request.jwt.claim.sub', :'cm', false);
select requisition_decide((requisition_view(:'r3') ->> 'task_id')::uuid, 'approve', 'ok');
select set_config('request.jwt.claim.sub', :'po', false);
select requisition_cancel_order(:'r3', 'No longer needed');
select public.assert((select status from purchase_requisitions where id = :'r3') = 'cancelled', 'an order can be cancelled before anything is received');
select public.expect_error(format('select public.requisition_cancel_order(%L, %L)', :'r2', 'x'), 'cannot cancel', 'not once goods were received');
select set_config('request.jwt.claim.sub', :'poB', false);
select public.expect_error(format('select public.requisition_place_order(%L, %L, %L, %L, %L)', :'r2', 'X', 'PO', current_date, current_date), 'Not authorised|cannot|not found', 'another centre''s Procurement Officer cannot act');
select public.assert((select count(*) from purchase_requisitions) = 0, 'and sees nothing');
select set_config('request.jwt.claim.sub', :'rq', false);
select public.assert((requisition_fulfilment(:'r1') ->> 'can_close')::boolean = false and (requisition_fulfilment(:'r1') ->> 'can_receive')::boolean = false, 'the requester can follow progress but not act on it');
select public.expect_error(format('select public.requisition_record_delay(%L, %L, %L)', :'r2', current_date + 4, 'x'), 'Not authorised', 'the requester cannot record procurement updates');
select public.expect_error($$update purchase_requisition_items set cancelled_quantity = 99$$, 'permission denied|row-level', 'quantities cannot be changed directly');
set role authenticated; select set_config('request.jwt.claim.sub', :'po', false);
select public.assert((requisition_procurement_summary(:'orgA') ->> 'ready_for_closure')::int = 1 and (requisition_procurement_summary(:'orgA') ->> 'orders_placed')::int = 0 and (requisition_procurement_summary(:'orgA') ->> 'outstanding_units')::int = 0, 'dashboard figures come from the live requisitions');
select set_config('request.jwt.claim.sub', :'poB', false);
select public.expect_error(format('select public.requisition_procurement_summary(%L)', :'orgA'), 'Not authorised', 'figures of another centre are refused');
reset role;
select public.expect_error($$update requisition_receipts set comments = 'edited'$$, 'never be changed', 'receipts cannot be edited');
select public.expect_error($$delete from requisition_receipt_items$$, 'never be changed', 'receipt lines cannot be deleted');
select 'OK requisition procurement and receipts';
