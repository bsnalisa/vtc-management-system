import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useOrganizationContext } from "@/hooks/useOrganizationContext";

export interface StockAlert {
  id: string;
  organization_id: string;
  stock_item_id: string;
  alert_type: string;
  threshold_quantity: number;
  current_quantity: number;
  status: string;
  acknowledged_by: string | null;
  acknowledged_at: string | null;
  created_at: string;
  stock_items?: {
    item_name: string;
    item_code: string;
    reorder_level: number;
  };
}

export const useStockAlerts = () => {
  const { organizationId } = useOrganizationContext();

  return useQuery({
    queryKey: ["stock-alerts", organizationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stock_alerts")
        .select(`
          *,
          stock_items (item_name, item_code, reorder_level)
        `)
        .eq("status", "active")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as StockAlert[];
    },
    enabled: !!organizationId,
  });
};

export const useAcknowledgeAlert = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (alertId: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase
        .from("stock_alerts")
        .update({
          status: "acknowledged",
          acknowledged_by: user.id,
          acknowledged_at: new Date().toISOString(),
        })
        .eq("id", alertId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stock-alerts"] });
      toast({ title: "Alert acknowledged" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });
};

export const useStockAlertCount = () => {
  const { organizationId } = useOrganizationContext();

  return useQuery({
    queryKey: ["stock-alert-count", organizationId],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("stock_alerts")
        .select("*", { count: "exact", head: true })
        .eq("status", "active");

      if (error) throw error;
      return count || 0;
    },
    enabled: !!organizationId,
  });
};
