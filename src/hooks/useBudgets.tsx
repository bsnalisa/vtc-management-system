import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

// These functions are newer than the generated Supabase types.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export interface BudgetLine {
  id: string; department: string; total: number; in_force: boolean; committed: number; available: number; utilisation: number | null; requisitions: number;
  proposal_status: "none" | "pending" | "rejected"; proposed_total: number | null; proposal_reason: string | null; proposal_note: string | null;
  proposed_by: string | null; proposed_at: string | null; approved_by: string | null; approved_at: string | null;
}
export interface BudgetEvent { event: string; department: string; year: string; old_total: number | null; new_total: number | null; note: string | null; by: string | null; role: string | null; at: string }
export interface BudgetOverview {
  year: string; years: string[]; can_propose: boolean; can_decide: boolean; lines: BudgetLine[];
  unbudgeted: { department: string; requisitions: number; committed: number }[]; events: BudgetEvent[];
}
export interface RequisitionBudget { department: string; year: string; found: boolean; total?: number; committed?: number; available?: number }

export const useBudgetOverview = (orgId: string | null | undefined, year: string | null) =>
  useQuery({
    queryKey: ["budgets", orgId, year],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await db.rpc("budget_overview", { _org: orgId, _year: year });
      if (error) throw error;
      return data as BudgetOverview;
    },
  });

export const useBudgetForRequisition = (requisitionId: string | undefined) =>
  useQuery({
    queryKey: ["budget-for-requisition", requisitionId],
    enabled: !!requisitionId,
    retry: false,
    queryFn: async () => {
      const { data, error } = await db.rpc("budget_for_requisition", { _req: requisitionId });
      if (error) throw error;
      return data as RequisitionBudget;
    },
  });

export const useBudgetActions = (orgId: string | null | undefined) => {
  const qc = useQueryClient();
  const { toast } = useToast();
  const done = () => { qc.invalidateQueries({ queryKey: ["budgets", orgId] }); qc.invalidateQueries({ queryKey: ["budget-summary", orgId] }); };
  const fail = (e: Error) => toast({ title: "Not saved", description: e.message, variant: "destructive" });
  return {
    propose: useMutation({
      mutationFn: async (v: { department: string; year: string; amount: number; reason: string }) => {
        const { error } = await db.rpc("budget_propose", { _org: orgId, _department: v.department, _year: v.year, _amount: v.amount, _reason: v.reason });
        if (error) throw error;
      }, onSuccess: () => { done(); toast({ title: "Sent to the Centre Manager for approval" }); }, onError: fail,
    }),
    withdraw: useMutation({
      mutationFn: async (line: string) => { const { error } = await db.rpc("budget_withdraw", { _line: line }); if (error) throw error; },
      onSuccess: () => { done(); toast({ title: "Proposal withdrawn" }); }, onError: fail,
    }),
    decide: useMutation({
      mutationFn: async (v: { line: string; approve: boolean; note: string }) => {
        const { error } = await db.rpc("budget_decide", { _line: v.line, _approve: v.approve, _note: v.note || null });
        if (error) throw error;
      }, onSuccess: (_d, v) => { done(); toast({ title: v.approve ? "Budget approved" : "Budget rejected" }); }, onError: fail,
    }),
  };
};

// Number of proposals waiting for the Centre Manager (for the dashboard alert)
export const useBudgetsWaiting = (orgId: string | null | undefined, enabled: boolean) =>
  useQuery({
    queryKey: ["budget-summary", orgId],
    enabled: enabled && !!orgId,
    queryFn: async () => {
      const { data, error } = await db.rpc("budget_overview", { _org: orgId, _year: null });
      if (error) throw error;
      return (data as BudgetOverview).lines.filter((l) => l.proposal_status === "pending").length;
    },
  });
