import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useOrganizationContext } from "@/hooks/useOrganizationContext";

export interface ProgressionRule {
  id: string;
  organization_id: string;
  trade_id: string | null;
  from_level: number;
  to_level: number;
  min_credits_required: number;
  min_competencies_required: number;
  min_attendance_percentage: number;
  max_outstanding_fees: number;
  active: boolean;
  created_at: string;
  trades?: { name: string };
}

export interface ProgressionCheckResult {
  can_progress: boolean;
  current_level: number;
  next_level: number;
  credits_completed: number;
  credits_required: number;
  attendance_percentage: number;
  attendance_required: number;
  outstanding_fees: number;
  max_fees_allowed: number;
  reasons: string[];
}

export const useProgressionRules = () => {
  const { organizationId } = useOrganizationContext();

  return useQuery({
    queryKey: ["progression-rules", organizationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("progression_rules")
        .select(`
          *,
          trades (name)
        `)
        .order("from_level");

      if (error) throw error;
      return data as ProgressionRule[];
    },
    enabled: !!organizationId,
  });
};

export const useCreateProgressionRule = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { organizationId } = useOrganizationContext();

  return useMutation({
    mutationFn: async (data: Omit<ProgressionRule, "id" | "organization_id" | "created_at" | "trades">) => {
      if (!organizationId) throw new Error("No organization");

      const { data: rule, error } = await supabase
        .from("progression_rules")
        .insert({
          organization_id: organizationId,
          ...data,
        })
        .select()
        .single();

      if (error) throw error;
      return rule;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["progression-rules"] });
      toast({ title: "Progression rule created" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });
};

export const useCheckTraineeProgression = () => {
  return useMutation({
    mutationFn: async (traineeId: string): Promise<ProgressionCheckResult | null> => {
      const { data, error } = await supabase
        .rpc("check_trainee_progression", { _trainee_id: traineeId });

      if (error) throw error;
      if (!data || data.length === 0) return null;
      
      return data[0] as ProgressionCheckResult;
    },
  });
};
