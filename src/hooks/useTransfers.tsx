import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useRpc } from "./useFinance";

// These functions are newer than the generated types, so they are called untyped.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;
const call = async <T,>(fn: string, args: Record<string, unknown> = {}) => {
  const { data, error } = await db.rpc(fn, args);
  if (error) throw error;
  return data as T;
};

export type TransferStatus = "PENDING_TRAINING" | "PENDING_SUPPORT" | "APPROVED" | "COMPLETED" | "REJECTED" | "CANCELLED" | "FAILED";
export interface Decision { decision: "approved" | "rejected" | null; at: string | null; comment: string | null; by: string | null }
export interface Transfer {
  id: string; reference: string; status: TransferStatus; reason: string; created_at: string; completed_at: string | null; failure_reason: string | null;
  source_org: string; source_name: string; destination_org: string; destination_name: string; trainee_number: string; trainee_name: string; programme: string | null; level: number | null;
  training: Decision; support: Decision; can_decide?: boolean; can_retry?: boolean;
  events?: { event: string; at: string; outcome: string; reason: string | null }[];
}
export interface MyTransferOverview {
  registered: boolean; trainee_number?: string; can_request?: boolean;
  current?: { trainee_id: string; organization_id: string; organization_name: string; status: string; level: number | null; programme: string | null };
  history?: { organization_name: string; status: string; since: string; programme: string | null }[];
  transfers?: Transfer[];
}
export interface IdentitySummary {
  trainee_number: string; number_format: "global9" | "legacy"; first_registration_year: number; identity_verified: boolean; earlier_numbers: string[];
  registrations: { organization_name: string; status: string; since: string; this_record: boolean }[];
}
export interface ReviewCase {
  id: string; kind: "possible_duplicate" | "manual_verification" | "identity_conflict"; status: string; created_at: string; reason: string | null; resolution_reason: string | null;
  organization: string | null; applicant: string | null;
  a: { id: string; trainee_number: string; name: string; date_of_birth: string | null } | null; b: { id: string; trainee_number: string; name: string; date_of_birth: string | null } | null;
}
export interface NumberCapacity {
  years: { year: string; issued: number; capacity: number; used_pct: number; warning: boolean }[]; global_identities: number; with_active_registration: number; registration_records: number;
  legacy_format_identities: number; open_reviews: number; failed_transfers: number; migration_report: Record<string, unknown> | null;
}

export const useMyTransferOverview = () => useQuery({ queryKey: ["transfers", "mine"], queryFn: () => call<MyTransferOverview>("my_transfer_overview") });
export const useTransferDestinations = () => useQuery({ queryKey: ["transfers", "destinations"], queryFn: () => call<{ id: string; name: string }[]>("transfer_destinations") });
export const useTransferQueue = () => useQuery({ queryKey: ["transfers", "queue"], queryFn: () => call<Transfer[]>("transfer_queue") });
export const useTransferHistory = (id: string | null) =>
  useQuery({ queryKey: ["transfers", "history", id], enabled: !!id, queryFn: () => call<{ event: string; at: string; by: string | null; role: string | null; outcome: string; reason: string | null }[]>("transfer_history", { _id: id }) });
export const useIdentitySummary = (traineeId: string | undefined) =>
  useQuery({ queryKey: ["transfers", "identity", traineeId], enabled: !!traineeId, retry: false, queryFn: () => call<IdentitySummary>("trainee_identity_summary", { _trainee: traineeId }) });
export const useReviewQueue = () => useQuery({ queryKey: ["transfers", "reviews"], queryFn: () => call<ReviewCase[]>("identity_review_queue") });
export const useNumberCapacity = () => useQuery({ queryKey: ["transfers", "capacity"], queryFn: () => call<NumberCapacity>("trainee_number_capacity"), retry: false });

const K = ["transfers"];
export const useSubmitTransfer = () =>
  useRpc<{ destination: string; reason: string }, { reference: string }>("submit_transfer_request", (v) => ({ _destination: v.destination, _reason: v.reason }), K, (r) => `Request ${r.reference} submitted`);
export const useCancelTransfer = () => useRpc<string>("cancel_transfer", (id) => ({ _id: id }), K, "Request cancelled");
export const useDecideTransfer = () =>
  useRpc<{ id: string; decision: "approved" | "rejected"; comment?: string }, { status: string; message?: string }>(
    "decide_transfer", (v) => ({ _id: v.id, _decision: v.decision, _comment: v.comment ?? null }), K,
    (r) => (r.status === "COMPLETED" ? "Approved: the transfer was completed" : r.status === "FAILED" ? "Approved, but the move failed and can be retried" : r.status === "REJECTED" ? "Request rejected" : "Approved: waiting for the next approval"));
export const useRetryTransfer = () => useRpc<string, { status: string }>("retry_transfer", (id) => ({ _id: id }), K, (r) => (r.status === "COMPLETED" ? "Transfer completed" : "The transfer failed again"));
export const useResolveReview = () =>
  useRpc<{ id: string; decision: string; reason: string }>("resolve_identity_review", (v) => ({ _case: v.id, _decision: v.decision, _reason: v.reason }), K, "Review recorded");
export const useMergeIdentities = () =>
  useRpc<{ from: string; into: string; reason: string }, { registrations_moved: number; retired_number: string; canonical_number: string }>(
    "merge_identities", (v) => ({ _from: v.from, _into: v.into, _reason: v.reason }), K, (r) => `Merged: ${r.retired_number} is retired, ${r.canonical_number} is canonical`);
export const useRemapLegacy = () =>
  useRpc<{ identity: string; reason: string }, { old_number: string; new_number: string }>("remap_legacy_identity", (v) => ({ _identity: v.identity, _reason: v.reason }), K, (r) => `${r.old_number} is now ${r.new_number}`);
