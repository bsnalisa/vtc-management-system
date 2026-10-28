// Live check of the reporting structure with the test accounts.
// Run: E2E_CREDS=path/to/creds.json node e2e/e2e_reporting.js
// Leaves only withdrawn requests, log entries and one cancelled test requisition behind; reporting lines end as they began.
const { session, BASE } = require('./lib.js');
const fs = require('fs');
const path = require('path');

const sessions = {};
const AK = fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8').match(/PUBLISHABLE_KEY="([^"]+)"/)[1];
async function api(role, method, url, body) {
  if (!sessions[role]) sessions[role] = await session(role);
  const { p } = sessions[role];
  const out = await p.evaluate(async ([method, url, body, AK]) => {
    const k = Object.keys(localStorage).find((x) => /sb-.*auth-token/.test(x));
    const s = JSON.parse(localStorage[k]); const ref = k.match(/sb-(.*)-auth-token/)[1];
    const r = await fetch(`https://${ref}.supabase.co/rest/v1/${url}`, { method, headers: { 'content-type': 'application/json', authorization: 'Bearer ' + s.access_token, apikey: AK, Prefer: 'return=representation' }, body: body ? JSON.stringify(body) : undefined });
    return { status: r.status, text: await r.text(), uid: s.user?.id };
  }, [method, url, body, AK]);
  let json = null; try { json = JSON.parse(out.text); } catch { /* error text */ }
  return { ...out, json };
}
const rpc = (role, fn, body) => api(role, 'POST', `rpc/${fn}`, body);
let failed = 0;
const ok = (label, cond, extra = '') => { if (!cond) failed++; console.log((cond ? 'PASS ' : 'FAIL ') + label + (extra ? ' | ' + extra : '')); };
const plus = (n) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);

(async () => {
  const org = (await api('organization_admin', 'GET', 'user_roles?select=organization_id&limit=1')).json?.[0]?.organization_id;
  const chart0 = await rpc('organization_admin', 'reporting_org_chart', { _org: org });
  ok('the Organisation Admin reads the chart', chart0.status === 200 && chart0.json?.people?.length > 5, `${chart0.json?.people?.length} people`);
  // the signed-in test account of each role (a centre can have several people with the same role)
  const uidOf = async (role) => (await api(role, 'GET', 'user_roles?select=user_id&limit=1')).uid;
  const id = { trainer: await uidOf('trainer'), hot: await uidOf('head_of_training'), acc: await uidOf('accountant'), hof: await uidOf('head_of_finance_admin'), cm: await uidOf('centre_manager'), lib: await uidOf('librarian'), oa: await uidOf('organization_admin') };
  ok('found the test people', Object.values(id).every(Boolean), JSON.stringify(Object.keys(id).filter((k) => !id[k])));
  const set = (user, supervisor, from, to) => rpc('organization_admin', 'reporting_set_supervisor', { _org: org, _user: user, _supervisor: supervisor, _from: from ?? null, _to: to ?? null, _note: 'E2E' });

  // refusals
  ok('nobody can be their own supervisor', (await set(id.trainer, id.trainer)).text.includes('own supervisor'));
  ok('an administrator cannot make themselves a supervisor', (await set(id.trainer, id.oa)).text.includes('make themselves'));
  ok('a person from outside the centre is refused', /same centre/.test((await set(id.trainer, '00000000-0000-4000-8000-0000000000aa')).text));
  ok('backdating is refused', /past/.test((await set(id.trainer, id.lib, plus(-3))).text));
  ok('an end date before the start is refused', /before the start/.test((await set(id.trainer, id.lib, plus(5), plus(2))).text));
  const loop = await set(id.cm, id.hot);
  ok('a loop is refused (the Head of Training already reports to the Centre Manager)', /loop/.test(loop.text), loop.text.slice(0, 100));
  const roleLoop = await rpc('organization_admin', 'reporting_set_line', { _org: org, _role: 'head_of_training', _supervisor_role: 'trainer' });
  ok('a loop between roles is refused', /loop between roles/.test(roleLoop.text), roleLoop.text.slice(0, 100));
  ok('a role cannot report to itself', /itself/.test((await rpc('organization_admin', 'reporting_set_line', { _org: org, _role: 'trainer', _supervisor_role: 'trainer' })).text));
  const direct = await api('organization_admin', 'POST', 'user_supervisors', { organization_id: org, user_id: id.trainer, supervisor_user_id: id.lib });
  ok('direct table writes are refused', direct.status >= 400, String(direct.status));
  const directLine = await api('organization_admin', 'PATCH', `reporting_lines?organization_id=eq.${org}&role=eq.trainer`, { supervisor_role: 'librarian' });
  ok('and so are role-line edits', !(directLine.json?.length > 0));

  // an acceptable scheduled change: preview, apply, see it on the chart, remove it
  const pv = await rpc('organization_admin', 'reporting_preview', { _org: org, _user: id.trainer, _supervisor: id.lib, _from: plus(30), _to: null });
  ok('the preview accepts a valid change', pv.status === 200 && pv.json?.problem === null && pv.json?.needs_super_admin === false, JSON.stringify(pv.json?.problem));
  const pvBad = await rpc('organization_admin', 'reporting_preview', { _org: org, _user: id.cm, _supervisor: id.hot, _from: plus(1), _to: null });
  ok('and names the problem before saving', /loop/.test(pvBad.json?.problem ?? ''));
  const ap = await set(id.trainer, id.lib, plus(30));
  ok('a future supervisor is scheduled', ap.json?.status === 'applied', ap.text.slice(0, 80));
  const chart1 = await rpc('organization_admin', 'reporting_org_chart', { _org: org });
  const tr1 = chart1.json.people.find((p) => p.user_id === id.trainer);
  ok('today the trainer is still on the role line and the change shows as scheduled', tr1.source === 'role' && tr1.scheduled.length === 1);
  const rm = await rpc('organization_admin', 'reporting_remove_supervisor', { _org: org, _user: id.trainer, _from: plus(0) });
  const chart2 = await rpc('organization_admin', 'reporting_org_chart', { _org: org });
  ok('removing it restores the original', rm.json?.status === 'applied' && chart2.json.people.find((p) => p.user_id === id.trainer).scheduled.length === 0);

  // protected roles wait for the Super Admin
  const pa = await set(id.acc, id.lib);
  ok('a change for the Accountant waits for the Super Admin', pa.json?.status === 'pending_confirmation', pa.text.slice(0, 80));
  const chart3 = await rpc('organization_admin', 'reporting_org_chart', { _org: org });
  ok('and nothing has changed yet', chart3.json.people.find((p) => p.user_id === id.acc).source === 'role');
  ok('only one open request per person', /already waiting/.test((await set(id.acc, id.lib)).text));
  const pl = await rpc('organization_admin', 'reporting_set_line', { _org: org, _role: 'head_of_finance_admin', _supervisor_role: 'head_of_training' });
  ok('a role line for the Head of Finance and Administration waits too', pl.json?.status === 'pending_confirmation', pl.text.slice(0, 80));
  const list = await rpc('organization_admin', 'reporting_change_requests_list', { _org: org });
  const mine = list.json.filter((r) => r.status === 'pending');
  ok('both requests are listed', mine.length >= 2);
  ok('the Organisation Admin cannot confirm them', (await rpc('organization_admin', 'reporting_decide_change', { _id: mine[0].id, _approve: true, _note: null })).status >= 400);
  ok('nor can the Centre Manager', (await rpc('centre_manager', 'reporting_decide_change', { _id: mine[0].id, _approve: true, _note: null })).status >= 400);
  for (const r of mine) await rpc('organization_admin', 'reporting_withdraw_change', { _id: r.id });
  const list2 = await rpc('organization_admin', 'reporting_change_requests_list', { _org: org });
  ok('the requests were withdrawn', list2.json.filter((r) => r.status === 'pending').length === 0);

  // moving a waiting approval
  const d = await rpc('trainer', 'requisition_save_draft', { _id: null, _org: org, _purpose: 'E2E reporting check', _department: 'Training', _items: [{ description: 'Pens', quantity: '1' }], _fields: {} });
  const sub = await rpc('trainer', 'requisition_submit', { _id: d.json });
  ok('a test requisition is waiting for the trainer\'s supervisor', sub.status === 200, sub.text.slice(0, 80));
  const pv2 = await rpc('organization_admin', 'reporting_preview', { _org: org, _user: id.trainer, _supervisor: null, _from: null, _to: null });
  ok('the preview lists it', pv2.json?.pending_approvals?.some((a) => a.title.includes('E2E reporting check')));
  ok('it cannot be moved to the person who submitted it', /submitted the request/.test((await rpc('organization_admin', 'reporting_reassign_pending', { _org: org, _submitter: id.trainer, _from_user: id.hot, _to_user: id.trainer, _reason: 'E2E check' })).text));
  ok('nor to the administrator', /themselves/.test((await rpc('organization_admin', 'reporting_reassign_pending', { _org: org, _submitter: id.trainer, _from_user: id.hot, _to_user: id.oa, _reason: 'E2E check' })).text));
  ok('a reason is required', /reason/.test((await rpc('organization_admin', 'reporting_reassign_pending', { _org: org, _submitter: id.trainer, _from_user: id.hot, _to_user: id.lib, _reason: '' })).text));
  const mv = await rpc('organization_admin', 'reporting_reassign_pending', { _org: org, _submitter: id.trainer, _from_user: id.hot, _to_user: id.lib, _reason: 'E2E check: Head of Training on leave' });
  ok('it is moved with a reason', mv.json?.moved >= 1, mv.text);
  const view = await rpc('librarian', 'requisition_view', { _id: d.json });
  ok('the new approver can now decide it', view.json?.can_decide === true);
  const viewOld = await rpc('head_of_training', 'requisition_view', { _id: d.json });
  ok('and the previous approver can no longer', viewOld.json?.can_decide !== true);
  await rpc('trainer', 'requisition_cancel', { _id: d.json, _reason: 'E2E clean-up' });

  // reading and history
  ok('the Centre Manager reads the chart but cannot change it', (await rpc('centre_manager', 'reporting_org_chart', { _org: org })).status === 200 && (await rpc('centre_manager', 'reporting_set_supervisor', { _org: org, _user: id.trainer, _supervisor: id.lib })).status >= 400);
  ok('a trainer cannot read the chart', (await rpc('trainer', 'reporting_org_chart', { _org: org })).status >= 400);
  const gaps = await rpc('organization_admin', 'reporting_gaps', { _org: org });
  ok('the gaps list loads', gaps.status === 200 && Array.isArray(gaps.json), `${gaps.json?.length} gap(s)`);
  const ev = await rpc('organization_admin', 'reporting_events_list', { _org: org, _limit: 100 });
  const names = new Set(ev.json?.map((e) => e.event));
  ok('every step is in the history', ['supervisor_set', 'supervisor_removed', 'change_requested', 'change_withdrawn', 'approvals_reassigned'].every((n) => names.has(n)), [...names].join(','));
  const lineStill = (await rpc('organization_admin', 'reporting_org_chart', { _org: org })).json.lines.find((l) => l.role === 'head_of_finance_admin');
  ok('the role lines are unchanged', lineStill?.supervisor_role === 'centre_manager', lineStill?.supervisor_role);

  // screens
  const a = sessions.organization_admin.p;
  await a.goto(BASE + '/reporting-structure', { waitUntil: 'networkidle' }); await a.waitForTimeout(2500);
  const t = await a.locator('body').innerText();
  ok('the Organisation Admin page shows the chart, gaps and change tabs', /Organisation chart/.test(t) && /Change a supervisor/.test(t) && /Role lines/.test(t));
  const c = sessions.centre_manager.p;
  await c.goto(BASE + '/reporting-structure', { waitUntil: 'networkidle' }); await c.waitForTimeout(2500);
  ok('the Centre Manager can open it', /Organisation chart/.test(await c.locator('body').innerText()));
  const tr = sessions.trainer.p;
  await tr.goto(BASE + '/reporting-structure', { waitUntil: 'networkidle' }); await tr.waitForTimeout(2500);
  ok('a trainer cannot', !/Organisation chart/.test(await tr.locator('body').innerText()));

  for (const s of Object.values(sessions)) await s.b.close();
  console.log(failed ? `${failed} FAILED` : 'ALL PASSED');
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
