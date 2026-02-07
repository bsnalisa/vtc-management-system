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

    // Get queue entry
    const { data: queueEntry, error: queueError } = await supabaseAdmin
      .from('financial_queue')
      .select('*')
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

    // Only process REGISTRATION fees in this function
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
    // IF FULLY CLEARED: Set status to REGISTERED
    // ========================================
    if (isFullyCleared) {
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
            hostel_application_status: registration.hostel_required ? 'allocated' : 'not_applied',
          })
          .eq('id', registration.application_id)
      }

      // Create trainee financial account if not exists
      const { data: existingAccount } = await supabaseAdmin
        .from('trainee_financial_accounts')
        .select('id')
        .eq('trainee_id', registration.trainee_id)
        .single()

      if (!existingAccount) {
        await supabaseAdmin.from('trainee_financial_accounts').insert({
          organization_id: queueEntry.organization_id,
          trainee_id: registration.trainee_id,
          balance: 0,
        })
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
    }

    return new Response(JSON.stringify({ 
      success: true,
      message: isFullyCleared 
        ? 'Registration fee cleared - trainee status set to REGISTERED' 
        : 'Partial payment recorded',
      payment_status: newStatus,
      amount_paid: newAmountPaid,
      balance: queueEntry.amount - newAmountPaid,
      final_status: isFullyCleared ? 'REGISTERED' : undefined,
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
