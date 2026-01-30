import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useOrganizationContext } from "./useOrganizationContext";

export interface SymbolPointData {
  exam_level: string;
  symbol: string;
  points: number;
  active?: boolean;
}

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

export const useCreateSymbolPoint = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { organizationId } = useOrganizationContext();

  return useMutation({
    mutationFn: async (data: SymbolPointData) => {
      if (!organizationId) throw new Error("No organization selected");

      const { data: result, error } = await supabase
        .from("symbol_points")
        .insert({
          ...data,
          organization_id: organizationId,
          active: true,
        })
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["symbol_points"] });
      toast({
        title: "Success",
        description: "Symbol point created successfully",
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

export const useUpdateSymbolPoint = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<SymbolPointData> }) => {
      const { data: result, error } = await supabase
        .from("symbol_points")
        .update(data)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["symbol_points"] });
      toast({
        title: "Success",
        description: "Symbol point updated successfully",
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

export const useDeleteSymbolPoint = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("symbol_points")
        .update({ active: false })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["symbol_points"] });
      toast({
        title: "Success",
        description: "Symbol point deleted successfully",
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
