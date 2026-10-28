// Live check, part 2: takes the approved E2E requisition through order, partial deliveries, a discrepancy and closure.
// Run after e2e_req.js: E2E_CREDS=path/to/creds.json node e2e/e2e_req_receipt.js
const { session } = require('./lib.js');
const fs = require('fs');
const path = require('path');

async function rpc(role, fn, body) {
  const { b, p } = await session(role);
  const AK = fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8').match(/PUBLISHABLE_KEY="([^"]+)"/)[1];
  const out = await p.evaluate(async ([fn, body, AK]) => {
    const k = Object.keys(localStorage).find((x) => /sb-.*auth-token/.test(x));
    const s = JSON.parse(localStorage[k]);
    const ref = k.match(/sb-(.*)-auth-token/)[1];
    const r = await fetch(`https://${ref}.supabase.co/rest/v1/rpc/${fn}`, { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + s.access_token, apikey: AK }, body: JSON.stringify(body) });
    return { status: r.status, text: await r.text() };
  }, [fn, body, AK]);
  await b.close();
  let json = null; try { json = JSON.parse(out.text); } catch { /* error text */ }
  return { ...out, json };
}
const ok = (label, cond, extra = '') => console.log((cond ? 'PASS ' : 'FAIL ') + label + (extra ? ' | ' + String(extra).slice(0, 140) : ''));
const day = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);

(async () => {
  const list = await rpc('procurement_officer', 'requisition_list', { _scope: 'procurement', _status: 'approved_awaiting_procurement', _search: 'E2E', _limit: 5, _offset: 0 });
  const id = list.json?.[0]?.id;
  ok('approved E2E requisition found', !!id);
  const early = await rpc('stock_control_officer', 'requisition_record_receipt', { _id: id, _delivery_date: day(0), _comments: 'x', _lines: [] });
  ok('nothing can be received before the order', early.status >= 400, early.text);
  ok('quotation recorded', (await rpc('procurement_officer', 'requisition_procurement_save', { _id: id, _supplier_id: null, _supplier_name: 'E2E Supplies', _quotation_reference: 'Q-1', _notes: 'e2e' })).status === 204);
  ok('order placed', (await rpc('procurement_officer', 'requisition_place_order', { _id: id, _supplier_name: 'E2E Supplies', _order_reference: 'PO-E2E-1', _order_date: day(0), _expected_delivery: day(3), _purchase_order: null })).status === 204);
  const f = await rpc('stock_control_officer', 'requisition_fulfilment', { _id: id });
  const item = f.json?.items?.[0];
  ok('receiving officer sees ordered quantity 4, none received', item?.ordered === 4 && item?.accepted === 0, JSON.stringify(item));
  const po = await rpc('procurement_officer', 'requisition_record_receipt', { _id: id, _delivery_date: day(0), _comments: 'x', _lines: [{ item_id: item.item_id, accepted: 1 }] });
  ok('the Procurement Officer cannot receive while a receiving officer exists', po.status >= 400, po.text);
  const over = await rpc('stock_control_officer', 'requisition_record_receipt', { _id: id, _delivery_date: day(0), _comments: 'x', _lines: [{ item_id: item.item_id, accepted: 5 }] });
  ok('receiving more than ordered is refused', over.status >= 400 && /outstanding/.test(over.text), over.text);
  const r1 = await rpc('stock_control_officer', 'requisition_record_receipt', { _id: id, _delivery_date: day(0), _comments: 'first van', _lines: [{ item_id: item.item_id, accepted: 2, damaged: 1, note: 'one cell leaking' }] });
  ok('partial delivery recorded', r1.status === 200 && r1.json?.status === 'partially_received', r1.text);
  const early2 = await rpc('procurement_officer', 'requisition_close', { _id: id, _note: 'x' });
  ok('cannot close while items are outstanding', early2.status >= 400, early2.text);
  const r2 = await rpc('stock_control_officer', 'requisition_record_receipt', { _id: id, _delivery_date: day(0), _comments: 'second van', _lines: [{ item_id: item.item_id, accepted: 2 }] });
  ok('everything accounted for: fully received', r2.json?.status === 'fully_received', r2.text);
  const f2 = await rpc('procurement_officer', 'requisition_fulfilment', { _id: id });
  ok('open discrepancy blocks closure', f2.json?.can_close === false && f2.json?.discrepancies?.length === 1);
  const res = await rpc('procurement_officer', 'requisition_resolve_discrepancy', { _disc: f2.json.discrepancies[0].id, _resolution: 'credited', _note: 'Supplier credited the leaking cell' });
  ok('discrepancy resolved', res.status === 200, res.text);
  const close = await rpc('procurement_officer', 'requisition_close', { _id: id, _note: 'All received and checked' });
  ok('requisition closed', close.status === 204, close.text);
  const v = await rpc('trainer', 'requisition_view', { _id: id });
  ok('the requester sees it closed with the full history', v.json?.status === 'closed' && v.json?.history?.length >= 8, v.json?.status);
})().catch((e) => { console.error(e); process.exit(1); });
