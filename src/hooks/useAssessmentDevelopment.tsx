import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useOrganizationContext } from "./useOrganizationContext";

// Newer than the generated Supabase types, so access untyped.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export interface SmeApplication {
  id: string; full_name: string; email: string; phone: string | null; national_id: string | null;
  expertise: string; experience: string; status: "pending" | "approved" | "rejected";
  review_notes: string | null; user_id: string | null; created_at: string;
}
export interface DevelopmentPlan {
  id: string; qualification_id: string; unit_standard_id: string | null; academic_year: string;
  assessment_type: "theory" | "practical"; assigned_to: string | null; questions_required: number;
  due_date: string | null; brief: string | null; status: "assigned" | "in_progress" | "submitted" | "approved" | "rejected";
  review_notes: string | null; qualifications?: { qualification_title: string } | null;
  unit_standards?: { unit_no: string } | null;
}
export type QuestionType = "multiple_choice" | "true_false" | "short_answer" | "practical_task";
export interface BankQuestion {
  id: string; qualification_id: string; unit_standard_id: string | null; plan_id: string | null;
  question_type: QuestionType; question_text: string; options: string[]; correct_answer: string | null;
  marks: number; difficulty: "easy" | "medium" | "hard"; status: "draft" | "submitted" | "approved" | "rejected";
  review_notes: string | null; author_id: string; qualifications?: { qualification_title: string } | null;
}
export interface QuestionPaper {
  id: string; qualification_id: string; title: string; target_marks: number; total_marks: number;
  duration_minutes: number | null; status: "draft" | "approved"; created_at: string;
  qualifications?: { qualification_title: string } | null;
}
export interface Sitting {
  id: string; qualification_id: string; title: string; sitting_date: string; venue: string | null; paper_id: string | null;
  induction_date: string | null; induction_venue: string | null; induction_agenda: string | null;
  induction_notified_at: string | null; printing_notified_at: string | null;
  qualifications?: { qualification_title: string } | null;
}
export interface SittingCandidate {
  sitting_id: string; trainee_id: string; status: "registered" | "approved" | "withdrawn";
  trainees?: { first_name: string; last_name: string; trainee_id: string } | null;
}
export interface RosterEntry {
  id: string; sitting_id: string; duty: "invigilator" | "chief_invigilator" | "assessor" | "supervisor";
  staff_name: string; room: string | null; session_start: string | null; session_end: string | null;
}

function useOrgMutation<T, R = unknown>(fn: (v: T, orgId: string) => Promise<R>, keys: string[], success: string | ((r: R) => string)) {
  const queryClient = useQueryClient();
  const { organizationId } = useOrganizationContext();
  return useMutation({
    mutationFn: async (v: T) => {
      if (!organizationId) throw new Error("No organization ID");
      return fn(v, organizationId);
    },
    onSuccess: (r) => {
      keys.forEach((k) => queryClient.invalidateQueries({ queryKey: [k] }));
      toast.success(typeof success === "function" ? success(r) : success);
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

function useOrgQuery<T>(key: string, table: string, select: string, order: { column: string; ascending?: boolean }, extra?: (q: any) => any, enabled = true) { // eslint-disable-line @typescript-eslint/no-explicit-any
  const { organizationId } = useOrganizationContext();
  return useQuery({
    queryKey: [key, organizationId, table],
    enabled: !!organizationId && enabled,
    queryFn: async () => {
      let q = db.from(table).select(select).eq("organization_id", organizationId).order(order.column, { ascending: order.ascending ?? false });
      if (extra) q = extra(q);
      const { data, error } = await q;
      if (error) throw error;
      return data as T[];
    },
  });
}

// ---- SME applications ----
export const useSmeApplications = () => useOrgQuery<SmeApplication>("sme-applications", "sme_applications", "*", { column: "created_at" });
export const useReviewSme = () =>
  useOrgMutation(async (v: { id: string; approve: boolean; notes: string }) => {
    const { data, error } = await db.rpc("review_sme_application", { _id: v.id, _approve: v.approve, _notes: v.notes || null });
    if (error) throw error;
    return data as string;
  }, ["sme-applications", "smes"], (r) =>
    r === "approved_without_account" ? "Approved. Create a user account with the Subject Matter Expert role for this email."
    : r === "approved_role_granted" ? "Approved. The applicant now has the Subject Matter Expert role." : "Application rejected");
export const useSmes = (enabled: boolean) => {
  const { organizationId } = useOrganizationContext();
  return useQuery({
    queryKey: ["smes", organizationId], enabled: !!organizationId && enabled,
    queryFn: async () => {
      const { data, error } = await db.rpc("list_smes", { _org: organizationId });
      if (error) throw error;
      return data as { user_id: string; full_name: string; email: string }[];
    },
  });
};

// public registration, no login
export const submitSmeApplication = async (v: { slug: string; full_name: string; email: string; phone: string; national_id: string; expertise: string; experience: string }) => {
  const { error } = await db.rpc("submit_sme_application", {
    _org_slug: v.slug, _full_name: v.full_name, _email: v.email, _phone: v.phone || null,
    _national_id: v.national_id || null, _expertise: v.expertise, _experience: v.experience,
  });
  if (error) throw error;
};

// ---- Development plans ----
export const useDevelopmentPlans = () =>
  useOrgQuery<DevelopmentPlan>("dev-plans", "assessment_development_plans", "*, qualifications(qualification_title), unit_standards(unit_no)", { column: "created_at" });
export const useCreatePlan = () =>
  useOrgMutation(async (p: Partial<DevelopmentPlan>, orgId) => {
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await db.from("assessment_development_plans").insert([{ ...p, organization_id: orgId, created_by: user?.id }]);
    if (error) throw error;
  }, ["dev-plans"], "Development plan created");
export const useUpdatePlan = () =>
  useOrgMutation(async ({ id, ...patch }: Partial<DevelopmentPlan> & { id: string }) => {
    const { error } = await db.from("assessment_development_plans").update(patch).eq("id", id);
    if (error) throw error;
  }, ["dev-plans"], "Plan updated");

// ---- Question bank ----
export const useQuestions = () =>
  useOrgQuery<BankQuestion>("bank-questions", "question_bank_items", "*, qualifications(qualification_title)", { column: "created_at" });
export const useSaveQuestion = () =>
  useOrgMutation(async (q: Partial<BankQuestion>, orgId) => {
    if (q.id) {
      const { id, ...patch } = q;
      const { error } = await db.from("question_bank_items").update(patch).eq("id", id);
      if (error) throw error;
    } else {
      const { error } = await db.from("question_bank_items").insert([{ ...q, organization_id: orgId }]);
      if (error) throw error;
    }
  }, ["bank-questions"], "Question saved");
export const useReviewQuestion = () =>
  useOrgMutation(async (v: { id: string; status: "approved" | "rejected"; review_notes?: string }) => {
    const { error } = await db.from("question_bank_items").update({ status: v.status, review_notes: v.review_notes ?? null }).eq("id", v.id);
    if (error) throw error;
  }, ["bank-questions"], "Review saved");

// ---- Papers ----
export const usePapers = () =>
  useOrgQuery<QuestionPaper>("question-papers", "question_papers", "*, qualifications(qualification_title)", { column: "created_at" });
export const useGeneratePaper = () =>
  useOrgMutation(async (v: { qualification: string; unitStandard: string | null; title: string; targetMarks: number; duration: number | null; difficulty: string | null }) => {
    const { data, error } = await db.rpc("generate_question_paper", {
      _qualification: v.qualification, _unit_standard: v.unitStandard, _title: v.title,
      _target_marks: v.targetMarks, _duration: v.duration, _difficulty: v.difficulty,
    });
    if (error) throw error;
    return data as string;
  }, ["question-papers"], "Paper generated");
export const useApprovePaper = () =>
  useOrgMutation(async (id: string) => {
    const { error } = await db.from("question_papers").update({ status: "approved" }).eq("id", id);
    if (error) throw error;
  }, ["question-papers"], "Paper approved");
export const usePaperQuestions = (paperId: string | undefined) =>
  useQuery({
    queryKey: ["paper-questions", paperId], enabled: !!paperId,
    queryFn: async () => {
      const { data, error } = await db.from("question_paper_items").select("position, question_bank_items(*)").eq("paper_id", paperId).order("position");
      if (error) throw error;
      return (data as { position: number; question_bank_items: BankQuestion }[]).map((d) => ({ position: d.position, ...d.question_bank_items }));
    },
  });

// ---- Sittings ----
export const useSittings = () =>
  useOrgQuery<Sitting>("sittings", "assessment_sittings", "*, qualifications(qualification_title)", { column: "sitting_date" });
export const useCreateSitting = () =>
  useOrgMutation(async (s: Partial<Sitting>, orgId) => {
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await db.from("assessment_sittings").insert([{ ...s, organization_id: orgId, created_by: user?.id }]);
    if (error) throw error;
  }, ["sittings"], "Assessment sitting created");
export const useUpdateSitting = () =>
  useOrgMutation(async ({ id, ...patch }: Partial<Sitting> & { id: string }) => {
    const { error } = await db.from("assessment_sittings").update(patch).eq("id", id);
    if (error) throw error;
  }, ["sittings"], "Sitting updated");
export const useCandidates = (sittingId: string | undefined) =>
  useQuery({
    queryKey: ["sitting-candidates", sittingId], enabled: !!sittingId,
    queryFn: async () => {
      const { data, error } = await db.from("assessment_sitting_candidates").select("*, trainees(first_name,last_name,trainee_id)").eq("sitting_id", sittingId).order("created_at");
      if (error) throw error;
      return data as SittingCandidate[];
    },
  });
export const useRegisterCandidates = () =>
  useOrgMutation(async (v: { sittingId: string; traineeIds: string[] }, orgId) => {
    const rows = v.traineeIds.map((trainee_id) => ({ sitting_id: v.sittingId, trainee_id, organization_id: orgId }));
    const { error } = await db.from("assessment_sitting_candidates").upsert(rows, { onConflict: "sitting_id,trainee_id", ignoreDuplicates: true });
    if (error) throw error;
  }, ["sitting-candidates"], "Candidates registered");
export const useSetCandidateStatus = () =>
  useOrgMutation(async (v: { sittingId: string; traineeIds: string[]; status: SittingCandidate["status"] }) => {
    const { error } = await db.from("assessment_sitting_candidates").update({ status: v.status }).eq("sitting_id", v.sittingId).in("trainee_id", v.traineeIds);
    if (error) throw error;
  }, ["sitting-candidates"], "Candidates updated");
export const useQualifiedTrainees = (qualificationId: string | undefined) => {
  const { organizationId } = useOrganizationContext();
  return useQuery({
    queryKey: ["qualified-trainees", organizationId, qualificationId], enabled: !!organizationId && !!qualificationId,
    queryFn: async () => {
      const { data, error } = await supabase.from("trainees").select("id, first_name, last_name, trainee_id")
        .eq("organization_id", organizationId!).eq("qualification_id", qualificationId!).eq("status", "active").order("last_name");
      if (error) throw error;
      return data;
    },
  });
};
export const useRoster = (sittingId: string | undefined) =>
  useQuery({
    queryKey: ["sitting-roster", sittingId], enabled: !!sittingId,
    queryFn: async () => {
      const { data, error } = await db.from("assessment_roster_entries").select("*").eq("sitting_id", sittingId).order("session_start");
      if (error) throw error;
      return data as RosterEntry[];
    },
  });
export const useAddRosterEntry = () =>
  useOrgMutation(async (e: Partial<RosterEntry>, orgId) => {
    const { error } = await db.from("assessment_roster_entries").insert([{ ...e, organization_id: orgId }]);
    if (error) throw error;
  }, ["sitting-roster"], "Roster entry added");
export const useRemoveRosterEntry = () =>
  useOrgMutation(async (id: string) => {
    const { error } = await db.from("assessment_roster_entries").delete().eq("id", id);
    if (error) throw error;
  }, ["sitting-roster"], "Roster entry removed");
export const useNotifyInduction = () =>
  useOrgMutation(async (sittingId: string) => {
    const { data, error } = await db.rpc("notify_sitting_induction", { _sitting: sittingId });
    if (error) throw error;
    return data as number;
  }, ["sittings"], (n) => `Induction notice sent to ${n} candidate(s) with portal accounts`);
export const useNotifyPrinting = () =>
  useOrgMutation(async (sittingId: string) => {
    const { data, error } = await db.rpc("notify_printing_officer", { _sitting: sittingId });
    if (error) throw error;
    return data as number;
  }, ["sittings"], (n) => `Printing & Distribution Officer notified (${n})`);
