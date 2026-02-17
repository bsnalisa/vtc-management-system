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
        .eq("active", true);

      // Fetch active trainers from user_roles (the real source of truth)
      const { data: trainerRoles } = await db
        .from("user_roles")
        .select("user_id")
        .eq("role", "trainer");
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

// Hook to fetch active trainers with their profile info (from user_roles + profiles)
export const useActiveTrainers = () => {
  return useQuery({
    queryKey: ["active_trainers_from_roles"],
    queryFn: async () => {
      const db: any = supabase;
      // Get all user_ids with trainer role
      const { data: trainerRoles, error: rolesError } = await db
        .from("user_roles")
        .select("user_id")
        .eq("role", "trainer");
      if (rolesError) throw rolesError;
      if (!trainerRoles || trainerRoles.length === 0) return [];

      const trainerUserIds = trainerRoles.map((r: any) => r.user_id);

      // Get profile info for these users
      const { data: profiles, error: profilesError } = await db
        .from("profiles")
        .select("id, firstname, surname, email, phone")
        .in("id", trainerUserIds);
      if (profilesError) throw profilesError;
      return profiles || [];
    },
  });
};
