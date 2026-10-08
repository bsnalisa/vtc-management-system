import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganizationContext } from "./useOrganizationContext";

// Several of these tables are newer than the generated Supabase types, so access untyped.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

const PAGE = 1000;

/** PostgREST returns at most 1000 rows per request; page through until a short page comes back. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchAll<T>(build: (from: number, to: number) => PromiseLike<{ data: any; error: any }>): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await build(from, from + PAGE - 1);
    if (error) throw error;
    const rows = (data ?? []) as T[];
    out.push(...rows);
    if (rows.length < PAGE) break;
  }
  return out;
}

export const monthKey = (d: string | Date) => {
  const date = typeof d === "string" ? new Date(d) : d;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
};

/** The last n month keys, oldest first. */
export const lastMonths = (n: number) => {
  const now = new Date();
  return Array.from({ length: n }, (_, i) => monthKey(new Date(now.getFullYear(), now.getMonth() - (n - 1 - i), 1)));
};

// ---- Resource centre ----
export interface BorrowingRow {
  id: string; library_item_id: string; borrow_date: string; due_date: string; return_date: string | null;
  status: "borrowed" | "returned" | "overdue"; library_items: { title: string } | null;
}
export interface FineRow { id: string; fine_amount: number; amount_paid: number; status: "pending" | "paid" | "waived" }

export const useResourceCentreReport = () => {
  const { organizationId } = useOrganizationContext();
  return useQuery({
    queryKey: ["report-resource-centre", organizationId],
    enabled: !!organizationId,
    queryFn: async () => {
      const [borrowing, fines] = await Promise.all([
        fetchAll<BorrowingRow>((from, to) => db.from("library_borrowing")
          .select("id, library_item_id, borrow_date, due_date, return_date, status, library_items(title)")
          .eq("organization_id", organizationId).order("borrow_date", { ascending: false }).range(from, to)),
        fetchAll<FineRow>((from, to) => db.from("library_fines")
          .select("id, fine_amount, amount_paid, status").eq("organization_id", organizationId).range(from, to)),
      ]);
      return { borrowing, fines };
    },
  });
};

// ---- Graduate surveys ----
export interface SurveyReportQuestion { id: string; survey_id: string; position: number; question_text: string; question_type: string; options: string[] }
export interface SurveyReportData {
  surveys: { id: string; title: string; status: string; anonymous: boolean; created_at: string }[];
  questions: SurveyReportQuestion[];
  recipients: { survey_id: string; completed_at: string | null }[];
  responses: { survey_id: string; answers: Record<string, unknown> }[];
}

export const useSurveyReport = () => {
  const { organizationId } = useOrganizationContext();
  return useQuery({
    queryKey: ["report-graduate-surveys", organizationId],
    enabled: !!organizationId,
    queryFn: async (): Promise<SurveyReportData> => {
      const surveys = await fetchAll<SurveyReportData["surveys"][number]>((from, to) => db.from("graduate_surveys")
        .select("id, title, status, anonymous, created_at").eq("organization_id", organizationId).order("created_at", { ascending: false }).range(from, to));
      if (!surveys.length) return { surveys, questions: [], recipients: [], responses: [] };
      const [questions, recipients, responses] = await Promise.all([
        fetchAll<SurveyReportQuestion>((from, to) => db.from("survey_questions")
          .select("id, survey_id, position, question_text, question_type, options").in("survey_id", surveys.map((s) => s.id)).order("position").range(from, to)),
        fetchAll<SurveyReportData["recipients"][number]>((from, to) => db.from("survey_recipients")
          .select("id, survey_id, completed_at").eq("organization_id", organizationId).order("id").range(from, to)),
        fetchAll<SurveyReportData["responses"][number]>((from, to) => db.from("survey_responses")
          .select("id, survey_id, answers").eq("organization_id", organizationId).order("id").range(from, to)),
      ]);
      return { surveys, questions, recipients, responses };
    },
  });
};

// ---- Trainee affairs ----
export interface AffairsReportRow {
  id: string; record_type: string; record_date: string; status: "open" | "in_progress" | "resolved" | "closed";
  created_at: string; updated_at: string;
}

export const useAffairsReport = () => {
  const { organizationId } = useOrganizationContext();
  return useQuery({
    queryKey: ["report-trainee-affairs", organizationId],
    enabled: !!organizationId,
    queryFn: () => fetchAll<AffairsReportRow>((from, to) => db.from("trainee_affairs_records")
      .select("id, record_type, record_date, status, created_at, updated_at")
      .eq("organization_id", organizationId).order("record_date", { ascending: false }).range(from, to)),
  });
};
