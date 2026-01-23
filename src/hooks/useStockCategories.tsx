import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganizationContext } from "./useOrganizationContext";
import { toast } from "sonner";

export interface StockCategory {
  id: string;
  organization_id: string;
  name: string;
  code: string;
  description: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export const useStockCategories = () => {
  const { organizationId } = useOrganizationContext();

  return useQuery({
    queryKey: ["stock-categories", organizationId],
    queryFn: async () => {
      if (!organizationId) throw new Error("Organization ID required");

      const { data, error } = await supabase
        .from("stock_categories")
        .select("*")
        .eq("organization_id", organizationId)
        .eq("active", true)
        .order("name");

      if (error) throw error;
      return data as StockCategory[];
    },
    enabled: !!organizationId,
  });
};

export const useCreateStockCategory = () => {
  const queryClient = useQueryClient();
  const { organizationId } = useOrganizationContext();

  return useMutation({
    mutationFn: async (category: Omit<StockCategory, "id" | "organization_id" | "created_at" | "updated_at">) => {
      if (!organizationId) throw new Error("Organization ID required");

      const { data, error } = await supabase
        .from("stock_categories")
        .insert({ ...category, organization_id: organizationId })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stock-categories"] });
      toast.success("Category created successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to create category: ${error.message}`);
    },
  });
};

export const useUpdateStockCategory = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<StockCategory> & { id: string }) => {
      const { data, error } = await supabase
        .from("stock_categories")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stock-categories"] });
      toast.success("Category updated successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to update category: ${error.message}`);
    },
  });
};
