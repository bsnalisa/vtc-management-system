import type { WorkflowInstance } from "@/hooks/useWorkflows";

/** One status vocabulary for every approval screen (engine states, plus the escalated / resubmitted views of "in progress"). */
export type DisplayStatus =
  | "draft" | "pending_supervisor" | "returned" | "resubmitted" | "pending_higher" | "approved" | "rejected" | "completed" | "cancelled";

export const STATUS_LABELS: Record<DisplayStatus, string> = {
  draft: "Draft",
  pending_supervisor: "Pending Supervisor Approval",
  returned: "Returned for Correction",
  resubmitted: "Resubmitted",
  pending_higher: "Pending Higher-Level Approval",
  approved: "Approved",
  rejected: "Rejected",
  completed: "Completed",
  cancelled: "Cancelled",
};

export const displayStatus = (i: Pick<WorkflowInstance, "status" | "escalated" | "resubmitted">): DisplayStatus => {
  switch (i.status) {
    case "draft": return "draft";
    case "awaiting_info": return "returned";
    case "approved": return "approved";
    case "rejected": return "rejected";
    case "completed": return "completed";
    case "cancelled": return "cancelled";
    default: return i.escalated ? "pending_higher" : i.resubmitted ? "resubmitted" : "pending_supervisor";
  }
};

export const statusLabel = (i: Pick<WorkflowInstance, "status" | "escalated" | "resubmitted">) => STATUS_LABELS[displayStatus(i)];

export const statusBadgeVariant = (i: Pick<WorkflowInstance, "status" | "escalated" | "resubmitted">): "default" | "destructive" | "secondary" | "outline" => {
  const d = displayStatus(i);
  return d === "approved" || d === "completed" ? "default" : d === "rejected" ? "destructive" : d === "cancelled" || d === "draft" ? "outline" : "secondary";
};

export const SUPERVISOR_STEP_LABELS: Record<string, string> = {
  "@supervisor": "The submitter's direct supervisor",
  "@supervisor2": "The submitter's supervisor's supervisor",
  "@supervisor3": "Three levels above the submitter",
};
