import { useMemo, useRef, useState } from "react";
import { AlertCircle, Clock, Download, FileText, ReceiptText, Truck, Wallet } from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { useRoleNavigation } from "@/hooks/useRoleNavigation";
import { useProfile } from "@/hooks/useProfile";
import { useOrganizationContext } from "@/hooks/useOrganizationContext";
import { supabase } from "@/integrations/supabase/client";
import {
  SupplierInvoice, money, openAttachment, useRecordSupplierInvoice, useRecordSupplierPayment, useRequestInvoicePayment, useSupplierInvoices,
  useSuppliersList, useVerifySupplierInvoice,
} from "@/hooks/useFinance";
import { useWorkflowInstances } from "@/hooks/useWorkflows";
import { downloadCsv } from "@/components/finance/FinanceCharts";
import { SubmitRequestDialog } from "@/components/workflow/WorkflowAttachments";
import { InstanceDialog } from "@/components/workflow/InstanceDialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { withRoleAccess } from "@/components/withRoleAccess";

const STATUS_LABEL: Record<SupplierInvoice["status"], string> = {
  recorded: "Recorded", verified: "Verified", requested: "Payment requested", approved: "Payment approved", rejected: "Rejected", paid: "Paid",
};
const statusVariant = (s: SupplierInvoice["status"]): "default" | "secondary" | "destructive" | "outline" =>
  s === "paid" ? "default" : s === "rejected" ? "destructive" : s === "recorded" ? "outline" : "secondary";

function RecordInvoiceDialog() {
  const { organizationId } = useOrganizationContext();
  const { data: suppliers } = useSuppliersList();
  const record = useRecordSupplierInvoice();
  const [open, setOpen] = useState(false);
  const file = useRef<File | null>(null);
  const today = new Date().toISOString().slice(0, 10);
  const [f, setF] = useState({ supplier: "", number: "", invoiceDate: today, dueDate: today, subtotal: "", tax: "0", notes: "" });
  const total = Number(f.subtotal || 0) + Number(f.tax || 0);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button onClick={() => setOpen(true)}>Record invoice</Button>
      <DialogContent>
        <DialogHeader><DialogTitle>Record a supplier invoice</DialogTitle></DialogHeader>
        <form className="space-y-3" onSubmit={async (e) => {
          e.preventDefault();
          let path: string | null = null;
          if (file.current) {
            path = `${organizationId}/supplier-invoices/${Date.now()}-${file.current.name.replace(/[^A-Za-z0-9._-]+/g, "_")}`;
            const up = await supabase.storage.from("documents").upload(path, file.current);
            if (up.error) { toast.error(up.error.message); return; }
          }
          await record.mutateAsync({ supplier: f.supplier, number: f.number, invoiceDate: f.invoiceDate, dueDate: f.dueDate, subtotal: Number(f.subtotal), tax: Number(f.tax || 0), notes: f.notes, document: path });
          setOpen(false); setF({ ...f, number: "", subtotal: "", tax: "0", notes: "" }); file.current = null;
        }}>
          <div className="space-y-1"><Label>Supplier</Label>
            <Select value={f.supplier} onValueChange={(v) => setF({ ...f, supplier: v })}><SelectTrigger><SelectValue placeholder="Choose supplier" /></SelectTrigger>
              <SelectContent>{suppliers?.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-1"><Label>Supplier's invoice number</Label><Input required value={f.number} onChange={(e) => setF({ ...f, number: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><Label>Invoice date</Label><Input type="date" required value={f.invoiceDate} onChange={(e) => setF({ ...f, invoiceDate: e.target.value })} /></div>
            <div className="space-y-1"><Label>Due date</Label><Input type="date" required value={f.dueDate} onChange={(e) => setF({ ...f, dueDate: e.target.value })} /></div>
            <div className="space-y-1"><Label>Amount before tax (N$)</Label><Input type="number" min="0" step="0.01" required value={f.subtotal} onChange={(e) => setF({ ...f, subtotal: e.target.value })} /></div>
            <div className="space-y-1"><Label>Tax (N$)</Label><Input type="number" min="0" step="0.01" value={f.tax} onChange={(e) => setF({ ...f, tax: e.target.value })} /></div>
          </div>
          <p className="text-sm">Total: <span className="font-medium">{money(total)}</span></p>
          <div className="space-y-1"><Label>Invoice document</Label><Input type="file" accept=".pdf,.png,.jpg,.jpeg" onChange={(e) => { file.current = e.target.files?.[0] ?? null; }} /></div>
          <div className="space-y-1"><Label>Notes</Label><Textarea value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></div>
          <Button type="submit" className="w-full" disabled={record.isPending || !f.supplier || !(total > 0)}>Record invoice</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function CreditorsOfficerDashboard() {
  const { navItems, groupLabel, role } = useRoleNavigation();
  const { data: profile } = useProfile();
  const { data: invoices, error } = useSupplierInvoices();
  const { data: suppliers } = useSuppliersList();
  const { data: instances } = useWorkflowInstances(false);
  const verify = useVerifySupplierInvoice();
  const request = useRequestInvoicePayment();
  const pay = useRecordSupplierPayment();
  const [attach, setAttach] = useState<{ id: string; title: string } | null>(null);
  const [detail, setDetail] = useState<string | null>(null);
  const [paying, setPaying] = useState<SupplierInvoice | null>(null);
  const [reference, setReference] = useState("");
  const [filter, setFilter] = useState("open");
  const canAct = role === "creditors_officer" || role === "accountant";
  const name = (id: string) => suppliers?.find((s) => s.id === id)?.name ?? "Supplier";
  const today = new Date().toISOString().slice(0, 10);
  const instance = instances?.find((i) => i.id === detail) ?? null;

  const s = useMemo(() => {
    const open = (invoices ?? []).filter((i) => i.status !== "paid");
    return {
      outstanding: open.reduce((a, i) => a + Number(i.total_amount), 0),
      overdue: open.filter((i) => i.due_date < today),
      due7: open.filter((i) => i.due_date >= today && i.due_date <= new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10)),
      awaiting: open.filter((i) => i.status === "requested").length,
      approved: open.filter((i) => i.status === "approved").length,
    };
  }, [invoices, today]);
  const rows = (invoices ?? []).filter((i) => filter === "all" || (filter === "open" ? i.status !== "paid" : i.status === filter));

  const statement = (supplierId: string) => {
    const lines = (invoices ?? []).filter((i) => i.supplier_id === supplierId).map((i) => ({
      Invoice: i.invoice_number, Date: i.invoice_date, Due: i.due_date, Total: i.total_amount, Status: STATUS_LABEL[i.status], Paid: i.paid_at ?? "", Reference: i.payment_reference ?? "",
    }));
    downloadCsv(`statement-${name(supplierId).replace(/\W+/g, "-")}.csv`, lines);
  };

  return (
    <DashboardLayout title={`Welcome back, ${profile?.firstname || "User"}`} subtitle="Suppliers, invoices and payments" navItems={navItems} groupLabel={groupLabel}>
      <DashboardShell
        name={profile?.firstname || undefined}
        heroIcon={ReceiptText}
        heroSubtitle="Record and verify supplier invoices, request payment approval and record payments."
        stats={[
          { label: "Outstanding payables", value: money(s.outstanding), icon: Wallet, hint: "Unpaid supplier invoices", tone: "primary" },
          { label: "Overdue", value: s.overdue.length, icon: Clock, hint: money(s.overdue.reduce((a, i) => a + Number(i.total_amount), 0)), tone: s.overdue.length ? "destructive" : "secondary" },
          { label: "Due in 7 days", value: s.due7.length, icon: FileText, hint: "Plan these payments" },
          { label: "Awaiting approval", value: s.awaiting, icon: ReceiptText, hint: `${s.approved} approved, not yet paid` },
        ]}
        actions={[
          { icon: Truck, label: "Suppliers", desc: "Supplier records", url: "/suppliers" },
          { icon: FileText, label: "My Approvals", desc: "Requests and decisions", url: "/my-approvals" },
          { icon: Wallet, label: "Reports", desc: "Payables reports", url: "/reports" },
        ]}
        actionCols={3}
      >
        {error && <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertDescription>Could not load invoices: {(error as Error).message}</AlertDescription></Alert>}
        {(s.overdue.length > 0 || s.due7.length > 0) && (
          <Alert><Clock className="h-4 w-4" /><AlertDescription>
            {s.overdue.length > 0 && <>{s.overdue.length} supplier invoice(s) are overdue for payment. </>}
            {s.due7.length > 0 && <>{s.due7.length} fall due within 7 days.</>}
          </AlertDescription></Alert>
        )}
        <Card>
          <CardHeader className="flex-row items-start justify-between space-y-0">
            <div><CardTitle>Supplier invoices</CardTitle><CardDescription>Approval and payment are separate stages: a submitted request is not approved, and an approved one is not paid until you record the payment.</CardDescription></div>
            <div className="flex gap-2">
              <Select value={filter} onValueChange={setFilter}><SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="open">Not yet paid</SelectItem><SelectItem value="all">All</SelectItem>{Object.entries(STATUS_LABEL).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent></Select>
              {canAct && <RecordInvoiceDialog />}
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader><TableRow><TableHead>Supplier</TableHead><TableHead>Invoice</TableHead><TableHead>Due</TableHead><TableHead className="text-right">Total</TableHead><TableHead>Status</TableHead><TableHead /></TableRow></TableHeader>
              <TableBody>
                {rows.map((i) => (
                  <TableRow key={i.id}>
                    <TableCell className="font-medium">{name(i.supplier_id)}</TableCell>
                    <TableCell>{i.invoice_number}</TableCell>
                    <TableCell>{i.due_date}{i.status !== "paid" && i.due_date < today && <Badge variant="destructive" className="ml-2">overdue</Badge>}</TableCell>
                    <TableCell className="text-right">{money(i.total_amount)}</TableCell>
                    <TableCell><Badge variant={statusVariant(i.status)}>{STATUS_LABEL[i.status]}</Badge>{i.payment_reference && <span className="ml-2 text-xs text-muted-foreground">{i.payment_reference}</span>}</TableCell>
                    <TableCell className="text-right space-x-1">
                      {i.document_path && <Button size="sm" variant="ghost" onClick={() => openAttachment(i.document_path as string)}>Document</Button>}
                      {canAct && i.status === "recorded" && <Button size="sm" disabled={verify.isPending} onClick={() => verify.mutate(i.id)}>Verify</Button>}
                      {canAct && i.status === "verified" && <Button size="sm" disabled={request.isPending} onClick={async () => { const id = await request.mutateAsync(i.id); setAttach({ id: id as string, title: `Pay ${name(i.supplier_id)} invoice ${i.invoice_number}` }); }}>Request payment</Button>}
                      {canAct && i.status === "approved" && <Button size="sm" onClick={() => { setPaying(i); setReference(""); }}>Record payment</Button>}
                      {i.workflow_instance_id && <Button size="sm" variant="outline" onClick={() => setDetail(i.workflow_instance_id)}>Approval</Button>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {!rows.length && <p className="text-sm text-muted-foreground text-center py-6">No invoices here.</p>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Supplier statements</CardTitle><CardDescription>Download an account statement for a supplier</CardDescription></CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {suppliers?.map((sp) => <Button key={sp.id} size="sm" variant="outline" onClick={() => statement(sp.id)}><Download className="h-3.5 w-3.5 mr-1" />{sp.name}</Button>)}
            {!suppliers?.length && <p className="text-sm text-muted-foreground">No suppliers yet. Add them under Suppliers.</p>}
          </CardContent>
        </Card>
      </DashboardShell>
      {attach && <SubmitRequestDialog instanceId={attach.id} title={attach.title} onClose={() => setAttach(null)} />}
      {instance && <InstanceDialog instance={instance} canCancel={false} onClose={() => setDetail(null)} />}
      {paying && (
        <Dialog open onOpenChange={(o) => !o && setPaying(null)}>
          <DialogContent>
            <DialogHeader><DialogTitle>Record payment</DialogTitle></DialogHeader>
            <p className="text-sm text-muted-foreground">{name(paying.supplier_id)} · invoice {paying.invoice_number} · {money(paying.total_amount)}</p>
            <div className="space-y-1"><Label>Payment reference</Label><Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="EFT or cheque number" /></div>
            <Button disabled={!reference.trim() || pay.isPending} onClick={async () => { await pay.mutateAsync({ id: paying.id, reference, paidOn: today }); setPaying(null); }}>Record payment</Button>
          </DialogContent>
        </Dialog>
      )}
    </DashboardLayout>
  );
}

export default withRoleAccess(CreditorsOfficerDashboard, { requiredRoles: ["creditors_officer", "accountant", "head_of_finance_admin", "centre_manager", "organization_admin", "admin"] });
