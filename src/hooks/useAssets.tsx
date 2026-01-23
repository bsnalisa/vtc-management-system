import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganizationContext } from "./useOrganizationContext";
import { toast } from "sonner";

export interface Asset {
  id: string;
  organization_id: string;
  category_id: string;
  asset_code: string;
  asset_name: string;
  description: string | null;
  serial_number: string | null;
  manufacturer: string | null;
  model: string | null;
  purchase_date: string | null;
  purchase_cost: number;
  current_value: number | null;
  depreciation_rate: number | null;
  useful_life_years: number | null;
  warranty_expiry: string | null;
  condition: "excellent" | "good" | "fair" | "poor" | "needs_repair";
  status: "active" | "under_repair" | "disposed" | "in_storage" | "retired";
  location: string | null;
  assigned_department: string | null;
  assigned_user: string | null;
  notes: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
  asset_categories?: {
    name: string;
    code: string;
  };
}

export const useAssets = (status?: string) => {
  const { organizationId } = useOrganizationContext();

  return useQuery({
    queryKey: ["assets", organizationId, status],
    queryFn: async () => {
      if (!organizationId) throw new Error("Organization ID required");

      let query = supabase
        .from("assets")
        .select(`
          *,
          asset_categories (
            name,
            code
          )
        `)
        .eq("organization_id", organizationId)
        .eq("active", true)
        .order("asset_name");

      if (status) {
        query = query.eq("status", status as any);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as Asset[];
    },
    enabled: !!organizationId,
  });
};

export const useAsset = (assetId: string | undefined) => {
  const { organizationId } = useOrganizationContext();

  return useQuery({
    queryKey: ["asset", assetId],
    queryFn: async () => {
      if (!assetId) throw new Error("Asset ID required");

      const { data, error } = await supabase
        .from("assets")
        .select(`
          *,
          asset_categories (
            name,
            code
          )
        `)
        .eq("id", assetId)
        .single();

      if (error) throw error;
      return data as Asset;
    },
    enabled: !!assetId && !!organizationId,
  });
};

export const useCreateAsset = () => {
  const queryClient = useQueryClient();
  const { organizationId } = useOrganizationContext();

  return useMutation({
    mutationFn: async (asset: Omit<Asset, "id" | "organization_id" | "created_at" | "updated_at" | "asset_categories">) => {
      if (!organizationId) throw new Error("Organization ID required");

      const { data, error } = await supabase
        .from("assets")
        .insert([{ ...asset, organization_id: organizationId }])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assets"] });
      toast.success("Asset created successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to create asset: ${error.message}`);
    },
  });
};

export const useUpdateAsset = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Asset> & { id: string }) => {
      // Remove fields that shouldn't be in the update
      const { asset_categories, organization_id, ...cleanUpdates } = updates as any;
      
      const { data, error } = await supabase
        .from("assets")
        .update(cleanUpdates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assets"] });
      queryClient.invalidateQueries({ queryKey: ["asset"] });
      toast.success("Asset updated successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to update asset: ${error.message}`);
    },
  });
};

export const useAssetCategories = () => {
  const { organizationId } = useOrganizationContext();

  return useQuery({
    queryKey: ["asset-categories", organizationId],
    queryFn: async () => {
      if (!organizationId) throw new Error("Organization ID required");

      const { data, error } = await supabase
        .from("asset_categories")
        .select("*")
        .eq("organization_id", organizationId)
        .eq("active", true)
        .order("name");

      if (error) throw error;
      return data;
    },
    enabled: !!organizationId,
  });
};

export const useCreateAssetCategory = () => {
  const queryClient = useQueryClient();
  const { organizationId } = useOrganizationContext();

  return useMutation({
    mutationFn: async (category: { name: string; code: string; description?: string }) => {
      if (!organizationId) throw new Error("Organization ID required");

      const { data, error } = await supabase
        .from("asset_categories")
        .insert({ ...category, organization_id: organizationId })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["asset-categories"] });
      toast.success("Category created successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to create category: ${error.message}`);
    },
  });
};
