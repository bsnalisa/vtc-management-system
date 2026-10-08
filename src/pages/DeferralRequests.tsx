import { useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DashboardLayout } from "@/components/DashboardLayout";
import { withRoleAccess } from "@/components/withRoleAccess";
import { useRoleNavigation } from "@/hooks/useRoleNavigation";
import { DeferralRequest, useDecideDeferral, useDeferralRequests, useReinstateTrainee } from "@/hooks/useDeferrals";

const STATUSES = ["submitted", "approved", "rejected", "cancelled", "reinstated"];
const label = (c: string) => c.charAt(0).toUpperCase() + c.slice(1);
const fmt = (d: string | null) => (d ? new Date(`${d.slice(0, 10)}T00:00:00`).toLocaleDateString() : "-");
const variant = (s: string): "default" | "secondary" | "destructive" | "outline" =>
  s === "approved" ? "default" : s === "rejected" ? "destructive" : s === "submitted" ? "secondary" : "outline";

const DeferralRequests = () => {
  const { navItems, groupLabel } = useRoleNavigation();
  const { data, isLoading } = useDeferralRequests();
  const decide = useDecideDeferral();
  const reinstate = useReinstateTrainee();
  const [status, setStatus] = useState("submitted");
  const [selected, setSelected] = useState<DeferralRequest | null>(null);
  const [notes, setNotes] = useState("");
  const [toEnd, setToEnd] = useState<DeferralRequest | null>(null);

  const rows = useMemo(() => (data ?? []).filter((r) => status === "all" || r.status === status), [data, status]);
  const close = () => { setSelected(null); setNotes(""); };

  const submitDecision = async (approve: boolean) => {
    if (!selected) return;
    try {
      await decide.mutateAsync({ id: selected.id, approve, notes: notes.trim() });
      close();
    } catch {
      // the mutation already showed the error toast; keep the dialog open
    }
  };

  return (
    <DashboardLayout title="Deferral Requests" subtitle="Trainees asking to pause their training" navItems={navItems} groupLabel={groupLabel}>
      <Card className="border-0 shadow-md">
        <CardHeader className="flex-row items-start justify-between space-y-0 gap-2 flex-wrap">
          <div><CardTitle>Requests</CardTitle><CardDescription>{rows.length} shown</CardDescription></div>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="all">All statuses</SelectItem>{STATUSES.map((s) => <SelectItem key={s} value={s}>{label(s)}</SelectItem>)}</SelectContent>
          </Select>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow><TableHead>Trainee</TableHead><TableHead>Defer from</TableHead><TableHead>Expected return</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead></TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>{r.trainees ? `${r.trainees.first_name} ${r.trainees.last_name}` : "-"}<div className="text-xs text-muted-foreground">{r.trainees?.trainee_id}</div></TableCell>
                  <TableCell>{fmt(r.defer_from)}</TableCell>
                  <TableCell>{fmt(r.expected_return)}</TableCell>
                  <TableCell><Badge variant={variant(r.status)}>{label(r.status)}</Badge></TableCell>
                  <TableCell className="text-right space-x-2">
                    <Button variant="outline" size="sm" onClick={() => { setSelected(r); setNotes(""); }}>{r.status === "submitted" ? "Review" : "View"}</Button>
                    {r.status === "approved" && <Button size="sm" onClick={() => setToEnd(r)}>End deferral</Button>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {!isLoading && !rows.length && <p className="text-sm text-muted-foreground text-center py-8">No deferral requests found.</p>}
        </CardContent>
      </Card>

      <Dialog open={!!selected} onOpenChange={(o) => !o && close()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Deferral request</DialogTitle>
            <DialogDescription>{selected?.trainees ? `${selected.trainees.first_name} ${selected.trainees.last_name} (${selected.trainees.trainee_id})` : ""}</DialogDescription>
          </DialogHeader>
          {selected && (
            <div className="space-y-3 text-sm">
              <div><span className="font-medium">Reason</span><p className="whitespace-pre-wrap">{selected.reason}</p></div>
              <div className="text-muted-foreground">From {fmt(selected.defer_from)}, expected back {fmt(selected.expected_return)}</div>
              {selected.status === "submitted" ? (
                <div className="space-y-1">
                  <Label>Decision notes (required to decline)</Label>
                  <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
                </div>
              ) : (
                selected.decision_notes && <div><span className="font-medium">Decision notes</span><p className="whitespace-pre-wrap">{selected.decision_notes}</p></div>
              )}
            </div>
          )}
          {selected?.status === "submitted" && (
            <DialogFooter>
              <Button variant="destructive" disabled={!notes.trim() || decide.isPending} onClick={() => submitDecision(false)}>Decline</Button>
              <Button disabled={decide.isPending} onClick={() => submitDecision(true)}>Approve</Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!toEnd} onOpenChange={(o) => !o && setToEnd(null)}
        title="End deferral" description="The trainee will be set back to active and notified. Continue?" confirmText="End deferral"
        isLoading={reinstate.isPending}
        onConfirm={async () => {
          if (!toEnd) return;
          try { await reinstate.mutateAsync(toEnd.id); setToEnd(null); } catch { /* error toast shown by the mutation */ }
        }}
      />
    </DashboardLayout>
  );
};

export default withRoleAccess(DeferralRequests, {
  requiredRoles: ["admin", "organization_admin", "registration_officer", "head_of_training", "head_of_trainee_support"],
});
