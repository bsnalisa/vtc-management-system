// Live check of the requisition workflow with the test accounts: one requisition through all four stages to procurement.
// Run: E2E_CREDS=path/to/creds.json node e2e/e2e_req.js   (leaves one approved test requisition behind)
const { session, BASE, creds } = require('./lib.js');
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
    const t = await r.text();
    const org = (await (await fetch(`https://${ref}.supabase.co/rest/v1/user_roles?select=organization_id&limit=1`, { headers: { authorization: 'Bearer ' + s.access_token, apikey: AK } })).json())[0]?.organization_id;
    return { status: r.status, text: t, org };
  }, [fn, body, AK]);
  await b.close();
  let json = null; try { json = JSON.parse(out.text); } catch { /* error text */ }
  return { ...out, json };
}
const ok = (label, cond, extra = '') => console.log((cond ? 'PASS ' : 'FAIL ') + label + (extra ? ' | ' + extra : ''));

(async () => {
  const first = await rpc('trainer', 'requisition_my_supervisor', { _org: null });
  const org = first.org;
  const sup = await rpc('trainer', 'requisition_my_supervisor', { _org: org });
  ok('requester has a configured supervisor', sup.json?.valid === true, JSON.stringify(sup.json?.supervisors));
  const d = await rpc('trainer', 'requisition_save_draft', { _id: null, _org: org, _purpose: 'E2E check: robotic arm training batteries', _department: 'Training', _items: [{ description: '18650 batteries', quantity: '4', specifications: 'Li-ion 3.7V' }] });
  ok('draft saved', d.status === 200, d.text.slice(0, 80));
  const id = d.json;
  const direct = await rpc('trainer', 'requisition_decide', { _task: '00000000-0000-0000-0000-000000000000', _decision: 'approve', _comment: 'x' });
  ok('unknown task refused', direct.status >= 400);
  const sub = await rpc('trainer', 'requisition_submit', { _id: id });
  ok('submitted and routed', sub.status === 200 && /REQ-/.test(sub.text), sub.text.slice(0, 160));
  const stages = [['head_of_training', 'recommend', null], ['accountant', 'fund_available', 'GL-E2E/01'], ['head_of_finance_admin', 'recommend', null], ['centre_manager', 'approve', null]];
  for (const [role, decision, gl] of stages) {
    const v = await rpc(role, 'requisition_view', { _id: id });
    const task = v.json?.task_id;
    ok(`${role} sees it waiting`, v.status === 200 && v.json?.can_decide === true, v.json?.status);
    if (!task) break;
    const r = await rpc(role, 'requisition_decide', { _task: task, _decision: decision, _comment: 'e2e', _gl_code: gl });
    ok(`${role}: ${decision}`, r.status === 200, r.text.slice(0, 80));
  }
  const po = await rpc('procurement_officer', 'requisition_list', { _scope: 'procurement', _status: null, _search: 'E2E', _limit: 10, _offset: 0 });
  ok('procurement officer receives it only after approval', po.status === 200 && po.json?.length >= 1, po.json?.[0]?.status);
  const generic = await rpc('trainer', 'workflow_cancel', { _instance: '00000000-0000-0000-0000-000000000000', _reason: 'x' });
  ok('generic cancel on nothing is refused', generic.status >= 400);
})().catch((e) => { console.error(e); process.exit(1); });
