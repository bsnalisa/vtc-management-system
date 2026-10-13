import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { WorkflowInstance, useCancelInstance, useInstanceEvents, useOrgUsers } from "@/hooks/useWorkflows";
import { statusBadgeVariant, statusLabel } from "./status";
import { getRoleDisplayName } from "@/lib/roleUtils";

const EVENT_LABELS: Record<string, string> = {
  started: "Request started", step_opened: "Step opened", approved: "Approved", rejected: "Rejected",
  info_requested: "More information requested", info_provided: "Information provided", escalated: "Escalated",
  overdue: "Overdue", no_assignees: "No approver available", completed_approved: "Completed: approved",
  completed_rejected: "Completed: rejected", completed_cancelled: "Cancelled",
  draft_saved: "Draft saved", submitted: "Submitted for approval", returned_for_correction: "Returned for correction",
  resubmitted: "Corrected and resubmitted", escalated_by_approver: "Escalated for higher-level approval", completed: "Marked completed",
};

export const statusVariant = (s: string): "default" | "destructive" | "secondary" | "outline" =>
  s === "approved" || s === "completed" ? "default" : s === "rejected" ? "destructive" : s === "cancelled" || s === "draft" ? "outline" : "secondary";

/** Summary of a request plus its full audit trail; the requester and admins can cancel it while it runs. */
export function InstanceDialog({ instance, canCancel, onClose }: { instance: WorkflowInstance; canCancel: boolean; onClose: () => void }) {
  const { data: events } = useInstanceEvents(instance.id);
  const { data: users } = useOrgUsers();
  const cancel = useCancelInstance();
  const [reason, setReason] = useState("");
  const name = (id: string | null) => (id ? users?.find((u) => u.user_id === id)?.full_name ?? "A user" : "System");
  const running = instance.status === "draft" || instance.status === "in_progress" || instance.status === "awaiting_info";

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{instance.title}</DialogTitle></DialogHeader>
        <div className="space-y-4 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            {instance.reference && <span className="font-mono text-xs">{instance.reference}</span>}
            <Badge variant={statusBadgeVariant(instance)}>{statusLabel(instance)}</Badge>
            <span className="text-muted-foreground">Step {instance.current_step} · started {new Date(instance.started_at).toLocaleString()}</span>
          </div>
          {instance.submitter_role && <div className="text-muted-foreground">Submitted by {name(instance.started_by)} ({getRoleDisplayName(instance.submitter_role as never)})</div>}
          {instance.next_action && <div><span className="text-muted-foreground">Next action: </span>{instance.next_action}</div>}
          <dl className="grid grid-cols-2 gap-2">
            {Object.entries(instance.summary).map(([k, v]) => (<div key={k} className="col-span-2"><dt className="text-muted-foreground">{k}</dt><dd className="whitespace-pre-wrap">{v}</dd></div>))}
          </dl>
          <div>
            <h4 className="font-medium mb-2">Audit trail</h4>
            <ol className="space-y-2 border-l pl-4">
              {events?.map((e) => (
                <li key={e.id}>
                  <div><span className="font-medium">{EVENT_LABELS[e.event] ?? e.event}</span> · {name(e.actor)}{e.via === "email" ? " (by email)" : ""}</div>
                  <div className="text-xs text-muted-foreground">{new Date(e.created_at).toLocaleString()}</div>
                  {e.comment && <div className="text-muted-foreground">{e.comment}</div>}
                </li>
              ))}
            </ol>
          </div>
          {canCancel && running && (
            <div className="space-y-2 border-t pt-3">
              <Textarea placeholder="Reason for cancelling (optional)" value={reason} onChange={(e) => setReason(e.target.value)} />
              <Button variant="destructive" disabled={cancel.isPending} onClick={async () => { await cancel.mutateAsync({ id: instance.id, reason }); onClose(); }}>Cancel this request</Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
