import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface GradebookAuditIssue {
  type: "missing_ca" | "stalled_workflow" | "orphaned_marks" | "empty_gradebook" | "unresolved_queries";
  severity: "error" | "warning" | "info";
  gradebook_id: string;
  gradebook_title: string;
  trainer_name: string;
  status: string;
  detail: string;
}

// ─── Org-wide audit: find data integrity issues ───
export const useGradebookAudit = () => {
  return useQuery({
    queryKey: ["gradebook-audit"],
    queryFn: async () => {
      const issues: GradebookAuditIssue[] = [];

      // 1. Fetch all gradebooks with related counts
      const { data: gradebooks, error: gbErr } = await supabase
        .from("gradebooks")
        .select(`
          id, title, status, created_at, updated_at, submitted_at,
          trainers:trainer_id (full_name)
        `)
        .order("updated_at", { ascending: false });
      if (gbErr) throw gbErr;
      if (!gradebooks || gradebooks.length === 0) return { issues, summary: { total: 0, draft: 0, submitted: 0, hot_approved: 0, ac_approved: 0, finalised: 0 } };

      const gbIds = gradebooks.map(g => g.id);

      // 2. Batch-fetch trainees, marks, CA scores, and queries
      const [traineeRes, marksRes, caRes, queriesRes] = await Promise.all([
        supabase.from("gradebook_trainees").select("gradebook_id").in("gradebook_id", gbIds),
        supabase.from("gradebook_marks").select("gradebook_id, trainee_id").in("gradebook_id", gbIds),
        supabase.from("gradebook_ca_scores").select("gradebook_id, trainee_id").in("gradebook_id", gbIds),
        supabase.from("gradebook_mark_queries").select("gradebook_id, status").in("gradebook_id", gbIds),
      ]);

      const traineesByGb = new Map<string, number>();
      (traineeRes.data || []).forEach(r => traineesByGb.set(r.gradebook_id, (traineesByGb.get(r.gradebook_id) || 0) + 1));

      const marksTrainees = new Map<string, Set<string>>();
      (marksRes.data || []).forEach(r => {
        if (!marksTrainees.has(r.gradebook_id)) marksTrainees.set(r.gradebook_id, new Set());
        marksTrainees.get(r.gradebook_id)!.add(r.trainee_id);
      });

      const caTrainees = new Map<string, Set<string>>();
      (caRes.data || []).forEach(r => {
        if (!caTrainees.has(r.gradebook_id)) caTrainees.set(r.gradebook_id, new Set());
        caTrainees.get(r.gradebook_id)!.add(r.trainee_id);
      });

      const openQueriesByGb = new Map<string, number>();
      (queriesRes.data || []).forEach(r => {
        if (r.status === "open") openQueriesByGb.set(r.gradebook_id, (openQueriesByGb.get(r.gradebook_id) || 0) + 1);
      });

      // 3. Analyse each gradebook
      const now = Date.now();
      const STALE_DAYS = 14;

      for (const gb of gradebooks) {
        const trainerName = (gb.trainers as any)?.full_name || "Unknown";
        const base = { gradebook_id: gb.id, gradebook_title: gb.title, trainer_name: trainerName, status: gb.status };

        const traineeCount = traineesByGb.get(gb.id) || 0;
        const markedTraineeCount = marksTrainees.get(gb.id)?.size || 0;
        const caTraineeCount = caTrainees.get(gb.id)?.size || 0;
        const openQueries = openQueriesByGb.get(gb.id) || 0;

        // Empty gradebook (no trainees enrolled)
        if (traineeCount === 0 && gb.status !== "draft") {
          issues.push({ ...base, type: "empty_gradebook", severity: "error", detail: `Non-draft gradebook has 0 trainees enrolled.` });
        }

        // Marks exist but CA scores missing for some trainees
        if (markedTraineeCount > 0 && caTraineeCount < markedTraineeCount) {
          const missing = markedTraineeCount - caTraineeCount;
          issues.push({ ...base, type: "missing_ca", severity: "warning", detail: `${missing} trainee(s) have marks but no computed CA score.` });
        }

        // Stalled workflow: submitted/approved but not progressed for >14 days
        if (["submitted", "hot_approved", "ac_approved"].includes(gb.status)) {
          const updatedAt = new Date(gb.updated_at).getTime();
          const daysSince = Math.floor((now - updatedAt) / (1000 * 60 * 60 * 24));
          if (daysSince > STALE_DAYS) {
            issues.push({ ...base, type: "stalled_workflow", severity: "warning", detail: `Status "${gb.status.replace(/_/g, " ")}" unchanged for ${daysSince} days.` });
          }
        }

        // Unresolved queries on finalised gradebooks
        if (gb.status === "finalised" && openQueries > 0) {
          issues.push({ ...base, type: "unresolved_queries", severity: "error", detail: `${openQueries} open mark query/queries on a finalised gradebook.` });
        }

        // Open queries on non-finalised (info)
        if (gb.status !== "finalised" && openQueries > 0) {
          issues.push({ ...base, type: "unresolved_queries", severity: "info", detail: `${openQueries} open mark query/queries pending resolution.` });
        }
      }

      // Summary counts
      const summary = {
        total: gradebooks.length,
        draft: gradebooks.filter(g => g.status === "draft").length,
        submitted: gradebooks.filter(g => g.status === "submitted").length,
        hot_approved: gradebooks.filter(g => g.status === "hot_approved").length,
        ac_approved: gradebooks.filter(g => g.status === "ac_approved").length,
        finalised: gradebooks.filter(g => g.status === "finalised").length,
      };

      return { issues, summary };
    },
  });
};
