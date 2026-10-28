import { Badge } from "@/components/ui/badge";
import { REQUISITION_STATUS } from "./status";

const TONE: Record<string, string> = {
  muted: "bg-muted text-muted-foreground",
  info: "bg-primary/10 text-primary",
  warn: "bg-warning/15 text-warning",
  good: "bg-success/15 text-success",
  bad: "bg-destructive/10 text-destructive",
};

export function RequisitionStatusBadge({ status }: { status: string }) {
  const s = REQUISITION_STATUS[status] ?? { label: status, tone: "muted" as const };
  return <Badge variant="outline" className={`whitespace-normal text-left font-medium ${TONE[s.tone]}`}>{s.label}</Badge>;
}
