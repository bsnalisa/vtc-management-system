import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface AuditLog {
  id: string;
  super_admin_id: string;
  action: string;
  target_organization_id: string | null;
  affected_table: string | null;
  affected_record_id: string | null;
  old_data: any;
  new_data: any;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

export const useSuperAdminAuditLogs = (limit = 50) => {
  return useQuery({
    queryKey: ["super_admin_audit_logs", limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("super_admin_audit_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data as AuditLog[];
    },
    staleTime: 30 * 1000, // 30 seconds
  });
};

export const useLogSuperAdminAction = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      action,
      targetOrgId,
      affectedTable,
      affectedRecordId,
      oldData,
      newData,
    }: {
      action: string;
      targetOrgId?: string;
      affectedTable?: string;
      affectedRecordId?: string;
      oldData?: any;
      newData?: any;
    }) => {
      const { data, error } = await supabase.rpc("log_super_admin_action", {
        _action: action,
        _target_org_id: targetOrgId || null,
        _affected_table: affectedTable || null,
        _affected_record_id: affectedRecordId || null,
        _old_data: oldData ? JSON.stringify(oldData) : null,
        _new_data: newData ? JSON.stringify(newData) : null,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["super_admin_audit_logs"] });
    },
  });
};

export const useLoginAttempts = (limit = 100) => {
  return useQuery({
    queryKey: ["login_attempts", limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("login_attempts")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data;
    },
    staleTime: 60 * 1000, // 1 minute
  });
};

export const useLogLoginAttempt = () => {
  return useMutation({
    mutationFn: async ({
      email,
      success,
      failureReason,
    }: {
      email: string;
      success: boolean;
      failureReason?: string;
    }) => {
      const { error } = await supabase.from("login_attempts").insert({
        email,
        success,
        failure_reason: failureReason || null,
      });

      if (error) throw error;
    },
  });
};
