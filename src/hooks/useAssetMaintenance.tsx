import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganizationContext } from "./useOrganizationContext";
import { toast } from "sonner";

export interface AssetMaintenance {
  id: string;
  organization_id: string;
  asset_id: string;
  maintenance_type: string;
  maintenance_date: string;
  next_maintenance_date: string | null;
  cost: number | null;
  performed_by: string | null;
  description: string;
  notes: string | null;
  created_at: string;
  created_by: string;
  assets?: {
    asset_name: string;
    asset_code: string;
  };
}

export const useAssetMaintenance = (assetId?: string) => {
  const { organizationId } = useOrganizationContext();

  return useQuery({
    queryKey: ["asset-maintenance", organizationId, assetId],
    queryFn: async () => {
      if (!organizationId) throw new Error("Organization ID required");

      let query = supabase
        .from("asset_maintenance")
        .select(`
          *,
          assets (
            asset_name,
            asset_code
          )
        `)
        .eq("organization_id", organizationId)
        .order("maintenance_date", { ascending: false });

      if (assetId) {
        query = query.eq("asset_id", assetId);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as AssetMaintenance[];
    },
    enabled: !!organizationId,
  });
};

export const useCreateAssetMaintenance = () => {
  const queryClient = useQueryClient();
  const { organizationId } = useOrganizationContext();

  return useMutation({
    mutationFn: async (maintenance: Omit<AssetMaintenance, "id" | "organization_id" | "created_at" | "created_by" | "assets">) => {
      if (!organizationId) throw new Error("Organization ID required");

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      const { data, error } = await supabase
        .from("asset_maintenance")
        .insert({
          ...maintenance,
          organization_id: organizationId,
          created_by: user.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["asset-maintenance"] });
      toast.success("Maintenance record created successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to create maintenance record: ${error.message}`);
    },
  });
};
