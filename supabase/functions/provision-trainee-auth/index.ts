import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Default password for all new trainees
const DEFAULT_TRAINEE_PASSWORD = 'Password1'

interface ProvisionRequest {
  trainee_id?: string;
  application_id?: string;
  force_provision?: boolean;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    // Verify the requesting user has admin permissions
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'No authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
    
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Get user's role and organization
    const { data: userRole, error: roleError } = await supabaseAdmin
      .from('user_roles')
      .select('organization_id, role')
      .eq('user_id', user.id)
      .single()

    if (roleError) {
      return new Response(JSON.stringify({ error: 'Failed to verify permissions' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Check if user has permission to provision trainees
    const allowedRoles = ['super_admin', 'organization_admin', 'registration_officer', 'admin']
    if (!allowedRoles.includes(userRole?.role)) {
      return new Response(JSON.stringify({ error: 'Insufficient permissions' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const requestBody: ProvisionRequest = await req.json()
    const { trainee_id, application_id, force_provision } = requestBody

    if (!trainee_id && !application_id) {
      return new Response(JSON.stringify({ error: 'Either trainee_id or application_id is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    let traineeData: any = null
    let systemEmail: string | null = null
    let organizationId: string | null = null

    if (trainee_id) {
      // Get trainee data
      const { data, error } = await supabaseAdmin
        .from('trainees')
        .select('*, organizations(name, email_domain)')
        .eq('id', trainee_id)
        .single()

      if (error || !data) {
        return new Response(JSON.stringify({ error: 'Trainee not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      traineeData = data
      systemEmail = data.system_email
      organizationId = data.organization_id

      // Check if trainee already has a user account
      if (data.user_id && !force_provision) {
        return new Response(JSON.stringify({ 
          success: true, 
          message: 'Trainee already has an account',
          user_id: data.user_id,
          email: systemEmail
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
    } else if (application_id) {
      // Get application data
      const { data, error } = await supabaseAdmin
        .from('trainee_applications')
        .select('*, organizations(name, email_domain)')
        .eq('id', application_id)
        .single()

      if (error || !data) {
        return new Response(JSON.stringify({ error: 'Application not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      traineeData = data
      systemEmail = data.system_email
      organizationId = data.organization_id

      // Check if application already has a user account
      if (data.user_id && !force_provision) {
        return new Response(JSON.stringify({ 
          success: true, 
          message: 'Application already has an account',
          user_id: data.user_id,
          email: systemEmail
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
    }

    if (!systemEmail) {
      return new Response(JSON.stringify({ 
        error: 'No system email available. Ensure trainee has a trainee number and organization has email domain configured.' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Check if user with this email already exists
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers()
    const existingUser = existingUsers?.users?.find(u => u.email === systemEmail)

    let userId: string

    if (existingUser) {
      userId = existingUser.id
      console.log('User already exists with email:', systemEmail)
    } else {
      // Create auth user with default password
      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: systemEmail,
        password: DEFAULT_TRAINEE_PASSWORD,
        email_confirm: true,
        user_metadata: {
          firstname: traineeData.first_name,
          surname: traineeData.last_name,
          full_name: `${traineeData.first_name} ${traineeData.last_name}`,
          trainee_id: trainee_id || null,
          application_id: application_id || null,
          is_trainee: true,
          password_reset_required: true,
        },
      })

      if (createError) {
        console.error('Error creating user:', createError)
        return new Response(JSON.stringify({ error: createError.message }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      userId = newUser.user.id
      console.log('Created new user:', userId)
    }

    // Assign trainee role
    const { error: roleInsertError } = await supabaseAdmin
      .from('user_roles')
      .upsert({
        user_id: userId,
        role: 'trainee',
        organization_id: organizationId,
      }, {
        onConflict: 'user_id'
      })

    if (roleInsertError) {
      console.error('Error assigning role:', roleInsertError)
    }

    // Update trainee or application with user_id
    if (trainee_id) {
      await supabaseAdmin
        .from('trainees')
        .update({ 
          user_id: userId,
          password_reset_required: true 
        })
        .eq('id', trainee_id)
    }

    if (application_id) {
      await supabaseAdmin
        .from('trainee_applications')
        .update({ user_id: userId })
        .eq('id', application_id)
    }

    return new Response(JSON.stringify({ 
      success: true, 
      user_id: userId,
      email: systemEmail,
      message: existingUser ? 'Account already existed, linked to trainee' : 'Account created with default password',
      password_reset_required: true
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    console.error('Error in provision-trainee-auth:', error)
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred'
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})