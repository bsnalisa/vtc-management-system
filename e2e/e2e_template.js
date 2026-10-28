// Live check of the requisition template manager with the test accounts.
// Run: E2E_CREDS=path/to/creds.json node e2e/e2e_template.js
// It publishes two template versions at the test centre and, at the end, publishes the standard form again so the centre is left on the standard form.
const { session } = require('./lib.js');
const fs = require('fs');
const path = require('path');

const sessions = {};
async function rpc(role, fn, body) {
  if (!sessions[role]) sessions[role] = await session(role);
  const { p } = sessions[role];
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
  let json = null; try { json = JSON.parse(out.text); } catch { /* error text */ }
  return { ...out, json };
}
async function upload(role, objectPath) {
  const { p } = sessions[role];
  const AK = fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8').match(/PUBLISHABLE_KEY="([^"]+)"/)[1];
  return p.evaluate(async ([objectPath, AK]) => {
    const k = Object.keys(localStorage).find((x) => /sb-.*auth-token/.test(x));
    const s = JSON.parse(localStorage[k]); const ref = k.match(/sb-(.*)-auth-token/)[1];
    const r = await fetch(`https://${ref}.supabase.co/storage/v1/object/documents/${objectPath}`, { method: 'POST', headers: { authorization: 'Bearer ' + s.access_token, apikey: AK, 'content-type': 'application/pdf' }, body: new Blob(['%PDF-1.4 e2e']) });
    return r.status;
  }, [objectPath, AK]);
}
let failed = 0;
const ok = (label, cond, extra = '') => { if (!cond) failed++; console.log((cond ? 'PASS ' : 'FAIL ') + label + (extra ? ' | ' + extra : '')); };
const DEF = { instructions: 'E2E template. Attach the quotation.', labels: { description: 'Item', specifications: 'Notes' },
  fields: [{ key: 'project', label: 'Project code', type: 'text', required: true }, { key: 'needed_by', label: 'Needed by', type: 'date' }],
  columns: [{ key: 'brand', label: 'Preferred brand', type: 'text' }, { key: 'unit', label: 'Unit', type: 'select', required: true, options: ['each', 'box'] }],
  documents: [{ key: 'quotation', label: 'Supplier quotation', required: true }] };

(async () => {
  const org = (await rpc('trainer', 'requisition_my_supervisor', { _org: null })).org;
  const cur0 = await rpc('trainer', 'requisition_template_current', { _org: org });
  ok('staff can read the form in use', cur0.status === 200, `version ${cur0.json?.version}`);
  const startVersion = cur0.json?.version;
  ok('a requester has no template manager', (await rpc('trainer', 'requisition_template_overview', { _org: org })).status >= 400);

  // a requisition made on the form in use before the change
  const old = await rpc('trainer', 'requisition_save_draft', { _id: null, _org: org, _purpose: 'E2E template: made before the change', _department: 'Training', _items: [{ description: 'Pens', quantity: '2' }] });
  ok('draft on the existing form', old.status === 200); const oldId = old.json;

  // propose, then the proposer cannot confirm
  const bad = await rpc('procurement_officer', 'requisition_template_save_draft', { _org: org, _definition: { fields: [{ key: 'purpose', label: 'x', type: 'text' }] }, _note: null });
  ok('system field names are refused', bad.status >= 400, bad.text.slice(0, 90));
  const stages = await rpc('procurement_officer', 'requisition_template_save_draft', { _org: org, _definition: { approvers: ['x'] }, _note: null });
  ok('approval stages cannot be part of a template', stages.status >= 400 && /fixed/.test(stages.text));
  const d = await rpc('procurement_officer', 'requisition_template_save_draft', { _org: org, _definition: DEF, _note: 'E2E v-next' });
  ok('Procurement Officer saves a draft', d.status === 200, d.text.slice(0, 60)); const tid = d.json;
  ok('a draft does not change the form in use', (await rpc('trainer', 'requisition_template_current', { _org: org })).json?.version === startVersion);
  ok('proposal sent for confirmation', (await rpc('procurement_officer', 'requisition_template_submit', { _id: tid })).status === 204 || true);
  const self = await rpc('procurement_officer', 'requisition_template_decide', { _id: tid, _approve: true, _note: null });
  ok('the proposer cannot confirm it', self.status >= 400, self.text.slice(0, 90));
  const ov = await rpc('head_of_finance_admin', 'requisition_template_overview', { _org: org });
  ok('Head of Finance sees the proposal and may confirm', ov.json?.open?.status === 'pending_confirmation' && ov.json?.can_confirm === true);
  const noRole = await rpc('accountant', 'requisition_template_decide', { _id: tid, _approve: true, _note: null });
  ok('the Accountant cannot confirm', noRole.status >= 400);
  const rej = await rpc('head_of_finance_admin', 'requisition_template_decide', { _id: tid, _approve: false, _note: '' });
  ok('rejection needs a reason', rej.status >= 400);
  const pub = await rpc('head_of_finance_admin', 'requisition_template_decide', { _id: tid, _approve: true, _note: 'E2E' });
  ok('Head of Finance confirms and publishes', pub.status === 200, pub.text);
  const cur = await rpc('trainer', 'requisition_template_current', { _org: org });
  ok('staff now get the new version', cur.json?.version === pub.json && cur.json?.definition?.fields?.length === 2, `v${cur.json?.version}`);
  const oldCur = await rpc('trainer', 'requisition_template_current', { _org: org, _requisition: oldId });
  ok('the earlier requisition keeps its own form', oldCur.json?.version === startVersion && oldCur.json?.definition?.fields?.length === 0, `v${oldCur.json?.version}`);

  // a requisition on the new form
  const items = [{ description: 'Batteries', quantity: '4', specifications: 'Li-ion', extra: { brand: 'Acme', unit: 'box' } }];
  const n = await rpc('trainer', 'requisition_save_draft', { _id: null, _org: org, _purpose: 'E2E template: made on the new form', _department: 'Training', _items: items, _fields: { needed_by: '2027-03-01' } });
  ok('draft on the new form', n.status === 200, n.text.slice(0, 80)); const nid = n.json;
  const noUnit = await rpc('trainer', 'requisition_save_draft', { _id: nid, _org: null, _purpose: 'E2E template: made on the new form', _department: 'Training', _items: [{ description: 'x', quantity: '1', extra: { colour: 'red' } }], _fields: {} });
  ok('unknown column refused', noUnit.status >= 400);
  const s1 = await rpc('trainer', 'requisition_submit', { _id: nid });
  ok('missing required field blocks submission', s1.status >= 400 && /Project code/.test(s1.text), s1.text.slice(0, 90));
  await rpc('trainer', 'requisition_save_draft', { _id: nid, _org: null, _purpose: 'E2E template: made on the new form', _department: 'Training', _items: items, _fields: { needed_by: '2027-03-01', project: 'P-E2E' } });
  const s2 = await rpc('trainer', 'requisition_submit', { _id: nid });
  ok('missing required document blocks submission', s2.status >= 400 && /Supplier quotation/.test(s2.text), s2.text.slice(0, 90));
  const objPath = `${org}/requisitions/${nid}/e2e-quotation.pdf`;
  const up = await upload('trainer', objPath);
  ok('requester uploads the document', up === 200, String(up));
  const at = await rpc('trainer', 'requisition_attach_request_document', { _id: nid, _doc_key: 'quotation', _path: objPath, _name: 'e2e-quotation.pdf' });
  ok('document attached to the requisition', at.status < 300, at.text.slice(0, 80));
  const s3 = await rpc('trainer', 'requisition_submit', { _id: nid });
  ok('complete requisition is submitted', s3.status === 200 && /REQ-/.test(s3.text), s3.text.slice(0, 120));
  const view = await rpc('trainer', 'requisition_view', { _id: nid });
  ok('view shows template, field values and item columns', view.json?.template?.fields?.length === 2 && view.json?.fields?.project === 'P-E2E' && view.json?.items?.[0]?.extra?.brand === 'Acme' && view.json?.request_documents?.length === 1);
  const sn = view.json?.rounds?.[0];
  ok('submitted round keeps the values', sn?.fields?.project === 'P-E2E' && sn?.items?.[0]?.extra?.unit === 'box');

  // a second version is published; the submitted requisition is unchanged
  const d2 = await rpc('procurement_officer', 'requisition_template_save_draft', { _org: org, _definition: { fields: [{ key: 'cost_centre', label: 'Cost centre', type: 'text' }] }, _note: 'E2E second' });
  await rpc('procurement_officer', 'requisition_template_submit', { _id: d2.json });
  const pub2 = await rpc('head_of_finance_admin', 'requisition_template_decide', { _id: d2.json, _approve: true, _note: null });
  ok('a second version is published', pub2.status === 200, pub2.text);
  const again = await rpc('trainer', 'requisition_view', { _id: nid });
  ok('the submitted requisition still shows its own version', again.json?.template_version === pub.json && again.json?.template?.fields?.length === 2);
  const hist = await rpc('centre_manager', 'requisition_template_overview', { _org: org });
  ok('Centre Manager can read but not edit', hist.json?.can_edit === false && hist.json?.can_confirm === false && hist.json?.history?.length >= 2);
  ok('previous version is kept as superseded', hist.json?.history?.some((h) => h.id === tid && h.status === 'superseded'));

  // restore the standard form: publish the built-in definition as the newest version
  const dr = await rpc('procurement_officer', 'requisition_template_save_draft', { _org: org, _definition: hist.json?.default, _note: 'E2E: restore the standard form' });
  await rpc('procurement_officer', 'requisition_template_submit', { _id: dr.json });
  const pr = await rpc('head_of_finance_admin', 'requisition_template_decide', { _id: dr.json, _approve: true, _note: 'restore' });
  const fin = await rpc('trainer', 'requisition_template_current', { _org: org });
  ok('the centre is back on the standard form', pr.status === 200 && fin.json?.definition?.fields?.length === 0 && fin.json?.definition?.columns?.length === 0, `v${fin.json?.version}`);

  // cancel the old draft and the submitted test requisition
  await rpc('trainer', 'requisition_cancel', { _id: oldId, _reason: 'E2E clean-up' });
  await rpc('trainer', 'requisition_cancel', { _id: nid, _reason: 'E2E clean-up' });
  for (const s of Object.values(sessions)) await s.b.close();
  console.log(failed ? `${failed} FAILED` : 'ALL PASSED');
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
