import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CreateNotificationRequest {
  organization_id: string;
  user_id?: string;
  role?: string;
  type: string;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  title: string;
  message: string;
  metadata?: Record<string, any>;
  action_url?: string;
  expires_at?: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const notification: CreateNotificationRequest = await req.json();

    console.log('Creating notification:', notification);

    // Validate required fields
    if (!notification.organization_id || !notification.type || !notification.title || !notification.message) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Missing required fields: organization_id, type, title, message' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // If role is specified, get all users with that role in the organization
    if (notification.role && !notification.user_id) {
      const { data: usersWithRole, error: roleError } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('organization_id', notification.organization_id)
        .eq('role', notification.role);

      if (roleError) {
        console.error('Error fetching users with role:', roleError);
        throw roleError;
      }

      // Create individual notifications for each user with the role
      const notifications = usersWithRole.map(ur => ({
        organization_id: notification.organization_id,
        user_id: ur.user_id,
        type: notification.type,
        priority: notification.priority || 'medium',
        title: notification.title,
        message: notification.message,
        metadata: notification.metadata || {},
        action_url: notification.action_url,
        expires_at: notification.expires_at,
      }));

      const { data, error } = await supabase
        .from('notifications')
        .insert(notifications)
        .select();

      if (error) {
        console.error('Error creating notifications:', error);
        throw error;
      }

      console.log(`Created ${data.length} notifications for role ${notification.role}`);

      return new Response(
        JSON.stringify({
          success: true,
          message: `Created ${data.length} notifications`,
          count: data.length
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // Create single notification
    const { data, error } = await supabase
      .from('notifications')
      .insert({
        organization_id: notification.organization_id,
        user_id: notification.user_id,
        role: notification.role,
        type: notification.type,
        priority: notification.priority || 'medium',
        title: notification.title,
        message: notification.message,
        metadata: notification.metadata || {},
        action_url: notification.action_url,
        expires_at: notification.expires_at,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating notification:', error);
      throw error;
    }

    console.log('Notification created successfully:', data.id);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Notification created successfully',
        notification: data
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error) {
    console.error('Error in create-notification function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: errorMessage 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
