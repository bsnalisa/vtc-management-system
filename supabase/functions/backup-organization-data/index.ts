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

    // Get all active organizations
    const { data: organizations, error: orgError } = await supabase
      .from("organizations")
      .select("id, name")
      .eq("active", true);

    if (orgError) throw orgError;

    const backupResults = [];

    for (const org of organizations || []) {
      console.log(`Starting backup for organization: ${org.name}`);

      // Fetch all organization data
      const [trainees, trainers, classes, feeRecords, assessments] = await Promise.all([
        supabase.from("trainees").select("*").eq("organization_id", org.id),
        supabase.from("trainers").select("*").eq("organization_id", org.id),
        supabase.from("classes").select("*").eq("organization_id", org.id),
        supabase.from("fee_records").select("*").eq("organization_id", org.id),
        supabase.from("attendance_registers").select("*").eq("organization_id", org.id),
      ]);

      const backupData = {
        organization: org,
        timestamp: new Date().toISOString(),
        data: {
          trainees: trainees.data || [],
          trainers: trainers.data || [],
          classes: classes.data || [],
          fee_records: feeRecords.data || [],
          attendance_registers: assessments.data || [],
        },
      };

      // Create backup filename
      const filename = `backups/${org.id}/${new Date().toISOString().split("T")[0]}_backup.json`;

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from("organization-backups")
        .upload(filename, JSON.stringify(backupData, null, 2), {
          contentType: "application/json",
          upsert: false,
        });

      if (uploadError) {
        console.error(`Backup failed for ${org.name}:`, uploadError);
        backupResults.push({
          organization: org.name,
          status: "failed",
          error: uploadError.message,
        });
      } else {
        console.log(`Backup completed for ${org.name}`);
        backupResults.push({
          organization: org.name,
          status: "success",
          filename,
        });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Backup process completed",
        results: backupResults,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Backup error:", error);
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
