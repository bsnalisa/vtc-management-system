import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganizationContext } from "./useOrganizationContext";

export const useTrades = (organizationIdOverride?: string) => {
  const { organizationId: contextOrgId } = useOrganizationContext();
  const organizationId = organizationIdOverride || contextOrgId;

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

/**
 * Trades an applicant can choose: those with an approved qualification at the centre, so every
 * application can later be registered. Falls back to every trade if the lookup fails.
 */
export const useTradesOpenForApplication = (organizationIdOverride?: string) => {
  const { organizationId: contextOrgId } = useOrganizationContext();
  const organizationId = organizationIdOverride || contextOrgId;
  const trades = useTrades(organizationIdOverride);

  const open = useQuery({
    queryKey: ["trades-open-for-application", organizationId],
    enabled: !!organizationId,
    queryFn: async () => {
      // not in the generated types until they are regenerated after the migration
      const { data, error } = await (supabase.rpc as any)("trades_open_for_application", { _org_id: organizationId });
      if (error) throw error;
      return new Set((data ?? []) as unknown as string[]);
    },
  });

  const filtered = open.data ? (trades.data ?? []).filter((t) => open.data.has(t.id)) : trades.data;
  return {
    data: filtered,
    isLoading: trades.isLoading || (!!organizationId && open.isLoading),
    // true when the centre has trades but none can take applications yet
    noneOpen: !!open.data && (trades.data?.length ?? 0) > 0 && (filtered?.length ?? 0) === 0,
  };
};
