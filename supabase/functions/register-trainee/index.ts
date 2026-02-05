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
 
     // Verify application is in correct status
     if (application.registration_status !== 'payment_cleared') {
       return new Response(JSON.stringify({ 
         success: false, 
         error: `Cannot register: application status is ${application.registration_status}, expected payment_cleared` 
       }), {
         status: 400,
         headers: { ...corsHeaders, 'Content-Type': 'application/json' },
       })
     }
 
     // Get trainee record
     const { data: trainee } = await supabaseAdmin
       .from('trainees')
       .select('id')
       .eq('trainee_id', application.trainee_number)
       .eq('organization_id', application.organization_id)
       .single()
 
     if (!trainee) {
       return new Response(JSON.stringify({ success: false, error: 'Trainee record not found' }), {
         status: 404,
         headers: { ...corsHeaders, 'Content-Type': 'application/json' },
       })
     }
 
     const currentYear = new Date().getFullYear().toString()
 
     // Create registration record
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
 
     // Create financial queue entry for registration fee
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
         entity_id: trainee.id,
         fee_type_id: feeType.id,
         amount: feeType.amount || 0,
         status: 'pending',
         description: `Registration fee for ${application.first_name} ${application.last_name}`,
         requested_by: user.id,
       })
     }
 
     // Update application status
     await supabaseAdmin
       .from('trainee_applications')
       .update({
         registration_status: 'registered',
         hostel_application_status: application.needs_hostel_accommodation ? 'provisionally_allocated' : 'not_applied',
       })
       .eq('id', application_id)
 
     console.log(`Trainee ${trainee.id} registered for qualification ${qualification_id}`)
 
     return new Response(JSON.stringify({ 
       success: true,
       message: 'Trainee registered successfully',
       registration_id: registration.id,
       registration_status: 'fee_pending',
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