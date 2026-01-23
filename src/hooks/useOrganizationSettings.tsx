import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useOrganizationContext } from "./useOrganizationContext";

export interface OrganizationSettings {
  id: string;
  organization_id: string;
  logo_url: string | null;
  color_theme: {
    primary: string;
    secondary: string;
    accent: string;
  };
  favicon: string | null;
  domain: string | null;
  organization_name: string | null;
  trainee_id_prefix: string | null;
  created_at: string;
  updated_at: string;
}

export interface UpdateOrganizationSettingsData {
  logo_url?: string;
  color_theme?: {
    primary: string;
    secondary: string;
    accent: string;
  };
  favicon?: string;
  domain?: string;
  organization_name?: string;
  trainee_id_prefix?: string;
}

export const useOrganizationSettings = () => {
  const { organizationId } = useOrganizationContext();

  return useQuery({
    queryKey: ["organization-settings", organizationId],
    queryFn: async () => {
      if (!organizationId) return null;

      // Fetch both organization_settings and organizations table data
      const [settingsResult, orgResult] = await Promise.all([
        supabase
          .from("organization_settings")
          .select("*")
          .eq("organization_id", organizationId)
          .maybeSingle(),
        supabase
          .from("organizations")
          .select("trainee_id_prefix")
          .eq("id", organizationId)
          .single()
      ]);

      if (settingsResult.error) throw settingsResult.error;
      
      // Merge trainee_id_prefix from organizations table
      return {
        ...settingsResult.data,
        trainee_id_prefix: orgResult.data?.trainee_id_prefix || 'VTC'
      } as OrganizationSettings | null;
    },
    enabled: !!organizationId,
    staleTime: 15 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
  });
};

export const useUpdateOrganizationSettings = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { organizationId } = useOrganizationContext();

  return useMutation({
    mutationFn: async (settingsData: UpdateOrganizationSettingsData) => {
      if (!organizationId) throw new Error("No organization ID");

      const { trainee_id_prefix, ...otherSettings } = settingsData;

      // Update trainee_id_prefix in organizations table if provided
      if (trainee_id_prefix !== undefined) {
        const { error: orgError } = await supabase
          .from("organizations")
          .update({ trainee_id_prefix })
          .eq("id", organizationId);

        if (orgError) throw orgError;
      }

      // Update other settings in organization_settings table
      const { data: existing } = await supabase
        .from("organization_settings")
        .select("id")
        .eq("organization_id", organizationId)
        .maybeSingle();

      if (existing) {
        const { data, error } = await supabase
          .from("organization_settings")
          .update(otherSettings)
          .eq("organization_id", organizationId)
          .select()
          .single();

        if (error) throw error;
        return data;
      } else {
        const { data, error } = await supabase
          .from("organization_settings")
          .insert([{ organization_id: organizationId, ...otherSettings }])
          .select()
          .single();

        if (error) throw error;
        return data;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["organization-settings"] });
      queryClient.invalidateQueries({ queryKey: ["organization"] });
      
      toast({
        title: "Success",
        description: "Organization settings updated successfully",
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
