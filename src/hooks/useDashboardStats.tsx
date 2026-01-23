import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect } from "react";

export const useDashboardStats = () => {
  const queryClient = useQueryClient();

  // Real-time updates for dashboard stats
  useEffect(() => {
    const channel = supabase
      .channel('dashboard-stats-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'trainees'
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['dashboard_stats'] });
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'trainers'
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['dashboard_stats'] });
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'fee_records'
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['dashboard_stats'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return useQuery({
    queryKey: ["dashboard_stats"],
    queryFn: async () => {
      // Get total trainees
      const { count: totalTrainees } = await supabase
        .from("trainees")
        .select("*", { count: "exact", head: true })
        .eq("status", "active");

      // Get total trainers
      const { count: totalTrainers } = await supabase
        .from("trainers")
        .select("*", { count: "exact", head: true })
        .eq("active", true);

      // Get fee statistics
      const { data: feeData } = await supabase
        .from("fee_records")
        .select("total_fee, amount_paid, balance");

      const totalFees = feeData?.reduce((sum, record) => sum + Number(record.total_fee), 0) || 0;
      const totalCollected = feeData?.reduce((sum, record) => sum + Number(record.amount_paid), 0) || 0;
      const totalOutstanding = feeData?.reduce((sum, record) => sum + Number(record.balance), 0) || 0;

      return {
        totalTrainees: totalTrainees || 0,
        totalTrainers: totalTrainers || 0,
        totalFees,
        totalCollected,
        totalOutstanding,
        collectionRate: totalFees > 0 ? ((totalCollected / totalFees) * 100).toFixed(1) : "0",
      };
    },
  });
};
