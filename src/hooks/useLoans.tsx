import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useOrganizationContext } from "./useOrganizationContext";
import { useRpc } from "./useFinance";

// Newer than the generated Supabase types, so access untyped.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export interface LoanBorrower {
  id: string; borrower_type: string; full_name: string; national_id: string; phone: string | null; email: string | null; address: string | null;
  employer: string | null; monthly_income: number; created_at: string;
}
export type LoanApplicationStatus =
  | "registered" | "assessed" | "declined" | "recommended" | "approved" | "rejected" | "disbursement_requested" | "disbursement_approved" | "active" | "closed" | "written_off";
export interface LoanApplication {
  id: string; application_number: string; borrower_id: string; purpose: string; amount_requested: number; term_months: number; interest_rate: number;
  existing_obligations: number; installment: number | null; assessment: "eligible" | "not_eligible" | null; assessment_notes: string | null;
  status: LoanApplicationStatus; workflow_instance_id: string | null; created_at: string;
}
export interface LoanDocument { id: string; application_id: string; doc_type: string; file_path: string; file_name: string; verified: boolean; verified_at: string | null }
export interface Loan {
  id: string; loan_number: string; application_id: string; borrower_id: string; principal: number; interest_rate: number; term_months: number; installment: number;
  disbursed_on: string; disbursement_reference: string | null; status: "active" | "closed" | "written_off"; outstanding?: number;
}
export interface ScheduleRow {
  id: string; loan_id: string; installment_no: number; due_date: string; interest_due: number; principal_due: number; amount_due: number;
  amount_paid: number; amount_adjusted: number; superseded: boolean;
}
export interface Repayment { id: string; loan_id: string; amount: number; paid_on: string; reference: string | null }
export interface LoanAdjustment {
  id: string; loan_id: string; adjustment_type: "restructure" | "interest_waiver" | "write_off"; amount: number | null; new_term_months: number | null; reason: string;
  status: "requested" | "approved" | "rejected" | "applied"; workflow_instance_id: string | null; created_at: string;
}
export interface LoanOverview {
  applications: { registered: number; assessed: number; with_approver: number; approved: number; ready_to_disburse: number; adjustments_open: number };
  portfolio: { active_loans: number; disbursed_total: number; outstanding: number; collected_30d: number; due_7d: number };
  arrears: { loans: number; amount: number };
}
export interface ArrearsRow { loan_id: string; loan_number: string; borrower: string; phone: string | null; days_overdue: number; installments_overdue: number; amount_overdue: number; outstanding: number }

export const useLoanOverview = () =>
  useQuery({
    queryKey: ["loan-overview"], refetchInterval: 120_000,
    queryFn: async () => {
      const { data, error } = await db.rpc("loan_overview");
      if (error) throw error;
      return data as LoanOverview;
    },
  });
export const useLoanArrears = () =>
  useQuery({
    queryKey: ["loan-arrears"],
    queryFn: async () => {
      const { data, error } = await db.rpc("loan_arrears");
      if (error) throw error;
      return data as ArrearsRow[];
    },
  });

const useOrgTable = <T,>(table: string, key: string, order = "created_at") => {
  const { organizationId } = useOrganizationContext();
  return useQuery({
    queryKey: [key, organizationId], enabled: !!organizationId,
    queryFn: async () => {
      const { data, error } = await db.from(table).select("*").eq("organization_id", organizationId).order(order, { ascending: false });
      if (error) throw error;
      return data as T[];
    },
  });
};
export const useLoanBorrowers = () => useOrgTable<LoanBorrower>("loan_borrowers", "loan-borrowers");
export const useLoanApplications = () => useOrgTable<LoanApplication>("loan_applications", "loan-applications");
export const useLoanAdjustments = () => useOrgTable<LoanAdjustment>("loan_adjustments", "loan-adjustments");
export const useLoans = () => {
  const { organizationId } = useOrganizationContext();
  return useQuery({
    queryKey: ["loans", organizationId], enabled: !!organizationId,
    queryFn: async () => {
      const { data, error } = await db.from("loans").select("*").eq("organization_id", organizationId).order("disbursed_on", { ascending: false });
      if (error) throw error;
      const loans = data as Loan[];
      const ids = loans.map((l) => l.id);
      const { data: rows } = ids.length ? await db.from("loan_schedule").select("loan_id, amount_due, amount_paid, amount_adjusted, superseded").in("loan_id", ids) : { data: [] };
      return loans.map((l) => ({
        ...l,
        outstanding: (rows ?? []).filter((r: ScheduleRow) => r.loan_id === l.id && !r.superseded).reduce((a: number, r: ScheduleRow) => a + Number(r.amount_due) - Number(r.amount_paid) - Number(r.amount_adjusted), 0),
      }));
    },
  });
};
export const useLoanDocuments = (applicationId: string | undefined) =>
  useQuery({
    queryKey: ["loan-documents", applicationId], enabled: !!applicationId,
    queryFn: async () => {
      const { data, error } = await db.from("loan_application_documents").select("*").eq("application_id", applicationId).order("created_at");
      if (error) throw error;
      return data as LoanDocument[];
    },
  });
export const useLoanSchedule = (loanId: string | undefined) =>
  useQuery({
    queryKey: ["loan-schedule", loanId], enabled: !!loanId,
    queryFn: async () => {
      const [s, r] = await Promise.all([
        db.from("loan_schedule").select("*").eq("loan_id", loanId).order("installment_no"),
        db.from("loan_repayments").select("*").eq("loan_id", loanId).order("paid_on", { ascending: false }),
      ]);
      if (s.error) throw s.error;
      if (r.error) throw r.error;
      return { schedule: s.data as ScheduleRow[], repayments: r.data as Repayment[] };
    },
  });

const KEYS = ["loan-borrowers", "loan-applications", "loans", "loan-documents", "loan-schedule", "loan-adjustments", "loan-overview", "loan-arrears"];
export const useRegisterBorrower = () =>
  useRpc<{ type: string; name: string; nationalId: string; phone: string; email: string; address: string; employer: string; income: number }, string>("register_loan_borrower",
    (v) => ({ _type: v.type, _trainee: null, _name: v.name, _national_id: v.nationalId, _phone: v.phone || null, _email: v.email || null, _address: v.address || null, _employer: v.employer || null, _income: v.income }), KEYS, "Borrower registered");
export const useRegisterApplication = () =>
  useRpc<{ borrower: string; purpose: string; amount: number; term: number; rate: number | null; obligations: number }, string>("register_loan_application",
    (v) => ({ _borrower: v.borrower, _purpose: v.purpose, _amount: v.amount, _term: v.term, _rate: v.rate, _obligations: v.obligations }), KEYS, "Application registered");
export const useVerifyLoanDocument = () => useRpc<string>("verify_loan_document", (id) => ({ _id: id }), KEYS, "Document verified");
export const useAssessApplication = () =>
  useRpc<{ id: string; obligations: number; notes: string }, string>("assess_loan_application", (v) => ({ _id: v.id, _obligations: v.obligations, _notes: v.notes || null }), KEYS,
    (r) => (r === "eligible" ? "Assessed: eligible" : "Assessed: not eligible"));
export const useDeclineApplication = () => useRpc<{ id: string; reason: string }>("decline_loan_application", (v) => ({ _id: v.id, _reason: v.reason }), KEYS, "Application declined");
export const useRecommendApplication = () => useRpc<string, string>("recommend_loan_application", (id) => ({ _id: id }), KEYS, "Recommendation ready: review and submit it");
export const useRequestDisbursement = () => useRpc<string, string>("request_loan_disbursement", (id) => ({ _id: id }), KEYS, "Disbursement request ready: review and submit it");
export const useRecordDisbursement = () =>
  useRpc<{ id: string; reference: string; on: string }>("record_loan_disbursement", (v) => ({ _id: v.id, _reference: v.reference, _on: v.on }), KEYS, "Disbursement recorded and repayment schedule created");
export const useRecordRepayment = () =>
  useRpc<{ loan: string; amount: number; paidOn: string; reference: string }>("record_loan_repayment", (v) => ({ _loan: v.loan, _amount: v.amount, _paid_on: v.paidOn, _reference: v.reference || null }), KEYS, "Repayment recorded");
export const useRequestLoanAdjustment = () =>
  useRpc<{ loan: string; type: string; amount: number | null; newTerm: number | null; reason: string }, string>("request_loan_adjustment",
    (v) => ({ _loan: v.loan, _type: v.type, _amount: v.amount, _new_term: v.newTerm, _reason: v.reason }), KEYS, "Request ready: attach the documents and submit it");
export const useApplyLoanAdjustment = () => useRpc<string>("apply_loan_adjustment", (id) => ({ _id: id }), KEYS, "Adjustment applied");

export const useAddLoanDocument = (applicationId: string) => {
  const queryClient = useQueryClient();
  const { organizationId } = useOrganizationContext();
  return useMutation({
    mutationFn: async (v: { file: File; type: string }) => {
      if (!organizationId) throw new Error("No organization ID");
      if (v.file.size > 10 * 1024 * 1024) throw new Error("Files can be at most 10 MB");
      const path = `${organizationId}/loans/${applicationId}/${Date.now()}-${v.file.name.replace(/[^A-Za-z0-9._-]+/g, "_")}`;
      const up = await supabase.storage.from("documents").upload(path, v.file);
      if (up.error) throw up.error;
      const { error } = await db.rpc("add_loan_document", { _application: applicationId, _type: v.type, _path: path, _name: v.file.name });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["loan-documents", applicationId] }),
    onError: (e: Error) => toast.error(e.message),
  });
};
