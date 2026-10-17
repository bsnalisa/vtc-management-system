import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useOrganizationContext } from "./useOrganizationContext";

// Newer than the generated Supabase types, so access untyped.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export const money = (n: number | string | null | undefined) =>
  `N$ ${Number(n ?? 0).toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export interface FinanceOverview {
  approvals: {
    pending: number; overdue: number; returned: number; approved_30d: number; rejected_30d: number;
    by_originator: { user_id: string; name: string; role: string | null; count: number }[];
    by_type: { process_type: string; count: number }[];
  };
  budgets: { department: string; year: string; total: number; spent: number }[];
  payables: { outstanding: number; overdue_total: number; overdue_count: number; due_7d_count: number; awaiting_approval: number; approved_unpaid: number };
  receivables: { billed: number; collected: number; outstanding: number; debtors: number; aged_30: number; aged_60: number; aged_90: number; aged_over_90: number; adjustments_pending: number };
  assets: { count: number; requests_pending: number; open_maintenance: number; maintenance_spend: number };
  journals: { draft: number; submitted: number; approved_unposted: number; posted: number };
  reconciliation: { unmatched_lines: number };
}
export interface MonthlyFigure { month: string; income: number; expenditure: number }

export const useFinanceOverview = () =>
  useQuery({
    queryKey: ["finance-overview"], refetchInterval: 120_000,
    queryFn: async () => {
      const { data, error } = await db.rpc("finance_overview");
      if (error) throw error;
      return data as FinanceOverview;
    },
  });

export const useFinanceMonthly = (months = 12) =>
  useQuery({
    queryKey: ["finance-monthly", months],
    queryFn: async () => {
      const { data, error } = await db.rpc("finance_monthly", { _months: months });
      if (error) throw error;
      return (data as { month: string; income: number | string; expenditure: number | string }[]).map((r) => ({ month: r.month, income: Number(r.income), expenditure: Number(r.expenditure) })) as MonthlyFigure[];
    },
  });

/** Run an RPC, refresh the listed queries and say what happened. */
export function useRpc<T, R = unknown>(fn: string, args: (v: T) => Record<string, unknown>, keys: string[], success: string | ((r: R) => string)) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (v: T) => {
      const { data, error } = await db.rpc(fn, args(v));
      if (error) throw error;
      return data as R;
    },
    onSuccess: (r) => {
      ["finance-overview", "workflow-instances", "workflow-my-tasks", ...keys].forEach((k) => queryClient.invalidateQueries({ queryKey: [k] }));
      toast.success(typeof success === "function" ? success(r) : success);
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

// ---- supplier invoices (creditor's officer) ----
export interface SupplierInvoice {
  id: string; supplier_id: string; invoice_number: string; invoice_date: string; due_date: string; subtotal: number; tax_amount: number;
  total_amount: number; status: "recorded" | "verified" | "requested" | "approved" | "rejected" | "paid"; notes: string | null; document_path: string | null;
  workflow_instance_id: string | null; paid_at: string | null; payment_reference: string | null; created_at: string;
}
export const useSupplierInvoices = () => {
  const { organizationId } = useOrganizationContext();
  return useQuery({
    queryKey: ["supplier-invoices", organizationId], enabled: !!organizationId,
    queryFn: async () => {
      const { data, error } = await db.from("supplier_invoices").select("*").eq("organization_id", organizationId).order("due_date");
      if (error) throw error;
      return data as SupplierInvoice[];
    },
  });
};
export const useSuppliersList = () => {
  const { organizationId } = useOrganizationContext();
  return useQuery({
    queryKey: ["suppliers-list", organizationId], enabled: !!organizationId,
    queryFn: async () => {
      const { data, error } = await db.from("suppliers").select("id, name, payment_terms").eq("organization_id", organizationId).eq("active", true).order("name");
      if (error) throw error;
      return data as { id: string; name: string; payment_terms: string | null }[];
    },
  });
};
export const useRecordSupplierInvoice = () =>
  useRpc<{ supplier: string; number: string; invoiceDate: string; dueDate: string; subtotal: number; tax: number; notes: string; document: string | null }>(
    "record_supplier_invoice",
    (v) => ({ _supplier: v.supplier, _number: v.number, _invoice_date: v.invoiceDate, _due_date: v.dueDate, _subtotal: v.subtotal, _tax: v.tax, _notes: v.notes || null, _document: v.document }),
    ["supplier-invoices"], "Invoice recorded");
export const useVerifySupplierInvoice = () => useRpc<string>("verify_supplier_invoice", (id) => ({ _id: id }), ["supplier-invoices"], "Invoice verified");
export const useRequestInvoicePayment = () => useRpc<string, string>("request_invoice_payment", (id) => ({ _id: id }), ["supplier-invoices"], "Payment request created. Attach the documents and submit it.");
export const useRecordSupplierPayment = () =>
  useRpc<{ id: string; reference: string; paidOn: string }>("record_supplier_payment", (v) => ({ _id: v.id, _reference: v.reference, _paid_on: v.paidOn }), ["supplier-invoices"], "Payment recorded");

// ---- journal entries (accountant) ----
export interface JournalEntry {
  id: string; entry_number: string; entry_date: string; description: string; debit_account: string; credit_account: string; amount: number;
  status: "draft" | "submitted" | "approved" | "rejected" | "posted" | "reversed"; reversal_of: string | null; workflow_instance_id: string | null; created_at: string;
}
export const useJournalEntries = () => {
  const { organizationId } = useOrganizationContext();
  return useQuery({
    queryKey: ["journal-entries", organizationId], enabled: !!organizationId,
    queryFn: async () => {
      const { data, error } = await db.from("journal_entries").select("*").eq("organization_id", organizationId).order("created_at", { ascending: false });
      if (error) throw error;
      return data as JournalEntry[];
    },
  });
};
export const useCreateJournalEntry = () =>
  useRpc<{ date: string; description: string; debit: string; credit: string; amount: number }>("create_journal_entry",
    (v) => ({ _date: v.date, _description: v.description, _debit: v.debit, _credit: v.credit, _amount: v.amount }), ["journal-entries"], "Draft entry saved");
export const useSubmitJournalEntry = () => useRpc<string, string>("submit_journal_entry", (id) => ({ _id: id }), ["journal-entries"], "Entry ready to submit. Attach documents if needed, then submit.");
export const usePostJournalEntry = () => useRpc<string>("post_journal_entry", (id) => ({ _id: id }), ["journal-entries"], "Entry posted");
export const useReverseJournalEntry = () => useRpc<{ id: string; reason: string }>("reverse_journal_entry", (v) => ({ _id: v.id, _reason: v.reason }), ["journal-entries"], "Reversing entry drafted");

// ---- debtor adjustments ----
export interface DebtorAdjustment {
  id: string; trainee_id: string; fee_record_id: string; adjustment_type: "write_off" | "credit_note" | "refund" | "charge_correction"; amount: number;
  reason: string; status: "requested" | "approved" | "rejected" | "applied"; workflow_instance_id: string | null; created_at: string; applied_at: string | null;
  trainees?: { first_name: string; last_name: string; trainee_id: string } | null;
}
export const useDebtorAdjustments = () => {
  const { organizationId } = useOrganizationContext();
  return useQuery({
    queryKey: ["debtor-adjustments", organizationId], enabled: !!organizationId,
    queryFn: async () => {
      const { data, error } = await db.from("debtor_adjustments").select("*").eq("organization_id", organizationId).order("created_at", { ascending: false });
      if (error) throw error;
      const rows = data as DebtorAdjustment[];
      const ids = [...new Set(rows.map((r) => r.trainee_id))];
      const { data: people } = ids.length ? await db.from("trainees").select("id, first_name, last_name, trainee_id").in("id", ids) : { data: [] };
      return rows.map((r) => ({ ...r, trainees: (people ?? []).find((p: { id: string }) => p.id === r.trainee_id) ?? null })) as DebtorAdjustment[];
    },
  });
};
export const useOutstandingFeeRecords = () => {
  const { organizationId } = useOrganizationContext();
  return useQuery({
    queryKey: ["outstanding-fee-records", organizationId], enabled: !!organizationId,
    queryFn: async () => {
      const { data, error } = await db.from("fee_records").select("id, trainee_id, total_fee, amount_paid, balance, academic_year").eq("organization_id", organizationId).order("created_at", { ascending: false }).limit(500);
      if (error) throw error;
      const rows = data as { id: string; trainee_id: string; total_fee: number; amount_paid: number; balance: number; academic_year: string }[];
      const ids = [...new Set(rows.map((r) => r.trainee_id))];
      const { data: people } = ids.length ? await db.from("trainees").select("id, first_name, last_name, trainee_id").in("id", ids) : { data: [] };
      return rows.map((r) => ({ ...r, trainee: (people ?? []).find((p: { id: string }) => p.id === r.trainee_id) as { first_name: string; last_name: string; trainee_id: string } | undefined }));
    },
  });
};
export const useRequestDebtorAdjustment = () =>
  useRpc<{ feeRecord: string; type: string; amount: number; reason: string }, string>("request_debtor_adjustment",
    (v) => ({ _fee_record: v.feeRecord, _type: v.type, _amount: v.amount, _reason: v.reason }), ["debtor-adjustments"], "Adjustment request created. Attach the documents and submit it.");
export const useApplyDebtorAdjustment = () => useRpc<string>("apply_debtor_adjustment", (id) => ({ _id: id }), ["debtor-adjustments", "outstanding-fee-records"], "Adjustment applied");

// ---- asset requests ----
export interface AssetRequest {
  id: string; kind: "acquisition" | "transfer" | "disposal" | "maintenance_expenditure" | "repair_quotation"; asset_id: string | null; title: string;
  description: string | null; estimated_cost: number; status: "requested" | "approved" | "rejected" | "completed"; workflow_instance_id: string | null; created_at: string;
}
export const useAssetRequests = () => {
  const { organizationId } = useOrganizationContext();
  return useQuery({
    queryKey: ["asset-requests", organizationId], enabled: !!organizationId,
    queryFn: async () => {
      const { data, error } = await db.from("asset_requests").select("*").eq("organization_id", organizationId).order("created_at", { ascending: false });
      if (error) throw error;
      return data as AssetRequest[];
    },
  });
};
export const useAssetOptions = () => {
  const { organizationId } = useOrganizationContext();
  return useQuery({
    queryKey: ["asset-options", organizationId], enabled: !!organizationId,
    queryFn: async () => {
      const { data, error } = await db.from("assets").select("id, asset_code, asset_name").eq("organization_id", organizationId).order("asset_name");
      if (error) throw error;
      return data as { id: string; asset_code: string; asset_name: string }[];
    },
  });
};
export const useRequestAssetApproval = () =>
  useRpc<{ kind: string; asset: string | null; title: string; description: string; cost: number }, string>("request_asset_approval",
    (v) => ({ _kind: v.kind, _asset: v.asset, _title: v.title, _description: v.description, _cost: v.cost }), ["asset-requests"], "Request created. Attach the documents and submit it.");
export const useCompleteAssetRequest = () => useRpc<{ id: string; notes: string }>("complete_asset_request", (v) => ({ _id: v.id, _notes: v.notes || null }), ["asset-requests"], "Marked as completed");

// ---- attachments ----
export interface WorkflowAttachment { id: string; instance_id: string; file_path: string; file_name: string; uploaded_by: string | null; created_at: string }
export const useWorkflowAttachments = (instanceId: string | undefined) =>
  useQuery({
    queryKey: ["workflow-attachments", instanceId], enabled: !!instanceId,
    queryFn: async () => {
      const { data, error } = await db.from("workflow_attachments").select("*").eq("instance_id", instanceId).order("created_at");
      if (error) throw error;
      return data as WorkflowAttachment[];
    },
  });
export const useAddAttachment = (instanceId: string) => {
  const queryClient = useQueryClient();
  const { organizationId } = useOrganizationContext();
  return useMutation({
    mutationFn: async (file: File) => {
      if (!organizationId) throw new Error("No organization ID");
      if (file.size > 10 * 1024 * 1024) throw new Error("Files can be at most 10 MB");
      const safe = file.name.replace(/[^A-Za-z0-9._-]+/g, "_");
      const path = `${organizationId}/workflow/${instanceId}/${Date.now()}-${safe}`;
      const up = await supabase.storage.from("documents").upload(path, file, { upsert: false });
      if (up.error) throw up.error;
      const { error } = await db.from("workflow_attachments").insert([{ instance_id: instanceId, file_path: path, file_name: file.name }]);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["workflow-attachments", instanceId] }),
    onError: (e: Error) => toast.error(e.message),
  });
};
export const useRemoveAttachment = (instanceId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (a: WorkflowAttachment) => {
      const { error } = await db.from("workflow_attachments").delete().eq("id", a.id);
      if (error) throw error;
      await supabase.storage.from("documents").remove([a.file_path]);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["workflow-attachments", instanceId] }),
    onError: (e: Error) => toast.error(e.message),
  });
};
export const openAttachment = async (path: string) => {
  const { data, error } = await supabase.storage.from("documents").createSignedUrl(path, 3600);
  if (error) { toast.error(error.message); return; }
  window.open(data.signedUrl, "_blank", "noopener");
};

export const useSubmitRequest = () =>
  useRpc<string>("workflow_submit", (id) => ({ _instance: id }), ["supplier-invoices", "journal-entries", "debtor-adjustments", "asset-requests"], "Sent for approval");

// ---- approval limits ----
export interface ApprovalLimit { process_type: string; limit_amount: number }
export const useApprovalLimits = () => {
  const { organizationId } = useOrganizationContext();
  return useQuery({
    queryKey: ["approval-limits", organizationId], enabled: !!organizationId,
    queryFn: async () => {
      const { data, error } = await db.from("workflow_escalation_limits").select("process_type, limit_amount").eq("organization_id", organizationId);
      if (error) throw error;
      return data as ApprovalLimit[];
    },
  });
};
export const useSaveApprovalLimit = () => {
  const queryClient = useQueryClient();
  const { organizationId } = useOrganizationContext();
  return useMutation({
    mutationFn: async (v: { process_type: string; limit_amount: number | null }) => {
      if (v.limit_amount === null) {
        const { error } = await db.from("workflow_escalation_limits").delete().eq("organization_id", organizationId).eq("process_type", v.process_type);
        if (error) throw error;
      } else {
        const { error } = await db.from("workflow_escalation_limits").upsert({ organization_id: organizationId, process_type: v.process_type, limit_amount: v.limit_amount });
        if (error) throw error;
      }
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["approval-limits"] }); toast.success("Approval limit saved"); },
    onError: (e: Error) => toast.error(e.message),
  });
};
