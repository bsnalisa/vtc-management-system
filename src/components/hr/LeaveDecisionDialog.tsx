import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { LeaveRequest, fmtDate, useDecideLeave } from "@/hooks/useHr";

/** Approve or decline a pending request; declining needs a reason. */
export function LeaveDecisionDialog({ request, name, onClose }: { request: LeaveRequest | null; name: string; onClose: () => void }) {
  const decide = useDecideLeave();
  const [notes, setNotes] = useState("");
  useEffect(() => { setNotes(""); }, [request?.id]);

  const run = async (approve: boolean) => {
    if (!request) return;
    try {
      await decide.mutateAsync({ id: request.id, approve, notes: notes.trim() });
      onClose();
    } catch {
      // the mutation already showed the error toast; keep the dialog open
    }
  };

  return (
    <Dialog open={!!request} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Leave request: {name}</DialogTitle>
          <DialogDescription>{request?.leave_types?.name} - {fmtDate(request?.start_date)} to {fmtDate(request?.end_date)} ({request?.days} working days)</DialogDescription>
        </DialogHeader>
        {request?.reason && <p className="text-sm rounded-md bg-muted p-3">{request.reason}</p>}
        <div className="space-y-1">
          <Label htmlFor="leave-notes">Notes (required when declining)</Label>
          <Textarea id="leave-notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onClose}>Close</Button>
          <Button variant="destructive" disabled={decide.isPending || !notes.trim()} onClick={() => run(false)}>Decline</Button>
          <Button disabled={decide.isPending} onClick={() => run(true)}>Approve</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
