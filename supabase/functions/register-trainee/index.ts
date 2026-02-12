import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface RegisterRequest {
  application_id: string
  qualification_id: string
  academic_year?: string
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    })

    // Verify authorization
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
    
    if (authError || !user) {
      return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Verify registration officer role
    const { data: userRole } = await supabaseAdmin
      .from('user_roles')
      .select('organization_id, role')
      .eq('user_id', user.id)
      .single()

    const allowedRoles = ['super_admin', 'organization_admin', 'registration_officer', 'admin']
    if (!userRole || !allowedRoles.includes(userRole.role)) {
      return new Response(JSON.stringify({ success: false, error: 'Insufficient permissions' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const body: RegisterRequest = await req.json()
    const { application_id, qualification_id, academic_year } = body

    if (!application_id || !qualification_id) {
      return new Response(JSON.stringify({ success: false, error: 'Missing required fields' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Get application
    const { data: application, error: appError } = await supabaseAdmin
      .from('trainee_applications')
      .select('*')
      .eq('id', application_id)
      .single()

    if (appError || !application) {
      return new Response(JSON.stringify({ success: false, error: 'Application not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Verify organization
    if (application.organization_id !== userRole.organization_id && userRole.role !== 'super_admin') {
      return new Response(JSON.stringify({ success: false, error: 'Cannot register trainees from other organizations' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // ========================================
    // STRICT STATUS CHECK: Must be PROVISIONALLY_ADMITTED
    // ========================================
    if (application.registration_status !== 'provisionally_admitted') {
      return new Response(JSON.stringify({ 
        success: false, 
        error: `Cannot register: application status is '${application.registration_status}'. ` +
               `Expected 'provisionally_admitted'. Application fee must be cleared first.`,
        current_status: application.registration_status,
        required_status: 'provisionally_admitted',
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Verify trainee_number exists
    if (!application.trainee_number) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Trainee number not found. Application fee must be cleared first to create trainee identity.' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Verify trainee record exists
    const { data: trainee, error: traineeError } = await supabaseAdmin
      .from('trainees')
      .select('id')
      .eq('trainee_id', application.trainee_number)
      .eq('organization_id', application.organization_id)
      .single()

    if (traineeError || !trainee) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Trainee record not found. Ensure application fee was cleared first.' 
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // ========================================
    // CAPACITY CHECKS
    // ========================================
    const { data: qualification, error: qualError } = await supabaseAdmin
      .from('qualifications')
      .select('id, qualification_title, trade_id')
      .eq('id', qualification_id)
      .single()

    if (qualError || !qualification) {
      return new Response(JSON.stringify({ success: false, error: 'Qualification not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (qualification.trade_id && application.trade_id && qualification.trade_id !== application.trade_id) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Qualification does not belong to the trade the trainee applied for.' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Log hostel request - room allocation is separate
    if (application.needs_hostel_accommodation) {
      console.log(`Trainee requested hostel accommodation. Room allocation will be handled separately.`)
    }

    // ========================================
    // CREATE REGISTRATION RECORD
    // ========================================
    const currentYear = new Date().getFullYear().toString()

    const { data: registration, error: regError } = await supabaseAdmin
      .from('registrations')
      .insert({
        organization_id: application.organization_id,
        trainee_id: trainee.id,
        application_id: application_id,
        qualification_id,
        academic_year: academic_year || currentYear,
        hostel_required: application.needs_hostel_accommodation || false,
        registration_status: 'fee_pending',
        registered_by: user.id,
      })
      .select()
      .single()

    if (regError) {
      console.error('Registration error:', regError)
      return new Response(JSON.stringify({ success: false, error: regError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // ========================================
    // CREATE FINANCIAL QUEUE ENTRIES
    // ALWAYS create REG_FEE (day scholar - mandatory gate for registration)
    // If hostel requested, ALSO create separate HOSTEL fee (non-blocking)
    // ========================================

    // 1. MANDATORY: Day scholar registration fee (REG_FEE) - gates registration
    const { data: regFee } = await supabaseAdmin
      .from('fee_types')
      .select('id, default_amount')
      .eq('organization_id', application.organization_id)
      .eq('code', 'REG_FEE')
      .eq('active', true)
      .maybeSingle()

    if (regFee) {
      const { error: regQueueError } = await supabaseAdmin.from('financial_queue').insert({
        organization_id: application.organization_id,
        entity_type: 'REGISTRATION',
        entity_id: registration.id,
        fee_type_id: regFee.id,
        amount: regFee.default_amount || 500,
        amount_paid: 0,
        status: 'pending',
        description: `Registration fee (Day Scholar) for ${application.first_name} ${application.last_name}`,
        requested_by: user.id,
      })
      if (regQueueError) {
        console.error('Failed to create REG_FEE queue entry:', regQueueError)
      } else {
        console.log(`Created REG_FEE (Day Scholar) in financial_queue for registration ${registration.id}`)
      }
    } else {
      console.warn(`No REG_FEE fee type found for organization ${application.organization_id}`)
    }

    // 2. OPTIONAL: Hostel registration fee (REG_FEE_HOST) - non-blocking, added to trainee account
    if (application.needs_hostel_accommodation) {
      const { data: hostelFee } = await supabaseAdmin
        .from('fee_types')
        .select('id, default_amount')
        .eq('organization_id', application.organization_id)
        .eq('code', 'REG_FEE_HOST')
        .eq('active', true)
        .maybeSingle()

      if (hostelFee) {
        const { error: hostelQueueError } = await supabaseAdmin.from('financial_queue').insert({
          organization_id: application.organization_id,
          entity_type: 'HOSTEL',
          entity_id: registration.id,
          fee_type_id: hostelFee.id,
          amount: hostelFee.default_amount || 1500,
          amount_paid: 0,
          status: 'pending',
          description: `Hostel accommodation fee for ${application.first_name} ${application.last_name}`,
          requested_by: user.id,
        })
        if (hostelQueueError) {
          console.error('Failed to create HOSTEL fee queue entry:', hostelQueueError)
        } else {
          console.log(`Created HOSTEL fee in financial_queue for registration ${registration.id}`)
        }
      } else {
        console.warn(`No REG_FEE_HOST fee type found for organization ${application.organization_id}`)
      }
    }

    // ========================================
    // UPDATE APPLICATION STATUS TO REGISTRATION_FEE_PENDING
    // ========================================
    const { error: statusUpdateError } = await supabaseAdmin
      .from('trainee_applications')
      .update({
        registration_status: 'registration_fee_pending',
        hostel_application_status: application.needs_hostel_accommodation ? 'applied' : 'not_applied',
      })
      .eq('id', application_id)

    if (statusUpdateError) {
      console.error('Failed to update application status:', statusUpdateError)
    }

    console.log(`Trainee ${trainee.id} registered for qualification ${qualification_id}, registration_id: ${registration.id}, status: REGISTRATION_FEE_PENDING`)

    return new Response(JSON.stringify({ 
      success: true,
      message: 'Trainee registered - awaiting registration fee payment (REGISTRATION_FEE_PENDING)',
      registration_id: registration.id,
      registration_status: 'fee_pending',
      trainee_number: application.trainee_number,
      hostel_fee_created: application.needs_hostel_accommodation || false,
      next_step: 'Clear day scholar registration fee to complete enrollment. Hostel fee is a separate obligation.',
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    console.error('Error in register-trainee:', error)
    return new Response(JSON.stringify({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})