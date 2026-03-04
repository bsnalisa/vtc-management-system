import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useOrganizationContext } from "./useOrganizationContext";

export interface AssessmentCycle {
  id: string;
  organization_id: string;
  academic_year: string;
  qualification_id: string;
  status: "open" | "locked" | "archived";
  locked_at: string | null;
  locked_by: string | null;
  lock_reason: string | null;
  results_release_date: string | null;
  created_at: string;
  updated_at: string;
  qualifications?: {
    qualification_title: string;
    qualification_code: string;
  };
}

export const useAssessmentCycles = (academicYear?: string) => {
  const { organizationId } = useOrganizationContext();

  return useQuery({
    queryKey: ["assessment-cycles", organizationId, academicYear],
    queryFn: async () => {
      if (!organizationId) return [];
      let query = (supabase as any)
        .from("assessment_cycles")
        .select(`*, qualifications:qualification_id(qualification_title, qualification_code)`)
        .eq("organization_id", organizationId)
        .order("created_at", { ascending: false });

      if (academicYear) query = query.eq("academic_year", academicYear);

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as AssessmentCycle[];
    },
    enabled: !!organizationId,
  });
};

export const useCycleStatus = (qualificationId?: string, academicYear?: string) => {
  const { organizationId } = useOrganizationContext();

  return useQuery({
    queryKey: ["cycle-status", organizationId, qualificationId, academicYear],
    queryFn: async () => {
      if (!organizationId || !qualificationId || !academicYear) return null;
      const { data, error } = await (supabase as any)
        .from("assessment_cycles")
        .select("*")
        .eq("organization_id", organizationId)
        .eq("qualification_id", qualificationId)
        .eq("academic_year", academicYear)
        .maybeSingle();
      if (error) throw error;
      return data as AssessmentCycle | null;
    },
    enabled: !!organizationId && !!qualificationId && !!academicYear,
  });
};

export const useLockCycle = () => {
  const { toast } = useToast();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ orgId, qualificationId, academicYear, reason }: {
      orgId: string; qualificationId: string; academicYear: string; reason?: string;
    }) => {
      const { data, error } = await supabase.rpc("lock_assessment_cycle" as any, {
        _org_id: orgId,
        _qualification_id: qualificationId,
        _academic_year: academicYear,
        _reason: reason || "End of assessment cycle",
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["assessment-cycles"] });
      qc.invalidateQueries({ queryKey: ["cycle-status"] });
      toast({ title: "Cycle Locked", description: "Assessment cycle has been locked. No further modifications allowed." });
    },
    onError: (e: Error) => {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    },
  });
};
