import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// Newer than the generated Supabase types, so access untyped.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export interface AdminAuditEntry {
  id: string;
  created_at: string;
  organization_id: string | null;
  actor_id: string | null;
  actor_name: string | null;
  actor_role: string | null;
  action: string;
  entity: string;
  entity_id: string | null;
  summary: string | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  details: Record<string, any>;
}

// What administrators changed. Centre admins see their own centre; super admins see every centre.
export const useAdminAuditLog = (limit = 500, organizationId?: string | null) =>
  useQuery({
    queryKey: ["admin-audit-log", limit, organizationId],
    queryFn: async () => {
      let query = db.from("admin_audit_log").select("*").order("created_at", { ascending: false }).limit(limit);
      if (organizationId) query = query.eq("organization_id", organizationId);
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as AdminAuditEntry[];
    },
  });
