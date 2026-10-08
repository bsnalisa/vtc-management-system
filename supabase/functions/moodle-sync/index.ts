import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';

// Connects a class to a Moodle course: lists courses, enrols the class's trainees, imports their grades.
// Secrets:  MOODLE_URL (e.g. https://moodle.example.org), MOODLE_TOKEN (a web-service token),
//           MOODLE_STUDENT_ROLE_ID (optional, default 5).
// The Moodle web-service user needs these functions enabled:
//   core_webservice_get_site_info, core_course_get_courses, core_user_get_users_by_field, core_user_create_users,
//   enrol_manual_enrol_users, gradereport_user_get_grade_items
// Callers must be signed in as admin, organization_admin, head_of_training or hod of the class's centre.
// NOTE: written against Moodle's documented REST API but not yet exercised against a live Moodle site.

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

class MoodleError extends Error {}

// deno-lint-ignore no-explicit-any
async function moodle(fn: string, params: Record<string, unknown> = {}): Promise<any> {
  const base = (Deno.env.get('MOODLE_URL') ?? '').replace(/\/+$/, '');
  const token = Deno.env.get('MOODLE_TOKEN');
  if (!base || !token) throw new MoodleError('MOODLE_URL and MOODLE_TOKEN are not configured');
  const body = new URLSearchParams({ wstoken: token, wsfunction: fn, moodlewsrestformat: 'json' });
  // Moodle expects PHP-style nested parameters: a[0][b]=c
  const flatten = (prefix: string, v: unknown) => {
    if (Array.isArray(v)) v.forEach((x, i) => flatten(`${prefix}[${i}]`, x));
    else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) flatten(`${prefix}[${k}]`, x);
    else if (v !== undefined && v !== null) body.append(prefix, String(v));
  };
  for (const [k, v] of Object.entries(params)) flatten(k, v);
  const res = await fetch(`${base}/webservice/rest/server.php`, { method: 'POST', body });
  if (!res.ok) throw new MoodleError(`Moodle answered HTTP ${res.status}`);
  const data = await res.json();
  if (data && typeof data === 'object' && 'exception' in data) throw new MoodleError(`${data.errorcode ?? 'error'}: ${data.message ?? data.exception}`);
  return data;
}

const NO_ROWS = ['00000000-0000-0000-0000-000000000000'];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  const { data: userData, error: userErr } = await admin.auth.getUser(jwt);
  if (userErr || !userData.user) return json({ error: 'Sign in first' }, 401);
  const uid = userData.user.id;

  // deno-lint-ignore no-explicit-any
  let input: any;
  try { input = await req.json(); } catch { return json({ error: 'Invalid request' }, 400); }
  const action = String(input.action ?? '');

  const { data: org } = await admin.rpc('get_user_organization', { _user_id: uid });
  if (!org) return json({ error: 'No centre for this account' }, 403);
  const { data: allowed } = await admin.rpc('has_org_role', { _user_id: uid, _org: org, _roles: ['admin', 'organization_admin', 'head_of_training', 'hod'] });
  if (!allowed) return json({ error: 'Not authorised' }, 403);

  try {
    if (action === 'test') {
      const info = await moodle('core_webservice_get_site_info');
      return json({ ok: true, site: info.sitename, release: info.release, user: info.username, functions: (info.functions ?? []).length });
    }
    if (action === 'courses') {
      const list = await moodle('core_course_get_courses');
      // deno-lint-ignore no-explicit-any
      return json({ courses: (list as any[]).filter((c) => c.id !== 1).map((c) => ({ id: c.id, name: c.fullname, shortname: c.shortname })) });
    }

    // everything below works on one class of this centre
    const classId = String(input.class_id ?? '');
    const { data: cls } = await admin.from('classes').select('id, organization_id').eq('id', classId).maybeSingle();
    if (!cls || cls.organization_id !== org) return json({ error: 'Class not found' }, 404);

    if (action === 'link') {
      const courseId = Number(input.moodle_course_id);
      if (!Number.isInteger(courseId) || courseId <= 0) return json({ error: 'Choose a Moodle course' }, 400);
      const list = await moodle('core_course_get_courses', { options: { ids: [courseId] } });
      if (!Array.isArray(list) || !list.length) return json({ error: 'That course does not exist in Moodle' }, 404);
      const { error } = await admin.from('moodle_course_links').upsert(
        { organization_id: org, class_id: classId, moodle_course_id: courseId, moodle_course_name: list[0].fullname, linked_by: uid, linked_at: new Date().toISOString() },
        { onConflict: 'class_id' });
      if (error) return json({ error: error.message }, 500);
      return json({ ok: true, course: list[0].fullname });
    }

    const { data: link } = await admin.from('moodle_course_links').select('*').eq('class_id', classId).maybeSingle();
    if (!link) return json({ error: 'Link this class to a Moodle course first' }, 400);

    const { data: enrolments } = await admin.from('class_enrollments').select('trainee_id').eq('class_id', classId).eq('status', 'active');
    // deno-lint-ignore no-explicit-any
    const ids: string[] = (enrolments ?? []).map((e: any) => e.trainee_id);
    const { data: trainees } = ids.length
      ? await admin.from('trainees').select('id, trainee_id, first_name, last_name, email').in('id', ids)
      : { data: [] };

    if (action === 'enrol') {
      const roleId = Number(Deno.env.get('MOODLE_STUDENT_ROLE_ID') ?? '5');
      const { data: known } = await admin.from('moodle_user_links').select('trainee_id, moodle_user_id').in('trainee_id', ids.length ? ids : NO_ROWS);
      // deno-lint-ignore no-explicit-any
      const moodleIds = new Map<string, number>((known ?? []).map((k: any) => [k.trainee_id, k.moodle_user_id]));
      const result = { enrolled: 0, created: 0, skipped: [] as string[] };
      const toEnrol: { roleid: number; userid: number; courseid: number }[] = [];
      for (const t of trainees ?? []) {
        try {
          let mid = moodleIds.get(t.id);
          if (!mid) {
            if (!t.email) { result.skipped.push(`${t.trainee_id}: no email address`); continue; }
            const found = await moodle('core_user_get_users_by_field', { field: 'email', values: [t.email] });
            if (Array.isArray(found) && found.length) mid = found[0].id;
            else {
              const made = await moodle('core_user_create_users', { users: [{
                username: String(t.trainee_id).toLowerCase().replace(/[^a-z0-9._-]/g, ''), createpassword: 1,
                firstname: t.first_name, lastname: t.last_name, email: t.email, auth: 'manual' }] });
              mid = made[0].id; result.created++;
            }
            await admin.from('moodle_user_links').upsert({ organization_id: org, trainee_id: t.id, moodle_user_id: mid }, { onConflict: 'trainee_id' });
          }
          toEnrol.push({ roleid: roleId, userid: mid as number, courseid: link.moodle_course_id });
        } catch (e) {
          result.skipped.push(`${t.trainee_id}: ${e instanceof Error ? e.message : String(e)}`);
        }
      }
      if (toEnrol.length) { await moodle('enrol_manual_enrol_users', { enrolments: toEnrol }); result.enrolled = toEnrol.length; }
      await admin.from('moodle_course_links').update({ last_enrol_at: new Date().toISOString() }).eq('id', link.id);
      return json(result);
    }

    if (action === 'grades') {
      const { data: users } = await admin.from('moodle_user_links').select('trainee_id, moodle_user_id').in('trainee_id', ids.length ? ids : NO_ROWS);
      let imported = 0;
      const problems: string[] = [];
      for (const u of users ?? []) {
        try {
          const r = await moodle('gradereport_user_get_grade_items', { courseid: link.moodle_course_id, userid: u.moodle_user_id });
          const items = r?.usergrades?.[0]?.gradeitems ?? [];
          // deno-lint-ignore no-explicit-any
          const rows = items.filter((g: any) => g.itemname).map((g: any) => ({
            organization_id: org, class_id: classId, trainee_id: u.trainee_id, item_name: String(g.itemname),
            grade: g.graderaw === null || g.graderaw === undefined ? null : Number(g.graderaw),
            grade_max: g.grademax === undefined ? null : Number(g.grademax),
            percentage: g.percentageformatted ?? null, imported_at: new Date().toISOString() }));
          if (rows.length) {
            const { error } = await admin.from('moodle_grade_imports').upsert(rows, { onConflict: 'class_id,trainee_id,item_name' });
            if (error) throw new Error(error.message);
            imported += rows.length;
          }
        } catch (e) {
          problems.push(`${u.trainee_id}: ${e instanceof Error ? e.message : String(e)}`);
        }
      }
      await admin.from('moodle_course_links').update({ last_grades_at: new Date().toISOString() }).eq('id', link.id);
      return json({ imported, problems });
    }

    return json({ error: 'Unknown action' }, 400);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return json({ error: message }, e instanceof MoodleError ? 502 : 500);
  }
});
