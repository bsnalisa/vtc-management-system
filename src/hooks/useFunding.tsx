import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganizationContext } from "./useOrganizationContext";
import { useRpc } from "./useFinance";
import { toast } from "sonner";

// The funding functions are newer than the generated types, so they are called untyped.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export interface FundingCase {
  id: string; organization_id: string; trainee_uuid: string; trainee_number: string; trainee_name: string; programme: string | null; qualification: string | null;
  level: number | null; intake: string | null; academic_year: string; funding_category: string; nsfaf_reference: string | null; application_status: string;
  eligibility_status: string; award_status: string; registration_status: string; payment_status: string; overall_status: string; updated_at: string;
  next_action: string | null; follow_up_due: string | null; assigned_to: string | null; missing_documents: string[]; attention: string[];
  open_followups: number; overdue_followups: number; awarded_amount: number | null; amount_paid: number;
}
export interface FundingFilters {
  programme?: string; level?: string; intake?: string; category?: string; application_status?: string; award_status?: string;
  registration_status?: string; payment_status?: string; overall?: string; reason?: string; attention?: boolean; overdue?: boolean;
}
export interface FundingOverview {
  tracked: number; trainees_total: number; pending_applications: number; needs_attention: number; confirmed: number; awaiting_reconciliation: number;
  open_followups: number; overdue_followups: number; distribution: Record<string, number>; previous: { year: string; tracked: number; confirmed: number } | null;
}
export interface FundingEvent { id: string; record_id: string; event_type: string; summary: string; created_at: string; actor: string | null; details?: Record<string, unknown> | null; trainee_number?: string; trainee_name?: string }
export interface FundingDocument { id: string; doc_type: string; file_path: string; file_name: string; status: string; note: string | null; verified_at: string | null; verified_by_name: string | null; created_at: string }
export interface FundingPayment {
  id: string; record_id: string; payment_type: string; funding_period: string | null; expected_amount: number | null; amount: number; payment_date: string; transaction_reference: string | null;
  recipient: string; recipient_note: string | null; reconciliation_status: string; finance_note: string | null; reconciled_at: string | null; recorded_by?: string;
  funding_category?: string; academic_year?: string; trainee_number?: string; trainee_name?: string;
}
export interface FundingFollowup {
  id: string; record_id: string; kind: string; description: string; due_date: string; status: string; resolution_note: string | null; resolved_at: string | null; created_at: string;
  trainee_number?: string; trainee_name?: string; assigned_name?: string | null;
}
export interface FundingDetail {
  case: FundingCase; // eslint-disable-next-line @typescript-eslint/no-explicit-any
  record: Record<string, any>; trainee: { status: string; level: number; training_mode: string; academic_year: string; phone: string | null; email: string | null };
  documents: FundingDocument[]; payments: FundingPayment[]; followups: FundingFollowup[]; events: FundingEvent[];
}

const call = async <T,>(fn: string, args: Record<string, unknown>) => {
  const { data, error } = await db.rpc(fn, args);
  if (error) throw error;
  return data as T;
};

export const useFundingOverview = (year: string | null) =>
  useQuery({ queryKey: ["funding", "overview", year], queryFn: () => call<FundingOverview>("funding_overview", { _year: year }) });

export const useFundingOptions = (year: string | null) =>
  useQuery({ queryKey: ["funding", "options", year], queryFn: () => call<{ years: string[]; programmes: string[]; levels: number[]; intakes: string[] }>("funding_filter_options", { _year: year }) });

export const useFundingRegister = (p: { year: string | null; search: string; filters: FundingFilters; sort: string; dir: "asc" | "desc"; page: number; pageSize: number }) =>
  useQuery({
    queryKey: ["funding", "register", p],
    placeholderData: keepPreviousData,
    queryFn: () => call<{ total: number; rows: FundingCase[] }>("funding_register", {
      _year: p.year, _search: p.search, _filters: p.filters, _sort: p.sort, _dir: p.dir, _limit: p.pageSize, _offset: (p.page - 1) * p.pageSize,
    }),
  });

/** Fetches every matching case (up to 5,000) for exports and reports. */
export const fetchAllFundingCases = async (year: string | null, filters: FundingFilters = {}) =>
  (await call<{ total: number; rows: FundingCase[] }>("funding_register", { _year: year, _search: "", _filters: filters, _sort: "trainee_number", _dir: "asc", _limit: 5000, _offset: 0 })).rows;

export const useFundingCases = (year: string | null, filters: FundingFilters, enabled = true) =>
  useQuery({ queryKey: ["funding", "cases", year, filters], enabled, queryFn: () => fetchAllFundingCases(year, filters) });

export const useFundingDetail = (id: string | undefined) =>
  useQuery({ queryKey: ["funding", "detail", id], enabled: !!id, queryFn: () => call<FundingDetail>("funding_record_detail", { _id: id }) });

export const useFundingActivity = (year: string | null, limit = 15) =>
  useQuery({ queryKey: ["funding", "activity", year, limit], queryFn: () => call<FundingEvent[]>("funding_recent_activity", { _year: year, _limit: limit }) });

export const useFundingFollowups = (year: string | null, status: string | null, kind: string | null) =>
  useQuery({ queryKey: ["funding", "followups", year, status, kind], queryFn: () => call<FundingFollowup[]>("funding_followup_list", { _year: year, _status: status, _kind: kind }) });

export const useFundingPayments = (year: string | null, status: string | null) =>
  useQuery({ queryKey: ["funding", "payments", year, status], queryFn: () => call<FundingPayment[]>("funding_payment_list", { _year: year, _status: status }) });

export const useFundingCoverage = (year: string | null) =>
  useQuery({ queryKey: ["funding", "coverage", year], queryFn: () => call<{ programme: string | null; level: number; trainees: number; with_record: number; funded: number; no_record: number }[]>("funding_coverage", { _year: year }) });

export const useFundingSearch = (q: string, year: string | null) =>
  useQuery({
    queryKey: ["funding", "search", q, year], enabled: q.trim().length >= 2,
    queryFn: () => call<{ trainee_uuid: string; trainee_number: string; trainee_name: string; programme: string | null; level: number; academic_year: string; record_id: string | null; nsfaf_reference: string | null }[]>("funding_search", { _q: q, _year: year }),
  });

const K = ["funding"];
export const useCreateFundingRecord = () =>
  useRpc<{ trainee: string; year?: string | null; category: string; intake?: string }, string>("create_funding_record", (v) => ({ _trainee: v.trainee, _year: v.year ?? null, _category: v.category, _intake: v.intake ?? null }), K, "Funding record created");
export const useUpdateFundingApplication = () =>
  useRpc<{ id: string; reference?: string; status?: string; submittedOn?: string; eligibility?: string; response?: string; responseOn?: string; category?: string; intake?: string; nextAction?: string; due?: string; assigned?: string }>(
    "update_funding_application",
    (v) => ({ _id: v.id, _reference: v.reference ?? null, _status: v.status ?? null, _submitted_on: v.submittedOn || null, _eligibility: v.eligibility ?? null, _response: v.response ?? null, _response_on: v.responseOn || null, _category: v.category ?? null, _intake: v.intake ?? null, _next_action: v.nextAction ?? null, _due: v.due || null, _assigned: v.assigned ?? null }),
    K, "Application details saved");
export const useRecordNsfafDecision = () =>
  useRpc<{ id: string; decision: string; date: string; source: string; amount?: number | null; start?: string; end?: string; conditions?: string }>(
    "record_nsfaf_decision", (v) => ({ _id: v.id, _decision: v.decision, _decision_date: v.date, _source: v.source, _amount: v.amount ?? null, _start: v.start || null, _end: v.end || null, _conditions: v.conditions ?? null }), K, "NSFAF decision recorded");
export const useSetDocumentStatus = () =>
  useRpc<{ doc: string; status: string; note?: string }>("set_funding_document_status", (v) => ({ _doc: v.doc, _status: v.status, _note: v.note ?? null }), K, "Document updated");
export const useSetRegistration = () =>
  useRpc<{ id: string; status: string; note?: string }>("set_funding_registration", (v) => ({ _id: v.id, _status: v.status, _note: v.note ?? null }), K, "Registration status saved");
export const useAddFundingNote = () =>
  useRpc<{ id: string; type: string; summary: string }>("add_funding_note", (v) => ({ _id: v.id, _type: v.type, _summary: v.summary }), K, "Note saved");
export const useAddFollowup = () =>
  useRpc<{ id: string; kind: string; description: string; due: string }>("add_funding_followup", (v) => ({ _id: v.id, _kind: v.kind, _description: v.description, _due: v.due }), K, "Follow-up added");
export const useResolveFollowup = () =>
  useRpc<{ id: string; note: string }>("resolve_funding_followup", (v) => ({ _fid: v.id, _note: v.note }), K, "Marked as resolved");
export const useRecordPayment = () =>
  useRpc<{ id: string; amount: number; date: string; reference: string; recipient: string; recipientNote?: string; period?: string; expected?: number | null; type: string }>(
    "record_funding_payment", (v) => ({ _id: v.id, _amount: v.amount, _date: v.date, _reference: v.reference, _recipient: v.recipient, _recipient_note: v.recipientNote ?? null, _period: v.period ?? null, _expected: v.expected ?? null, _type: v.type }), K, "Payment recorded");
export const useSendPaymentToFinance = () => useRpc<string>("send_payment_to_finance", (id) => ({ _pid: id }), K, "Sent to Finance for verification");
export const useReconcilePayment = () =>
  useRpc<{ id: string; outcome: string; note?: string }>("reconcile_funding_payment", (v) => ({ _pid: v.id, _outcome: v.outcome, _note: v.note ?? null }), K, "Reconciliation saved");

/** Uploads a file to the centre's documents folder and files it against the funding record. */
export const useAddFundingDocument = () => {
  const { organizationId } = useOrganizationContext();
  const file = useRpc<{ id: string; type: string; path: string; name: string }>("add_funding_document", (v) => ({ _id: v.id, _type: v.type, _path: v.path, _name: v.name }), K, "Document filed");
  return {
    ...file,
    mutateAsync: async (v: { id: string; type: string; file: File }) => {
      if (!organizationId) throw new Error("No centre selected");
      if (v.file.size > 10 * 1024 * 1024) { toast.error("Files must be 10 MB or smaller"); throw new Error("File too large"); }
      const safe = v.file.name.replace(/[^\w.-]+/g, "_");
      const path = `${organizationId}/funding/${v.id}/${Date.now()}-${safe}`;
      const { error } = await supabase.storage.from("documents").upload(path, v.file, { contentType: v.file.type || undefined });
      if (error) { toast.error(error.message); throw error; }
      return file.mutateAsync({ id: v.id, type: v.type, path, name: v.file.name });
    },
  };
};
