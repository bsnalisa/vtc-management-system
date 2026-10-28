// Creates a standard set of test logins (one per role) for a centre, so a reset can be followed by a fresh start. Super Admin only.
// Passwords are generated here and returned once in the response; they are never stored or logged.
import { identifyCaller, serviceClient } from '../_shared/caller.ts';

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

const ROLES = [
  'organization_admin', 'head_of_training', 'registration_officer', 'trainer', 'trainee', 'assessment_coordinator', 'debtor_officer',
  'hostel_coordinator', 'procurement_officer', 'stock_control_officer', 'asset_maintenance_coordinator', 'maintenance_coordinator', 'librarian',
  'printing_distribution_officer', 'subject_matter_expert', 'placement_officer', 'head_of_trainee_support', 'projects_coordinator', 'hr_officer',
  'bdl_coordinator', 'rpl_coordinator', 'liaison_officer', 'resource_center_coordinator', 'centre_manager', 'applicant', 'accountant',
  'head_of_finance_admin', 'creditors_officer', 'loan_officer', 'pa_to_centre_manager', 'staff_member',
];

function password(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (b) => chars[b % chars.length]).join('') + '!7';
}

const label = (role: string) => role.split('_').map((w) => w[0].toUpperCase() + w.slice(1)).join(' ');

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
  try {
    const admin = serviceClient();
    const caller = await identifyCaller(req, admin);
    if (!caller || caller.kind !== 'user' || !caller.roles.some((r) => r.role === 'super_admin')) return json({ error: 'Only the Super Admin can create test accounts' }, 403);

    const { organization_id, suffix } = await req.json();
    if (!organization_id) return json({ error: 'organization_id is required' }, 400);
    const { data: org } = await admin.from('organizations').select('id, name').eq('id', organization_id).maybeSingle();
    if (!org) return json({ error: 'Centre not found' }, 404);
    const tag = suffix ? `.${String(suffix).toLowerCase().replace(/[^a-z0-9]+/g, '')}` : '';

    const created: { role: string; email: string; password: string }[] = [];
    const skipped: { role: string; email: string; reason: string }[] = [];

    for (const role of ROLES) {
      const email = `test.${role.replace(/_/g, '.')}${tag}@vms-test.example`;
      const pw = password();
      const { data: made, error } = await admin.auth.admin.createUser({
        email, password: pw, email_confirm: true,
        user_metadata: { firstname: 'Test', surname: label(role), full_name: `Test ${label(role)}` },
      });
      if (error || !made.user) { skipped.push({ role, email, reason: error?.message ?? 'not created' }); continue; }
      const uid = made.user.id;

      const { error: roleError } = await admin.from('user_roles').insert({ user_id: uid, role, organization_id });
      if (roleError) { await admin.auth.admin.deleteUser(uid); skipped.push({ role, email, reason: roleError.message }); continue; }

      if (role === 'trainer') {
        await admin.from('trainers').insert({ user_id: uid, full_name: 'Test Trainer', email, designation: 'Instructor', employment_type: 'fulltime', gender: 'other', trainer_id: '', organization_id, active: true });
      }
      if (role === 'trainee') {
        const { data: trade } = await admin.from('trades').select('id').eq('organization_id', organization_id).limit(1).maybeSingle();
        if (!trade) { skipped.push({ role, email: `${email} (login created without a registration)`, reason: 'the centre has no trade to register the trainee in' }); }
        else {
          const { data: t, error: tErr } = await admin.from('trainees').insert({
            organization_id, first_name: 'Test', last_name: 'Trainee', gender: 'other', date_of_birth: '2000-01-01', national_id: `TEST-NID-${crypto.randomUUID().slice(0, 8)}`,
            phone: '0000000000', address: 'Test address', trade_id: trade.id, training_mode: 'fulltime', level: 1, academic_year: String(new Date().getFullYear()),
            trainee_id: 'x', user_id: uid, status: 'active',
          }).select('identity_id').single();
          if (tErr) skipped.push({ role, email: `${email} (login created without a registration)`, reason: tErr.message });
          else if (t?.identity_id) await admin.from('trainee_identities').update({ is_test: true }).eq('id', t.identity_id);
        }
      }
      created.push({ role, email, password: pw });
    }
    return json({ centre: org.name, created, skipped });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'Unknown error' }, 500);
  }
});
