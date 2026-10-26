import { useState } from "react";
import { ArrowRightLeft } from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { traineeNavItems } from "@/lib/navigationConfig";
import { useCancelTransfer, useMyTransferOverview, useSubmitTransfer, useTransferDestinations } from "@/hooks/useTransfers";
import { TransferDecisions, TransferStatusBadge } from "@/components/transfers/TransferStatus";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { ButtonSpinner } from "@/components/ui/loading-spinner";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const fmt = (d: string) => new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });

export default function TraineeTransferPage() {
  const { data, isLoading, error } = useMyTransferOverview();
  const { data: destinations } = useTransferDestinations();
  const submit = useSubmitTransfer();
  const cancel = useCancelTransfer();
  const [destination, setDestination] = useState("");
  const [reason, setReason] = useState("");
  const [confirming, setConfirming] = useState<string | null>(null);
  const tooShort = reason.trim().length < 10;

  return (
    <DashboardLayout title="Transfer to another VTC" subtitle="Ask to move your registration to a different centre" navItems={traineeNavItems} groupLabel="Trainee iEnabler">
      <div className="space-y-6">
        {error ? <Alert variant="destructive"><AlertDescription>{(error as Error).message}</AlertDescription></Alert> : isLoading || !data ? <Skeleton className="h-64" aria-busy="true" /> : !data.registered ? (
          <Alert><AlertDescription>You need to be a registered trainee before you can request a transfer.</AlertDescription></Alert>
        ) : (<>
          <Card>
            <CardHeader><CardTitle className="text-base">Your registration</CardTitle><CardDescription>Your trainee number stays the same at every VTC.</CardDescription></CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-1.5"><Label htmlFor="tn">Trainee number</Label><Input id="tn" readOnly value={data.trainee_number ?? ""} className="font-mono" /></div>
              <div className="space-y-1.5"><Label htmlFor="cv">Current VTC</Label><Input id="cv" readOnly value={data.current?.organization_name ?? ""} /></div>
              <div className="space-y-1.5"><Label htmlFor="cp">Programme</Label><Input id="cp" readOnly value={`${data.current?.programme ?? "—"}${data.current?.level ? ` · Level ${data.current.level}` : ""}`} /></div>
            </CardContent>
          </Card>

          {data.can_request ? (
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2 text-base"><ArrowRightLeft className="h-4 w-4" />Request a transfer</CardTitle>
                <CardDescription>Your Head of Training and then your Head of Trainee Support must both approve. Only then is your registration moved.</CardDescription></CardHeader>
              <CardContent>
                <form className="space-y-4" onSubmit={async (e) => { e.preventDefault(); if (!destination || tooShort) return; await submit.mutateAsync({ destination, reason }); setReason(""); setDestination(""); }}>
                  <div className="space-y-1.5"><Label>Destination VTC</Label>
                    <Select value={destination} onValueChange={setDestination}><SelectTrigger aria-label="Destination VTC"><SelectValue placeholder="Choose the VTC you want to move to" /></SelectTrigger>
                      <SelectContent>{destinations?.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent></Select></div>
                  <div className="space-y-1.5"><Label htmlFor="reason">Reason for the transfer</Label>
                    <Textarea id="reason" rows={4} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Explain why you want to move (at least 10 characters)" />
                    {reason && tooShort && <p role="alert" className="text-xs text-destructive">Please give a little more detail.</p>}</div>
                  <Button type="submit" disabled={!destination || tooShort || submit.isPending}>{submit.isPending && <ButtonSpinner />}Submit request</Button>
                </form>
              </CardContent>
            </Card>
          ) : (
            <Alert><AlertDescription>{data.current?.status === "active" ? "You already have a transfer request in progress." : "A transfer can only be requested while your registration is active."}</AlertDescription></Alert>
          )}

          <Card>
            <CardHeader><CardTitle className="text-base">Your transfer requests</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {!data.transfers?.length ? <p className="text-sm text-muted-foreground">You have not requested a transfer.</p> : data.transfers.map((t) => (
                <div key={t.id} className="space-y-3 rounded-lg border p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div><p className="font-medium">{t.reference}: {t.source_name} → {t.destination_name}</p><p className="text-xs text-muted-foreground">Requested {fmt(t.created_at)}</p></div>
                    <TransferStatusBadge status={t.status} />
                  </div>
                  <p className="text-sm">{t.reason}</p>
                  <TransferDecisions t={t} />
                  {(t.status === "PENDING_TRAINING" || t.status === "PENDING_SUPPORT") && <Button variant="outline" size="sm" onClick={() => setConfirming(t.id)}>Cancel request</Button>}
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Registration history</CardTitle></CardHeader>
            <CardContent>
              <ul className="divide-y">{data.history?.map((h, i) => <li key={i} className="flex flex-wrap justify-between gap-2 py-2 text-sm"><span>{h.organization_name}{h.programme ? ` · ${h.programme}` : ""}</span><span className="text-muted-foreground capitalize">{h.status} · since {fmt(h.since)}</span></li>)}</ul>
            </CardContent>
          </Card>
        </>)}
      </div>
      <ConfirmDialog open={!!confirming} onOpenChange={(o) => !o && setConfirming(null)} title="Cancel this transfer request?" description="Nothing changes about your registration. You can submit a new request later."
        confirmText="Cancel request" onConfirm={async () => { if (confirming) await cancel.mutateAsync(confirming); setConfirming(null); }} />
    </DashboardLayout>
  );
}
