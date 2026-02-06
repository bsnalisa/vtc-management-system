import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ScreenRequest {
  application_id: string
  qualification_status: 'provisionally_qualified' | 'does_not_qualify'
  screening_remarks?: string
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

    // Verify the requesting user
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

    // Verify user has registration officer or admin role
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

    const body: ScreenRequest = await req.json()
    const { application_id, qualification_status, screening_remarks } = body

    if (!application_id || !qualification_status) {
      return new Response(JSON.stringify({ success: false, error: 'Missing required fields' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Get application details
    const { data: application, error: appError } = await supabaseAdmin
      .from('trainee_applications')
      .select('*, organizations(name, email_domain, trainee_id_prefix)')
      .eq('id', application_id)
      .single()

    if (appError || !application) {
      return new Response(JSON.stringify({ success: false, error: 'Application not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Verify organization matches
    if (application.organization_id !== userRole.organization_id && userRole.role !== 'super_admin') {
      return new Response(JSON.stringify({ success: false, error: 'Cannot screen applications from other organizations' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Build update data - ONLY set status fields
    const updateData: Record<string, any> = {
      qualification_status,
      screened_by: user.id,
      screened_at: new Date().toISOString(),
      screening_remarks: screening_remarks || null,
    }

    // If qualified, set status to APPLICATION_FEE_PENDING and create financial queue entry
    if (qualification_status === 'provisionally_qualified') {
      // Set status to APPLICATION_FEE_PENDING (not provisionally_admitted yet)
      updateData.registration_status = 'pending_payment'
      
      // Set hostel status if applied
      if (application.needs_hostel_accommodation) {
        updateData.hostel_application_status = 'applied'
      }
      
      // Create financial queue entry for application fee
      const { data: feeType } = await supabaseAdmin
        .from('fee_types')
        .select('id, amount')
        .eq('organization_id', application.organization_id)
        .ilike('name', '%application%')
        .single()
      
      if (feeType) {
        await supabaseAdmin.from('financial_queue').insert({
          organization_id: application.organization_id,
          entity_type: 'APPLICATION',
          entity_id: application_id, // Use application_id for APPLICATION type
          fee_type_id: feeType.id,
          amount: feeType.amount || 0,
          status: 'pending',
          description: `Application fee for ${application.first_name} ${application.last_name}`,
          requested_by: user.id,
        })
      }
      
      // DO NOT generate trainee_number or system_email here
      // These are generated in clear-application-fee when payment is cleared
      
    } else {
      // Does not qualify - keep at applied status
      updateData.registration_status = 'applied'
    }

    // Update application
    const { error: updateError } = await supabaseAdmin
      .from('trainee_applications')
      .update(updateData)
      .eq('id', application_id)

    if (updateError) {
      console.error('Update error:', updateError)
      return new Response(JSON.stringify({ success: false, error: updateError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Log to audit - no identity artifacts created
    await supabaseAdmin.from('provisioning_logs').insert({
      organization_id: application.organization_id,
      application_id,
      trigger_type: 'manual',
      result: 'screening_complete',
      email: application.email, // Personal email, not system email
      metadata: { 
        qualification_status, 
        screened_by: user.id,
        status_set: qualification_status === 'provisionally_qualified' ? 'pending_payment' : 'applied',
        note: 'No identity artifacts created - awaiting payment clearance'
      }
    })

    console.log(`Application ${application_id} screened: ${qualification_status}, status set to ${updateData.registration_status}`)

    return new Response(JSON.stringify({ 
      success: true, 
      message: qualification_status === 'provisionally_qualified' 
        ? 'Application qualified - awaiting application fee payment'
        : 'Application marked as does not qualify',
      registration_status: updateData.registration_status,
      // No trainee_number or system_email returned - these don't exist yet
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    console.error('Error in screen-application:', error)
    return new Response(JSON.stringify({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
