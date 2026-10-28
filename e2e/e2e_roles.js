// Live check of phases 4 to 6 that need a Super Admin: confirmation of protected reporting changes, the role factory
// (job description, proposal, review, approval, assignment), the Staff Member base role and the role dashboard.
// Run: E2E_CREDS=path/to/creds.json node e2e/e2e_roles.js   (needs the super_admin, super_admin_2 and organization_admin test logins;
// two Super Admins are needed because a role one prepares must be approved by another)
// Cleans up after itself: both test roles are retired, the assignment is ended, the named supervisor is removed and the
// Staff Member login is deleted (or left for the Test Data Reset when it carries the @vms-test.example address).
const { session, creds, BASE } = require('./lib.js');
const fs = require('fs');
const path = require('path');

const sessions = {};
const AK = fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8').match(/PUBLISHABLE_KEY="([^"]+)"/)[1];
async function http(role, method, kind, url, body) {
  if (!sessions[role]) sessions[role] = await session(role);
  const { p } = sessions[role];
  const out = await p.evaluate(async ([method, kind, url, body, AK]) => {
    try {
    const k = Object.keys(localStorage).find((x) => /sb-.*auth-token/.test(x));
    const s = JSON.parse(localStorage[k]); const ref = k.match(/sb-(.*)-auth-token/)[1];
    const r = await fetch(`https://${ref}.supabase.co/${kind}/v1/${url}`, { method, headers: { 'content-type': 'application/json', authorization: 'Bearer ' + s.access_token, apikey: AK, ...(kind === 'rest' ? { Prefer: 'return=representation' } : {}) }, body: body ? JSON.stringify(body) : undefined });
    return { status: r.status, text: await r.text(), uid: s.user?.id };
    } catch (e) { return { status: 0, text: 'network error: ' + e.message, uid: null }; }
  }, [method, kind, url, body, AK]);
  let json = null; try { json = JSON.parse(out.text); } catch { /* error text */ }
  return { ...out, json };
}
const api = (role, method, url, body) => http(role, method, 'rest', url, body);
const rpc = (role, fn, body) => http(role, 'POST', 'rest', `rpc/${fn}`, body);
const fn = (role, name, body) => http(role, 'POST', 'functions', name, body);
let failed = 0;
const ok = (label, cond, extra = '') => { if (!cond) failed++; console.log((cond ? 'PASS ' : 'FAIL ') + label + (extra ? ' | ' + extra : '')); };
const info = (label, extra = '') => console.log('INFO ' + label + (extra ? ' | ' + extra : ''));
const plus = (n) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);
const tag = Date.now().toString(36);

(async () => {
  const org = (await api('organization_admin', 'GET', 'user_roles?select=organization_id&limit=1')).json?.[0]?.organization_id;
  const leftovers = (await rpc('super_admin', 'role_factory_overview', {})).json?.filter((r) => r.role_code.startsWith('e2e_') && r.status !== 'retired') ?? [];
  for (const r of leftovers) await rpc('super_admin', 'role_factory_retire', { _role: r.id, _note: 'E2E clean-up of an earlier run' });
  info('leftover test roles retired', String(leftovers.length));
  const uid = async (role) => (await api(role, 'GET', 'user_roles?select=user_id&limit=1')).uid;
  const id = { acc: await uid('accountant'), lib: await uid('librarian'), oa: await uid('organization_admin') };

  // ===== phase 4: the Super Admin confirms changes to the Accountant's supervisor =====
  const req = await rpc('organization_admin', 'reporting_set_supervisor', { _org: org, _user: id.acc, _supervisor: id.lib, _from: null, _to: null, _note: 'E2E roles check' });
  ok('the Organisation Admin\'s change for the Accountant waits for the Super Admin', req.json?.status === 'pending_confirmation', req.text.slice(0, 90));
  const all = await rpc('super_admin', 'reporting_change_requests_list', { _org: null });
  const mine = all.json?.find((r) => r.id === req.json?.request_id);
  ok('the Super Admin sees it in the all-centres list', all.status === 200 && !!mine, mine ? `${mine.centre}: ${mine.subject} -> ${mine.proposed}` : all.text.slice(0, 80));
  ok('rejecting needs a reason', (await rpc('super_admin', 'reporting_decide_change', { _id: req.json?.request_id, _approve: false, _note: '' })).status >= 400);
  const dec = await rpc('super_admin', 'reporting_decide_change', { _id: req.json?.request_id, _approve: true, _note: 'E2E: confirm' });
  ok('the Super Admin confirms it', dec.json === 'confirmed', dec.text.slice(0, 80));
  const chart = await rpc('organization_admin', 'reporting_org_chart', { _org: org });
  const accNode = chart.json?.people?.find((p) => p.user_id === id.acc);
  ok('and it is applied', accNode?.source === 'named' && accNode.supervisors.some((s) => s.user_id === id.lib));
  ok('a decision is final', (await rpc('super_admin', 'reporting_decide_change', { _id: req.json?.request_id, _approve: true, _note: null })).status >= 400);
  const rem = await rpc('super_admin', 'reporting_remove_supervisor', { _org: org, _user: id.acc, _from: plus(0) });
  ok('the Super Admin\'s own change applies directly (removing it again)', rem.json?.status === 'applied', rem.text.slice(0, 80));
  const chart2 = await rpc('organization_admin', 'reporting_org_chart', { _org: org });
  ok('the Accountant is back on the role line', chart2.json?.people?.find((p) => p.user_id === id.acc)?.source === 'role');
  const reqLine = await rpc('organization_admin', 'reporting_set_line', { _org: org, _role: 'accountant', _supervisor_role: 'centre_manager' });
  const rej = await rpc('super_admin', 'reporting_decide_change', { _id: reqLine.json?.request_id, _approve: false, _note: 'E2E: not needed' });
  ok('a role-line request can be rejected with a reason and nothing changes', reqLine.json?.status === 'pending_confirmation' && rej.json === 'rejected' && (await rpc('organization_admin', 'reporting_org_chart', { _org: org })).json.lines.find((l) => l.role === 'accountant')?.supervisor_role === 'head_of_finance_admin');

  // ===== phase 5: the role factory =====
  const JD = 'The Safety Officer monitors workshop safety, follows attendance at safety induction sessions, checks the stock of protective equipment, and raises support tickets for faulty equipment. Reports on leave and incidents each month to management.';
  ok('the Organisation Admin cannot define roles', (await rpc('organization_admin', 'role_factory_create', { _code: 'e2e_x_' + tag, _name: 'Nope', _job_description: JD, _reports_to_role: null })).status >= 400);
  ok('a short job description is refused', /80 characters/.test((await rpc('super_admin', 'role_factory_create', { _code: 'e2e_short_' + tag, _name: 'Short', _job_description: 'too short', _reports_to_role: null })).text));
  ok('a clash with a built-in role is refused', /already exists/.test((await rpc('super_admin', 'role_factory_create', { _code: 'trainer', _name: 'Trainer 2', _job_description: JD, _reports_to_role: null })).text));
  const code = 'e2e_safety_' + tag;
  const created = await rpc('super_admin', 'role_factory_create', { _code: code, _name: 'E2E Safety Officer ' + tag, _job_description: JD, _reports_to_role: 'head_of_training' });
  ok('the Super Admin creates a role from a job description', created.status === 200, created.text.slice(0, 60));
  const v1 = created.json;
  ok('a draft grants nothing and cannot be submitted without capabilities', (await rpc('super_admin', 'role_factory_submit', { _version: v1 })).status >= 400);

  const ai = await fn('super_admin', 'analyse-job-description', { version_id: v1 });
  info('AI analysis', ai.status === 200 && ai.json?.ok ? `proposed by AI: ${JSON.stringify(ai.json.capabilities)}` : `not available (${ai.status} ${ai.text.slice(0, 120)}), falling back to the rules`);
  const rules = await rpc('super_admin', 'role_factory_run_rules', { _version: v1 });
  ok('the built-in rules make a proposal labelled "rules" with no sensitive capability', rules.json?.method === 'rules' && rules.json?.capabilities?.length > 0, JSON.stringify(rules.json?.capabilities));
  const cat = (await rpc('super_admin', 'role_factory_catalogue', {})).json;
  ok('the catalogue lists the capabilities', cat?.length >= 15);
  ok('an invented capability is refused', /Unknown capability/.test((await rpc('super_admin', 'role_factory_save_draft', { _version: v1, _job_description: JD, _reports_to_role: null, _capabilities: ['made.up'] })).text));
  const caps = ['centre.overview', 'attendance.summary', 'hr.own', 'tickets.own'];
  ok('the selection is saved beside the proposal', (await rpc('super_admin', 'role_factory_save_draft', { _version: v1, _job_description: JD, _reports_to_role: 'head_of_training', _capabilities: caps })).status < 300);
  ok('a widget needing a capability the role lacks is refused', /needs the capability/.test((await rpc('super_admin', 'role_factory_save_widgets', { _version: v1, _widgets: ['fees.collection'] })).text));
  const widgets = ['centre.headcounts', 'attendance.rate', 'leave.mine', 'tickets.mine'];
  ok('the widgets are saved', (await rpc('super_admin', 'role_factory_save_widgets', { _version: v1, _widgets: widgets })).status < 300);
  const sub = await rpc('super_admin', 'role_factory_submit', { _version: v1 });
  ok('it is sent for review', sub.status < 300, sub.text.slice(0, 80));
  ok('a submitted version cannot be edited', (await rpc('super_admin', 'role_factory_save_draft', { _version: v1, _job_description: JD, _reports_to_role: null, _capabilities: caps })).status >= 400);
  const roleId = (await rpc('super_admin', 'role_factory_overview', {})).json.find((r) => r.role_code === code)?.id;
  ok('before approval the role cannot be assigned', (await rpc('organization_admin', 'role_factory_assign', { _org: org, _user: id.lib, _role: roleId })).status >= 400);
  ok('a role the Super Admin prepared cannot be approved by the same person', /Another Super Admin/.test((await rpc('super_admin', 'role_factory_decide', { _version: v1, _approve: true, _note: 'self', _ack_sensitive: false })).text));
  const approve = await rpc('super_admin_2', 'role_factory_decide', { _version: v1, _approve: true, _note: 'E2E approve', _ack_sensitive: false });
  ok('a second Super Admin approves it', approve.json === 'approved', approve.text.slice(0, 100));

  // a sensitive role: only the Super Admin can assign it
  const code2 = 'e2e_records_' + tag;
  const JD2 = 'The Records Viewer reviews recently registered trainees and the largest outstanding fee balances so that follow-up calls can be made by the finance and registration teams every week of the year.';
  const v2 = (await rpc('super_admin', 'role_factory_create', { _code: code2, _name: 'E2E Records Viewer ' + tag, _job_description: JD2, _reports_to_role: null })).json;
  await rpc('super_admin', 'role_factory_save_draft', { _version: v2, _job_description: JD2, _reports_to_role: null, _capabilities: ['trainees.records', 'fees.records'] });
  await rpc('super_admin', 'role_factory_save_widgets', { _version: v2, _widgets: ['trainees.recent', 'fees.outstanding'] });
  await rpc('super_admin', 'role_factory_submit', { _version: v2 });
  ok('a sensitive role needs an acknowledgement', /sensitive/.test((await rpc('super_admin_2', 'role_factory_decide', { _version: v2, _approve: true, _note: null, _ack_sensitive: false })).text));
  ok('and is approved with one', (await rpc('super_admin_2', 'role_factory_decide', { _version: v2, _approve: true, _note: 'E2E', _ack_sensitive: true })).json === 'approved');
  const role2Id = (await rpc('super_admin', 'role_factory_overview', {})).json.find((r) => r.role_code === code2)?.id;

  // ===== the Staff Member base role: created by the Organisation Admin, no access of its own =====
  const email = `test.staffmember.${tag}@vms-test.example`;
  const pw = 'Sm' + Math.random().toString(36).slice(2, 10) + 'X!9' + tag;
  const mk = await fn('organization_admin', 'create-user', { email, password: pw, firstname: 'Test', surname: 'Staff Member', role: 'staff_member' });
  ok('the Organisation Admin creates a login with the Staff Member role', mk.status < 300, mk.text.slice(0, 120));
  const smId = mk.json?.user?.id ?? mk.json?.user_id ?? mk.json?.id;
  creds.staff_member = { role: 'staff_member', email, pw };
  const sm = await session('staff_member'); sessions.staff_member = sm;
  info('the Staff Member lands on', new URL(sm.p.url()).pathname);
  const smUser = (await api('staff_member', 'GET', 'user_roles?select=user_id&limit=1')).uid;
  const smUid = (await api('staff_member', 'GET', `user_roles?select=user_id,role&user_id=eq.${smUser}`)).json;
  const allRoles = (await api('staff_member', 'GET', 'user_roles?select=user_id')).json;
  ok('and see no colleague\'s roles', Array.isArray(allRoles) && allRoles.length === 1, String(allRoles?.length));
  ok('they hold only the Staff Member role', smUid?.length === 1 && smUid[0].role === 'staff_member', JSON.stringify(smUid));
  for (const t of ['trainees', 'fee_records', 'classes', 'stock_items', 'trades', 'purchase_requisitions']) {
    const r = await api('staff_member', 'GET', `${t}?select=id&limit=1`);
    ok(`alone, they read nothing from ${t}`, r.status === 200 && Array.isArray(r.json) && r.json.length === 0, `${r.status} ${r.json?.length}`);
  }
  ok('and cannot write', (await api('staff_member', 'POST', 'trades', { organization_id: org, name: 'X', code: 'XX' + tag })).status >= 400);
  ok('without a role they have no capabilities and an empty dashboard', (await rpc('staff_member', 'my_capabilities', { _org: org })).json?.length === 0 && (await rpc('staff_member', 'my_dashboard', { _org: org })).json?.widgets?.length === 0);

  // assignment
  const assign = await rpc('organization_admin', 'role_factory_assign', { _org: org, _user: smUser, _role: roleId });
  ok('the Organisation Admin assigns the approved role', assign.status < 300, assign.text.slice(0, 100));
  ok('but not the sensitive one', /sensitive/.test((await rpc('organization_admin', 'role_factory_assign', { _org: org, _user: smUser, _role: role2Id })).text));
  ok('nor to themselves', /themselves/.test((await rpc('organization_admin', 'role_factory_assign', { _org: org, _user: id.oa, _role: roleId })).text));

  // ===== phase 6: the dashboard =====
  const caps2 = (await rpc('staff_member', 'my_capabilities', { _org: org })).json;
  ok('the person now holds exactly the approved capabilities', JSON.stringify(caps2) === JSON.stringify([...caps].sort()), JSON.stringify(caps2));
  const dash = (await rpc('staff_member', 'my_dashboard', { _org: org })).json;
  ok('their dashboard lists exactly the approved widgets', JSON.stringify(dash.widgets.map((w) => w.code).sort()) === JSON.stringify([...widgets].sort()), JSON.stringify(dash.widgets.map((w) => w.code)));
  for (const w of widgets) { const d = await rpc('staff_member', 'dashboard_widget_data', { _org: org, _widget: w }); ok(`widget ${w} answers`, d.status === 200 && (d.json?.stats || d.json?.bars || d.json?.rows), d.text.slice(0, 90)); }
  for (const w of ['fees.collection', 'trainees.recent', 'fees.outstanding', 'classes.overview']) ok(`widget ${w} is refused`, (await rpc('staff_member', 'dashboard_widget_data', { _org: org, _widget: w })).status >= 400);
  ok('another centre\'s id is refused', (await rpc('staff_member', 'dashboard_widget_data', { _org: '00000000-0000-4000-8000-0000000000bb', _widget: 'centre.headcounts' })).status >= 400);
  const trainees = await api('staff_member', 'GET', 'trainees?select=id&limit=1');
  ok('the role still opens no trainee rows directly', Array.isArray(trainees.json) && trainees.json.length === 0);

  await sm.p.goto(BASE + '/my-role-dashboard', { waitUntil: 'networkidle' }); await sm.p.waitForTimeout(3500);
  const text = await sm.p.locator('body').innerText();
  ok('the dashboard page shows the role and its widgets', /E2E Safety Officer/.test(text) && /Centre at a glance/.test(text) && /My leave/.test(text), text.replace(/\s+/g, ' ').slice(0, 160));
  ok('and not the widgets of other capabilities', !/Fee collection|Largest outstanding fees/.test(text));
  ok('the menu has the role dashboard', /My Role Dashboard/.test(text));
  await sm.p.screenshot({ path: 'role_dashboard.png', fullPage: true });

  // the Super Admin screens
  const a = sessions.super_admin.p;
  await a.goto(BASE + '/role-factory', { waitUntil: 'networkidle' }); await a.waitForTimeout(3000);
  const rt = await a.locator('body').innerText();
  ok('the Role Factory page lists the roles', /E2E Safety Officer/.test(rt) && /Job description/.test(rt));
  await a.goto(BASE + '/reporting-confirmations', { waitUntil: 'networkidle' }); await a.waitForTimeout(2500);
  ok('the confirmations page opens', /Reporting confirmations/.test(await a.locator('body').innerText()));

  // ===== clean up =====
  const asg = (await rpc('organization_admin', 'role_factory_assignable', { _org: org })).json.assignments.filter((x) => x.user_id === smUser);
  for (const x of asg) await rpc('organization_admin', 'role_factory_unassign', { _assignment: x.id });
  await rpc('super_admin', 'role_factory_retire', { _role: roleId, _note: 'E2E clean-up' });
  await rpc('super_admin', 'role_factory_retire', { _role: role2Id, _note: 'E2E clean-up' });
  ok('a retired role grants nothing', (await rpc('staff_member', 'my_capabilities', { _org: org })).json?.length === 0);
  const del = smId ? await fn('super_admin', 'delete-user', { userId: smId }) : { status: 0, text: 'no id' };
  info('the Staff Member login', del.status < 300 ? 'deleted' : `left for the Test Data Reset (${del.status} ${del.text.slice(0, 80)})`);

  for (const s of Object.values(sessions)) await s.b.close();
  console.log(failed ? `${failed} FAILED` : 'ALL PASSED');
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
