import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ClearFeeRequest {
  queue_id: string
  amount: number
  payment_method: string
  notes?: string
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

    // Verify debtor officer role
    const { data: userRole } = await supabaseAdmin
      .from('user_roles')
      .select('organization_id, role')
      .eq('user_id', user.id)
      .single()

    const allowedRoles = ['super_admin', 'organization_admin', 'debtor_officer', 'admin']
    if (!userRole || !allowedRoles.includes(userRole.role)) {
      return new Response(JSON.stringify({ success: false, error: 'Insufficient permissions' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const body: ClearFeeRequest = await req.json()
    const { queue_id, amount, payment_method, notes } = body

    if (!queue_id || amount === undefined || !payment_method) {
      return new Response(JSON.stringify({ success: false, error: 'Missing required fields' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Get queue entry with fee type info
    const { data: queueEntry, error: queueError } = await supabaseAdmin
      .from('financial_queue')
      .select('*, fee_types(code, name)')
      .eq('id', queue_id)
      .single()

    if (queueError || !queueEntry) {
      return new Response(JSON.stringify({ success: false, error: 'Queue entry not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Verify organization
    if (queueEntry.organization_id !== userRole.organization_id && userRole.role !== 'super_admin') {
      return new Response(JSON.stringify({ success: false, error: 'Cannot process payments for other organizations' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // This function handles REGISTRATION entity type fees only
    if (queueEntry.entity_type !== 'REGISTRATION') {
      return new Response(JSON.stringify({ success: false, error: 'This function only handles registration fees' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const newAmountPaid = (queueEntry.amount_paid || 0) + amount
    const isFullyCleared = newAmountPaid >= queueEntry.amount
    const newStatus = isFullyCleared ? 'cleared' : (newAmountPaid > 0 ? 'partial' : 'pending')

    // Update financial queue
    const { error: updateQueueError } = await supabaseAdmin
      .from('financial_queue')
      .update({
        amount_paid: newAmountPaid,
        status: newStatus,
        payment_method,
        cleared_by: isFullyCleared ? user.id : null,
        cleared_at: isFullyCleared ? new Date().toISOString() : null,
      })
      .eq('id', queue_id)

    if (updateQueueError) {
      console.error('Queue update error:', updateQueueError)
      return new Response(JSON.stringify({ success: false, error: updateQueueError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // ========================================
    // IF FULLY CLEARED: Determine if this is a registration-gating fee
    // Only REG_FEE (day scholar) clearance triggers REGISTERED status
    // HOSTEL fees (REG_FEE_HOST) do NOT gate registration
    // ========================================
    const feeCode = queueEntry.fee_types?.code || ''
    const isRegistrationGatingFee = feeCode === 'REG_FEE' || feeCode === 'REG_FEE_BDL'

    if (isFullyCleared && isRegistrationGatingFee) {
      const registrationId = queueEntry.entity_id

      // Get registration to find trainee and application
      const { data: registration, error: regError } = await supabaseAdmin
        .from('registrations')
        .select('*, trainees(*)')
        .eq('id', registrationId)
        .single()

      if (regError || !registration) {
        console.error('Registration not found:', regError)
        
        // Rollback queue update
        await supabaseAdmin
          .from('financial_queue')
          .update({ 
            amount_paid: queueEntry.amount_paid, 
            status: queueEntry.status,
            cleared_by: null,
            cleared_at: null,
          })
          .eq('id', queue_id)

        return new Response(JSON.stringify({ 
          success: false, 
          error: 'Registration record not found - payment rolled back' 
        }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const trainee = registration.trainees

      // Update registration status to REGISTERED
      const { error: updateRegError } = await supabaseAdmin
        .from('registrations')
        .update({
          registration_status: 'registered',
          registered_at: new Date().toISOString(),
        })
        .eq('id', registrationId)

      if (updateRegError) {
        console.error('Failed to update registration:', updateRegError)
        
        // Rollback queue update
        await supabaseAdmin
          .from('financial_queue')
          .update({ 
            amount_paid: queueEntry.amount_paid, 
            status: queueEntry.status,
            cleared_by: null,
            cleared_at: null,
          })
          .eq('id', queue_id)

        return new Response(JSON.stringify({ 
          success: false, 
          error: 'Failed to update registration status - payment rolled back' 
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      // Update trainee status to active
      await supabaseAdmin
        .from('trainees')
        .update({ status: 'active' })
        .eq('id', registration.trainee_id)

      // Update application status to REGISTERED (final state)
      if (registration.application_id) {
        await supabaseAdmin
          .from('trainee_applications')
          .update({ 
            registration_status: 'registered',
            hostel_application_status: registration.hostel_required ? 'applied' : 'not_applied',
          })
          .eq('id', registration.application_id)
      }

      // Create or update trainee financial account
      const { data: existingAccount } = await supabaseAdmin
        .from('trainee_financial_accounts')
        .select('id, trainee_id')
        .or(`trainee_id.eq.${registration.trainee_id},application_id.eq.${registration.application_id}`)
        .maybeSingle()

      if (existingAccount) {
        // Ensure trainee_id is linked if it was missing
        if (!existingAccount.trainee_id) {
          await supabaseAdmin
            .from('trainee_financial_accounts')
            .update({ trainee_id: registration.trainee_id })
            .eq('id', existingAccount.id)
        }
      } else {
        await supabaseAdmin.from('trainee_financial_accounts').insert({
          organization_id: queueEntry.organization_id,
          trainee_id: registration.trainee_id,
          application_id: registration.application_id,
          balance: 0,
        })
      }

      // If there's still a pending HOSTEL fee, add it to the trainee's financial account
      // This ensures the hostel fee persists as a separate obligation
      if (registration.hostel_required) {
        console.log(`Trainee has hostel fee obligation - this remains as a separate pending item`)
      }

      // Create notification for trainee
      if (trainee?.user_id) {
        await supabaseAdmin.from('notifications').insert({
          user_id: trainee.user_id,
          organization_id: queueEntry.organization_id,
          title: 'Registration Complete! 🎉',
          message: 'Your registration fee has been cleared. You are now fully REGISTERED.',
          type: 'success',
        })
      }

      console.log(`Registration ${registrationId} fee cleared - trainee fully REGISTERED`)

      return new Response(JSON.stringify({ 
        success: true,
        message: 'Registration fee cleared - trainee status set to REGISTERED',
        payment_status: newStatus,
        amount_paid: newAmountPaid,
        balance: queueEntry.amount - newAmountPaid,
        final_status: 'REGISTERED',
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // For non-gating fees (e.g. HOSTEL fee) or partial payments, just record the payment
    return new Response(JSON.stringify({ 
      success: true,
      message: isFullyCleared 
        ? 'Fee cleared successfully' 
        : 'Partial payment recorded',
      payment_status: newStatus,
      amount_paid: newAmountPaid,
      balance: queueEntry.amount - newAmountPaid,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    console.error('Error in clear-registration-fee:', error)
    return new Response(JSON.stringify({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})