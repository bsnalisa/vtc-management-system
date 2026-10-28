import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { type ChangeRequest, useReportingActions } from "@/hooks/useReportingStructure";

const day = (d: string | null) => (d ? new Date(d).toLocaleDateString() : "-");

// Requests to change the reporting line of the Accountant, Head of Finance and Administration or Centre Manager
export function ChangeRequestsList({ rows, canDecide, showCentre, canWithdraw = true }: { rows: ChangeRequest[]; canDecide: boolean; showCentre?: boolean; canWithdraw?: boolean }) {
  const act = useReportingActions();
  const [notes, setNotes] = useState<Record<string, string>>({});
  if (!rows.length) return <p className="text-sm text-muted-foreground">No requests.</p>;
  return (
    <div className="space-y-3">
      {rows.map((r) => (
        <div key={r.id} className="space-y-2 rounded border p-3 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-medium">{showCentre ? `${r.centre}: ` : ""}{r.kind === "line" ? `Role line for ${r.subject}` : `Supervisor of ${r.subject}`}</span>
            <Badge variant={r.status === "pending" ? "secondary" : r.status === "confirmed" ? "default" : "outline"}>{r.status === "pending" ? "Waiting for the Super Admin" : r.status}</Badge>
          </div>
          <div>{r.current ?? "none"} → <strong>{r.proposed ?? "no supervisor"}</strong>{r.effective_from ? ` from ${day(r.effective_from)}` : ""}{r.effective_to ? ` until ${day(r.effective_to)}` : ""}</div>
          <div className="text-muted-foreground">Requested by {r.requested_by ?? "-"} on {day(r.requested_at)}{r.note ? `: ${r.note}` : ""}</div>
          {r.decided_at && <div className="text-muted-foreground">Decided by {r.decided_by ?? "-"} on {day(r.decided_at)}{r.decision_note ? `: ${r.decision_note}` : ""}</div>}
          {r.status === "pending" && canDecide && (
            <div className="space-y-2">
              <Textarea rows={2} placeholder="Note (required to reject)" value={notes[r.id] ?? ""} onChange={(e) => setNotes((n) => ({ ...n, [r.id]: e.target.value }))} />
              <div className="flex gap-2">
                <Button size="sm" disabled={act.decide.isPending} onClick={() => act.decide.mutate({ id: r.id, approve: true, note: notes[r.id] })}>Confirm</Button>
                <Button size="sm" variant="destructive" disabled={act.decide.isPending || (notes[r.id] ?? "").trim().length < 5} onClick={() => act.decide.mutate({ id: r.id, approve: false, note: notes[r.id] })}>Reject</Button>
              </div>
            </div>
          )}
          {r.status === "pending" && !canDecide && canWithdraw && (
            <Button size="sm" variant="outline" disabled={act.withdraw.isPending} onClick={() => act.withdraw.mutate(r.id)}>Withdraw</Button>
          )}
        </div>
      ))}
    </div>
  );
}
