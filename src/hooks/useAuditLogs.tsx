import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const useAuditLogs = (organizationId?: string) => {
  return useQuery({
    queryKey: ["audit_logs", organizationId],
    queryFn: async () => {
      let query = supabase
        .from("system_audit_logs")
        .select(`
          *,
          user:user_id(email, profiles(full_name)),
          organization:organization_id(name)
        `)
        .order("created_at", { ascending: false })
        .limit(100);

      if (organizationId) {
        query = query.eq("organization_id", organizationId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });
};

export const useLogAuditEvent = () => {
  return useMutation({
    mutationFn: async ({
      action,
      tableName,
      recordId,
      oldData,
      newData,
    }: {
      action: string;
      tableName?: string;
      recordId?: string;
      oldData?: any;
      newData?: any;
    }) => {
      const { data, error } = await supabase.rpc("log_audit_event", {
        _action: action,
        _table_name: tableName,
        _record_id: recordId,
        _old_data: oldData,
        _new_data: newData,
      });

      if (error) throw error;
      return data;
    },
  });
};
