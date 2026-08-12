import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useOrganizationContext } from "./useOrganizationContext";

export interface OnlineApplicationFilters {
  source?: "all" | "online" | "staff";
  qualification_status?: string;
  registration_status?: string;
  trade_id?: string;
  intake?: string;
  academic_year?: string;
}

/** Applications received by the signed-in staff member's centre */
export const useOnlineApplications = (filters?: OnlineApplicationFilters) => {
  const { organizationId } = useOrganizationContext();

  return useQuery({
    queryKey: ["online_applications", filters, organizationId],
    queryFn: async () => {
      let query = supabase
        .from("trainee_applications")
        .select(
          `*, trades:trades!trainee_applications_trade_id_fkey (id, name, code)`
        )
        .eq("organization_id", organizationId!)
        .order("created_at", { ascending: false });

      if (filters?.source && filters.source !== "all") {
        query = query.eq("application_source", filters.source);
      }
      if (filters?.qualification_status && filters.qualification_status !== "all") {
        query = query.eq("qualification_status", filters.qualification_status);
      }
      if (filters?.registration_status && filters.registration_status !== "all") {
        query = query.eq("registration_status", filters.registration_status);
      }
      if (filters?.trade_id && filters.trade_id !== "all") {
        query = query.eq("trade_id", filters.trade_id);
      }
      if (filters?.intake && filters.intake !== "all") {
        query = query.eq("intake", filters.intake);
      }
      if (filters?.academic_year && filters.academic_year !== "all") {
        query = query.eq("academic_year", filters.academic_year);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as any[];
    },
    enabled: !!organizationId,
  });
};

/** Update the registration status of an application from the inbox */
export const useUpdateApplicationStatus = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      applicationId,
      registration_status,
    }: {
      applicationId: string;
      registration_status: string;
    }) => {
      const { data, error } = await supabase
        .from("trainee_applications")
        .update({ registration_status })
        .eq("id", applicationId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["online_applications"] });
      queryClient.invalidateQueries({ queryKey: ["trainee_applications"] });
      toast({ title: "Updated", description: "Application status updated." });
    },
    onError: (error: Error) => {
      toast({ title: "Update failed", description: error.message, variant: "destructive" });
    },
  });
};
