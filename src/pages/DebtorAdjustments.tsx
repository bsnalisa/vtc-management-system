import { useMemo, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useRoleNavigation } from "@/hooks/useRoleNavigation";
import {
  DebtorAdjustment, money, useApplyDebtorAdjustment, useDebtorAdjustments, useOutstandingFeeRecords, useRequestDebtorAdjustment,
} from "@/hooks/useFinance";
import { useWorkflowInstances } from "@/hooks/useWorkflows";
import { SubmitRequestDialog } from "@/components/workflow/WorkflowAttachments";
import { InstanceDialog } from "@/components/workflow/InstanceDialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { withRoleAccess } from "@/components/withRoleAccess";

const TYPE_LABEL: Record<DebtorAdjustment["adjustment_type"], string> = {
  write_off: "Write-off", credit_note: "Credit note", refund: "Refund", charge_correction: "Charge correction",
};
const STATUS_LABEL: Record<DebtorAdjustment["status"], string> = { requested: "With approver", approved: "Approved", rejected: "Rejected", applied: "Applied" };

function RequestDialog({ onCreated }: { onCreated: (id: string, title: string) => void }) {
  const { data: records } = useOutstandingFeeRecords();
  const request = useRequestDebtorAdjustment();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [f, setF] = useState({ feeRecord: "", type: "write_off", amount: "", reason: "" });
  const matches = useMemo(() => (records ?? []).filter((r) => `${r.trainee?.first_name ?? ""} ${r.trainee?.last_name ?? ""} ${r.trainee?.trainee_id ?? ""}`.toLowerCase().includes(search.toLowerCase())).slice(0, 50), [records, search]);
  const chosen = records?.find((r) => r.id === f.feeRecord);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button onClick={() => setOpen(true)}>Request an adjustment</Button>
      <DialogContent>
        <DialogHeader><DialogTitle>Request an adjustment</DialogTitle></DialogHeader>
        <form className="space-y-3" onSubmit={async (e) => {
          e.preventDefault();
          const id = await request.mutateAsync({ feeRecord: f.feeRecord, type: f.type, amount: Number(f.amount), reason: f.reason });
          setOpen(false);
          onCreated(id as string, `${TYPE_LABEL[f.type as DebtorAdjustment["adjustment_type"]]} for ${chosen?.trainee?.first_name ?? "trainee"} ${chosen?.trainee?.last_name ?? ""}`);
          setF({ feeRecord: "", type: "write_off", amount: "", reason: "" });
        }}>
          <div className="space-y-1"><Label>Trainee</Label><Input placeholder="Search by name or trainee number" value={search} onChange={(e) => setSearch(e.target.value)} />
            <Select value={f.feeRecord} onValueChange={(v) => setF({ ...f, feeRecord: v })}><SelectTrigger><SelectValue placeholder="Choose the fee account" /></SelectTrigger>
              <SelectContent>{matches.map((r) => <SelectItem key={r.id} value={r.id}>{r.trainee ? `${r.trainee.first_name} ${r.trainee.last_name} (${r.trainee.trainee_id})` : "Trainee"} · balance {money(r.balance)}</SelectItem>)}</SelectContent></Select></div>
          {chosen && <p className="text-xs text-muted-foreground">Billed {money(chosen.total_fee)}, paid {money(chosen.amount_paid)}, balance {money(chosen.balance)}.</p>}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><Label>Type</Label>
              <Select value={f.type} onValueChange={(v) => setF({ ...f, type: v })}><SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(TYPE_LABEL).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-1"><Label>Amount (N$)</Label><Input type="number" min="0.01" step="0.01" required value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} /></div>
          </div>
          <div className="space-y-1"><Label>Reason</Label><Textarea required value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} /></div>
          <p className="text-xs text-muted-foreground">Nothing changes on the account until the Head of Finance and Administration approves it and you apply it.</p>
          <Button type="submit" className="w-full" disabled={request.isPending || !f.feeRecord || !f.reason.trim()}>Continue: attach documents</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DebtorAdjustments() {
  const { navItems, groupLabel, role } = useRoleNavigation();
  const { data: adjustments } = useDebtorAdjustments();
  const { data: records } = useOutstandingFeeRecords();
  const { data: instances } = useWorkflowInstances(false);
  const apply = useApplyDebtorAdjustment();
  const [attach, setAttach] = useState<{ id: string; title: string } | null>(null);
  const [detail, setDetail] = useState<string | null>(null);
  const canAct = role === "debtor_officer";
  const instance = instances?.find((i) => i.id === detail) ?? null;
  const owing = (records ?? []).filter((r) => Number(r.balance) > 0);
  return (
    <DashboardLayout title="Debtor adjustments" subtitle="Write-offs, credits, refunds and corrections need approval" navItems={navItems} groupLabel={groupLabel}>
      <div className="grid gap-4 md:grid-cols-3">
        <Card><CardHeader className="pb-2"><CardDescription>Accounts with a balance</CardDescription><CardTitle>{owing.length}</CardTitle></CardHeader></Card>
        <Card><CardHeader className="pb-2"><CardDescription>Total outstanding</CardDescription><CardTitle>{money(owing.reduce((a, r) => a + Number(r.balance), 0))}</CardTitle></CardHeader></Card>
        <Card><CardHeader className="pb-2"><CardDescription>Adjustments in progress</CardDescription><CardTitle>{adjustments?.filter((a) => a.status === "requested" || a.status === "approved").length ?? 0}</CardTitle></CardHeader></Card>
      </div>
      <Card>
        <CardHeader className="flex-row items-start justify-between space-y-0">
          <div><CardTitle>Adjustment requests</CardTitle><CardDescription>Finalised fee records are never edited directly. Every correction is requested, approved, then applied here, and kept for audit.</CardDescription></div>
          {canAct && <RequestDialog onCreated={(id, title) => setAttach({ id, title })} />}
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Trainee</TableHead><TableHead>Type</TableHead><TableHead className="text-right">Amount</TableHead><TableHead>Reason</TableHead><TableHead>Status</TableHead><TableHead /></TableRow></TableHeader>
            <TableBody>
              {adjustments?.map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="font-medium">{a.trainees ? `${a.trainees.first_name} ${a.trainees.last_name}` : "Trainee"}<div className="text-xs text-muted-foreground">{a.trainees?.trainee_id}</div></TableCell>
                  <TableCell>{TYPE_LABEL[a.adjustment_type]}</TableCell>
                  <TableCell className="text-right">{money(a.amount)}</TableCell>
                  <TableCell className="max-w-[18rem] text-sm">{a.reason}</TableCell>
                  <TableCell><Badge variant={a.status === "applied" ? "default" : a.status === "rejected" ? "destructive" : "secondary"}>{STATUS_LABEL[a.status]}</Badge></TableCell>
                  <TableCell className="text-right space-x-1">
                    {canAct && a.status === "approved" && <Button size="sm" disabled={apply.isPending} onClick={() => apply.mutate(a.id)}>Apply</Button>}
                    {a.workflow_instance_id && <Button size="sm" variant="outline" onClick={() => setDetail(a.workflow_instance_id)}>Approval</Button>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {!adjustments?.length && <p className="text-sm text-muted-foreground text-center py-6">No adjustments have been requested.</p>}
        </CardContent>
      </Card>
      {attach && <SubmitRequestDialog instanceId={attach.id} title={attach.title} onClose={() => setAttach(null)} />}
      {instance && <InstanceDialog instance={instance} canCancel onClose={() => setDetail(null)} />}
    </DashboardLayout>
  );
}

export default withRoleAccess(DebtorAdjustments, { requiredRoles: ["debtor_officer", "accountant", "head_of_finance_admin", "centre_manager", "organization_admin", "admin"] });
