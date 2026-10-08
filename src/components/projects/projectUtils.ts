import type { MilestoneStatus, ProjectPriority, ProjectStatus, StaffUser } from "@/hooks/useProjects";

export const PROJECT_STATUSES: ProjectStatus[] = ["planned", "active", "on_hold", "completed", "cancelled"];
export const PROJECT_PRIORITIES: ProjectPriority[] = ["low", "medium", "high"];
export const MILESTONE_STATUSES: MilestoneStatus[] = ["pending", "in_progress", "done", "blocked"];

export const label = (c: string) => c.replace(/_/g, " ").replace(/^\w/, (x) => x.toUpperCase());
export const fmtDate = (d: string | null) => (d ? new Date(`${d.slice(0, 10)}T00:00:00`).toLocaleDateString() : "-");
export const fmtDateTime = (d: string) => new Date(d).toLocaleString();
export const money = (n: number | null | undefined) => (n === null || n === undefined ? "-" : Number(n).toLocaleString(undefined, { maximumFractionDigits: 2 }));

type BadgeVariant = "default" | "secondary" | "destructive" | "outline";
export const statusVariant = (s: string): BadgeVariant =>
  s === "active" || s === "in_progress" ? "default" : s === "cancelled" || s === "blocked" ? "destructive" : s === "planned" || s === "pending" ? "secondary" : "outline";
export const priorityVariant = (p: string): BadgeVariant => (p === "high" ? "destructive" : p === "medium" ? "secondary" : "outline");

export const userName = (users: StaffUser[] | undefined, id: string | null) => {
  if (!id) return "-";
  const u = users?.find((x) => x.user_id === id);
  return u?.full_name || u?.email || "Unknown user";
};
