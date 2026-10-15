import { useState } from "react";
import { AlertCircle, BookOpen, Banknote, Download, FileText, Landmark, Scale, Wallet } from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { useRoleNavigation } from "@/hooks/useRoleNavigation";
import { useProfile } from "@/hooks/useProfile";
import {
  JournalEntry, money, useCreateJournalEntry, useFinanceMonthly, useFinanceOverview, useJournalEntries, usePostJournalEntry,
  useReverseJournalEntry, useSubmitJournalEntry,
} from "@/hooks/useFinance";
import { useWorkflowInstances } from "@/hooks/useWorkflows";
import { BudgetUtilisation, IncomeExpenditureChart, downloadCsv } from "@/components/finance/FinanceCharts";
import { SubmitRequestDialog } from "@/components/workflow/WorkflowAttachments";
import { InstanceDialog } from "@/components/workflow/InstanceDialog";
import { statusBadgeVariant, statusLabel } from "@/components/workflow/status";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { withRoleAccess } from "@/components/withRoleAccess";

const entryVariant = (s: JournalEntry["status"]): "default" | "secondary" | "destructive" | "outline" =>
  s === "posted" ? "default" : s === "rejected" ? "destructive" : s === "draft" || s === "reversed" ? "outline" : "secondary";

function NewEntryDialog() {
  const [open, setOpen] = useState(false);
  const create = useCreateJournalEntry();
  const [f, setF] = useState({ date: new Date().toISOString().slice(0, 10), description: "", debit: "", credit: "", amount: "" });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button onClick={() => setOpen(true)}>New journal entry</Button>
      <DialogContent>
        <DialogHeader><DialogTitle>New journal entry</DialogTitle></DialogHeader>
        <form className="space-y-3" onSubmit={async (e) => {
          e.preventDefault();
          await create.mutateAsync({ date: f.date, description: f.description, debit: f.debit, credit: f.credit, amount: Number(f.amount) });
          setOpen(false); setF({ ...f, description: "", debit: "", credit: "", amount: "" });
        }}>
          <div className="space-y-1"><Label>Date</Label><Input type="date" required value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></div>
          <div className="space-y-1"><Label>Description</Label><Input required value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><Label>Debit account</Label><Input required value={f.debit} onChange={(e) => setF({ ...f, debit: e.target.value })} /></div>
            <div className="space-y-1"><Label>Credit account</Label><Input required value={f.credit} onChange={(e) => setF({ ...f, credit: e.target.value })} /></div>
          </div>
          <div className="space-y-1"><Label>Amount (N$)</Label><Input type="number" min="0.01" step="0.01" required value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} /></div>
          <Button type="submit" className="w-full" disabled={create.isPending}>Save as draft</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function AccountantDashboard() {
  const { navItems, groupLabel } = useRoleNavigation();
  const { data: profile } = useProfile();
  const { data: s, error } = useFinanceOverview();
  const { data: monthly } = useFinanceMonthly(12);
  const { data: entries } = useJournalEntries();
  const { data: mine } = useWorkflowInstances(true);
  const submit = useSubmitJournalEntry();
  const post = usePostJournalEntry();
  const reverse = useReverseJournalEntry();
  const [attach, setAttach] = useState<{ id: string; title: string } | null>(null);
  const [detail, setDetail] = useState<string | null>(null);
  const instance = mine?.find((i) => i.id === detail) ?? null;

  const ytd = (monthly ?? []).filter((m) => m.month.startsWith(String(new Date().getFullYear())));
  const income = ytd.reduce((a, m) => a + m.income, 0);
  const spend = ytd.reduce((a, m) => a + m.expenditure, 0);

  const stats = s ? [
    { label: "Income this year", value: money(income), icon: Banknote, hint: "Payments received", tone: "primary" as const },
    { label: "Expenditure this year", value: money(spend), icon: Wallet, hint: "Supplier invoices paid" },
    { label: "Payables", value: money(s.payables.outstanding), icon: FileText, hint: `${s.payables.overdue_count} overdue` },
    { label: "Receivables", value: money(s.receivables.outstanding), icon: Scale, hint: `${s.receivables.debtors} debtor accounts` },
  ] : [];

  return (
    <DashboardLayout title={`Welcome back, ${profile?.firstname || "User"}`} subtitle="Accounts and financial reporting" navItems={navItems} groupLabel={groupLabel}>
      <DashboardShell
        name={profile?.firstname || undefined}
        heroIcon={Landmark}
        heroSubtitle="Journals, budgets, reconciliation and submissions to the Head of Finance and Administration."
        stats={stats}
        actions={[
          { icon: FileText, label: "My Approvals", desc: "Submissions and decisions", url: "/my-approvals" },
          { icon: BookOpen, label: "Bank Reconciliation", desc: "Match statement lines", url: "/bank-reconciliation", badge: s?.reconciliation.unmatched_lines },
          { icon: Download, label: "Accounting Export", desc: "Export to your accounting package", url: "/accounting-export" },
          { icon: Scale, label: "Reports", desc: "Financial reports", url: "/reports" },
        ]}
        actionCols={4}
      >
        {error && <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertDescription>Could not load the finance figures: {(error as Error).message}</AlertDescription></Alert>}
        <div className="grid gap-4 lg:grid-cols-2">
          <IncomeExpenditureChart data={monthly ?? []} />
          <BudgetUtilisation budgets={s?.budgets ?? []} />
        </div>
        <Card>
          <CardHeader className="flex-row items-start justify-between space-y-0">
            <div>
              <CardTitle>Journal entries</CardTitle>
              <CardDescription>
                Entries need the Head of Finance and Administration's approval before they are posted. A posted entry is never edited: reverse it instead.
                {s ? ` ${s.journals.draft} draft, ${s.journals.submitted} awaiting approval, ${s.journals.approved_unposted} approved and ready to post.` : ""}
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" disabled={!entries?.length} onClick={() => downloadCsv("journal-entries.csv", (entries ?? []).map((e) => ({ Entry: e.entry_number, Date: e.entry_date, Description: e.description, Debit: e.debit_account, Credit: e.credit_account, Amount: e.amount, Status: e.status })))}><Download className="h-4 w-4 mr-1" />Export</Button>
              <NewEntryDialog />
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader><TableRow><TableHead>Entry</TableHead><TableHead>Date</TableHead><TableHead>Description</TableHead><TableHead>Debit</TableHead><TableHead>Credit</TableHead><TableHead className="text-right">Amount</TableHead><TableHead>Status</TableHead><TableHead /></TableRow></TableHeader>
              <TableBody>
                {entries?.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="font-mono text-xs">{e.entry_number}</TableCell>
                    <TableCell>{e.entry_date}</TableCell>
                    <TableCell className="max-w-[16rem]">{e.description}</TableCell>
                    <TableCell>{e.debit_account}</TableCell><TableCell>{e.credit_account}</TableCell>
                    <TableCell className="text-right">{money(e.amount)}</TableCell>
                    <TableCell><Badge variant={entryVariant(e.status)}>{e.status}</Badge></TableCell>
                    <TableCell className="text-right space-x-1">
                      {(e.status === "draft" || e.status === "rejected") && (
                        <Button size="sm" disabled={submit.isPending} onClick={async () => { const id = await submit.mutateAsync(e.id); setAttach({ id: id as string, title: `${e.entry_number}: ${e.description}` }); }}>Submit</Button>
                      )}
                      {e.status === "submitted" && e.workflow_instance_id && <Button size="sm" variant="outline" onClick={() => setDetail(e.workflow_instance_id)}>Status</Button>}
                      {e.status === "approved" && <Button size="sm" disabled={post.isPending} onClick={() => post.mutate(e.id)}>Post</Button>}
                      {e.status === "posted" && <Button size="sm" variant="outline" disabled={reverse.isPending} onClick={() => { const reason = window.prompt("Reason for the reversal"); if (reason) reverse.mutate({ id: e.id, reason }); }}>Reverse</Button>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {!entries?.length && <p className="text-sm text-muted-foreground text-center py-6">No journal entries yet.</p>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>My submissions</CardTitle><CardDescription>Pending, returned, approved and rejected</CardDescription></CardHeader>
          <CardContent>
            <Table>
              <TableHeader><TableRow><TableHead>Reference</TableHead><TableHead>Request</TableHead><TableHead>Status</TableHead><TableHead>Next action</TableHead><TableHead /></TableRow></TableHeader>
              <TableBody>
                {mine?.slice(0, 15).map((i) => (
                  <TableRow key={i.id}>
                    <TableCell className="font-mono text-xs">{i.reference}</TableCell><TableCell className="font-medium">{i.title}</TableCell>
                    <TableCell><Badge variant={statusBadgeVariant(i)}>{statusLabel(i)}</Badge></TableCell>
                    <TableCell className="text-xs text-muted-foreground">{i.next_action}</TableCell>
                    <TableCell className="text-right"><Button size="sm" variant="outline" onClick={() => setDetail(i.id)}>Details</Button></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {!mine?.length && <p className="text-sm text-muted-foreground text-center py-4">You have not made any submissions.</p>}
          </CardContent>
        </Card>
      </DashboardShell>
      {attach && <SubmitRequestDialog instanceId={attach.id} title={attach.title} onClose={() => setAttach(null)} />}
      {instance && <InstanceDialog instance={instance} canCancel onClose={() => setDetail(null)} />}
    </DashboardLayout>
  );
}

export default withRoleAccess(AccountantDashboard, { requiredRoles: ["accountant", "head_of_finance_admin", "organization_admin", "admin"] });
