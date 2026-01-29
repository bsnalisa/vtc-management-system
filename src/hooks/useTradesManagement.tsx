import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useOrganizationContext } from "./useOrganizationContext";

export interface Trade {
  id: string;
  name: string;
  code: string;
  description: string | null;
  active: boolean;
  organization_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateTradeData {
  name: string;
  code: string;
  description?: string;
  active?: boolean;
}

// Fetch all trades for the organization
export const useTradesForOrg = () => {
  const { organizationId } = useOrganizationContext();

  return useQuery({
    queryKey: ["trades", organizationId],
    queryFn: async () => {
      let query = supabase
        .from("trades")
        .select("*")
        .order("name");

      // Include global trades (null org_id) and org-specific trades
      if (organizationId) {
        query = query.or(`organization_id.is.null,organization_id.eq.${organizationId}`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Trade[];
    },
  });
};

// Create trade mutation
export const useCreateTrade = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { organizationId } = useOrganizationContext();

  return useMutation({
    mutationFn: async (data: CreateTradeData) => {
      const { data: result, error } = await supabase
        .from("trades")
        .insert([{
          ...data,
          organization_id: organizationId,
        }])
        .select()
        .single();

      if (error) throw error;
      return result as Trade;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trades"] });
      toast({
        title: "Success",
        description: "Trade created successfully",
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

// Update trade mutation
export const useUpdateTrade = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...data }: Partial<Trade> & { id: string }) => {
      const { data: result, error } = await supabase
        .from("trades")
        .update(data)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return result as Trade;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trades"] });
      toast({
        title: "Success",
        description: "Trade updated successfully",
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

// Delete trade mutation
export const useDeleteTrade = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("trades")
        .delete()
        .eq("id", id);

      if (error) throw error;
      return { id };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trades"] });
      toast({
        title: "Success",
        description: "Trade deleted successfully",
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
