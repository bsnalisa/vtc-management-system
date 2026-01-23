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
    const url = new URL(req.url);
    const path = url.pathname.replace("/api-gateway/", "");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Authentication check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Route handling
    switch (path) {
      case "analytics/organization": {
        const orgId = url.searchParams.get("org_id");
        if (!orgId) {
          return new Response(
            JSON.stringify({ error: "org_id required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Fetch comprehensive analytics
        const [traineesRes, trainersRes, classesRes, feesRes] = await Promise.all([
          supabase.from("trainees").select("*", { count: "exact", head: true }).eq("organization_id", orgId).eq("status", "active"),
          supabase.from("trainers").select("*", { count: "exact", head: true }).eq("organization_id", orgId).eq("active", true),
          supabase.from("classes").select("*", { count: "exact", head: true }).eq("organization_id", orgId).eq("active", true),
          supabase.from("fee_records").select("total_fee, amount_paid, balance").eq("organization_id", orgId),
        ]);

        const totalFees = feesRes.data?.reduce((sum, r) => sum + Number(r.total_fee), 0) || 0;
        const collected = feesRes.data?.reduce((sum, r) => sum + Number(r.amount_paid), 0) || 0;

        return new Response(
          JSON.stringify({
            organization_id: orgId,
            metrics: {
              total_trainees: traineesRes.count || 0,
              total_trainers: trainersRes.count || 0,
              total_classes: classesRes.count || 0,
              total_fees: totalFees,
              collected_fees: collected,
              collection_rate: totalFees > 0 ? ((collected / totalFees) * 100).toFixed(2) : "0",
            },
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "analytics/system": {
        // Super admin only
        const { data: roles } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id)
          .eq("role", "super_admin")
          .single();

        if (!roles) {
          return new Response(
            JSON.stringify({ error: "Forbidden" }),
            { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const [orgsRes, usersRes, packagesRes] = await Promise.all([
          supabase.from("organizations").select("*", { count: "exact", head: true }),
          supabase.from("profiles").select("*", { count: "exact", head: true }),
          supabase.from("organization_packages").select("package_id, packages(name)").eq("status", "active"),
        ]);

        return new Response(
          JSON.stringify({
            metrics: {
              total_organizations: orgsRes.count || 0,
              total_users: usersRes.count || 0,
              active_packages: packagesRes.data?.length || 0,
            },
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "search": {
        const query = url.searchParams.get("q");
        const orgId = url.searchParams.get("org_id");
        const limit = parseInt(url.searchParams.get("limit") || "50");

        if (!query) {
          return new Response(
            JSON.stringify({ error: "Search query required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const { data, error } = await supabase.rpc("global_search", {
          search_query: query,
          org_id: orgId || null,
          search_limit: limit,
        });

        if (error) throw error;

        return new Response(
          JSON.stringify({ results: data }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "integrations/sync": {
        // Integration endpoint for MTC/NTA data sync
        const body = await req.json();
        
        // Log sync attempt
        await supabase.from("system_audit_logs").insert({
          user_id: user.id,
          action: "external_sync_attempt",
          new_data: {
            source: body.source,
            record_count: body.records?.length || 0,
          },
        });

        // Placeholder for actual integration logic
        return new Response(
          JSON.stringify({
            success: true,
            message: "Integration endpoint ready. Configure MTC/NTA credentials to enable sync.",
            records_received: body.records?.length || 0,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      default:
        return new Response(
          JSON.stringify({ error: "Endpoint not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
  } catch (error) {
    console.error("Error in api-gateway:", error);
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
