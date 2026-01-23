import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useOrganizationContext } from "@/hooks/useOrganizationContext";

export interface SystemConfig {
  id: string;
  organization_id: string | null;
  config_key: string;
  config_value: Record<string, any>;
  description: string | null;
  is_global: boolean;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export const useSystemConfiguration = () => {
  const { organizationId } = useOrganizationContext();

  return useQuery({
    queryKey: ["system-configuration", organizationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("system_configuration")
        .select("*")
        .or(`is_global.eq.true,organization_id.eq.${organizationId}`)
        .order("config_key");

      if (error) throw error;
      return data as SystemConfig[];
    },
  });
};

export const useUpdateSystemConfig = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, config_value }: { id: string; config_value: Record<string, any> }) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { error } = await supabase
        .from("system_configuration")
        .update({
          config_value,
          updated_by: user?.id,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["system-configuration"] });
      toast({ title: "Configuration updated" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });
};

export const usePasswordPolicy = () => {
  const { organizationId } = useOrganizationContext();

  return useQuery({
    queryKey: ["password-policy", organizationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("password_policies")
        .select("*")
        .or(`organization_id.is.null,organization_id.eq.${organizationId}`)
        .eq("active", true)
        .order("organization_id", { ascending: false, nullsFirst: false })
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      return data;
    },
  });
};

export const useUpdatePasswordPolicy = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { organizationId } = useOrganizationContext();

  return useMutation({
    mutationFn: async (policy: Partial<{
      min_length: number;
      require_uppercase: boolean;
      require_lowercase: boolean;
      require_numbers: boolean;
      require_special_chars: boolean;
      max_age_days: number;
      prevent_reuse_count: number;
      lockout_attempts: number;
      lockout_duration_minutes: number;
    }>) => {
      // Check if org-specific policy exists
      const { data: existing } = await supabase
        .from("password_policies")
        .select("id")
        .eq("organization_id", organizationId)
        .single();

      if (existing) {
        const { error } = await supabase
          .from("password_policies")
          .update({ ...policy, updated_at: new Date().toISOString() })
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("password_policies")
          .insert({ organization_id: organizationId, ...policy });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["password-policy"] });
      toast({ title: "Password policy updated" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });
};
