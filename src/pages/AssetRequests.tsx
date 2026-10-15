import { useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useRoleNavigation } from "@/hooks/useRoleNavigation";
import { AssetRequest, money, useAssetOptions, useAssetRequests, useCompleteAssetRequest, useRequestAssetApproval } from "@/hooks/useFinance";
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

const KIND_LABEL: Record<AssetRequest["kind"], string> = {
  acquisition: "Asset acquisition", transfer: "Asset transfer", disposal: "Asset disposal", maintenance_expenditure: "Maintenance expenditure", repair_quotation: "Repair quotation",
};
const STATUS_LABEL: Record<AssetRequest["status"], string> = { requested: "With approver", approved: "Approved", rejected: "Rejected", completed: "Completed" };

function RequestDialog({ onCreated }: { onCreated: (id: string, title: string) => void }) {
  const { data: assets } = useAssetOptions();
  const request = useRequestAssetApproval();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ kind: "acquisition", asset: "", title: "", description: "", cost: "" });
  const needsAsset = f.kind !== "acquisition";
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button onClick={() => setOpen(true)}>New request</Button>
      <DialogContent>
        <DialogHeader><DialogTitle>Request approval</DialogTitle></DialogHeader>
        <form className="space-y-3" onSubmit={async (e) => {
          e.preventDefault();
          const id = await request.mutateAsync({ kind: f.kind, asset: needsAsset || f.asset ? f.asset || null : null, title: f.title, description: f.description, cost: Number(f.cost || 0) });
          setOpen(false); onCreated(id as string, `${KIND_LABEL[f.kind as AssetRequest["kind"]]}: ${f.title}`);
          setF({ kind: "acquisition", asset: "", title: "", description: "", cost: "" });
        }}>
          <div className="space-y-1"><Label>Type</Label>
            <Select value={f.kind} onValueChange={(v) => setF({ ...f, kind: v })}><SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{Object.entries(KIND_LABEL).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-1"><Label>Asset{needsAsset ? "" : " (optional)"}</Label>
            <Select value={f.asset} onValueChange={(v) => setF({ ...f, asset: v })}><SelectTrigger><SelectValue placeholder="Choose asset" /></SelectTrigger>
              <SelectContent>{assets?.map((a) => <SelectItem key={a.id} value={a.id}>{a.asset_code} · {a.asset_name}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-1"><Label>Title</Label><Input required value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></div>
          <div className="space-y-1"><Label>Estimated cost (N$)</Label><Input type="number" min="0" step="0.01" value={f.cost} onChange={(e) => setF({ ...f, cost: e.target.value })} /></div>
          <div className="space-y-1"><Label>Details</Label><Textarea value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></div>
          <p className="text-xs text-muted-foreground">Quotations and other supporting documents are attached next. Above the approval limit it also goes to the Centre Manager.</p>
          <Button type="submit" className="w-full" disabled={request.isPending || !f.title.trim() || (needsAsset && !f.asset)}>Continue: attach documents</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function AssetRequests() {
  const { navItems, groupLabel, role } = useRoleNavigation();
  const { data: requests } = useAssetRequests();
  const { data: instances } = useWorkflowInstances(false);
  const complete = useCompleteAssetRequest();
  const [attach, setAttach] = useState<{ id: string; title: string } | null>(null);
  const [detail, setDetail] = useState<string | null>(null);
  const canAct = role === "asset_maintenance_coordinator" || role === "maintenance_coordinator";
  const instance = instances?.find((i) => i.id === detail) ?? null;
  const spend = (requests ?? []).filter((r) => r.kind === "maintenance_expenditure" && r.status === "completed").reduce((a, r) => a + Number(r.estimated_cost), 0);
  return (
    <DashboardLayout title="Asset requests" subtitle="Purchases, transfers, disposals and maintenance spending" navItems={navItems} groupLabel={groupLabel}>
      <div className="grid gap-4 md:grid-cols-3">
        <Card><CardHeader className="pb-2"><CardDescription>With the approver</CardDescription><CardTitle>{requests?.filter((r) => r.status === "requested").length ?? 0}</CardTitle></CardHeader></Card>
        <Card><CardHeader className="pb-2"><CardDescription>Approved, not yet carried out</CardDescription><CardTitle>{requests?.filter((r) => r.status === "approved").length ?? 0}</CardTitle></CardHeader></Card>
        <Card><CardHeader className="pb-2"><CardDescription>Maintenance spend (completed)</CardDescription><CardTitle>{money(spend)}</CardTitle></CardHeader></Card>
      </div>
      <Card>
        <CardHeader className="flex-row items-start justify-between space-y-0">
          <div><CardTitle>Requests</CardTitle><CardDescription>Submitted to the Head of Finance and Administration. Mark a request completed once it has been carried out.</CardDescription></div>
          {canAct && <RequestDialog onCreated={(id, title) => setAttach({ id, title })} />}
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Request</TableHead><TableHead>Type</TableHead><TableHead className="text-right">Estimated cost</TableHead><TableHead>Status</TableHead><TableHead /></TableRow></TableHeader>
            <TableBody>
              {requests?.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.title}</TableCell><TableCell>{KIND_LABEL[r.kind]}</TableCell>
                  <TableCell className="text-right">{money(r.estimated_cost)}</TableCell>
                  <TableCell><Badge variant={r.status === "completed" ? "default" : r.status === "rejected" ? "destructive" : "secondary"}>{STATUS_LABEL[r.status]}</Badge></TableCell>
                  <TableCell className="text-right space-x-1">
                    {canAct && r.status === "approved" && <Button size="sm" disabled={complete.isPending} onClick={() => { const notes = window.prompt("Notes on how it was carried out (optional)") ?? ""; complete.mutate({ id: r.id, notes }); }}>Mark completed</Button>}
                    {r.workflow_instance_id && <Button size="sm" variant="outline" onClick={() => setDetail(r.workflow_instance_id)}>Approval</Button>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {!requests?.length && <p className="text-sm text-muted-foreground text-center py-6">No requests yet.</p>}
        </CardContent>
      </Card>
      {attach && <SubmitRequestDialog instanceId={attach.id} title={attach.title} onClose={() => setAttach(null)} />}
      {instance && <InstanceDialog instance={instance} canCancel onClose={() => setDetail(null)} />}
    </DashboardLayout>
  );
}

export default withRoleAccess(AssetRequests, { requiredRoles: ["asset_maintenance_coordinator", "maintenance_coordinator", "accountant", "head_of_finance_admin", "centre_manager", "organization_admin", "admin"] });
