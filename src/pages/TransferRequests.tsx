import { useState } from "react";
import { ArrowRightLeft } from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useRoleNavigation } from "@/hooks/useRoleNavigation";
import { Transfer, useDecideTransfer, useRetryTransfer, useTransferHistory, useTransferQueue } from "@/hooks/useTransfers";
import { TransferDecisions, TransferStatusBadge } from "@/components/transfers/TransferStatus";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { ButtonSpinner } from "@/components/ui/loading-spinner";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { withRoleAccess } from "@/components/withRoleAccess";

const fmt = (d: string | null) => (d ? new Date(d).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—");

function DecisionDialog({ t, onClose }: { t: Transfer; onClose: () => void }) {
  const decide = useDecideTransfer();
  const [comment, setComment] = useState("");
  const [choice, setChoice] = useState<"approved" | "rejected" | null>(null);
  const step = t.status === "PENDING_TRAINING" ? "Head of Training" : "Head of Trainee Support";
  const go = async (d: "approved" | "rejected") => { setChoice(d); try { await decide.mutateAsync({ id: t.id, decision: d, comment }); onClose(); } finally { setChoice(null); } };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader><DialogTitle>{t.reference}: decision as {step}</DialogTitle><DialogDescription>{t.trainee_name} · {t.trainee_number}</DialogDescription></DialogHeader>
        <dl className="grid gap-2 text-sm sm:grid-cols-2">
          <div><dt className="text-muted-foreground">From</dt><dd className="font-medium">{t.source_name}</dd></div>
          <div><dt className="text-muted-foreground">To</dt><dd className="font-medium">{t.destination_name}</dd></div>
          <div><dt className="text-muted-foreground">Programme</dt><dd>{t.programme ?? "—"}{t.level ? ` · Level ${t.level}` : ""}</dd></div>
          <div><dt className="text-muted-foreground">Requested</dt><dd>{fmt(t.created_at)}</dd></div>
          <div className="sm:col-span-2"><dt className="text-muted-foreground">Trainee’s reason</dt><dd>{t.reason}</dd></div>
        </dl>
        <TransferDecisions t={t} />
        <div className="space-y-1.5"><Label htmlFor="c">Comments {` (required to reject)`}</Label><Textarea id="c" rows={3} value={comment} onChange={(e) => setComment(e.target.value)} /></div>
        <p className="text-xs text-muted-foreground">{t.status === "PENDING_TRAINING" ? "After you approve, the Head of Trainee Support decides next. Nothing moves until both have approved." : "Your approval completes the transfer. The registration is then moved to the destination VTC."}</p>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onClose}>Close</Button>
          <Button variant="destructive" disabled={decide.isPending || comment.trim().length < 5} onClick={() => go("rejected")}>{decide.isPending && choice === "rejected" && <ButtonSpinner />}Reject</Button>
          <Button disabled={decide.isPending} onClick={() => go("approved")}>{decide.isPending && choice === "approved" && <ButtonSpinner />}Approve</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function HistoryDialog({ t, onClose }: { t: Transfer; onClose: () => void }) {
  const { data, isLoading } = useTransferHistory(t.id);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader><DialogTitle>{t.reference}: history</DialogTitle><DialogDescription>{t.trainee_name} · {t.source_name} → {t.destination_name}</DialogDescription></DialogHeader>
        <TransferDecisions t={t} />
        {isLoading ? <Skeleton className="h-24" /> : (
          <ol className="space-y-2 border-t pt-3 text-sm">{data?.map((e, i) => <li key={i}><span className="font-medium">{e.event.replace(/_/g, " ")}</span> <span className="text-muted-foreground">· {fmt(e.at)}{e.by ? ` · ${e.by}` : ""}{e.outcome !== "success" ? ` · ${e.outcome}` : ""}</span>{e.reason && <span className="block text-muted-foreground">{e.reason}</span>}</li>)}</ol>
        )}
      </DialogContent>
    </Dialog>
  );
}

function TransfersTable({ rows, onDecide, onHistory }: { rows: Transfer[]; onDecide: (t: Transfer) => void; onHistory: (t: Transfer) => void }) {
  const retry = useRetryTransfer();
  if (!rows.length) return <EmptyState icon={ArrowRightLeft} title="Nothing here" description="Transfer requests appear here as trainees submit them." />;
  return (
    <Table>
      <TableHeader><TableRow><TableHead>Request</TableHead><TableHead>Trainee</TableHead><TableHead>Move</TableHead><TableHead>Status</TableHead><TableHead>Requested</TableHead><TableHead><span className="sr-only">Actions</span></TableHead></TableRow></TableHeader>
      <TableBody>
        {rows.map((t) => (
          <TableRow key={t.id}>
            <TableCell className="font-medium">{t.reference}</TableCell>
            <TableCell>{t.trainee_name}<span className="block text-xs text-muted-foreground">{t.trainee_number}</span></TableCell>
            <TableCell>{t.source_name} → {t.destination_name}</TableCell>
            <TableCell><TransferStatusBadge status={t.status} /></TableCell>
            <TableCell className="whitespace-nowrap">{fmt(t.created_at)}</TableCell>
            <TableCell className="space-x-1 whitespace-nowrap">
              {t.can_decide && <Button size="sm" onClick={() => onDecide(t)}>Review</Button>}
              {t.can_retry && <Button size="sm" variant="outline" disabled={retry.isPending} onClick={() => retry.mutate(t.id)}>Retry move</Button>}
              <Button size="sm" variant="ghost" onClick={() => onHistory(t)}>History</Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function TransferRequests() {
  const { navItems, groupLabel } = useRoleNavigation();
  const { data, isLoading, error } = useTransferQueue();
  const [deciding, setDeciding] = useState<Transfer | null>(null);
  const [viewing, setViewing] = useState<Transfer | null>(null);
  const rows = data ?? [];
  const waiting = rows.filter((t) => t.can_decide);
  const open = rows.filter((t) => ["PENDING_TRAINING", "PENDING_SUPPORT", "APPROVED", "FAILED"].includes(t.status));
  const closed = rows.filter((t) => ["COMPLETED", "REJECTED", "CANCELLED"].includes(t.status));
  return (
    <DashboardLayout title="Transfer Requests" subtitle="Trainees asking to move to another VTC" navItems={navItems} groupLabel={groupLabel}>
      {error ? <Alert variant="destructive"><AlertDescription>{(error as Error).message}</AlertDescription></Alert> : isLoading ? <Skeleton className="h-64" aria-busy="true" /> : (
        <Card>
          <CardHeader><CardTitle className="text-base">Transfer requests</CardTitle><CardDescription>Each request needs approval from the Head of Training and then, independently, the Head of Trainee Support. Approved is not the same as completed: the move happens only after both.</CardDescription></CardHeader>
          <CardContent>
            <Tabs defaultValue={waiting.length ? "waiting" : "open"}>
              <TabsList><TabsTrigger value="waiting">Needs my decision ({waiting.length})</TabsTrigger><TabsTrigger value="open">In progress ({open.length})</TabsTrigger><TabsTrigger value="closed">Finished ({closed.length})</TabsTrigger></TabsList>
              <TabsContent value="waiting"><TransfersTable rows={waiting} onDecide={setDeciding} onHistory={setViewing} /></TabsContent>
              <TabsContent value="open"><TransfersTable rows={open} onDecide={setDeciding} onHistory={setViewing} /></TabsContent>
              <TabsContent value="closed"><TransfersTable rows={closed} onDecide={setDeciding} onHistory={setViewing} /></TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}
      {deciding && <DecisionDialog t={deciding} onClose={() => setDeciding(null)} />}
      {viewing && <HistoryDialog t={viewing} onClose={() => setViewing(null)} />}
    </DashboardLayout>
  );
}

export default withRoleAccess(TransferRequests, { requiredRoles: ["head_of_training", "hod", "head_of_trainee_support", "registration_officer", "centre_manager", "organization_admin", "admin"] });
