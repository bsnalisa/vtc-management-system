import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganizationContext } from "@/hooks/useOrganizationContext";

export const useHODStats = () => {
  const { organizationId } = useOrganizationContext();

  return useQuery({
    queryKey: ["hod_stats", organizationId],
    queryFn: async () => {
      const db: any = supabase;

      // Fetch trainees count
      const { count: traineeCount } = await db
        .from("trainees")
        .select("*", { count: "exact", head: true })
        .eq("organization_id", organizationId)
        .eq("status", "active");

      // Fetch active trainers from user_roles scoped to this org
      const { data: trainerRoles } = await db
        .from("user_roles")
        .select("user_id")
        .eq("role", "trainer")
        .eq("organization_id", organizationId);
      const trainerCount = trainerRoles?.length || 0;

      // Fetch classes count
      const { count: classCount } = await db
        .from("classes")
        .select("*", { count: "exact", head: true })
        .eq("organization_id", organizationId)
        .eq("active", true);

      // Fetch trades count
      const { count: tradeCount } = await db
        .from("trades")
        .select("*", { count: "exact", head: true })
        .eq("organization_id", organizationId)
        .eq("active", true);

      // Fetch approved qualifications count
      const { count: qualificationCount } = await db
        .from("qualifications")
        .select("*", { count: "exact", head: true })
        .eq("organization_id", organizationId)
        .eq("status", "approved");

      // Fetch assessment results for competency rate
      const { data: assessmentResults } = await db
        .from("assessment_results")
        .select("competency_status")
        .limit(1000);

      const totalAssessments = assessmentResults?.length || 0;
      const competentCount = assessmentResults?.filter(
        (r: any) => r.competency_status === "competent"
      ).length || 0;
      const competencyRate = totalAssessments > 0 
        ? Math.round((competentCount / totalAssessments) * 100) 
        : 0;

      return {
        totalTrainees: traineeCount || 0,
        totalTrainers: trainerCount,
        totalClasses: classCount || 0,
        totalTrades: tradeCount || 0,
        totalQualifications: qualificationCount || 0,
        competencyRate,
      };
    },
    enabled: !!organizationId,
    staleTime: 5 * 60 * 1000,
  });
};

// Hook to fetch active trainers with their profile info (from trainers table)
export const useActiveTrainers = (organizationId?: string) => {
  return useQuery({
    queryKey: ["active_trainers_from_roles", organizationId],
    queryFn: async () => {
      const db: any = supabase;
      // Get trainers directly from the trainers table
      let query = db.from("trainers").select("id, user_id, full_name, email, phone, designation").eq("active", true);
      if (organizationId) query = query.eq("organization_id", organizationId);

      const { data: trainers, error } = await query;
      if (error) throw error;
      if (!trainers || trainers.length === 0) return [];

      return trainers.map((t: any) => ({
        id: t.id, // This is the trainers table id, which trainer_qualifications references
        user_id: t.user_id,
        full_name: t.full_name,
        email: t.email,
        phone: t.phone,
        firstname: t.full_name?.split(" ")[0] || "",
        surname: t.full_name?.split(" ").slice(1).join(" ") || "",
        display_name: t.full_name || t.email || "Unknown",
      }));
    },
    enabled: true,
  });
};
