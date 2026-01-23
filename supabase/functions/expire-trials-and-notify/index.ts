import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log("Starting trial expiration check...");

    // Call the expire_trial_packages function
    const { data: expiredPackages, error: expireError } = await supabase
      .rpc("expire_trial_packages");

    if (expireError) {
      console.error("Error expiring trials:", expireError);
      throw expireError;
    }

    console.log(`Expired ${expiredPackages?.length || 0} trial packages`);

    // Send notifications for each expired trial
    const notificationPromises = (expiredPackages || []).map(async (expired: {
      organization_id: string;
      package_name: string;
      expired_at: string;
    }) => {
      try {
        // Get organization admins
        const { data: admins } = await supabase
          .from("user_roles")
          .select("user_id, profiles(email, full_name)")
          .eq("organization_id", expired.organization_id)
          .in("role", ["admin", "organization_admin"]);

        if (!admins || admins.length === 0) {
          console.log(`No admins found for organization ${expired.organization_id}`);
          return null;
        }

        // Create notifications for each admin
        const notifications = admins.map((admin) => ({
          user_id: admin.user_id,
          title: "Trial Period Expired",
          message: `Your trial for the ${expired.package_name} package has expired. Please upgrade to continue accessing premium features.`,
          type: "trial_expired",
        }));

        const { error: notifError } = await supabase
          .from("notifications")
          .insert(notifications);

        if (notifError) {
          console.error(`Failed to create notification for org ${expired.organization_id}:`, notifError);
        } else {
          console.log(`Notified admins for organization ${expired.organization_id}`);
        }

        return {
          organization_id: expired.organization_id,
          package_name: expired.package_name,
          notified_admins: admins.length,
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        console.error(`Error processing notifications for org ${expired.organization_id}:`, errorMessage);
        return null;
      }
    });

    const notificationResults = await Promise.all(notificationPromises);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Trial expiration check completed",
        expired_count: expiredPackages?.length || 0,
        notifications_sent: notificationResults.filter(r => r !== null).length,
        results: notificationResults,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Trial expiration error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
