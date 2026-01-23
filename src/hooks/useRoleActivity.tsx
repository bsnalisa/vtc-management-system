import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "./useUserRole";

export interface RoleActivityLog {
  id: string;
  user_id: string;
  role: string;
  module_code: string;
  action: string;
  page_url: string | null;
  created_at: string;
}

export interface RoleActivitySummary {
  role: string;
  module_code: string;
  activity_count: number;
  unique_users: number;
  last_activity: string;
}

export const useRoleActivity = () => {
  return useQuery({
    queryKey: ["role-activity"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("role_activity_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) throw error;
      return data as RoleActivityLog[];
    },
  });
};

export const useRoleActivitySummary = () => {
  return useQuery({
    queryKey: ["role-activity-summary"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("role_activity_summary")
        .select("*");

      if (error) throw error;
      return data as RoleActivitySummary[];
    },
  });
};

export const useLogActivity = () => {
  const queryClient = useQueryClient();
  const { role } = useUserRole();

  return useMutation({
    mutationFn: async ({
      module_code,
      action,
      page_url,
    }: {
      module_code: string;
      action: string;
      page_url?: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !role) return;

      const { error } = await supabase.from("role_activity_logs").insert({
        user_id: user.id,
        role: role,
        module_code,
        action,
        page_url: page_url || window.location.pathname,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["role-activity"] });
      queryClient.invalidateQueries({ queryKey: ["role-activity-summary"] });
    },
  });
};
