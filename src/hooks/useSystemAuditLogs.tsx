import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const useSystemAuditLogs = (limit = 50, organizationId?: string | null) => {
  return useQuery({
    queryKey: ["system_audit_logs", limit, organizationId],
    queryFn: async () => {
      let query = supabase
        .from("system_audit_logs" as any)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(limit);

      if (organizationId) {
        query = query.eq("organization_id", organizationId);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data;
    },
  });
};

export const useSystemConfig = () => {
  return useQuery({
    queryKey: ["system_config"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("system_config" as any)
        .select("*")
        .order("config_key");

      if (error) throw error;
      return data;
    },
  });
};
