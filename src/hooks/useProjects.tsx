import { useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useOrganizationContext } from "./useOrganizationContext";

// Newer than the generated Supabase types, so access untyped.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export type ProjectStatus = "planned" | "active" | "on_hold" | "completed" | "cancelled";
export type ProjectPriority = "low" | "medium" | "high";
export type MilestoneStatus = "pending" | "in_progress" | "done" | "blocked";

export interface Project {
  id: string; organization_id: string; project_code: string; title: string; description: string | null;
  status: ProjectStatus; priority: ProjectPriority; start_date: string | null; end_date: string | null;
  budget: number | null; spent: number; lead_user_id: string | null; created_at: string; updated_at: string;
}
export interface ProjectMilestone {
  id: string; project_id: string; organization_id: string; title: string; description: string | null;
  due_date: string; status: MilestoneStatus; owner_user_id: string | null; completed_on: string | null;
  projects?: { title: string; project_code: string } | null;
}
export interface ProjectUpdate {
  id: string; project_id: string; organization_id: string; note: string; progress_percent: number | null;
  author_id: string | null; created_at: string;
  projects?: { title: string; project_code: string } | null;
}
export interface StaffUser { user_id: string; full_name: string | null; email: string | null }

export type ProjectInput = Omit<Project, "id" | "organization_id" | "project_code" | "created_at" | "updated_at">;
export type MilestoneInput = Pick<ProjectMilestone, "title" | "description" | "due_date" | "status" | "owner_user_id">;

export const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const addDaysIso = (days: number) => {
  const d = new Date(); d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export const useCurrentUserId = () =>
  useQuery({
    queryKey: ["projects-current-user"],
    queryFn: async () => {
      const { data, error } = await supabase.auth.getUser();
      if (error) throw error;
      return data.user?.id ?? null;
    },
  });

export const useProjectStaff = () =>
  useQuery({
    queryKey: ["projects-staff-users"],
    queryFn: async () => {
      const { data, error } = await db.rpc("workflow_list_users");
      if (error) throw error;
      return data as StaffUser[];
    },
  });

export const useProjects = () => {
  const { organizationId } = useOrganizationContext();
  return useQuery({
    queryKey: ["projects", organizationId], enabled: !!organizationId,
    queryFn: async () => {
      const { data, error } = await db.from("projects").select("*")
        .eq("organization_id", organizationId).order("created_at", { ascending: false });
      if (error) throw error;
      return data as Project[];
    },
  });
};

/** Milestones for the centre, or for a single project when projectId is given. */
export const useProjectMilestones = (projectId?: string) => {
  const { organizationId } = useOrganizationContext();
  return useQuery({
    queryKey: ["project-milestones", organizationId, projectId ?? "all"], enabled: !!organizationId,
    queryFn: async () => {
      let q = db.from("project_milestones").select("*, projects(title, project_code)").eq("organization_id", organizationId);
      if (projectId) q = q.eq("project_id", projectId);
      const { data, error } = await q.order("due_date", { ascending: true });
      if (error) throw error;
      return data as ProjectMilestone[];
    },
  });
};

/** Updates newest first, for the centre or a single project. */
export const useProjectUpdates = (projectId?: string, limit = 500) => {
  const { organizationId } = useOrganizationContext();
  return useQuery({
    queryKey: ["project-updates", organizationId, projectId ?? "all", limit], enabled: !!organizationId,
    queryFn: async () => {
      let q = db.from("project_updates").select("*, projects(title, project_code)").eq("organization_id", organizationId);
      if (projectId) q = q.eq("project_id", projectId);
      const { data, error } = await q.order("created_at", { ascending: false }).limit(limit);
      if (error) throw error;
      return data as ProjectUpdate[];
    },
  });
};

/** Map of project id to the latest progress percentage that was reported. */
export const latestProgressByProject = (updates: ProjectUpdate[] | undefined) => {
  const map = new Map<string, number>();
  // updates arrive newest first, so the first value seen per project is the latest
  (updates ?? []).forEach((u) => { if (u.progress_percent !== null && !map.has(u.project_id)) map.set(u.project_id, u.progress_percent); });
  return map;
};

export const computeProjectStats = (projects: Project[] = [], milestones: ProjectMilestone[] = []) => {
  const byStatus: Record<ProjectStatus, number> = { planned: 0, active: 0, on_hold: 0, completed: 0, cancelled: 0 };
  let totalBudget = 0; let totalSpent = 0;
  projects.forEach((p) => { byStatus[p.status] += 1; totalBudget += Number(p.budget ?? 0); totalSpent += Number(p.spent ?? 0); });
  const today = todayIso(); const soon = addDaysIso(14);
  const open = milestones.filter((m) => m.status !== "done");
  return {
    total: projects.length, byStatus, totalBudget, totalSpent,
    overdueMilestones: open.filter((m) => m.due_date < today).length,
    dueSoonMilestones: open.filter((m) => m.due_date >= today && m.due_date <= soon).length,
  };
};

export const useProjectStats = () => {
  const projects = useProjects(); const milestones = useProjectMilestones();
  const stats = useMemo(() => computeProjectStats(projects.data, milestones.data), [projects.data, milestones.data]);
  return { stats, projects, milestones };
};

const useInvalidate = () => {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ["projects"] });
    qc.invalidateQueries({ queryKey: ["project-milestones"] });
    qc.invalidateQueries({ queryKey: ["project-updates"] });
  };
};

export const useSaveProject = () => {
  const invalidate = useInvalidate(); const { organizationId } = useOrganizationContext();
  return useMutation({
    mutationFn: async (v: { id?: string; values: ProjectInput }) => {
      if (v.id) {
        const { error } = await db.from("projects").update(v.values).eq("id", v.id);
        if (error) throw error;
      } else {
        const { error } = await db.from("projects").insert([{ ...v.values, organization_id: organizationId }]);
        if (error) throw error;
      }
    },
    onSuccess: (_d, v) => { invalidate(); toast.success(v.id ? "Project updated" : "Project created"); },
    onError: (e: Error) => toast.error(e.message),
  });
};

export const useDeleteProject = () => {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (id: string) => { const { error } = await db.from("projects").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { invalidate(); toast.success("Project deleted"); },
    onError: (e: Error) => toast.error(e.message),
  });
};

export const useSaveMilestone = () => {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (v: { id?: string; project_id: string; values: MilestoneInput }) => {
      if (v.id) {
        const { error } = await db.from("project_milestones").update(v.values).eq("id", v.id);
        if (error) throw error;
      } else {
        const { error } = await db.from("project_milestones").insert([{ ...v.values, project_id: v.project_id }]);
        if (error) throw error;
      }
    },
    onSuccess: (_d, v) => { invalidate(); toast.success(v.id ? "Milestone updated" : "Milestone added"); },
    onError: (e: Error) => toast.error(e.message),
  });
};

/** Status-only change; owners may do this on their own milestones (the database enforces it). */
export const useSetMilestoneStatus = () => {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (v: { id: string; status: MilestoneStatus }) => {
      const { data, error } = await db.from("project_milestones").update({ status: v.status }).eq("id", v.id).select("id");
      if (error) throw error;
      if (!data?.length) throw new Error("You are not allowed to change this milestone");
    },
    onSuccess: () => { invalidate(); toast.success("Milestone status updated"); },
    onError: (e: Error) => toast.error(e.message),
  });
};

export const useDeleteMilestone = () => {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (id: string) => { const { error } = await db.from("project_milestones").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { invalidate(); toast.success("Milestone deleted"); },
    onError: (e: Error) => toast.error(e.message),
  });
};

export const usePostProjectUpdate = () => {
  const invalidate = useInvalidate(); const { data: userId } = useCurrentUserId();
  return useMutation({
    mutationFn: async (v: { project_id: string; note: string; progress_percent: number | null }) => {
      const { error } = await db.from("project_updates").insert([{ ...v, author_id: userId }]);
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast.success("Update posted"); },
    onError: (e: Error) => toast.error(e.message),
  });
};
