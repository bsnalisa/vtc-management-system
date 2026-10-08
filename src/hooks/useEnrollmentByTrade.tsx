import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganizationContext } from "./useOrganizationContext";

/** Active trainees of the centre grouped by trade (real counts, largest first). */
export const useEnrollmentByTrade = () => {
  const { organizationId } = useOrganizationContext();
  return useQuery({
    queryKey: ["enrollment-by-trade", organizationId],
    enabled: !!organizationId,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trainees")
        .select("trade_id, trades(name)")
        .eq("organization_id", organizationId!)
        .eq("status", "active")
        .limit(5000);
      if (error) throw error;
      const counts = new Map<string, number>();
      for (const row of data ?? []) {
        const name = (row as { trades?: { name?: string } | null }).trades?.name ?? "No trade";
        counts.set(name, (counts.get(name) ?? 0) + 1);
      }
      return [...counts.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 12);
    },
  });
};
