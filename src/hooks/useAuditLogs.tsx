import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// system_audit_logs.user_id points at the auth schema, which the API cannot embed, so people are looked up separately
export async function attachAuditUsers<T extends { user_id: string | null }>(rows: T[]) {
  const ids = [...new Set(rows.map((r) => r.user_id).filter((x): x is string => !!x))];
  const people = new Map<string, { email: string | null; full_name: string | null }>();
  if (ids.length) {
    const { data } = await supabase.from("profiles").select("user_id, full_name, email").in("user_id", ids);
    (data ?? []).forEach((p) => people.set(p.user_id, { email: p.email, full_name: p.full_name }));
  }
  return rows.map((r) => {
    const p = r.user_id ? people.get(r.user_id) : undefined;
    return { ...r, user: p ? { email: p.email, profiles: { full_name: p.full_name } } : null };
  });
}

export const useAuditLogs = (organizationId?: string) => {
  return useQuery({
    queryKey: ["audit_logs", organizationId],
    queryFn: async () => {
      let query = supabase
        .from("system_audit_logs")
        .select(`
          *,
          organization:organization_id(name)
        `)
        .order("created_at", { ascending: false })
        .limit(100);

      if (organizationId) {
        query = query.eq("organization_id", organizationId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return attachAuditUsers(data ?? []);
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
