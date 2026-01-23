import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganizationContext } from "./useOrganizationContext";
import { toast } from "sonner";

export interface AssetDepreciation {
  id: string;
  organization_id: string;
  asset_id: string;
  depreciation_year: number;
  opening_value: number;
  depreciation_amount: number;
  closing_value: number;
  calculation_date: string;
  notes: string | null;
  created_at: string;
}

export const useAssetDepreciation = (assetId?: string) => {
  const { organizationId } = useOrganizationContext();

  return useQuery({
    queryKey: ["asset-depreciation", organizationId, assetId],
    queryFn: async () => {
      if (!organizationId) throw new Error("Organization ID required");

      let query = supabase
        .from("asset_depreciation")
        .select("*")
        .eq("organization_id", organizationId)
        .order("depreciation_year", { ascending: false });

      if (assetId) {
        query = query.eq("asset_id", assetId);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as AssetDepreciation[];
    },
    enabled: !!organizationId,
  });
};

export const useCalculateDepreciation = () => {
  const queryClient = useQueryClient();
  const { organizationId } = useOrganizationContext();

  return useMutation({
    mutationFn: async ({ 
      assetId, 
      year, 
      openingValue, 
      depreciationRate 
    }: { 
      assetId: string; 
      year: number; 
      openingValue: number; 
      depreciationRate: number;
    }) => {
      if (!organizationId) throw new Error("Organization ID required");

      const depreciationAmount = (openingValue * depreciationRate) / 100;
      const closingValue = openingValue - depreciationAmount;

      const { data, error } = await supabase
        .from("asset_depreciation")
        .insert({
          organization_id: organizationId,
          asset_id: assetId,
          depreciation_year: year,
          opening_value: openingValue,
          depreciation_amount: depreciationAmount,
          closing_value: closingValue,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["asset-depreciation"] });
      toast.success("Depreciation calculated successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to calculate depreciation: ${error.message}`);
    },
  });
};
