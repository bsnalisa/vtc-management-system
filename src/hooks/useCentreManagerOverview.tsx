import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganizationContext } from "./useOrganizationContext";

// The overview function is newer than the generated Supabase types, so call it untyped.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export interface CentreOverview {
  trainees: { total: number; active: number; by_status: { status: string; count: number }[]; by_trade: { trade: string; count: number }[] };
  applications: { this_month: number; last_month: number; trend: { month: string; count: number }[] };
  teaching: { classes: number; trainers: number };
  attendance: { rate: number | null; previous: number | null };
  results: { by_status: { status: string; count: number }[]; awaiting_approval: number; open_cycles: number };
  finance: {
    billed: number; collected: number; outstanding: number; debtors: number; collection_rate: number | null;
    hostel_overdue_count: number; hostel_overdue_amount: number; unreconciled_bank_lines: number;
  };
  people: { staff: number; on_leave_today: number; leave_pending: number };
  attention: { open_tickets: number; deferrals_pending: number; maintenance_open: number; workflows_running: number; oldest_workflow_days: number | null };
  generated_at: string;
}

export const useCentreManagerOverview = () => {
  const { organizationId: org } = useOrganizationContext();
  return useQuery({
    queryKey: ["centre-manager-overview", org],
    enabled: !!org,
    refetchInterval: 5 * 60_000,
    queryFn: async (): Promise<CentreOverview> => {
      const { data, error } = await db.rpc("centre_manager_overview", { _org: org });
      if (error) throw error;
      return data as CentreOverview;
    },
  });
};
