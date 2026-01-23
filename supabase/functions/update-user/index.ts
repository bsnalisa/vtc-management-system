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
    
    console.log('Creating admin client for update-user...')
    
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

    // Get user's role and organization
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

    // Check if user is admin or org admin
    const isAdmin = userOrg?.role === 'admin' || userOrg?.role === 'organization_admin' || userOrg?.role === 'super_admin'
    
    if (!isAdmin) {
      console.log('User is not admin:', userOrg?.role)
      return new Response(JSON.stringify({ error: 'Only admins can update users' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const requestBody = await req.json()
    const { userId, firstname, surname, phone, role, active, organization_id } = requestBody

    console.log('Update request:', { userId, firstname, surname, phone, role, active, organization_id })

    if (!userId) {
      return new Response(JSON.stringify({ error: 'User ID is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Get the target user's current role to verify permissions
    const { data: targetUserRole, error: targetError } = await supabaseAdmin
      .from('user_roles')
      .select('role, organization_id')
      .eq('user_id', userId)
      .single()

    if (targetError && targetError.code !== 'PGRST116') {
      console.error('Error fetching target user:', targetError)
    }

    // Org admins can only update users in their organization
    if (userOrg?.role === 'organization_admin') {
      if (targetUserRole?.organization_id !== userOrg.organization_id) {
        return new Response(JSON.stringify({ error: 'You can only update users in your organization' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      // Org admins cannot update super_admin users
      if (targetUserRole?.role === 'super_admin') {
        return new Response(JSON.stringify({ error: 'Cannot update super admin users' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
    }

    // Update profile if name/phone provided
    if (firstname !== undefined || surname !== undefined || phone !== undefined) {
      const profileUpdate: Record<string, any> = {}
      if (firstname !== undefined) profileUpdate.firstname = firstname
      if (surname !== undefined) profileUpdate.surname = surname
      if (phone !== undefined) profileUpdate.phone = phone
      if (firstname !== undefined || surname !== undefined) {
        profileUpdate.full_name = `${firstname || ''} ${surname || ''}`.trim()
      }

      const { error: profileError } = await supabaseAdmin
        .from('profiles')
        .update(profileUpdate)
        .eq('user_id', userId)

      if (profileError) {
        console.error('Error updating profile:', profileError)
        return new Response(JSON.stringify({ error: `Failed to update profile: ${profileError.message}` }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      console.log('Profile updated successfully')
    }

    // Update user auth metadata
    if (firstname !== undefined || surname !== undefined || phone !== undefined) {
      const userMetadata: Record<string, any> = {}
      if (firstname !== undefined) userMetadata.firstname = firstname
      if (surname !== undefined) userMetadata.surname = surname
      if (phone !== undefined) userMetadata.phone = phone
      if (firstname !== undefined || surname !== undefined) {
        userMetadata.full_name = `${firstname || ''} ${surname || ''}`.trim()
      }

      const { error: authUpdateError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
        user_metadata: userMetadata
      })

      if (authUpdateError) {
        console.error('Error updating auth user:', authUpdateError)
        // Don't fail the whole operation for this
      }
    }

    // Update role if provided
    if (role !== undefined) {
      // Prevent non-super_admins from assigning super_admin role
      if (role === 'super_admin' && userOrg?.role !== 'super_admin') {
        return new Response(JSON.stringify({ error: 'Only super admins can assign super admin role' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const targetOrgId = userOrg?.role === 'super_admin' ? (organization_id || targetUserRole?.organization_id) : userOrg?.organization_id

      // Update the role
      const { error: roleError } = await supabaseAdmin
        .from('user_roles')
        .update({ 
          role: role,
          organization_id: targetOrgId || null
        })
        .eq('user_id', userId)

      if (roleError) {
        console.error('Error updating role:', roleError)
        return new Response(JSON.stringify({ error: `Failed to update role: ${roleError.message}` }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      console.log('Role updated successfully')
    }

    // Handle user deactivation (soft delete)
    if (active === false) {
      // Ban the user in auth
      const { error: banError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
        ban_duration: '876000h' // ~100 years
      })

      if (banError) {
        console.error('Error banning user:', banError)
        return new Response(JSON.stringify({ error: `Failed to deactivate user: ${banError.message}` }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      console.log('User deactivated successfully')
    } else if (active === true) {
      // Unban the user
      const { error: unbanError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
        ban_duration: 'none'
      })

      if (unbanError) {
        console.error('Error unbanning user:', unbanError)
        return new Response(JSON.stringify({ error: `Failed to reactivate user: ${unbanError.message}` }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      console.log('User reactivated successfully')
    }

    // Log audit event
    try {
      await supabaseAdmin.rpc('log_audit_event', {
        _action: 'user_updated',
        _table_name: 'profiles',
        _record_id: userId,
        _old_data: null,
        _new_data: { firstname, surname, phone, role, active }
      })
    } catch (auditError) {
      console.warn('Failed to log audit event:', auditError)
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Error in update-user function:', error)
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred'
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
