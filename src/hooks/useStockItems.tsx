import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganizationContext } from "./useOrganizationContext";
import { toast } from "sonner";

export interface StockItem {
  id: string;
  organization_id: string;
  category_id: string;
  item_code: string;
  item_name: string;
  description: string | null;
  unit_of_measure: string;
  unit_cost: number;
  current_quantity: number;
  reorder_level: number;
  location: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
  stock_categories?: {
    name: string;
    code: string;
  };
}

export const useStockItems = () => {
  const { organizationId } = useOrganizationContext();

  return useQuery({
    queryKey: ["stock-items", organizationId],
    queryFn: async () => {
      if (!organizationId) throw new Error("Organization ID required");

      const { data, error } = await supabase
        .from("stock_items")
        .select(`
          *,
          stock_categories (
            name,
            code
          )
        `)
        .eq("organization_id", organizationId)
        .eq("active", true)
        .order("item_name");

      if (error) throw error;
      return data as StockItem[];
    },
    enabled: !!organizationId,
  });
};

export const useLowStockItems = () => {
  const { organizationId } = useOrganizationContext();

  return useQuery({
    queryKey: ["low-stock-items", organizationId],
    queryFn: async () => {
      if (!organizationId) throw new Error("Organization ID required");

      const { data, error } = await supabase
        .from("stock_items")
        .select(`
          *,
          stock_categories (
            name,
            code
          )
        `)
        .eq("organization_id", organizationId)
        .eq("active", true)
        .filter("current_quantity", "lte", "reorder_level")
        .order("item_name");

      if (error) throw error;
      return data as StockItem[];
    },
    enabled: !!organizationId,
  });
};

export const useCreateStockItem = () => {
  const queryClient = useQueryClient();
  const { organizationId } = useOrganizationContext();

  return useMutation({
    mutationFn: async (item: Omit<StockItem, "id" | "organization_id" | "created_at" | "updated_at" | "stock_categories">) => {
      if (!organizationId) throw new Error("Organization ID required");

      const { data, error } = await supabase
        .from("stock_items")
        .insert({ ...item, organization_id: organizationId })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stock-items"] });
      toast.success("Stock item created successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to create stock item: ${error.message}`);
    },
  });
};

export const useUpdateStockItem = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<StockItem> & { id: string }) => {
      const { data, error } = await supabase
        .from("stock_items")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stock-items"] });
      queryClient.invalidateQueries({ queryKey: ["low-stock-items"] });
      toast.success("Stock item updated successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to update stock item: ${error.message}`);
    },
  });
};
