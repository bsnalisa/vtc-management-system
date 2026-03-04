import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganizationContext } from "./useOrganizationContext";

export const useAssessmentAuditLogs = (entityType?: string, limit = 100) => {
  const { organizationId } = useOrganizationContext();

  return useQuery({
    queryKey: ["assessment-audit-logs", organizationId, entityType, limit],
    queryFn: async () => {
      if (!organizationId) return [];
      let query = supabase
        .from("assessment_template_audit")
        .select("*")
        .eq("organization_id", organizationId)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (entityType) query = query.eq("entity_type", entityType);

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: !!organizationId,
  });
};
