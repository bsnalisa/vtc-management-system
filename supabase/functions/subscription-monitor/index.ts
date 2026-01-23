import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log("Starting subscription monitoring...");

    // Check for expiring subscriptions
    const { data: expiringSubscriptions, error: expiryError } = await supabase
      .rpc("check_subscription_expiry");

    if (expiryError) {
      console.error("Error checking expiry:", expiryError);
      throw expiryError;
    }

    console.log(`Found ${expiringSubscriptions?.length || 0} expiring subscriptions`);

    // Create notifications for expiring subscriptions
    const notifications = [];
    
    for (const sub of expiringSubscriptions || []) {
      // Get organization admins
      const { data: admins } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("organization_id", sub.organization_id)
        .in("role", ["admin", "organization_admin"]);

      if (admins && admins.length > 0) {
        for (const admin of admins) {
          notifications.push({
            user_id: admin.user_id,
            type: "subscription_expiry",
            title: "Subscription Expiring Soon",
            message: `Your ${sub.package_name} subscription expires in ${sub.days_remaining} days. Please renew to avoid service interruption.`,
          });
        }
      }

      // Log audit event
      await supabase.from("system_audit_logs").insert({
        organization_id: sub.organization_id,
        action: "subscription_expiry_warning",
        table_name: "organization_packages",
        new_data: {
          organization_name: sub.organization_name,
          package_name: sub.package_name,
          days_remaining: sub.days_remaining,
        },
      });
    }

    // Insert all notifications
    if (notifications.length > 0) {
      const { error: notifError } = await supabase
        .from("notifications")
        .insert(notifications);

      if (notifError) {
        console.error("Error creating notifications:", notifError);
      } else {
        console.log(`Created ${notifications.length} notifications`);
      }
    }

    // Expire overdue subscriptions
    const { data: expired } = await supabase.rpc("expire_trial_packages");
    console.log(`Expired ${expired?.length || 0} overdue subscriptions`);

    return new Response(
      JSON.stringify({
        success: true,
        expiring_count: expiringSubscriptions?.length || 0,
        expired_count: expired?.length || 0,
        notifications_sent: notifications.length,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Error in subscription-monitor:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
