// Creates (or links) the applicant account for an application that staff captured at the centre.
// The applicant signs in with the application's email, follows the status on the applicant dashboard,
// and screening carries on as usual.
import { identifyCaller, hasRoleAt, serviceClient, jsonResponse } from '../_shared/caller.ts'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-dispatch-secret',
}

const tempPassword = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'
  const b = crypto.getRandomValues(new Uint8Array(10))
  return Array.from(b, (x) => chars[x % chars.length]).join('') + 'a7'
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors })
  try {
    const admin = serviceClient()
    const caller = await identifyCaller(req, admin)
    if (!caller) return jsonResponse({ success: false, error: 'Unauthorized' }, 401, cors)

    const { application_id } = await req.json()
    if (!application_id) return jsonResponse({ success: false, error: 'application_id is required' }, 400, cors)

    const { data: app } = await admin.from('trainee_applications')
      .select('id, organization_id, email, first_name, last_name, phone, applicant_user_id, application_number')
      .eq('id', application_id).maybeSingle()
    if (!app) return jsonResponse({ success: false, error: 'Application not found' }, 404, cors)

    // Capturing applications is the registration officer's work, at their own centre
    if (!hasRoleAt(caller, app.organization_id, ['registration_officer'])) {
      return jsonResponse({ success: false, error: 'Only a registration officer of this centre can do this' }, 403, cors)
    }

    const email = (app.email ?? '').trim().toLowerCase()
    if (!email) return jsonResponse({ success: false, error: 'The application has no email address to create an account with' }, 400, cors)

    if (app.applicant_user_id) {
      return jsonResponse({ success: true, existing: true, email, message: 'Applicant account already linked' }, 200, cors)
    }

    const password = tempPassword()
    let userId: string | null = null
    let created = false
    const { data: newUser, error: createError } = await admin.auth.admin.createUser({
      email, password, email_confirm: true,
      user_metadata: { firstname: app.first_name, surname: app.last_name, full_name: `${app.first_name} ${app.last_name}`, phone: app.phone, is_applicant: true },
    })
    if (newUser?.user) {
      userId = newUser.user.id
      created = true
    } else {
      // Email already registered: link the existing account instead of making a second one
      for (let page = 1; page <= 20 && !userId; page++) {
        const { data } = await admin.auth.admin.listUsers({ page, perPage: 1000 })
        const hit = data?.users?.find((u) => u.email?.toLowerCase() === email)
        if (hit) userId = hit.id
        if (!data?.users?.length || data.users.length < 1000) break
      }
      if (!userId) return jsonResponse({ success: false, error: createError?.message ?? 'Could not create the account' }, 400, cors)
    }

    const { error: linkError } = await admin.from('trainee_applications').update({ applicant_user_id: userId }).eq('id', app.id)
    if (linkError) return jsonResponse({ success: false, error: linkError.message }, 500, cors)

    return jsonResponse({
      success: true, existing: !created, email,
      temporary_password: created ? password : undefined,
      message: created ? 'Applicant account created' : 'Linked to the applicant\'s existing account',
    }, 200, cors)
  } catch (e) {
    return jsonResponse({ success: false, error: e instanceof Error ? e.message : 'Unexpected error' }, 500, cors)
  }
})
