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

    console.log("Starting scheduled report generation...");

    // Get current date info
    const now = new Date();
    const isMonthEnd = now.getDate() === new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const isWeekEnd = now.getDay() === 0; // Sunday

    const reportsGenerated = [];

    // Weekly reports (every Sunday)
    if (isWeekEnd) {
      console.log("Generating weekly reports...");
      
      // Get all active organizations
      const { data: organizations } = await supabase
        .from("organizations")
        .select("id, name")
        .eq("active", true);

      for (const org of organizations || []) {
        // Generate attendance summary
        const { data: attendanceData } = await supabase
          .from("attendance_records")
          .select(`
            *,
            trainee:trainees(first_name, last_name),
            register:attendance_registers(academic_year)
          `)
          .gte("attendance_date", new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString());

        if (attendanceData && attendanceData.length > 0) {
          const totalRecords = attendanceData.length;
          const presentCount = attendanceData.filter(r => r.present).length;
          const attendanceRate = ((presentCount / totalRecords) * 100).toFixed(2);

          // Create notification for HODs and Admins
          const { data: recipients } = await supabase
            .from("user_roles")
            .select("user_id")
            .eq("organization_id", org.id)
            .in("role", ["admin", "hod"]);

          if (recipients && recipients.length > 0) {
            await supabase.from("notifications").insert(
              recipients.map(r => ({
                user_id: r.user_id,
                type: "report",
                title: "Weekly Attendance Report",
                message: `Attendance rate for ${org.name} this week: ${attendanceRate}% (${presentCount}/${totalRecords})`,
              }))
            );
            reportsGenerated.push(`Attendance report for ${org.name}`);
          }
        }
      }
    }

    // Monthly reports (last day of month)
    if (isMonthEnd) {
      console.log("Generating monthly reports...");

      const { data: organizations } = await supabase
        .from("organizations")
        .select("id, name")
        .eq("active", true);

      for (const org of organizations || []) {
        // Generate fee collection summary
        const { data: feeData } = await supabase
          .from("fee_records")
          .select("total_fee, amount_paid, balance")
          .eq("organization_id", org.id);

        if (feeData && feeData.length > 0) {
          const totalFees = feeData.reduce((sum, r) => sum + Number(r.total_fee), 0);
          const totalCollected = feeData.reduce((sum, r) => sum + Number(r.amount_paid), 0);
          const collectionRate = ((totalCollected / totalFees) * 100).toFixed(2);

          // Notify finance officers and admins
          const { data: recipients } = await supabase
            .from("user_roles")
            .select("user_id")
            .eq("organization_id", org.id)
            .in("role", ["admin", "debtor_officer"]);

          if (recipients && recipients.length > 0) {
            await supabase.from("notifications").insert(
              recipients.map(r => ({
                user_id: r.user_id,
                type: "report",
                title: "Monthly Fee Collection Report",
                message: `Collection rate for ${org.name}: ${collectionRate}% (${totalCollected.toFixed(2)}/${totalFees.toFixed(2)})`,
              }))
            );
            reportsGenerated.push(`Fee report for ${org.name}`);
          }
        }
      }
    }

    console.log(`Generated ${reportsGenerated.length} reports`);

    return new Response(
      JSON.stringify({
        success: true,
        reports_generated: reportsGenerated.length,
        reports: reportsGenerated,
        is_week_end: isWeekEnd,
        is_month_end: isMonthEnd,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Error in scheduled-reports:", error);
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
