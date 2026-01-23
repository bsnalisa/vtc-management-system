import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useOrganizationContext } from "./useOrganizationContext";

export interface EntryRequirementData {
  trade_id: string;
  level: number;
  requirement_name: string;
  min_grade?: number;
  min_points?: number;
  english_symbol?: string;
  maths_symbol?: string;
  science_symbol?: string;
  prevocational_symbol?: string;
  requires_previous_level?: boolean;
  previous_level_required?: number;
  mature_age_entry?: boolean;
  mature_min_age?: number;
  mature_min_experience_years?: number;
  additional_requirements?: string;
}

export const useEntryRequirements = (tradeId?: string, level?: number) => {
  const { organizationId } = useOrganizationContext();

  return useQuery({
    queryKey: ["entry_requirements", organizationId, tradeId, level],
    queryFn: async () => {
      let query = supabase
        .from("entry_requirements")
        .select(`
          *,
          trades:trade_id (
            id,
            name,
            code
          )
        `)
        .eq("organization_id", organizationId!)
        .eq("active", true)
        .order("level");

      if (tradeId) {
        query = query.eq("trade_id", tradeId);
      }
      if (level !== undefined) {
        query = query.eq("level", level);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!organizationId,
  });
};

export const useCreateEntryRequirement = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { organizationId } = useOrganizationContext();

  return useMutation({
    mutationFn: async (data: EntryRequirementData) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      if (!organizationId) throw new Error("No organization selected");

      const { data: result, error } = await supabase
        .from("entry_requirements")
        .insert({
          ...data,
          organization_id: organizationId,
          created_by: user.id,
        })
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["entry_requirements"] });
      toast({
        title: "Success",
        description: "Entry requirement created successfully!",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });
};

export const useUpdateEntryRequirement = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<EntryRequirementData> }) => {
      const { data: result, error } = await supabase
        .from("entry_requirements")
        .update(data)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["entry_requirements"] });
      toast({
        title: "Success",
        description: "Entry requirement updated successfully!",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });
};

export const useSymbolPoints = () => {
  const { organizationId } = useOrganizationContext();

  return useQuery({
    queryKey: ["symbol_points", organizationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("symbol_points")
        .select("*")
        .eq("organization_id", organizationId!)
        .eq("active", true)
        .order("exam_level")
        .order("points", { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!organizationId,
  });
};

export const useCalculatePoints = () => {
  const { organizationId } = useOrganizationContext();
  const { data: symbolPoints } = useSymbolPoints();

  const calculatePoints = (subjects: { exam_level: string; symbol: string }[]) => {
    if (!symbolPoints || subjects.length === 0) return 0;

    let totalPoints = 0;
    for (const subject of subjects) {
      const point = symbolPoints.find(
        sp => sp.exam_level === subject.exam_level && sp.symbol === subject.symbol
      );
      totalPoints += point?.points || 0;
    }
    return totalPoints;
  };

  return { calculatePoints, symbolPoints };
};
