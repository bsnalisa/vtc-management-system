import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    console.log('Creating admin client...')
    
    // Create admin client with service role key - this bypasses RLS
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    // Verify the requesting user
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      console.log('No authorization header')
      return new Response(JSON.stringify({ error: 'No authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
    
    if (authError || !user) {
      console.log('Auth error:', authError)
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    console.log('User authenticated:', user.id)

    // Get user's organization using service role client
    const { data: userOrg, error: userOrgError } = await supabaseAdmin
      .from('user_roles')
      .select('organization_id, role')
      .eq('user_id', user.id)
      .single()

    if (userOrgError) {
      console.error('Error fetching user org:', userOrgError)
      return new Response(JSON.stringify({ error: 'Failed to verify user permissions' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    console.log('User org:', userOrg)

    // Check if user is admin or org admin
    const isAdmin = userOrg?.role === 'admin' || userOrg?.role === 'organization_admin' || userOrg?.role === 'super_admin'
    
    if (!isAdmin) {
      console.log('User is not admin:', userOrg?.role)
      return new Response(JSON.stringify({ error: 'Only admins can create users' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const requestBody = await req.json()
    const { email, password, firstname, surname, phone, role, organization_id } = requestBody

    console.log('Request body:', { email, firstname, surname, role, organization_id })

    if (!email || !password || !role) {
      return new Response(JSON.stringify({ error: 'Email, password, and role are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Prevent non-super_admins from creating super_admin users
    if (role === 'super_admin' && userOrg?.role !== 'super_admin') {
      return new Response(JSON.stringify({ error: 'Only super admins can create super admin users' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // For org admins, force their organization
    const targetOrgId = userOrg?.role === 'super_admin' ? organization_id : userOrg?.organization_id

    console.log('Target org ID:', targetOrgId)

    // Create user with admin API (doesn't affect current session)
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        firstname,
        surname,
        full_name: `${firstname} ${surname}`,
        phone,
      },
    })

    if (createError) {
      console.error('Error creating user:', createError)
      return new Response(JSON.stringify({ error: createError.message }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    console.log('User created:', newUser.user.id)

    // Assign role using service role client (bypasses RLS)
    const roleInsertData = {
      user_id: newUser.user.id,
      role: role,
      organization_id: targetOrgId || null,
    }
    
    console.log('Inserting role:', roleInsertData)

    const { data: roleData, error: roleError } = await supabaseAdmin
      .from('user_roles')
      .insert([roleInsertData])
      .select()

    if (roleError) {
      console.error('Error assigning role:', roleError)
      console.error('Role error details:', JSON.stringify(roleError, null, 2))
      // Clean up - delete the created user
      await supabaseAdmin.auth.admin.deleteUser(newUser.user.id)
      return new Response(JSON.stringify({ error: `Failed to assign role: ${roleError.message}` }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    console.log('Role assigned successfully:', roleData)

    return new Response(JSON.stringify({ success: true, user: newUser.user }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Error in create-user function:', error)
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred'
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
