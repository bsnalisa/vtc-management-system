import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Generate a cryptographically secure random password
function generateSecurePassword(): string {
  const length = 16
  const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*'
  const array = new Uint8Array(length)
  crypto.getRandomValues(array)
  return Array.from(array, byte => charset[byte % charset.length]).join('')
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

    // Verify debtor officer or admin role
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

    // Only process APPLICATION fees in this function
    if (queueEntry.entity_type !== 'APPLICATION') {
      return new Response(JSON.stringify({ success: false, error: 'This function only handles application fees' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const newAmountPaid = (queueEntry.amount_paid || 0) + amount
    const newBalance = Math.max(0, queueEntry.amount - newAmountPaid)
    const isFullyCleared = newBalance <= 0
    const newStatus = isFullyCleared ? 'cleared' : (newAmountPaid > 0 ? 'partial' : 'pending')

    console.log('Processing payment:', { 
      queue_id, 
      amount, 
      newAmountPaid, 
      newBalance, 
      isFullyCleared, 
      newStatus 
    })

    // Update financial queue - balance is auto-calculated by trigger
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

    // If fully cleared, this is the TRIGGER POINT for ALL identity creation
    let provisioningResult = null
    if (isFullyCleared) {
      console.log('Payment fully cleared, starting identity creation for entity_id:', queueEntry.entity_id)
      
      // Get application - query separately to avoid join issues
      const { data: application, error: appError } = await supabaseAdmin
        .from('trainee_applications')
        .select('*')
        .eq('id', queueEntry.entity_id)
        .single()

      if (appError) {
        console.error('Application query error:', appError)
      }
      
      if (!application) {
        console.error('Application not found for entity_id:', queueEntry.entity_id)
        
        // Don't rollback the payment, but log the error
        await supabaseAdmin.from('provisioning_logs').insert({
          organization_id: queueEntry.organization_id,
          application_id: queueEntry.entity_id,
          trigger_type: 'auto',
          result: 'failed',
          email: 'unknown',
          error_message: `Application not found for entity_id: ${queueEntry.entity_id}`,
        })
        
        return new Response(JSON.stringify({ 
          success: true, 
          warning: 'Payment cleared but application not found for identity creation',
          payment_status: newStatus,
          amount_paid: newAmountPaid,
        }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      
      // Get organization separately
      const { data: organization, error: orgError } = await supabaseAdmin
        .from('organizations')
        .select('name, email_domain')
        .eq('id', application.organization_id)
        .single()
      
      if (orgError || !organization) {
        console.error('Organization not found:', orgError)
        return new Response(JSON.stringify({ 
          success: false, 
          error: 'Organization not found' 
        }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      
      console.log('Found application:', application.id, 'Organization:', organization.name)

      // ========================================
      // ATOMIC IDENTITY CREATION - ALL STEPS HERE
      // ========================================

      // Step 1: Generate trainee number (FIRST TIME)
      const { data: traineeNumber, error: numError } = await supabaseAdmin
        .rpc('generate_continuous_trainee_number', { org_id: application.organization_id })
      
      if (numError || !traineeNumber) {
        console.error('Failed to generate trainee number:', numError)
        
        await supabaseAdmin.from('provisioning_logs').insert({
          organization_id: application.organization_id,
          application_id: application.id,
          trigger_type: 'auto',
          result: 'failed',
          email: application.email,
          error_message: 'Failed to generate trainee number',
        })
        
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
          error: 'Failed to generate trainee number - payment rolled back',
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      // Step 2: Generate system email
      const { data: systemEmail, error: emailError } = await supabaseAdmin
        .rpc('generate_trainee_system_email', { 
          p_trainee_number: traineeNumber, 
          p_org_id: application.organization_id 
        })
      
      if (emailError || !systemEmail) {
        console.error('Failed to generate system email:', emailError)
        
        await supabaseAdmin.from('provisioning_logs').insert({
          organization_id: application.organization_id,
          application_id: application.id,
          trigger_type: 'auto',
          result: 'failed',
          email: application.email,
          error_message: 'Failed to generate system email',
        })
        
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
          error: 'Failed to generate system email - payment rolled back',
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      // Step 3: Check if auth user already exists (idempotency using system email)
      const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers()
      const existingUser = existingUsers?.users?.find(u => u.email === systemEmail)

      let userId: string
      let accountExisted = false

      if (existingUser) {
        userId = existingUser.id
        accountExisted = true
        console.log('Auth user already exists:', systemEmail)
      } else {
        // Step 4: Create auth user with secure random password
        // Password reset is enforced on first login, so the trainee will set their own password
        const securePassword = generateSecurePassword()
        const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
          email: systemEmail,
          password: securePassword,
          email_confirm: true,
          user_metadata: {
            firstname: application.first_name,
            surname: application.last_name,
            full_name: `${application.first_name} ${application.last_name}`,
            application_id: application.id,
            is_trainee: true,
            password_reset_required: true,
          },
        })

        if (createError) {
          console.error('Error creating auth user:', createError)
          
          await supabaseAdmin
            .from('trainee_applications')
            .update({ 
              account_provisioning_status: 'failed',
              trainee_number: traineeNumber,
              system_email: systemEmail,
            })
            .eq('id', application.id)

          await supabaseAdmin.from('provisioning_logs').insert({
            organization_id: application.organization_id,
            application_id: application.id,
            trigger_type: 'auto',
            result: 'failed',
            email: systemEmail,
            error_message: createError.message,
          })

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
            error: 'Failed to create auth user - payment rolled back',
          }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }

        userId = newUser.user.id
        console.log('Created new auth user:', userId)
      }

      // Step 5: Create trainee record
      // Note: trainees table requires gender and academic_year (not null)
      const traineeData: Record<string, unknown> = {
        organization_id: application.organization_id,
        trainee_id: traineeNumber,
        first_name: application.first_name,
        last_name: application.last_name,
        email: application.email,
        phone: application.phone,
        national_id: application.national_id,
        date_of_birth: application.date_of_birth,
        gender: application.gender || 'male', // Default if null
        address: application.address,
        trade_id: application.trade_id,
        level: application.preferred_level || 1,
        training_mode: application.preferred_training_mode || 'fulltime',
        academic_year: application.academic_year || new Date().getFullYear().toString(),
        status: 'active',
        system_email: systemEmail,
        user_id: userId,
        account_provisioning_status: 'auto_provisioned',
        password_reset_required: true,
        is_email_system_generated: true,
      }

      const { data: trainee, error: traineeError } = await supabaseAdmin
        .from('trainees')
        .insert(traineeData)
        .select()
        .single()

      if (traineeError) {
        console.error('Error creating trainee:', traineeError, 'Data:', traineeData)
        // Continue anyway - auth user exists, trainee creation can be retried
      }

      // Step 6: Assign trainee role (check existence first to avoid conflict)
      const { data: existingRole } = await supabaseAdmin
        .from('user_roles')
        .select('id')
        .eq('user_id', userId)
        .eq('role', 'trainee')
        .maybeSingle()

      if (!existingRole) {
        await supabaseAdmin.from('user_roles').insert({
          user_id: userId,
          role: 'trainee',
          organization_id: application.organization_id,
        })
      }

      // Step 6b: Create/update financial account and record transactions
      // The trigger 'update_account_on_transaction' auto-updates total_fees/total_paid
      const { data: existingFinAccount } = await supabaseAdmin
        .from('trainee_financial_accounts')
        .select('id')
        .or(`trainee_id.eq.${trainee?.id},application_id.eq.${application.id}`)
        .maybeSingle()

      let accountId: string
      if (existingFinAccount) {
        accountId = existingFinAccount.id
        // Just ensure trainee_id is linked
        if (trainee?.id) {
          await supabaseAdmin
            .from('trainee_financial_accounts')
            .update({ trainee_id: trainee.id })
            .eq('id', accountId)
        }
      } else {
        const { data: newAccount } = await supabaseAdmin
          .from('trainee_financial_accounts')
          .insert({
            organization_id: application.organization_id,
            trainee_id: trainee?.id || null,
            application_id: application.id,
          })
          .select('id')
          .single()
        accountId = newAccount?.id
      }

      // Record charge (fee) and payment transactions - trigger handles totals
      if (accountId) {
        // 1. Record the fee charge
        await supabaseAdmin.from('financial_transactions').insert({
          organization_id: application.organization_id,
          account_id: accountId,
          fee_type_id: queueEntry.fee_type_id,
          transaction_type: 'charge',
          amount: queueEntry.amount,
          balance_after: queueEntry.amount,
          description: 'Application fee',
          processed_by: user.id,
        })
        // 2. Record the payment
        await supabaseAdmin.from('financial_transactions').insert({
          organization_id: application.organization_id,
          account_id: accountId,
          fee_type_id: queueEntry.fee_type_id,
          transaction_type: 'payment',
          amount: amount,
          balance_after: 0,
          payment_method,
          description: 'Application fee payment',
          notes,
          processed_by: user.id,
        })
      }

      // Step 7: Update application with ALL identity artifacts and new status
      const { error: appUpdateError } = await supabaseAdmin
        .from('trainee_applications')
        .update({
          trainee_number: traineeNumber,
          system_email: systemEmail,
          user_id: userId,
          registration_status: 'provisionally_admitted', // NOW set to provisionally_admitted
          account_provisioning_status: 'auto_provisioned',
          payment_clearance_status: 'cleared',
          payment_cleared_at: new Date().toISOString(),
          payment_cleared_by: user.id,
        })
        .eq('id', application.id)

      if (appUpdateError) {
        console.error('CRITICAL: Failed to update application status to provisionally_admitted:', appUpdateError)
      } else {
        console.log(`Application ${application.id} status updated to provisionally_admitted`)
      }

      // Step 8: Log success
      await supabaseAdmin.from('provisioning_logs').insert({
        organization_id: application.organization_id,
        application_id: application.id,
        trainee_id: trainee?.id,
        user_id: userId,
        trigger_type: 'auto',
        result: 'success',
        email: systemEmail,
        metadata: { 
          account_existed: accountExisted, 
          payment_cleared_by: user.id,
          trainee_number: traineeNumber,
          workflow_step: 'clear-application-fee',
        },
      })

      provisioningResult = {
        user_id: userId,
        trainee_id: trainee?.id,
        trainee_number: traineeNumber,
        system_email: systemEmail,
        account_existed: accountExisted,
      }

      console.log(`Application ${application.id} fee cleared, identity created:`, provisioningResult)
    }

    return new Response(JSON.stringify({ 
      success: true,
      message: isFullyCleared 
        ? 'Payment cleared - trainee account created and status set to PROVISIONALLY_ADMITTED' 
        : 'Partial payment recorded',
      payment_status: newStatus,
      amount_paid: newAmountPaid,
      balance: queueEntry.amount - newAmountPaid,
      provisioning: provisioningResult,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    console.error('Error in clear-application-fee:', error)
    return new Response(JSON.stringify({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
