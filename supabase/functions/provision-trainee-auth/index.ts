import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Default password for all new trainees
const DEFAULT_TRAINEE_PASSWORD = 'Password1'

// Valid statuses that allow provisioning
const ALLOWED_QUALIFICATION_STATUSES = ['provisionally_qualified']
const ALLOWED_REGISTRATION_STATUSES = ['provisionally_admitted', 'pending_payment', 'payment_verified', 'payment_cleared', 'fully_registered', 'registered']

interface ProvisionRequest {
  trainee_id?: string
  application_id?: string
  trigger_type?: 'auto' | 'manual' | 'bulk'
  force_provision?: boolean
}

interface ProvisionResult {
  success: boolean
  user_id?: string
  email?: string
  message: string
  provisioning_status: 'auto_provisioned' | 'manually_provisioned' | 'failed' | 'skipped'
  error?: string
}

async function logProvisioningAttempt(
  supabaseAdmin: any,
  orgId: string | null,
  traineeId: string | null,
  applicationId: string | null,
  userId: string | null,
  email: string,
  triggerType: string,
  result: string,
  errorMessage: string | null = null,
  metadata: Record<string, any> = {}
) {
  try {
    await supabaseAdmin.from('provisioning_logs').insert({
      organization_id: orgId,
      trainee_id: traineeId,
      application_id: applicationId,
      user_id: userId,
      email,
      trigger_type: triggerType,
      result,
      error_message: errorMessage,
      metadata
    })
  } catch (e) {
    console.error('Failed to log provisioning attempt:', e)
  }
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
      return new Response(JSON.stringify({ 
        success: false,
        error: 'No authorization header',
        provisioning_status: 'failed'
      }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
    
    if (authError || !user) {
      return new Response(JSON.stringify({ 
        success: false,
        error: 'Unauthorized',
        provisioning_status: 'failed'
      }), {
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
      return new Response(JSON.stringify({ 
        success: false,
        error: 'Failed to verify permissions',
        provisioning_status: 'failed'
      }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Check if user has permission to provision trainees
    const allowedRoles = ['super_admin', 'organization_admin', 'registration_officer', 'admin']
    if (!allowedRoles.includes(userRole?.role)) {
      return new Response(JSON.stringify({ 
        success: false,
        error: 'Insufficient permissions',
        provisioning_status: 'failed'
      }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const requestBody: ProvisionRequest = await req.json()
    const { trainee_id, application_id, trigger_type = 'manual', force_provision } = requestBody

    if (!trainee_id && !application_id) {
      return new Response(JSON.stringify({ 
        success: false,
        error: 'Either trainee_id or application_id is required',
        provisioning_status: 'failed'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    let traineeData: any = null
    let systemEmail: string | null = null
    let traineeNumber: string | null = null
    let organizationId: string | null = null
    let qualificationStatus: string | null = null
    let registrationStatus: string | null = null
    let currentProvisioningStatus: string | null = null
    let existingUserId: string | null = null

    // ========================================
    // PRECONDITION CHECKS
    // ========================================

    if (trainee_id) {
      const { data, error } = await supabaseAdmin
        .from('trainees')
        .select('*, organizations(name, email_domain)')
        .eq('id', trainee_id)
        .single()

      if (error || !data) {
        await logProvisioningAttempt(
          supabaseAdmin, null, trainee_id, null, null,
          'unknown', trigger_type, 'failed', 'Trainee not found'
        )
        return new Response(JSON.stringify({ 
          success: false,
          error: 'Trainee not found',
          provisioning_status: 'failed'
        }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      traineeData = data
      systemEmail = data.system_email
      traineeNumber = data.trainee_id
      organizationId = data.organization_id
      currentProvisioningStatus = data.account_provisioning_status
      existingUserId = data.user_id
      // For trainees, we use status as 'active' which is always valid
      qualificationStatus = 'provisionally_qualified' // Trainees are already qualified
      registrationStatus = data.status || 'registered'

    } else if (application_id) {
      const { data, error } = await supabaseAdmin
        .from('trainee_applications')
        .select('*, organizations(name, email_domain)')
        .eq('id', application_id)
        .single()

      if (error || !data) {
        await logProvisioningAttempt(
          supabaseAdmin, null, null, application_id, null,
          'unknown', trigger_type, 'failed', 'Application not found'
        )
        return new Response(JSON.stringify({ 
          success: false,
          error: 'Application not found',
          provisioning_status: 'failed'
        }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      traineeData = data
      systemEmail = data.system_email
      traineeNumber = data.trainee_number
      organizationId = data.organization_id
      qualificationStatus = data.qualification_status
      registrationStatus = data.registration_status
      currentProvisioningStatus = data.account_provisioning_status
      existingUserId = data.user_id
    }

    // ========================================
    // GUARD: Check trainee_number exists
    // ========================================
    if (!traineeNumber) {
      const errorMsg = 'Trainee number not yet assigned'
      console.error('Precondition failed:', errorMsg)
      
      // Update provisioning status to failed
      if (application_id) {
        await supabaseAdmin
          .from('trainee_applications')
          .update({ account_provisioning_status: 'failed' })
          .eq('id', application_id)
      }
      
      await logProvisioningAttempt(
        supabaseAdmin, organizationId, trainee_id || null, application_id || null, null,
        systemEmail || 'no_email', trigger_type, 'failed', errorMsg
      )

      return new Response(JSON.stringify({ 
        success: false,
        error: errorMsg,
        provisioning_status: 'failed'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // ========================================
    // GUARD: Check system_email exists
    // ========================================
    if (!systemEmail) {
      const errorMsg = 'System email not generated. Ensure organization has email domain configured.'
      console.error('Precondition failed:', errorMsg)
      
      if (application_id) {
        await supabaseAdmin
          .from('trainee_applications')
          .update({ account_provisioning_status: 'failed' })
          .eq('id', application_id)
      }
      
      await logProvisioningAttempt(
        supabaseAdmin, organizationId, trainee_id || null, application_id || null, null,
        traineeNumber, trigger_type, 'failed', errorMsg
      )

      return new Response(JSON.stringify({ 
        success: false,
        error: errorMsg,
        provisioning_status: 'failed'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // ========================================
    // GUARD: Check qualification status is valid
    // ========================================
    if (!force_provision && qualificationStatus && !ALLOWED_QUALIFICATION_STATUSES.includes(qualificationStatus)) {
      const errorMsg = `Invalid qualification status for provisioning: ${qualificationStatus}. Must be one of: ${ALLOWED_QUALIFICATION_STATUSES.join(', ')}`
      console.error('Precondition failed:', errorMsg)
      
      if (application_id) {
        await supabaseAdmin
          .from('trainee_applications')
          .update({ account_provisioning_status: 'failed' })
          .eq('id', application_id)
      }
      
      await logProvisioningAttempt(
        supabaseAdmin, organizationId, trainee_id || null, application_id || null, null,
        systemEmail, trigger_type, 'failed', errorMsg
      )

      return new Response(JSON.stringify({ 
        success: false,
        error: errorMsg,
        provisioning_status: 'failed'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // ========================================
    // IDEMPOTENCY: Check if already provisioned
    // ========================================
    if (existingUserId && !force_provision) {
      // Already has an account - return success without creating duplicate
      console.log('Account already exists for:', systemEmail)
      
      await logProvisioningAttempt(
        supabaseAdmin, organizationId, trainee_id || null, application_id || null, existingUserId,
        systemEmail, trigger_type, 'skipped', 'Account already exists'
      )

      return new Response(JSON.stringify({ 
        success: true, 
        message: 'Account already exists',
        user_id: existingUserId,
        email: systemEmail,
        provisioning_status: currentProvisioningStatus || 'auto_provisioned'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // ========================================
    // IDEMPOTENCY: Check if auth user already exists by email
    // ========================================
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers()
    const existingUser = existingUsers?.users?.find(u => u.email === systemEmail)

    let userId: string
    let accountExisted = false

    if (existingUser) {
      userId = existingUser.id
      accountExisted = true
      console.log('Auth user already exists with email:', systemEmail)
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
        
        // Update provisioning status to failed
        if (application_id) {
          await supabaseAdmin
            .from('trainee_applications')
            .update({ account_provisioning_status: 'failed' })
            .eq('id', application_id)
        }
        if (trainee_id) {
          await supabaseAdmin
            .from('trainees')
            .update({ account_provisioning_status: 'failed' })
            .eq('id', trainee_id)
        }
        
        await logProvisioningAttempt(
          supabaseAdmin, organizationId, trainee_id || null, application_id || null, null,
          systemEmail, trigger_type, 'failed', createError.message
        )

        return new Response(JSON.stringify({ 
          success: false,
          error: createError.message,
          provisioning_status: 'failed'
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      userId = newUser.user.id
      console.log('Created new auth user:', userId)
    }

    // ========================================
    // ASSIGN TRAINEE ROLE
    // ========================================
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
      // Don't fail the whole operation for role assignment issues
    }

    // ========================================
    // UPDATE RECORDS WITH USER_ID AND PROVISIONING STATUS
    // ========================================
    const provisioningStatus = trigger_type === 'auto' ? 'auto_provisioned' : 'manually_provisioned'

    if (trainee_id) {
      await supabaseAdmin
        .from('trainees')
        .update({ 
          user_id: userId,
          password_reset_required: true,
          account_provisioning_status: provisioningStatus
        })
        .eq('id', trainee_id)
    }

    if (application_id) {
      await supabaseAdmin
        .from('trainee_applications')
        .update({ 
          user_id: userId,
          account_provisioning_status: provisioningStatus
        })
        .eq('id', application_id)
    }

    // ========================================
    // LOG SUCCESS
    // ========================================
    await logProvisioningAttempt(
      supabaseAdmin, organizationId, trainee_id || null, application_id || null, userId,
      systemEmail, trigger_type, 'success', null,
      { account_existed: accountExisted }
    )

    const result: ProvisionResult = {
      success: true,
      user_id: userId,
      email: systemEmail,
      message: accountExisted ? 'Account already existed, linked to trainee' : 'Account created with default password',
      provisioning_status: provisioningStatus
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    console.error('Error in provision-trainee-auth:', error)
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred'
    
    return new Response(JSON.stringify({ 
      success: false,
      error: errorMessage,
      provisioning_status: 'failed'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
