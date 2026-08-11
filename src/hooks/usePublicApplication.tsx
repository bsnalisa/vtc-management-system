import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ComprehensiveApplicationData } from "@/types/application";
import { buildApplicationInsert } from "@/lib/applicationMapper";

export interface PublicOrganization {
  id: string;
  name: string;
  subdomain: string | null;
  logo_url: string | null;
}

/** Public directory of active training centres (VTCs) */
export const useActiveOrganizations = () => {
  return useQuery({
    queryKey: ["public_organizations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("organizations")
        .select("id, name, subdomain, logo_url")
        .eq("active", true)
        .order("name");
      if (error) throw error;
      return data as PublicOrganization[];
    },
  });
};

/** Resolve a centre from its link name (subdomain) */
export const useOrganizationBySlug = (slug?: string) => {
  return useQuery({
    queryKey: ["public_organization", slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("organizations")
        .select("id, name, subdomain, logo_url")
        .eq("active", true)
        .eq("subdomain", slug!)
        .maybeSingle();
      if (error) throw error;
      return data as PublicOrganization | null;
    },
    enabled: !!slug,
  });
};

/** Submit an online application to a specific centre */
export const useSubmitOnlineApplication = (organizationId?: string) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (formData: ComprehensiveApplicationData) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Please sign in to submit your application");
      if (!organizationId) throw new Error("Please select a training centre");

      const payload = buildApplicationInsert(formData, organizationId, user.id, "online");

      const { data, error } = await supabase
        .from("trainee_applications")
        .insert([payload])
        .select()
        .single();

      if (error) {
        if (error.code === "23505" && error.message.includes("national_id")) {
          throw new Error("An application with this National ID already exists");
        }
        throw error;
      }
      return data;
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["my_applications"] });
      toast({
        title: "Application submitted",
        description: `Your reference number is ${data.application_number}. Track it under "My Applications".`,
      });
    },
    onError: (error: Error) => {
      toast({ title: "Submission failed", description: error.message, variant: "destructive" });
    },
  });
};

/** Applications submitted by the signed-in applicant */
export const useMyApplications = () => {
  return useQuery({
    queryKey: ["my_applications"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data, error } = await supabase
        .from("trainee_applications")
        .select("id, application_number, first_name, last_name, intake, academic_year, qualification_status, registration_status, created_at, organization_id, trades:trades!trainee_applications_trade_id_fkey(name, code)")
        .eq("created_by", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });
};
