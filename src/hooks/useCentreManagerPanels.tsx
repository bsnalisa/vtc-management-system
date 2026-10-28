import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganizationContext } from "./useOrganizationContext";

// These functions are newer than the generated Supabase types.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export interface CmFinance {
  year: string | null; years: string[];
  fees: { billed: number; collected: number; outstanding: number; debtors: number; collection_rate: number | null };
  budgets: { department: string; total: number; spent: number; remaining: number; utilisation: number | null; committed: number }[];
  funding: { cases: number; by_award_status: { status: string; count: number }[]; awarded: number; received: number; payments_awaiting_reconciliation: number };
  requisitions: { awaiting_decision: number; awaiting_my_decision: number; approved_awaiting_procurement: number; on_order: number; overdue_deliveries: number; closed_last_30_days: number; ordered_value: number; orders_without_value: number };
}
export interface CmQuality {
  qualifications: { approved: number; pending_approval: number; draft: number; rejected: number; trades_without_approved_qualification: number };
  results: { awaiting_approval: number; decided: number; passed: number; pass_rate: number | null };
  progression: { registered: number; completed: number; withdrawn: number; dropout_rate: number | null; completion_rate: number | null; by_status: { status: string; count: number }[] };
  delivery_plans: { status: string; count: number }[];
  assessment_cycles: { open: number; locked: number };
  attendance: { rate_30_days: number | null };
}
export interface CmStaffing {
  trainers: number; active_trainees: number; trainees_per_trainer: number | null; staff: number;
  establishment: { role: string; post: string; approved: number; filled: number; vacant: number }[];
  appraisals: { open: number; staff_without_review_this_year: number };
  leave: { pending: number; on_leave_today: number; days_this_month: number };
  contracts_ending_90_days: { name: string; job_title: string | null; end_date: string }[];
}
export interface CmStakeholders {
  correspondence: { open: number; overdue: number; items: { reference: string; subject: string; party: string; direction: string; due_on: string | null; status: string; overdue: boolean }[] };
  reports_and_reviews: { open: number; overdue: number; done_last_90_days: number; items: { title: string; kind: string; due_on: string | null; overdue: boolean }[] };
  meetings_next_14_days: { title: string; on: string }[];
  placements: { total: number };
}

function usePanel<T>(key: string, fn: string, args: (org: string) => Record<string, unknown>, enabled: boolean, extra: unknown[] = []) {
  const { organizationId: org } = useOrganizationContext();
  return useQuery({
    queryKey: [key, org, ...extra],
    enabled: !!org && enabled,
    queryFn: async (): Promise<T> => {
      const { data, error } = await db.rpc(fn, args(org as string));
      if (error) throw error;
      return data as T;
    },
  });
}

export const useCmFinance = (year: string | null, enabled: boolean) => usePanel<CmFinance>("cm-finance", "centre_manager_finance", (o) => ({ _org: o, _year: year }), enabled, [year]);
export const useCmQuality = (enabled: boolean) => usePanel<CmQuality>("cm-quality", "centre_manager_quality", (o) => ({ _org: o }), enabled);
export const useCmStaffing = (enabled: boolean) => usePanel<CmStaffing>("cm-staffing", "centre_manager_staffing", (o) => ({ _org: o }), enabled);
export const useCmStakeholders = (enabled: boolean) => usePanel<CmStakeholders>("cm-stakeholders", "centre_manager_stakeholders", (o) => ({ _org: o }), enabled);
export const useCentreTargets = (enabled = true) => usePanel<Record<string, number>>("centre-targets", "centre_targets_list", (o) => ({ _org: o }), enabled);

// Which way is "good" for each indicator with a target
export const TARGETS: Record<string, { label: string; unit: string; goodWhen: "min" | "max" }> = {
  collection_rate: { label: "Fees collected", unit: "%", goodWhen: "min" },
  attendance_rate: { label: "Attendance", unit: "%", goodWhen: "min" },
  pass_rate: { label: "Assessment pass rate", unit: "%", goodWhen: "min" },
  completion_rate: { label: "Completion rate", unit: "%", goodWhen: "min" },
  dropout_rate: { label: "Dropout rate", unit: "%", goodWhen: "max" },
  trainees_per_trainer: { label: "Trainees per trainer", unit: "", goodWhen: "max" },
  budget_utilisation: { label: "Budget used", unit: "%", goodWhen: "max" },
};
