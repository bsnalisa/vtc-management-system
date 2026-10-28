import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export const useRequisitionSupervisor = (organizationId: string | null | undefined) =>
  useQuery({
    queryKey: ["requisition-supervisor", organizationId],
    enabled: !!organizationId,
    queryFn: async () => {
      const { data, error } = await db.rpc("requisition_my_supervisor", { _org: organizationId });
      if (error) throw error;
      return data as { valid: boolean; supervisors: { name: string; role: string | null }[] };
    },
  });
