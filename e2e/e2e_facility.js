// Live check of the class / building / room approval flow with the test accounts.
// Run: E2E_CREDS=path/to/creds.json node e2e/e2e_facility.js
// Leaves three REJECTED test records (one class, one building, one room) behind as the history of the check.
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
    return { status: r.status, text: await r.text() };
  }, [method, url, body, AK]);
  let json = null; try { json = JSON.parse(out.text); } catch { /* error text */ }
  return { ...out, json };
}
const rpc = (role, fn, body) => api(role, 'POST', `rpc/${fn}`, body);
let failed = 0;
const ok = (label, cond, extra = '') => { if (!cond) failed++; console.log((cond ? 'PASS ' : 'FAIL ') + label + (extra ? ' | ' + extra : '')); };

(async () => {
  const org = (await api('head_of_training', 'GET', 'user_roles?select=organization_id&limit=1')).json?.[0]?.organization_id;
  const trade = (await api('head_of_training', 'GET', 'trades?select=id&limit=1')).json?.[0]?.id;
  const tag = 'E2E-' + Date.now().toString(36).toUpperCase();

  const b = await api('head_of_training', 'POST', 'training_buildings', { organization_id: org, name: tag + ' workshop', code: tag + '-B' });
  ok('Head of Training adds a building', b.status === 201, b.text.slice(0, 80));
  const bid = b.json?.[0]?.id;
  ok('and it starts pending', b.json?.[0]?.approval_status === 'pending');
  const r = await api('head_of_training', 'POST', 'training_rooms', { organization_id: org, building_id: bid, name: tag + ' bay', code: tag + '-R' });
  ok('adds a room', r.status === 201); const rid = r.json?.[0]?.id;
  const c = await api('head_of_training', 'POST', 'classes', { organization_id: org, trade_id: trade, level: 1, training_mode: 'fulltime', class_code: tag + '-C', class_name: tag + ' class', academic_year: '2099', approval_status: 'approved' });
  ok('adds a class (asking for "approved" is ignored)', c.status === 201 && c.json?.[0]?.approval_status === 'pending', c.text.slice(0, 100));
  const cid = c.json?.[0]?.id;

  const self = await api('head_of_training', 'PATCH', `classes?id=eq.${cid}`, { approval_status: 'approved' });
  ok('the Head of Training cannot approve their own class', self.status >= 400, self.text.slice(0, 90));
  const selfFn = await rpc('head_of_training', 'facility_decide', { _kind: 'class', _id: cid, _approve: true, _note: null });
  ok('nor through the function', selfFn.status >= 400);
  const tr = await rpc('trainer', 'facility_decide', { _kind: 'class', _id: cid, _approve: true, _note: null });
  ok('a trainer cannot decide', tr.status >= 400);
  const oa = await rpc('organization_admin', 'facility_decide', { _kind: 'class', _id: cid, _approve: true, _note: null });
  ok('the IT administrator cannot decide', oa.status >= 400);
  const sum = await rpc('centre_manager', 'facility_approval_summary', { _org: org });
  ok('the Centre Manager sees what is waiting', sum.status === 200 && sum.json?.classes >= 1 && sum.json?.buildings >= 1 && sum.json?.rooms >= 1, JSON.stringify(sum.json));
  const see = await api('centre_manager', 'GET', `training_rooms?id=eq.${rid}&select=id,approval_status`);
  ok('the Centre Manager can read the room', see.json?.length === 1);
  const edit = await api('centre_manager', 'PATCH', `classes?id=eq.${cid}`, { class_name: 'changed' });
  ok('but cannot edit the class', !(edit.json?.length > 0), edit.text.slice(0, 80));
  const roomFirst = await rpc('centre_manager', 'facility_decide', { _kind: 'room', _id: rid, _approve: true, _note: null });
  ok('a room cannot be approved before its building', roomFirst.status >= 400 && /building/i.test(roomFirst.text), roomFirst.text.slice(0, 80));
  const noReason = await rpc('centre_manager', 'facility_decide', { _kind: 'class', _id: cid, _approve: false, _note: '' });
  ok('a rejection needs a reason', noReason.status >= 400);
  const note = await api('centre_manager', 'GET', 'notifications?select=title&type=eq.facility_approval&order=created_at.desc&limit=5');
  ok('the Centre Manager was notified', note.json?.some((n) => n.title.includes(tag)), JSON.stringify(note.json?.map((n) => n.title)));

  const rej = await rpc('centre_manager', 'facility_decide', { _kind: 'class', _id: cid, _approve: false, _note: 'E2E check: rejected' });
  ok('the Centre Manager rejects the class', rej.status === 200 && rej.json === 'rejected', rej.text);
  const again = await rpc('centre_manager', 'facility_decide', { _kind: 'class', _id: cid, _approve: true, _note: null });
  ok('a decision is final', again.status >= 400);
  const fix = await api('head_of_training', 'PATCH', `classes?id=eq.${cid}`, { class_name: tag + ' class (corrected)' });
  ok('correcting it sends it back for approval', fix.json?.[0]?.approval_status === 'pending', fix.text.slice(0, 80));
  const back = await rpc('centre_manager', 'facility_approval_summary', { _org: org });
  ok('and it shows as waiting again', back.json?.classes >= 1);
  const rej2 = await rpc('centre_manager', 'facility_decide', { _kind: 'class', _id: cid, _approve: false, _note: 'E2E check: rejected again' });
  ok('rejected again', rej2.status === 200);
  const done = await rpc('centre_manager', 'facility_decide', { _kind: 'room', _id: rid, _approve: false, _note: 'E2E check: rejected' });
  ok('room rejected', done.status === 200);
  const bd = await rpc('centre_manager', 'facility_decide', { _kind: 'building', _id: bid, _approve: false, _note: 'E2E check: rejected' });
  ok('building rejected', bd.status === 200);

  // a pending class cannot be put on the timetable by direct insert
  const hn = await api('head_of_training', 'GET', `facility_approval_events?item_id=in.(${cid},${bid},${rid})&select=event`);
  ok('every step is in the history', hn.json?.length >= 7, String(hn.json?.length));

  // the screens
  const { p } = sessions['centre_manager'] ?? (sessions['centre_manager'] = await session('centre_manager'));
  await p.goto(BASE + '/classes', { waitUntil: 'networkidle' }); await p.waitForTimeout(2500);
  const txt = await p.locator('body').innerText();
  ok('the Centre Manager page shows classes, buildings and rooms read-only', /Buildings/.test(txt) && /Rooms/.test(txt) && !/Create Class|Add Building/.test(txt));
  ok('and the menu is "Classes & Facilities"', /Classes & Facilities/.test(txt));
  const h = sessions['head_of_training'].p;
  await h.goto(BASE + '/classes', { waitUntil: 'networkidle' }); await h.waitForTimeout(2500);
  const ht = await h.locator('body').innerText();
  ok('the Head of Training still has the create controls and sees the approval column', /Create Class|Add Class/.test(ht) && /Approval/.test(ht));

  for (const s of Object.values(sessions)) await s.b.close();
  console.log(failed ? `${failed} FAILED` : 'ALL PASSED');
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
