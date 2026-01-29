import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganizationContext } from "./useOrganizationContext";

export const useTrades = () => {
  const { organizationId } = useOrganizationContext();

  return useQuery({
    queryKey: ["trades", organizationId],
    queryFn: async () => {
      let query = supabase
        .from("trades")
        .select("*")
        .eq("active", true)
        .order("name");

      // Include global trades (null org_id) and org-specific trades
      if (organizationId) {
        query = query.or(`organization_id.is.null,organization_id.eq.${organizationId}`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });
};
