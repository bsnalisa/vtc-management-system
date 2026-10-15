import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { MyTask, useActOnTask, useInstanceEvents, useOrgUsers } from "@/hooks/useWorkflows";
import { getRoleDisplayName } from "@/lib/roleUtils";
import { WorkflowAttachments } from "./WorkflowAttachments";

const EVENT_LABELS: Record<string, string> = {
  draft_saved: "Draft saved", submitted: "Submitted", step_opened: "Step opened", approved: "Approved", rejected: "Rejected",
  info_requested: "Returned for correction", info_provided: "Corrected and resubmitted", escalated_by_approver: "Escalated",
  escalated_over_limit: "Escalated: above the approval limit", escalated: "Escalated: overdue", completed_approved: "Approved", completed_rejected: "Rejected",
  completed_cancelled: "Cancelled", completed: "Completed",
};

/** Everything an approver needs on one screen: the request, its documents and history, and the four decisions. */
export function TaskDecisionDialog({ task, onClose }: { task: MyTask; onClose: () => void }) {
  const act = useActOnTask();
  const { data: events } = useInstanceEvents(task.instance_id);
  const { data: users } = useOrgUsers();
  const [comment, setComment] = useState("");
  const go = async (action: "approve" | "reject" | "request_info" | "escalate") => {
    await act.mutateAsync({ task: task.task_id, action, comment: comment.trim() });
    onClose();
  };
  const needsComment = !comment.trim();
  const name = (id: string | null) => (id ? users?.find((u) => u.user_id === id)?.full_name ?? "A user" : "System");
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{task.title}</DialogTitle></DialogHeader>
        <div className="space-y-4 text-sm">
          {task.reference && <div className="font-mono text-xs">{task.reference}</div>}
          <div className="text-muted-foreground">Step {task.step_no}: {task.step_name} · requested by {task.requested_by ?? "unknown"}{task.submitter_role ? ` (${getRoleDisplayName(task.submitter_role as never)})` : ""}{task.due_at ? ` · respond by ${new Date(task.due_at).toLocaleString()}` : ""}</div>
          {task.delegated && <Badge variant="outline">You are covering for a colleague</Badge>}
          {task.escalated && <Badge variant="destructive" className="ml-2">Higher-level approval</Badge>}
          <dl className="space-y-2">
            {Object.entries(task.summary).map(([k, v]) => (<div key={k}><dt className="text-muted-foreground">{k}</dt><dd className="whitespace-pre-wrap">{v}</dd></div>))}
          </dl>
          <WorkflowAttachments instanceId={task.instance_id} />
          <div>
            <h4 className="font-medium text-sm mb-1">History</h4>
            <ol className="space-y-1 border-l pl-3 text-xs">
              {events?.map((e) => (
                <li key={e.id}><span className="font-medium">{EVENT_LABELS[e.event] ?? e.event}</span> · {name(e.actor)} · {new Date(e.created_at).toLocaleString()}{e.comment ? <span className="text-muted-foreground"> — {e.comment}</span> : null}</li>
              ))}
            </ol>
          </div>
          <div className="space-y-1"><Label>Comments (required to reject, return for correction or escalate)</Label><Textarea value={comment} onChange={(e) => setComment(e.target.value)} /></div>
          <div className="flex flex-wrap gap-2">
            <Button disabled={act.isPending} onClick={() => go("approve")}>Approve</Button>
            <Button variant="outline" disabled={act.isPending || needsComment} title={needsComment ? "Say what must be corrected" : ""} onClick={() => go("request_info")}>Return for correction</Button>
            {task.can_escalate && <Button variant="outline" disabled={act.isPending || needsComment} title={needsComment ? "Say why it needs a higher level" : "Send to your own supervisor for a decision"} onClick={() => go("escalate")}>Escalate</Button>}
            <Button variant="destructive" disabled={act.isPending || needsComment} title={needsComment ? "Give a reason" : ""} onClick={() => go("reject")}>Reject</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
