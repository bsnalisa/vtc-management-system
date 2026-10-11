import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Only a super admin may create, change, deactivate or reset the password of an admin-level account
const PRIVILEGED_ROLES = ['organization_admin', 'admin', 'centre_manager', 'super_admin', 'vms_developer', 'vms_support']

const generateTemporaryPassword = () => {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'
  const bytes = crypto.getRandomValues(new Uint8Array(12))
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('') + '!7'
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
    const { userId, firstname, surname, phone, role, active, organization_id, resetPassword } = requestBody

    console.log('Update request:', { userId, firstname, surname, phone, role, active, organization_id, resetPassword })

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

    // Admin-level accounts and roles are managed by super admins only
    if (userOrg?.role !== 'super_admin') {
      const targetIsPrivileged = PRIVILEGED_ROLES.includes(targetUserRole?.role ?? '')
      const roleChanged = role !== undefined && role !== targetUserRole?.role
      const touchesAccount = roleChanged || active !== undefined || resetPassword === true
      if (targetIsPrivileged && touchesAccount) {
        return new Response(JSON.stringify({ error: 'Only a super admin can change the role, status or password of an administrator account' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      if (targetIsPrivileged && userId !== user.id) {
        return new Response(JSON.stringify({ error: 'Only a super admin can edit another administrator account' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      if (role !== undefined && role !== targetUserRole?.role && PRIVILEGED_ROLES.includes(role)) {
        return new Response(JSON.stringify({ error: 'Only a super admin can grant an administrator role' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
    }

    const auditOrg = targetUserRole?.organization_id ?? userOrg?.organization_id ?? null
    const audit = async (action: string, summary: string, details: Record<string, unknown> = {}) => {
      const { error: auditError } = await supabaseAdmin.from('admin_audit_log').insert({
        organization_id: auditOrg,
        actor_id: user.id,
        actor_role: userOrg?.role ?? null,
        action,
        entity: 'users',
        entity_id: userId,
        summary,
        details,
      })
      if (auditError) console.warn('Failed to write audit entry:', auditError.message)
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
      await audit('user.profile_updated', 'Changed a user\'s name or phone', { firstname, surname, phone })
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
    if (role !== undefined && role !== targetUserRole?.role) {
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
      await audit('user.role_changed', 'Changed a user\'s role', { from: targetUserRole?.role ?? null, to: role })
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
      await audit('user.deactivated', 'Deactivated a user account')
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
      await audit('user.reactivated', 'Reactivated a user account')
    }

    // Handle password reset
    let resetResult: string | null = null
    if (resetPassword === true) {
      const temporaryPassword = generateTemporaryPassword()
      const { error: resetError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
        password: temporaryPassword,
        user_metadata: { password_reset_required: true }
      })

      if (resetError) {
        console.error('Error resetting password:', resetError)
        return new Response(JSON.stringify({ error: `Failed to reset password: ${resetError.message}` }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      // Also update trainee record if applicable
      await supabaseAdmin
        .from('trainees')
        .update({ password_reset_required: true })
        .eq('user_id', userId)

      console.log('Password reset successfully')
      await audit('user.password_reset', 'Reset a user\'s password')
      resetResult = temporaryPassword
    }

    // Log audit event
    try {
      await supabaseAdmin.rpc('log_audit_event', {
        _action: 'user_updated',
        _table_name: 'profiles',
        _record_id: userId,
        _old_data: null,
        _new_data: { firstname, surname, phone, role, active, resetPassword }
      })
    } catch (auditError) {
      console.warn('Failed to log audit event:', auditError)
    }

    return new Response(JSON.stringify({ success: true, passwordReset: resetPassword === true, temporaryPassword: resetResult }), {
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
