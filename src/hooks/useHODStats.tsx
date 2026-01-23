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

      // Fetch trainers count
      const { count: trainerCount } = await db
        .from("trainers")
        .select("*", { count: "exact", head: true })
        .eq("organization_id", organizationId)
        .eq("active", true);

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
        totalTrainers: trainerCount || 0,
        totalClasses: classCount || 0,
        totalTrades: tradeCount || 0,
        competencyRate,
      };
    },
    enabled: !!organizationId,
    staleTime: 5 * 60 * 1000,
  });
};
