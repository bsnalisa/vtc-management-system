import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface Organization {
  id: string;
  name: string;
  package: "basic" | "extended" | "professional";
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateOrganizationData {
  name: string;
  package: "basic" | "extended" | "professional";
}

export const useOrganizations = () => {
  return useQuery({
    queryKey: ["organizations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("organizations")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as Organization[];
    },
  });
};

export const useCreateOrganization = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (orgData: CreateOrganizationData) => {
      const { data, error } = await supabase
        .from("organizations")
        .insert([orgData])
        .select()
        .single();

      if (error) throw error;

      // Get modules based on package
      const { data: modules } = await supabase
        .from("modules")
        .select("id, code");

      if (!modules) return data;

      const packageModules = getPackageModules(orgData.package);
      const moduleIds = modules
        .filter((m) => packageModules.includes(m.code))
        .map((m) => m.id);

      // Assign modules to organization
      await supabase.from("organization_modules").insert(
        moduleIds.map((moduleId) => ({
          organization_id: data.id,
          module_id: moduleId,
        }))
      );

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["organizations"] });
      toast({
        title: "Success",
        description: "Organization created successfully!",
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

export const useUpdateOrganization = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      updates,
    }: {
      id: string;
      updates: Partial<Organization>;
    }) => {
      const { data, error } = await supabase
        .from("organizations")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["organizations"] });
      toast({
        title: "Success",
        description: "Organization updated successfully!",
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

// Helper function to get modules for each package
function getPackageModules(packageType: "basic" | "extended" | "professional"): string[] {
  const basicModules = ["trainee_registration"];
  
  const extendedModules = [
    ...basicModules,
    "trainer_management",
    "assessments",
    "fee_management",
    "attendance",
    "timetable",
    "class_management",
    "announcements",
    "reports",
  ];

  const professionalModules = [
    ...extendedModules,
    // Add future modules here
  ];

  switch (packageType) {
    case "basic":
      return basicModules;
    case "extended":
      return extendedModules;
    case "professional":
      return professionalModules;
    default:
      return basicModules;
  }
}
