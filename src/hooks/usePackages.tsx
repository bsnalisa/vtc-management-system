import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface Package {
  id: string;
  name: string;
  price: number;
  billing_cycle: string;
  module_access: string[];
  limits: {
    max_trainees: number | null;
    max_trainers: number | null;
    max_classes: number | null;
    max_storage_mb: number | null;
  };
  description: string | null;
  features: string[];
  is_trial: boolean;
  trial_days: number;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface OrganizationPackage {
  id: string;
  organization_id: string;
  package_id: string;
  start_date: string;
  end_date: string | null;
  status: "active" | "expired" | "cancelled" | "suspended";
  is_trial: boolean;
  auto_renew: boolean;
  created_at: string;
  updated_at: string;
  packages?: Package;
}

export const usePackages = () => {
  return useQuery({
    queryKey: ["packages"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("packages")
        .select("*")
        .eq("active", true)
        .order("price");

      if (error) throw error;
      return data as Package[];
    },
  });
};

export const useOrganizationPackage = (organizationId: string | null) => {
  return useQuery({
    queryKey: ["organization-package", organizationId],
    queryFn: async () => {
      if (!organizationId) return null;

      const { data, error } = await supabase
        .from("organization_packages")
        .select(`
          *,
          packages (*)
        `)
        .eq("organization_id", organizationId)
        .eq("status", "active")
        .maybeSingle();

      if (error) throw error;
      return data as OrganizationPackage | null;
    },
    enabled: !!organizationId,
  });
};

export const useAssignPackage = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      organizationId,
      packageId,
      isTrial,
      trialDays,
    }: {
      organizationId: string;
      packageId: string;
      isTrial?: boolean;
      trialDays?: number;
    }) => {
      // Cancel any existing active packages first
      await supabase
        .from("organization_packages")
        .update({ status: "cancelled" })
        .eq("organization_id", organizationId)
        .eq("status", "active");

      // Assign new package
      const endDate = isTrial && trialDays
        ? new Date(Date.now() + trialDays * 24 * 60 * 60 * 1000).toISOString()
        : null;

      const { data, error } = await supabase
        .from("organization_packages")
        .insert([
          {
            organization_id: organizationId,
            package_id: packageId,
            is_trial: isTrial || false,
            end_date: endDate,
            status: "active",
          },
        ])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["organization-package"] });
      queryClient.invalidateQueries({ queryKey: ["organizations"] });
      toast({
        title: "Success",
        description: "Package assigned successfully",
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

export const useUpgradePackage = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      organizationId,
      newPackageId,
    }: {
      organizationId: string;
      newPackageId: string;
    }) => {
      // Cancel current package
      await supabase
        .from("organization_packages")
        .update({ status: "cancelled" })
        .eq("organization_id", organizationId)
        .eq("status", "active");

      // Assign new package
      const { data, error } = await supabase
        .from("organization_packages")
        .insert([
          {
            organization_id: organizationId,
            package_id: newPackageId,
            is_trial: false,
            status: "active",
          },
        ])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["organization-package"] });
      toast({
        title: "Success",
        description: "Package upgraded successfully",
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

export const useBillingRecords = (organizationId: string | null) => {
  return useQuery({
    queryKey: ["billing-records", organizationId],
    queryFn: async () => {
      if (!organizationId) return [];

      const { data, error } = await supabase
        .from("billing_records")
        .select("*")
        .eq("organization_id", organizationId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!organizationId,
  });
};
