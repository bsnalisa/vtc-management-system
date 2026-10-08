import { useQueries, useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useOrganizationContext } from "./useOrganizationContext";

// Newer than the generated Supabase types, so access untyped.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export interface BdlClass {
  id: string; class_name: string; class_code: string; level: number; academic_year: string;
  trade_name: string | null; trainer_name: string | null; enrolled: number;
  items_published: number; items_draft: number; assignments: number; quizzes: number;
}
export interface VirtualSession {
  id: string; class_id: string; title: string; starts_at: string; ends_at: string | null; meeting_url: string;
  host_name: string | null; notes: string | null; status: "scheduled" | "held" | "cancelled";
  classes?: { class_name: string; class_code: string } | null;
}
export interface ProgressRow {
  trainee_id: string; trainee_number: string; first_name: string; last_name: string;
  items_total: number; items_done: number; assignments_total: number; assignments_submitted: number;
  quizzes_total: number; quizzes_passed: number; last_activity: string | null;
}

export const INACTIVE_DAYS = 14;
export const isInactive = (last: string | null) => !last || Date.now() - new Date(last).getTime() > INACTIVE_DAYS * 86400000;
/** Share of everything assigned (content, assignments, quizzes) that the trainee has finished, 0-100. */
export const overallPercent = (p: ProgressRow) => {
  const total = p.items_total + p.assignments_total + p.quizzes_total;
  return total ? Math.round(((p.items_done + p.assignments_submitted + p.quizzes_passed) / total) * 100) : 0;
};
export const contentPercent = (p: ProgressRow) => (p.items_total ? Math.round((p.items_done / p.items_total) * 100) : 0);

const check = ({ error }: { error: Error | null }) => { if (error) throw error; };
const onError = (e: Error) => { toast.error(e.message); };

export const useBdlClasses = () => {
  const { organizationId } = useOrganizationContext();
  return useQuery({
    queryKey: ["bdl-classes", organizationId], enabled: !!organizationId,
    queryFn: async (): Promise<BdlClass[]> => {
      const { data: classes, error } = await db.from("classes")
        .select("id, class_name, class_code, level, academic_year, trades(name), trainers(full_name)")
        .eq("organization_id", organizationId).eq("training_mode", "bdl").order("class_name");
      if (error) throw error;
      const ids: string[] = (classes ?? []).map((c: { id: string }) => c.id);
      if (!ids.length) return [];
      const [enr, items, asg, quiz] = await Promise.all([
        db.from("class_enrollments").select("class_id").in("class_id", ids).eq("status", "active"),
        db.from("learning_items").select("class_id, published").in("class_id", ids),
        db.from("learning_assignments").select("class_id").in("class_id", ids).eq("published", true),
        db.from("learning_quizzes").select("class_id").in("class_id", ids).eq("published", true),
      ]);
      [enr, items, asg, quiz].forEach(check);
      const count = (rows: { class_id: string; published?: boolean }[], id: string, pub?: boolean) =>
        rows.filter((r) => r.class_id === id && (pub === undefined || r.published === pub)).length;
      return (classes as Record<string, any>[]).map((c) => ({ // eslint-disable-line @typescript-eslint/no-explicit-any
        id: c.id, class_name: c.class_name, class_code: c.class_code, level: c.level, academic_year: c.academic_year,
        trade_name: c.trades?.name ?? null, trainer_name: c.trainers?.full_name ?? null,
        enrolled: count(enr.data, c.id), items_published: count(items.data, c.id, true), items_draft: count(items.data, c.id, false),
        assignments: count(asg.data, c.id), quizzes: count(quiz.data, c.id),
      }));
    },
  });
};

export const useVirtualSessions = (classId?: string) => {
  const { organizationId } = useOrganizationContext();
  return useQuery({
    queryKey: ["virtual-sessions", organizationId, classId ?? "all"], enabled: !!organizationId,
    queryFn: async () => {
      let q = db.from("virtual_sessions").select("*, classes(class_name, class_code)").eq("organization_id", organizationId).order("starts_at");
      if (classId) q = q.eq("class_id", classId);
      const { data, error } = await q;
      if (error) throw error;
      return data as VirtualSession[];
    },
  });
};

/** Sessions of one class as a learner sees them (cancelled ones are hidden by row-level security). */
export const useClassSessions = (classId: string | undefined) =>
  useQuery({
    queryKey: ["virtual-sessions-class", classId], enabled: !!classId,
    queryFn: async () => {
      const { data, error } = await db.from("virtual_sessions").select("*").eq("class_id", classId).order("starts_at");
      if (error) throw error;
      return data as VirtualSession[];
    },
  });

export const useSaveVirtualSession = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: Partial<VirtualSession>) => {
      if (v.id) { const { id, ...patch } = v; check(await db.from("virtual_sessions").update(patch).eq("id", id)); }
      else check(await db.from("virtual_sessions").insert([v]));
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["virtual-sessions"] });
      qc.invalidateQueries({ queryKey: ["virtual-sessions-class"] });
      toast.success("Session saved");
    },
    onError,
  });
};

export const useClassProgress = (classId: string | undefined) =>
  useQuery({
    queryKey: ["class-progress", classId], enabled: !!classId,
    queryFn: async () => {
      const { data, error } = await db.rpc("class_progress", { _class: classId });
      if (error) throw error;
      return (data as Record<string, unknown>[]).map((r) => ({
        ...r, items_total: Number(r.items_total), items_done: Number(r.items_done), assignments_total: Number(r.assignments_total),
        assignments_submitted: Number(r.assignments_submitted), quizzes_total: Number(r.quizzes_total), quizzes_passed: Number(r.quizzes_passed),
      })) as ProgressRow[];
    },
  });

/** Progress of every BDL class at once (for the dashboard). */
export const useAllClassProgress = (classIds: string[]) => {
  const results = useQueries({
    queries: classIds.map((id) => ({
      queryKey: ["class-progress", id],
      queryFn: async () => {
        const { data, error } = await db.rpc("class_progress", { _class: id });
        if (error) throw error;
        return (data as Record<string, unknown>[]).map((r) => ({
          ...r, items_total: Number(r.items_total), items_done: Number(r.items_done), assignments_total: Number(r.assignments_total),
          assignments_submitted: Number(r.assignments_submitted), quizzes_total: Number(r.quizzes_total), quizzes_passed: Number(r.quizzes_passed),
        })) as ProgressRow[];
      },
    })),
  });
  return {
    isLoading: results.some((r) => r.isLoading),
    error: results.find((r) => r.error)?.error as Error | undefined,
    byClass: classIds.map((id, i) => ({ classId: id, rows: results[i].data ?? [] })),
  };
};

/** Items the signed-in trainee has marked done in a class. */
export const useMyCompletions = (classId: string | undefined, enabled: boolean) =>
  useQuery({
    queryKey: ["my-item-completions", classId], enabled: enabled && !!classId,
    queryFn: async () => {
      const { data, error } = await db.from("learning_item_completions").select("item_id, learning_items!inner(class_id)").eq("learning_items.class_id", classId);
      if (error) throw error;
      return (data as { item_id: string }[]).map((r) => r.item_id);
    },
  });

export const useSetItemCompleted = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ item, done }: { item: string; done: boolean }) => check(await db.rpc("set_item_completed", { _item: item, _done: done })),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["my-item-completions"] }),
    onError,
  });
};
