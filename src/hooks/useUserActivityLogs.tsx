import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganizationContext } from "@/hooks/useOrganizationContext";

export interface UserActivityLog {
  id: string;
  user_id: string;
  organization_id: string | null;
  activity_type: string;
  module_code: string | null;
  description: string | null;
  ip_address: string | null;
  user_agent: string | null;
  metadata: Record<string, any> | null;
  created_at: string;
}

export const useUserActivityLogs = (userId?: string) => {
  const { organizationId } = useOrganizationContext();

  return useQuery({
    queryKey: ["user-activity-logs", organizationId, userId],
    queryFn: async () => {
      let query = supabase
        .from("user_activity_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);

      if (userId) {
        query = query.eq("user_id", userId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as UserActivityLog[];
    },
    enabled: !!organizationId,
  });
};

export const useLogUserActivity = () => {
  const { organizationId } = useOrganizationContext();

  return useMutation({
    mutationFn: async (data: {
      activity_type: string;
      module_code?: string;
      description?: string;
      metadata?: Record<string, any>;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from("user_activity_logs")
        .insert({
          user_id: user.id,
          organization_id: organizationId,
          activity_type: data.activity_type,
          module_code: data.module_code,
          description: data.description,
          metadata: data.metadata,
          user_agent: navigator.userAgent,
        });

      if (error) console.error("Failed to log activity:", error);
    },
  });
};

export const useActivitySummary = () => {
  const { organizationId } = useOrganizationContext();

  return useQuery({
    queryKey: ["activity-summary", organizationId],
    queryFn: async () => {
      const today = new Date();
      const lastWeek = new Date(today);
      lastWeek.setDate(lastWeek.getDate() - 7);

      const { data, error } = await supabase
        .from("user_activity_logs")
        .select("activity_type, created_at")
        .gte("created_at", lastWeek.toISOString());

      if (error) throw error;

      // Group by activity type
      const summary = data.reduce((acc, log) => {
        acc[log.activity_type] = (acc[log.activity_type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      // Group by day
      const daily = data.reduce((acc, log) => {
        const day = log.created_at.split('T')[0];
        acc[day] = (acc[day] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      return { byType: summary, byDay: daily, total: data.length };
    },
    enabled: !!organizationId,
  });
};
