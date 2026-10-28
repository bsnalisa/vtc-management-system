import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { Fulfilment, RequisitionRow, RequisitionView } from "@/components/requisitions/status";

// These functions are newer than the generated Supabase types.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export type RequisitionScope = "mine" | "to_decide" | "procurement" | "receiving" | "centre";

export const useRequisitionList = (scope: RequisitionScope, opts: { status?: string; search?: string; page?: number; pageSize?: number; enabled?: boolean } = {}) => {
  const pageSize = opts.pageSize ?? 25;
  const page = opts.page ?? 0;
  return useQuery({
    queryKey: ["requisitions", scope, opts.status ?? "", opts.search ?? "", page],
    enabled: opts.enabled ?? true,
    queryFn: async () => {
      const { data, error } = await db.rpc("requisition_list", { _scope: scope, _status: opts.status || null, _search: opts.search || null, _limit: pageSize, _offset: page * pageSize });
      if (error) throw error;
      const rows = (data ?? []) as RequisitionRow[];
      return { rows, total: rows[0]?.total_count ?? 0 };
    },
  });
};

export const useRequisition = (id: string | undefined) =>
  useQuery({
    queryKey: ["requisition", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await db.rpc("requisition_view", { _id: id });
      if (error) throw error;
      return data as RequisitionView;
    },
  });

export const useRequisitionLetterhead = (id: string | undefined, enabled: boolean) =>
  useQuery({
    queryKey: ["requisition-letterhead", id],
    enabled: !!id && enabled,
    queryFn: async () => {
      const { data, error } = await db.rpc("requisition_letterhead", { _req: id });
      if (error) throw error;
      return data as { centre_name: string | null; configured: boolean; settings: Record<string, string | null> };
    },
  });

export interface DraftInput { id: string | null; organizationId: string | null; purpose: string; department: string; items: { description: string; quantity: string; specifications: string; extra?: Record<string, string> }[]; fields?: Record<string, string> }

export const useRequisitionActions = () => {
  const qc = useQueryClient();
  const { toast } = useToast();
  const refresh = () => { qc.invalidateQueries({ queryKey: ["requisitions"] }); qc.invalidateQueries({ queryKey: ["requisition"] }); };
  const fail = (title: string) => (e: Error) => toast({ title, description: e.message, variant: "destructive" });

  const saveDraft = useMutation({
    mutationFn: async (d: DraftInput) => {
      const { data, error } = await db.rpc("requisition_save_draft", { _id: d.id, _org: d.organizationId, _purpose: d.purpose, _department: d.department, _items: d.items.map((i) => ({ description: i.description, quantity: i.quantity, specifications: i.specifications, extra: i.extra ?? {} })), _fields: d.fields ?? {} });
      if (error) throw error;
      return data as string;
    },
    onSuccess: refresh, onError: fail("The draft was not saved"),
  });
  const submit = useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await db.rpc("requisition_submit", { _id: id });
      if (error) throw error;
      return data as { requisition_number: string; supervisor: string; round: number };
    },
    onSuccess: refresh, onError: fail("The requisition was not submitted"),
  });
  const decide = useMutation({
    mutationFn: async (a: { task: string; decision: string; comment: string; gl?: string }) => {
      const { data, error } = await db.rpc("requisition_decide", { _task: a.task, _decision: a.decision, _comment: a.comment, _gl_code: a.gl || null });
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => { refresh(); qc.invalidateQueries({ queryKey: ["workflow"] }); }, onError: fail("The decision was not recorded"),
  });
  const reopen = useMutation({
    mutationFn: async (id: string) => { const { error } = await db.rpc("requisition_reopen", { _id: id }); if (error) throw error; },
    onSuccess: refresh, onError: fail("Could not reopen the requisition"),
  });
  const cancel = useMutation({
    mutationFn: async (a: { id: string; reason: string }) => { const { error } = await db.rpc("requisition_cancel", { _id: a.id, _reason: a.reason }); if (error) throw error; },
    onSuccess: refresh, onError: fail("Could not cancel the requisition"),
  });
  return { saveDraft, submit, decide, reopen, cancel };
};

export const useFulfilment = (id: string | undefined, enabled: boolean) =>
  useQuery({
    queryKey: ["requisition-fulfilment", id],
    enabled: !!id && enabled,
    queryFn: async () => {
      const { data, error } = await db.rpc("requisition_fulfilment", { _id: id });
      if (error) throw error;
      return data as Fulfilment;
    },
  });

export const useProcurementSummary = (organizationId: string | null | undefined) =>
  useQuery({
    queryKey: ["requisition-procurement-summary", organizationId],
    enabled: !!organizationId,
    queryFn: async () => {
      const { data, error } = await db.rpc("requisition_procurement_summary", { _org: organizationId });
      if (error) throw error;
      return data as Record<string, number>;
    },
  });

// One mutation helper for every procurement, receipt and closure call
export const useFulfilmentAction = (requisitionId: string) => {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (a: { fn: string; args: Record<string, unknown>; done?: string }) => {
      const { data, error } = await db.rpc(a.fn, a.args);
      if (error) throw error;
      return { data, done: a.done };
    },
    onSuccess: (r) => {
      if (r.done) toast({ title: r.done });
      ["requisition", "requisition-fulfilment", "requisitions", "requisition-procurement-summary"].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
    },
    onError: (e: Error) => toast({ title: "Not saved", description: e.message, variant: "destructive" }),
    meta: { requisitionId },
  });
};
