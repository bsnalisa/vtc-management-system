import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganizationContext } from "./useOrganizationContext";

export const useGlobalSearch = (query: string, enabled: boolean = true) => {
  const { organizationId } = useOrganizationContext();

  return useQuery({
    queryKey: ["global_search", query, organizationId],
    queryFn: async () => {
      if (!query || query.length < 2) {
        return [];
      }

      const { data, error } = await supabase.rpc("global_search", {
        search_query: query,
        org_id: organizationId,
        search_limit: 50,
      });

      if (error) throw error;
      return data || [];
    },
    enabled: enabled && query.length >= 2,
  });
};
