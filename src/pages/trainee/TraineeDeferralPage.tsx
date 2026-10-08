import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DashboardLayout } from "@/components/DashboardLayout";
import { traineeNavItems } from "@/lib/navigationConfig";
import { withRoleAccess } from "@/components/withRoleAccess";
import { useMyDeferralRequests, useMyTraineeRecord, useSubmitDeferral, useWithdrawDeferral } from "@/hooks/useDeferrals";

const today = () => new Date().toISOString().slice(0, 10);
const label = (c: string) => c.charAt(0).toUpperCase() + c.slice(1);
const fmt = (d: string | null) => (d ? new Date(`${d.slice(0, 10)}T00:00:00`).toLocaleDateString() : "-");
const variant = (s: string): "default" | "secondary" | "destructive" | "outline" =>
  s === "approved" ? "default" : s === "rejected" ? "destructive" : s === "submitted" ? "secondary" : "outline";

const TraineeDeferralPage = () => {
  const { data: me, isLoading: loadingMe } = useMyTraineeRecord();
  const { data: requests, isLoading } = useMyDeferralRequests(me?.id);
  const submit = useSubmitDeferral();
  const withdraw = useWithdrawDeferral();
  const [f, setF] = useState({ reason: "", defer_from: today(), expected_return: "" });

  const open = (requests ?? []).some((r) => r.status === "submitted" || r.status === "approved");
  const valid = f.reason.trim() && f.defer_from && (!f.expected_return || f.expected_return >= f.defer_from);

  const send = async () => {
    if (!me) return;
    try {
      await submit.mutateAsync({
        trainee_id: me.id, organization_id: me.organization_id, reason: f.reason.trim(),
        defer_from: f.defer_from, expected_return: f.expected_return || null,
      });
      setF({ reason: "", defer_from: today(), expected_return: "" });
    } catch {
      // the mutation already showed the error toast; keep the form filled in
    }
  };

  return (
    <DashboardLayout title="Deferral of Training" subtitle="Ask to pause your training and follow the decision" navItems={traineeNavItems} groupLabel="Trainee iEnabler">
      <div className="space-y-6">
        <Card className="border-0 shadow-md">
          <CardHeader><CardTitle>Request a deferral</CardTitle><CardDescription>{open ? "You already have an open request. Wait for the decision or withdraw it." : "Tell us why you need to pause and when you expect to return."}</CardDescription></CardHeader>
          <CardContent className="space-y-3">
            {!loadingMe && !me && <p className="text-sm text-destructive">No trainee record is linked to your account.</p>}
            <div className="space-y-1"><Label>Reason</Label><Textarea rows={4} disabled={open} value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>Defer from</Label><Input type="date" disabled={open} value={f.defer_from} onChange={(e) => setF({ ...f, defer_from: e.target.value })} /></div>
              <div className="space-y-1"><Label>Expected return (optional)</Label><Input type="date" min={f.defer_from} disabled={open} value={f.expected_return} onChange={(e) => setF({ ...f, expected_return: e.target.value })} /></div>
            </div>
            <Button disabled={!me || open || !valid || submit.isPending} onClick={send}>Submit request</Button>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md">
          <CardHeader><CardTitle>My requests</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {(requests ?? []).map((r) => (
              <div key={r.id} className="border rounded-md p-3 text-sm space-y-1">
                <div className="flex justify-between items-center gap-2">
                  <span className="font-medium">From {fmt(r.defer_from)}, back {fmt(r.expected_return)}</span>
                  <Badge variant={variant(r.status)}>{label(r.status)}</Badge>
                </div>
                <p className="whitespace-pre-wrap">{r.reason}</p>
                {r.decision_notes && <p className="text-muted-foreground">Decision: {r.decision_notes}</p>}
                {r.status === "submitted" && (
                  <Button variant="outline" size="sm" disabled={withdraw.isPending} onClick={() => withdraw.mutate(r.id)}>Withdraw</Button>
                )}
              </div>
            ))}
            {!isLoading && !(requests ?? []).length && <p className="text-sm text-muted-foreground text-center py-6">You have not made any deferral requests.</p>}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default withRoleAccess(TraineeDeferralPage, { requiredRoles: ["trainee"] });
