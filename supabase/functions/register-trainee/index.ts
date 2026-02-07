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
    // This status is only set AFTER application fee is cleared
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

    // Verify trainee_number exists (created during application fee clearance)
    if (!application.trainee_number) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Trainee number not found. Application fee must be cleared first to create trainee identity.' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Verify trainee record exists (created during application fee clearance)
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

    // Check qualification capacity
    const { data: qualification, error: qualError } = await supabaseAdmin
      .from('qualifications')
      .select('id, name, max_intake, current_enrollment')
      .eq('id', qualification_id)
      .single()

    if (qualError || !qualification) {
      return new Response(JSON.stringify({ success: false, error: 'Qualification not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Check if qualification has capacity limit and enforce it
    if (qualification.max_intake !== null && qualification.max_intake > 0) {
      const currentEnrollment = qualification.current_enrollment || 0
      if (currentEnrollment >= qualification.max_intake) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: `Qualification "${qualification.name}" has reached maximum capacity (${qualification.max_intake})` 
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
    }

    // Check hostel capacity if required
    if (application.needs_hostel_accommodation) {
      const { data: hostelCapacity, error: hostelError } = await supabaseAdmin
        .from('hostel_rooms')
        .select('id, capacity, current_occupancy')
        .eq('organization_id', application.organization_id)
        .eq('status', 'available')

      if (hostelError) {
        console.error('Hostel capacity check error:', hostelError)
      } else {
        const totalAvailable = (hostelCapacity || []).reduce((sum, room) => {
          return sum + (room.capacity - (room.current_occupancy || 0))
        }, 0)

        if (totalAvailable <= 0) {
          return new Response(JSON.stringify({ 
            success: false, 
            error: 'No hostel accommodation available. Please process as day scholar or wait for availability.' 
          }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }
      }
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
        registration_status: 'fee_pending', // REGISTRATION_FEE_PENDING
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
    // CREATE REGISTRATION FEE IN FINANCIAL_QUEUE
    // ========================================
    const { data: feeType } = await supabaseAdmin
      .from('fee_types')
      .select('id, amount')
      .eq('organization_id', application.organization_id)
      .ilike('name', '%registration%')
      .single()

    if (feeType) {
      await supabaseAdmin.from('financial_queue').insert({
        organization_id: application.organization_id,
        entity_type: 'REGISTRATION',
        entity_id: registration.id, // Use registration_id for REGISTRATION type
        fee_type_id: feeType.id,
        amount: feeType.amount || 0,
        status: 'pending',
        description: `Registration fee for ${application.first_name} ${application.last_name}`,
        requested_by: user.id,
      })
      console.log(`Created REGISTRATION fee in financial_queue for registration ${registration.id}`)
    } else {
      console.warn(`No registration fee type found for organization ${application.organization_id}`)
    }

    // ========================================
    // UPDATE APPLICATION STATUS
    // Status remains at provisionally_admitted until registration fee is cleared
    // ========================================
    await supabaseAdmin
      .from('trainee_applications')
      .update({
        hostel_application_status: application.needs_hostel_accommodation ? 'provisionally_allocated' : 'not_applied',
      })
      .eq('id', application_id)

    // Increment qualification enrollment count (reserve slot)
    if (qualification.max_intake !== null) {
      await supabaseAdmin
        .from('qualifications')
        .update({ 
          current_enrollment: (qualification.current_enrollment || 0) + 1 
        })
        .eq('id', qualification_id)
    }

    console.log(`Trainee ${trainee.id} registered for qualification ${qualification_id}, registration_id: ${registration.id}, status: REGISTRATION_FEE_PENDING`)

    return new Response(JSON.stringify({ 
      success: true,
      message: 'Trainee registered - awaiting registration fee payment (REGISTRATION_FEE_PENDING)',
      registration_id: registration.id,
      registration_status: 'fee_pending',
      trainee_number: application.trainee_number,
      next_step: 'Clear registration fee to complete enrollment',
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
