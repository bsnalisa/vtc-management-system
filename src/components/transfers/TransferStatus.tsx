import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Decision, Transfer, TransferStatus as Status } from "@/hooks/useTransfers";

const LABEL: Record<Status, { text: string; tone: string }> = {
  PENDING_TRAINING: { text: "Waiting for Head of Training", tone: "bg-orange-100 text-orange-800 border-orange-200" },
  PENDING_SUPPORT: { text: "Waiting for Head of Trainee Support", tone: "bg-orange-100 text-orange-800 border-orange-200" },
  APPROVED: { text: "Approved, not yet moved", tone: "bg-blue-100 text-blue-800 border-blue-200" },
  COMPLETED: { text: "Completed", tone: "bg-green-100 text-green-800 border-green-200" },
  REJECTED: { text: "Rejected", tone: "bg-red-100 text-red-800 border-red-200" },
  CANCELLED: { text: "Cancelled", tone: "bg-gray-100 text-gray-800 border-gray-200" },
  FAILED: { text: "Approved, move failed", tone: "bg-red-100 text-red-800 border-red-200" },
};
export const transferStatusText = (s: Status) => LABEL[s].text;
export const TransferStatusBadge = ({ status }: { status: Status }) => <Badge variant="outline" className={cn("whitespace-nowrap font-medium", LABEL[status].tone)}>{LABEL[status].text}</Badge>;

const fmt = (d: string | null) => (d ? new Date(d).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "");
const Step = ({ title, d }: { title: string; d: Decision }) => (
  <li className="text-sm">
    <span className="font-medium">{title}: </span>
    {d.decision ? <>{d.decision === "approved" ? "Approved" : "Rejected"} by {d.by ?? "an authorised approver"} on {fmt(d.at)}{d.comment ? <span className="block text-muted-foreground">“{d.comment}”</span> : null}</> : <span className="text-muted-foreground">No decision yet</span>}
  </li>
);

/** Both required decisions, so "approved" is never confused with "completed". */
export const TransferDecisions = ({ t }: { t: Transfer }) => (
  <ul className="space-y-1.5">
    <Step title="1. Head of Training" d={t.training} />
    <Step title="2. Head of Trainee Support" d={t.support} />
    <li className="text-sm"><span className="font-medium">3. Move to {t.destination_name}: </span>
      {t.status === "COMPLETED" ? <>Completed on {fmt(t.completed_at)}</> : t.status === "FAILED" ? <span className="text-destructive">Failed: {t.failure_reason}</span> : <span className="text-muted-foreground">Not done</span>}</li>
  </ul>
);
