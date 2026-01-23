import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganizationContext } from "./useOrganizationContext";
import { toast } from "sonner";

export interface StockMovement {
  id: string;
  organization_id: string;
  stock_item_id: string;
  movement_type: "inflow" | "outflow" | "adjustment";
  quantity: number;
  unit_cost: number | null;
  total_cost: number | null;
  reference_number: string | null;
  movement_date: string;
  issued_to: string | null;
  issued_by: string | null;
  department: string | null;
  notes: string | null;
  created_at: string;
  created_by: string;
  stock_items?: {
    item_name: string;
    item_code: string;
    unit_of_measure: string;
  };
  trainers?: {
    full_name: string;
  };
}

export const useStockMovements = (stockItemId?: string) => {
  const { organizationId } = useOrganizationContext();

  return useQuery({
    queryKey: ["stock-movements", organizationId, stockItemId],
    queryFn: async () => {
      if (!organizationId) throw new Error("Organization ID required");

      let query = supabase
        .from("stock_movements")
        .select(`
          *,
          stock_items (
            item_name,
            item_code,
            unit_of_measure
          ),
          trainers (
            full_name
          )
        `)
        .eq("organization_id", organizationId)
        .order("movement_date", { ascending: false });

      if (stockItemId) {
        query = query.eq("stock_item_id", stockItemId);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as StockMovement[];
    },
    enabled: !!organizationId,
  });
};

export const useCreateStockMovement = () => {
  const queryClient = useQueryClient();
  const { organizationId } = useOrganizationContext();

  return useMutation({
    mutationFn: async (movement: Omit<StockMovement, "id" | "organization_id" | "created_at" | "created_by" | "stock_items" | "trainers">) => {
      if (!organizationId) throw new Error("Organization ID required");

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      const { data, error } = await supabase
        .from("stock_movements")
        .insert({
          ...movement,
          organization_id: organizationId,
          created_by: user.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stock-movements"] });
      queryClient.invalidateQueries({ queryKey: ["stock-items"] });
      queryClient.invalidateQueries({ queryKey: ["low-stock-items"] });
      toast.success("Stock movement recorded successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to record movement: ${error.message}`);
    },
  });
};
