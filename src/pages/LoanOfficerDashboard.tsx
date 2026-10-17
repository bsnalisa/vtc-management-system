import { useState } from "react";
import { AlertCircle, Banknote, ClipboardCheck, Clock, FileText, Landmark, Users, Wallet } from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { useRoleNavigation } from "@/hooks/useRoleNavigation";
import { useProfile } from "@/hooks/useProfile";
import { money, openAttachment } from "@/hooks/useFinance";
import {
  Loan, LoanApplication, LoanApplicationStatus, useAddLoanDocument, useApplyLoanAdjustment, useAssessApplication, useDeclineApplication, useLoanAdjustments,
  useLoanApplications, useLoanArrears, useLoanBorrowers, useLoanDocuments, useLoanOverview, useLoans, useLoanSchedule, useRecommendApplication, useRecordDisbursement,
  useRecordRepayment, useRegisterApplication, useRegisterBorrower, useRequestDisbursement, useRequestLoanAdjustment, useVerifyLoanDocument,
} from "@/hooks/useLoans";
import { useWorkflowInstances } from "@/hooks/useWorkflows";
import { downloadCsv } from "@/components/finance/FinanceCharts";
import { SubmitRequestDialog } from "@/components/workflow/WorkflowAttachments";
import { InstanceDialog } from "@/components/workflow/InstanceDialog";
import { statusBadgeVariant, statusLabel } from "@/components/workflow/status";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { withRoleAccess } from "@/components/withRoleAccess";

const STAGE: Record<LoanApplicationStatus, string> = {
  registered: "Registered", assessed: "Assessed", declined: "Declined", recommended: "With approver", approved: "Approved", rejected: "Rejected",
  disbursement_requested: "Disbursement with approver", disbursement_approved: "Ready to disburse", active: "Active", closed: "Closed", written_off: "Written off",
};
const stageVariant = (s: LoanApplicationStatus): "default" | "secondary" | "destructive" | "outline" =>
  s === "active" || s === "closed" ? "default" : s === "rejected" || s === "declined" || s === "written_off" ? "destructive" : s === "registered" ? "outline" : "secondary";
const ADJ_LABEL = { restructure: "Restructure", interest_waiver: "Interest waiver", write_off: "Write-off" } as const;
const DOC_LABEL: Record<string, string> = { identity: "Identity document", proof_of_income: "Proof of income", bank_statement: "Bank statement", guarantor: "Guarantor form", other: "Other" };

function NewApplicationDialog() {
  const { data: borrowers } = useLoanBorrowers();
  const registerBorrower = useRegisterBorrower();
  const register = useRegisterApplication();
  const [open, setOpen] = useState(false);
  const [newBorrower, setNewBorrower] = useState(false);
  const [b, setB] = useState({ type: "other", name: "", nationalId: "", phone: "", email: "", address: "", employer: "", income: "" });
  const [a, setA] = useState({ borrower: "", purpose: "", amount: "", term: "12", rate: "" });
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    let borrower = a.borrower;
    if (newBorrower) borrower = (await registerBorrower.mutateAsync({ type: b.type, name: b.name, nationalId: b.nationalId, phone: b.phone, email: b.email, address: b.address, employer: b.employer, income: Number(b.income || 0) })) as string;
    await register.mutateAsync({ borrower, purpose: a.purpose, amount: Number(a.amount), term: Number(a.term), rate: a.rate ? Number(a.rate) : null, obligations: 0 });
    setOpen(false); setA({ borrower: "", purpose: "", amount: "", term: "12", rate: "" }); setNewBorrower(false);
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button onClick={() => setOpen(true)}>New loan application</Button>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>New loan application</DialogTitle></DialogHeader>
        <form className="space-y-3" onSubmit={submit}>
          <div className="flex items-center justify-between"><Label>Borrower</Label><Button type="button" variant="link" className="px-0" onClick={() => setNewBorrower(!newBorrower)}>{newBorrower ? "Choose an existing borrower" : "Register a new borrower"}</Button></div>
          {!newBorrower ? (
            <Select value={a.borrower} onValueChange={(v) => setA({ ...a, borrower: v })}><SelectTrigger><SelectValue placeholder="Choose borrower" /></SelectTrigger>
              <SelectContent>{borrowers?.map((x) => <SelectItem key={x.id} value={x.id}>{x.full_name} ({x.national_id})</SelectItem>)}</SelectContent></Select>
          ) : (
            <div className="grid grid-cols-2 gap-3 border rounded-md p-3">
              <div className="space-y-1 col-span-2"><Label>Full name</Label><Input required value={b.name} onChange={(e) => setB({ ...b, name: e.target.value })} /></div>
              <div className="space-y-1"><Label>ID number</Label><Input required value={b.nationalId} onChange={(e) => setB({ ...b, nationalId: e.target.value })} /></div>
              <div className="space-y-1"><Label>Type</Label>
                <Select value={b.type} onValueChange={(v) => setB({ ...b, type: v })}><SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="trainee">Trainee</SelectItem><SelectItem value="staff">Staff</SelectItem><SelectItem value="other">Other</SelectItem></SelectContent></Select></div>
              <div className="space-y-1"><Label>Phone</Label><Input value={b.phone} onChange={(e) => setB({ ...b, phone: e.target.value })} /></div>
              <div className="space-y-1"><Label>Email</Label><Input type="email" value={b.email} onChange={(e) => setB({ ...b, email: e.target.value })} /></div>
              <div className="space-y-1"><Label>Employer</Label><Input value={b.employer} onChange={(e) => setB({ ...b, employer: e.target.value })} /></div>
              <div className="space-y-1"><Label>Monthly income (N$)</Label><Input type="number" min="0" step="0.01" required value={b.income} onChange={(e) => setB({ ...b, income: e.target.value })} /></div>
              <div className="space-y-1 col-span-2"><Label>Address</Label><Input value={b.address} onChange={(e) => setB({ ...b, address: e.target.value })} /></div>
            </div>
          )}
          <div className="space-y-1"><Label>Purpose of the loan</Label><Input required value={a.purpose} onChange={(e) => setA({ ...a, purpose: e.target.value })} /></div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1"><Label>Amount (N$)</Label><Input type="number" min="1" step="0.01" required value={a.amount} onChange={(e) => setA({ ...a, amount: e.target.value })} /></div>
            <div className="space-y-1"><Label>Term (months)</Label><Input type="number" min="1" required value={a.term} onChange={(e) => setA({ ...a, term: e.target.value })} /></div>
            <div className="space-y-1"><Label>Rate (% a year)</Label><Input type="number" min="0" step="0.01" placeholder="centre default" value={a.rate} onChange={(e) => setA({ ...a, rate: e.target.value })} /></div>
          </div>
          <Button type="submit" className="w-full" disabled={register.isPending || registerBorrower.isPending || (!newBorrower && !a.borrower)}>Register application</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function FileDialog({ app, onClose, canEdit }: { app: LoanApplication; onClose: () => void; canEdit: boolean }) {
  const { data: docs } = useLoanDocuments(app.id);
  const add = useAddLoanDocument(app.id);
  const verify = useVerifyLoanDocument();
  const assess = useAssessApplication();
  const decline = useDeclineApplication();
  const [type, setType] = useState("identity");
  const [obligations, setObligations] = useState(String(app.existing_obligations ?? 0));
  const [notes, setNotes] = useState("");
  const open = app.status === "registered" || app.status === "assessed" || app.status === "rejected";
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{app.application_number}</DialogTitle><DialogDescription>{app.purpose} · {money(app.amount_requested)} over {app.term_months} months at {app.interest_rate}%</DialogDescription></DialogHeader>
        <div className="space-y-4 text-sm">
          <div>
            <h4 className="font-medium mb-1">Supporting documents</h4>
            <p className="text-xs text-muted-foreground mb-2">The identity document and proof of income must be verified before the application can be assessed.</p>
            <ul className="space-y-1">
              {docs?.map((d) => (
                <li key={d.id} className="flex items-center gap-2">
                  <Badge variant="outline">{DOC_LABEL[d.doc_type] ?? d.doc_type}</Badge>
                  <button type="button" className="underline" onClick={() => openAttachment(d.file_path)}>{d.file_name}</button>
                  {d.verified ? <Badge>Verified</Badge> : canEdit && open ? <Button size="sm" variant="outline" disabled={verify.isPending} onClick={() => verify.mutate(d.id)}>Mark verified</Button> : <Badge variant="secondary">Not verified</Badge>}
                </li>
              ))}
            </ul>
            {!docs?.length && <p className="text-muted-foreground">No documents yet.</p>}
            {canEdit && open && (
              <div className="flex items-center gap-2 mt-2">
                <Select value={type} onValueChange={setType}><SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(DOC_LABEL).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent></Select>
                <Input type="file" accept=".pdf,.png,.jpg,.jpeg" disabled={add.isPending} onChange={async (e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) await add.mutateAsync({ file: f, type }); }} />
              </div>
            )}
          </div>
          {app.assessment && (
            <Alert variant={app.assessment === "eligible" ? "default" : "destructive"}><AlertDescription>
              <span className="font-medium">{app.assessment === "eligible" ? "Eligible" : "Not eligible"}.</span> Installment {money(app.installment)}. {app.assessment_notes}
            </AlertDescription></Alert>
          )}
          {canEdit && open && (
            <div className="space-y-2 border-t pt-3">
              <h4 className="font-medium">Eligibility assessment</h4>
              <div className="space-y-1"><Label>The borrower's existing monthly obligations (N$)</Label><Input type="number" min="0" step="0.01" value={obligations} onChange={(e) => setObligations(e.target.value)} /></div>
              <div className="space-y-1"><Label>Notes</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
              <div className="flex gap-2">
                <Button disabled={assess.isPending} onClick={() => assess.mutate({ id: app.id, obligations: Number(obligations || 0), notes })}>Assess eligibility</Button>
                <Button variant="outline" disabled={decline.isPending || !notes.trim()} title={notes.trim() ? "" : "Write the reason in the notes"} onClick={async () => { await decline.mutateAsync({ id: app.id, reason: notes }); onClose(); }}>Decline application</Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function LoanDialog({ loan, onClose, canEdit, onRequest }: { loan: Loan; onClose: () => void; canEdit: boolean; onRequest: (instanceId: string, title: string) => void }) {
  const { data } = useLoanSchedule(loan.id);
  const repay = useRecordRepayment();
  const adjust = useRequestLoanAdjustment();
  const [amount, setAmount] = useState("");
  const [reference, setReference] = useState("");
  const [adj, setAdj] = useState({ type: "interest_waiver", amount: "", term: "", reason: "" });
  const rows = (data?.schedule ?? []).filter((r) => !r.superseded);
  const owed = (r: { amount_due: number; amount_paid: number; amount_adjusted: number }) => Number(r.amount_due) - Number(r.amount_paid) - Number(r.amount_adjusted);
  const today = new Date().toISOString().slice(0, 10);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{loan.loan_number}</DialogTitle><DialogDescription>{money(loan.principal)} at {loan.interest_rate}% over {loan.term_months} months · outstanding {money(loan.outstanding)}</DialogDescription></DialogHeader>
        <div className="space-y-4 text-sm">
          <Table>
            <TableHeader><TableRow><TableHead>#</TableHead><TableHead>Due</TableHead><TableHead className="text-right">Interest</TableHead><TableHead className="text-right">Principal</TableHead><TableHead className="text-right">Paid</TableHead><TableHead className="text-right">Adjusted</TableHead><TableHead /></TableRow></TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>{r.installment_no}</TableCell><TableCell>{r.due_date}</TableCell>
                  <TableCell className="text-right">{money(r.interest_due)}</TableCell><TableCell className="text-right">{money(r.principal_due)}</TableCell>
                  <TableCell className="text-right">{money(r.amount_paid)}</TableCell><TableCell className="text-right">{money(r.amount_adjusted)}</TableCell>
                  <TableCell>{owed(r) <= 0 ? <Badge>Settled</Badge> : r.due_date < today ? <Badge variant="destructive">Overdue {money(owed(r))}</Badge> : <Badge variant="outline">Due {money(owed(r))}</Badge>}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div>
            <h4 className="font-medium mb-1">Repayments</h4>
            {!data?.repayments.length && <p className="text-muted-foreground">None yet.</p>}
            <ul className="space-y-1">{data?.repayments.map((p) => <li key={p.id}>{p.paid_on} · {money(p.amount)}{p.reference ? ` · ${p.reference}` : ""}</li>)}</ul>
          </div>
          {canEdit && loan.status === "active" && (
            <>
              <form className="grid gap-2 md:grid-cols-4 items-end border-t pt-3" onSubmit={async (e) => { e.preventDefault(); await repay.mutateAsync({ loan: loan.id, amount: Number(amount), paidOn: today, reference }); setAmount(""); setReference(""); }}>
                <div className="space-y-1"><Label>Repayment (N$)</Label><Input type="number" min="0.01" step="0.01" required value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
                <div className="space-y-1"><Label>Reference</Label><Input value={reference} onChange={(e) => setReference(e.target.value)} /></div>
                <Button type="submit" disabled={repay.isPending || !amount}>Record repayment</Button>
              </form>
              <form className="space-y-2 border-t pt-3" onSubmit={async (e) => {
                e.preventDefault();
                const id = await adjust.mutateAsync({ loan: loan.id, type: adj.type, amount: adj.type === "restructure" ? null : Number(adj.amount), newTerm: adj.type === "restructure" ? Number(adj.term) : null, reason: adj.reason });
                onClose(); onRequest(id as string, `${ADJ_LABEL[adj.type as keyof typeof ADJ_LABEL]} for loan ${loan.loan_number}`);
              }}>
                <h4 className="font-medium">Request restructuring, a waiver or a write-off</h4>
                <div className="grid gap-2 md:grid-cols-3">
                  <Select value={adj.type} onValueChange={(v) => setAdj({ ...adj, type: v })}><SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{Object.entries(ADJ_LABEL).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent></Select>
                  {adj.type === "restructure"
                    ? <Input type="number" min="1" placeholder="New term (months)" required value={adj.term} onChange={(e) => setAdj({ ...adj, term: e.target.value })} />
                    : <Input type="number" min="0.01" step="0.01" placeholder="Amount (N$)" required value={adj.amount} onChange={(e) => setAdj({ ...adj, amount: e.target.value })} />}
                </div>
                <Textarea required placeholder="Reason" value={adj.reason} onChange={(e) => setAdj({ ...adj, reason: e.target.value })} />
                <Button type="submit" variant="outline" disabled={adjust.isPending || !adj.reason.trim()}>Continue: attach documents</Button>
              </form>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function LoanOfficerDashboard() {
  const { navItems, groupLabel, role } = useRoleNavigation();
  const { data: profile } = useProfile();
  const { data: s, error } = useLoanOverview();
  const { data: apps } = useLoanApplications();
  const { data: borrowers } = useLoanBorrowers();
  const { data: loans } = useLoans();
  const { data: arrears } = useLoanArrears();
  const { data: adjustments } = useLoanAdjustments();
  const { data: instances } = useWorkflowInstances(false);
  const recommend = useRecommendApplication();
  const requestDisb = useRequestDisbursement();
  const recordDisb = useRecordDisbursement();
  const applyAdj = useApplyLoanAdjustment();
  const [fileFor, setFileFor] = useState<LoanApplication | null>(null);
  const [loanOpen, setLoanOpen] = useState<Loan | null>(null);
  const [attach, setAttach] = useState<{ id: string; title: string } | null>(null);
  const [detail, setDetail] = useState<string | null>(null);
  const [disburse, setDisburse] = useState<LoanApplication | null>(null);
  const [reference, setReference] = useState("");
  const canAct = role === "loan_officer";
  const name = (id: string) => borrowers?.find((b) => b.id === id)?.full_name ?? "Borrower";
  const loanNo = (id: string) => loans?.find((l) => l.id === id)?.loan_number ?? "Loan";
  const instance = instances?.find((i) => i.id === detail) ?? null;
  const today = new Date().toISOString().slice(0, 10);

  const stats = s ? [
    { label: "Active loans", value: s.portfolio.active_loans, icon: Landmark, hint: `${money(s.portfolio.disbursed_total)} disbursed`, tone: "primary" as const },
    { label: "Outstanding", value: money(s.portfolio.outstanding), icon: Wallet, hint: `${money(s.portfolio.due_7d)} due in 7 days` },
    { label: "In arrears", value: s.arrears.loans, icon: Clock, hint: money(s.arrears.amount), tone: s.arrears.loans > 0 ? ("destructive" as const) : ("secondary" as const) },
    { label: "Collected (30 days)", value: money(s.portfolio.collected_30d), icon: Banknote, hint: "Repayments received" },
    { label: "New to assess", value: s.applications.registered + s.applications.assessed, icon: FileText, hint: "Registered or assessed" },
    { label: "With the approver", value: s.applications.with_approver, icon: ClipboardCheck, hint: `${s.applications.approved} approved, ${s.applications.ready_to_disburse} ready to disburse` },
  ] : [];

  return (
    <DashboardLayout title={`Welcome back, ${profile?.firstname || "User"}`} subtitle="Loan applications, repayments and arrears" navItems={navItems} groupLabel={groupLabel}>
      <DashboardShell
        name={profile?.firstname || undefined}
        heroIcon={Landmark}
        heroSubtitle="Register and assess applications, request approvals, record disbursements and repayments, and follow arrears."
        stats={stats}
        actions={[
          { icon: ClipboardCheck, label: "My Approvals", desc: "Recommendations and requests", url: "/my-approvals" },
          { icon: Users, label: "Reports", desc: "Loan reports", url: "/reports" },
        ]}
        actionCols={3}
      >
        {error && <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertDescription>Could not load the loan figures: {(error as Error).message}</AlertDescription></Alert>}
        <Card>
          <CardHeader className="flex-row items-start justify-between space-y-0">
            <div><CardTitle>Loans</CardTitle><CardDescription>An application is recommended to the Head of Finance and Administration, and a disbursement is a separate request. Larger amounts also go to the Centre Manager. You cannot approve your own requests.</CardDescription></div>
            {canAct && <NewApplicationDialog />}
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="applications">
              <TabsList className="flex-wrap h-auto">
                <TabsTrigger value="applications">Applications</TabsTrigger><TabsTrigger value="loans">Loans</TabsTrigger>
                <TabsTrigger value="arrears">Arrears{arrears?.length ? ` (${arrears.length})` : ""}</TabsTrigger>
                <TabsTrigger value="requests">Adjustments</TabsTrigger><TabsTrigger value="borrowers">Borrowers</TabsTrigger>
              </TabsList>
              <TabsContent value="applications">
                <Table>
                  <TableHeader><TableRow><TableHead>Application</TableHead><TableHead>Borrower</TableHead><TableHead className="text-right">Amount</TableHead><TableHead>Stage</TableHead><TableHead /></TableRow></TableHeader>
                  <TableBody>
                    {apps?.map((a) => (
                      <TableRow key={a.id}>
                        <TableCell className="font-mono text-xs">{a.application_number}<div className="font-sans text-sm">{a.purpose}</div></TableCell>
                        <TableCell>{name(a.borrower_id)}</TableCell>
                        <TableCell className="text-right">{money(a.amount_requested)}<div className="text-xs text-muted-foreground">{a.term_months} months</div></TableCell>
                        <TableCell><Badge variant={stageVariant(a.status)}>{STAGE[a.status]}</Badge>{a.assessment && a.status === "assessed" && <Badge variant={a.assessment === "eligible" ? "default" : "destructive"} className="ml-1">{a.assessment === "eligible" ? "eligible" : "not eligible"}</Badge>}</TableCell>
                        <TableCell className="text-right space-x-1">
                          <Button size="sm" variant="outline" onClick={() => setFileFor(a)}>{["registered", "assessed", "rejected"].includes(a.status) && canAct ? "Documents and assessment" : "View file"}</Button>
                          {canAct && a.status === "assessed" && a.assessment === "eligible" && <Button size="sm" disabled={recommend.isPending} onClick={async () => { const id = await recommend.mutateAsync(a.id); setAttach({ id: id as string, title: `Loan recommendation ${a.application_number}` }); }}>Recommend</Button>}
                          {canAct && a.status === "approved" && <Button size="sm" disabled={requestDisb.isPending} onClick={async () => { const id = await requestDisb.mutateAsync(a.id); setAttach({ id: id as string, title: `Loan disbursement ${a.application_number}` }); }}>Request disbursement</Button>}
                          {(role === "loan_officer" || role === "accountant") && a.status === "disbursement_approved" && <Button size="sm" onClick={() => { setDisburse(a); setReference(""); }}>Record disbursement</Button>}
                          {a.workflow_instance_id && ["recommended", "disbursement_requested", "approved", "rejected", "disbursement_approved"].includes(a.status) && <Button size="sm" variant="ghost" onClick={() => setDetail(a.workflow_instance_id)}>Approval</Button>}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {!apps?.length && <p className="text-sm text-muted-foreground text-center py-6">No applications yet.</p>}
              </TabsContent>
              <TabsContent value="loans">
                <Table>
                  <TableHeader><TableRow><TableHead>Loan</TableHead><TableHead>Borrower</TableHead><TableHead className="text-right">Principal</TableHead><TableHead className="text-right">Outstanding</TableHead><TableHead>Status</TableHead><TableHead /></TableRow></TableHeader>
                  <TableBody>
                    {loans?.map((l) => (
                      <TableRow key={l.id}>
                        <TableCell className="font-mono text-xs">{l.loan_number}<div className="font-sans text-xs text-muted-foreground">{l.disbursed_on}</div></TableCell>
                        <TableCell>{name(l.borrower_id)}</TableCell><TableCell className="text-right">{money(l.principal)}</TableCell><TableCell className="text-right">{money(l.outstanding)}</TableCell>
                        <TableCell><Badge variant={l.status === "active" ? "secondary" : l.status === "closed" ? "default" : "destructive"}>{l.status.replace("_", " ")}</Badge></TableCell>
                        <TableCell className="text-right"><Button size="sm" variant="outline" onClick={() => setLoanOpen(l)}>Schedule and repayments</Button></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {!loans?.length && <p className="text-sm text-muted-foreground text-center py-6">No loans have been disbursed.</p>}
              </TabsContent>
              <TabsContent value="arrears">
                <div className="flex justify-end mb-2"><Button size="sm" variant="outline" disabled={!arrears?.length} onClick={() => downloadCsv("loan-arrears.csv", (arrears ?? []).map((r) => ({ Loan: r.loan_number, Borrower: r.borrower, Phone: r.phone, DaysOverdue: r.days_overdue, InstallmentsOverdue: r.installments_overdue, AmountOverdue: r.amount_overdue, Outstanding: r.outstanding })))}>Export</Button></div>
                <Table>
                  <TableHeader><TableRow><TableHead>Loan</TableHead><TableHead>Borrower</TableHead><TableHead>Phone</TableHead><TableHead className="text-right">Days overdue</TableHead><TableHead className="text-right">Overdue</TableHead><TableHead className="text-right">Outstanding</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {arrears?.map((r) => (
                      <TableRow key={r.loan_id}><TableCell className="font-mono text-xs">{r.loan_number}</TableCell><TableCell>{r.borrower}</TableCell><TableCell>{r.phone}</TableCell>
                        <TableCell className="text-right"><Badge variant={r.days_overdue > 60 ? "destructive" : "secondary"}>{r.days_overdue}</Badge></TableCell>
                        <TableCell className="text-right">{money(r.amount_overdue)}</TableCell><TableCell className="text-right">{money(r.outstanding)}</TableCell></TableRow>
                    ))}
                  </TableBody>
                </Table>
                {!arrears?.length && <p className="text-sm text-muted-foreground text-center py-6">No loans are in arrears.</p>}
              </TabsContent>
              <TabsContent value="requests">
                <Table>
                  <TableHeader><TableRow><TableHead>Loan</TableHead><TableHead>Type</TableHead><TableHead className="text-right">Amount / term</TableHead><TableHead>Reason</TableHead><TableHead>Status</TableHead><TableHead /></TableRow></TableHeader>
                  <TableBody>
                    {adjustments?.map((x) => (
                      <TableRow key={x.id}>
                        <TableCell className="font-mono text-xs">{loanNo(x.loan_id)}</TableCell><TableCell>{ADJ_LABEL[x.adjustment_type]}</TableCell>
                        <TableCell className="text-right">{x.amount ? money(x.amount) : `${x.new_term_months} months`}</TableCell><TableCell className="max-w-[16rem] text-sm">{x.reason}</TableCell>
                        <TableCell><Badge variant={x.status === "applied" ? "default" : x.status === "rejected" ? "destructive" : "secondary"}>{x.status === "requested" ? "With approver" : x.status}</Badge></TableCell>
                        <TableCell className="text-right space-x-1">
                          {canAct && x.status === "approved" && <Button size="sm" disabled={applyAdj.isPending} onClick={() => applyAdj.mutate(x.id)}>Apply</Button>}
                          {x.workflow_instance_id && <Button size="sm" variant="outline" onClick={() => setDetail(x.workflow_instance_id)}>Approval</Button>}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {!adjustments?.length && <p className="text-sm text-muted-foreground text-center py-6">No adjustment requests.</p>}
              </TabsContent>
              <TabsContent value="borrowers">
                <Table>
                  <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>ID</TableHead><TableHead>Contact</TableHead><TableHead className="text-right">Monthly income</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {borrowers?.map((b) => <TableRow key={b.id}><TableCell className="font-medium">{b.full_name}<div className="text-xs text-muted-foreground">{b.borrower_type}{b.employer ? ` · ${b.employer}` : ""}</div></TableCell><TableCell>{b.national_id}</TableCell><TableCell>{b.phone}<div className="text-xs text-muted-foreground">{b.email}</div></TableCell><TableCell className="text-right">{money(b.monthly_income)}</TableCell></TableRow>)}
                  </TableBody>
                </Table>
                {!borrowers?.length && <p className="text-sm text-muted-foreground text-center py-6">No borrowers yet.</p>}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </DashboardShell>
      {fileFor && <FileDialog app={fileFor} canEdit={canAct} onClose={() => setFileFor(null)} />}
      {loanOpen && <LoanDialog loan={loanOpen} canEdit={canAct || role === "accountant"} onClose={() => setLoanOpen(null)} onRequest={(id, title) => setAttach({ id, title })} />}
      {attach && <SubmitRequestDialog instanceId={attach.id} title={attach.title} onClose={() => setAttach(null)} />}
      {instance && <InstanceDialog instance={instance} canCancel={false} onClose={() => setDetail(null)} />}
      {disburse && (
        <Dialog open onOpenChange={(o) => !o && setDisburse(null)}>
          <DialogContent>
            <DialogHeader><DialogTitle>Record disbursement</DialogTitle><DialogDescription>{name(disburse.borrower_id)} · {money(disburse.amount_requested)} · {disburse.application_number}</DialogDescription></DialogHeader>
            <div className="space-y-1"><Label>Payment reference</Label><Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="EFT or cheque number" /></div>
            <p className="text-xs text-muted-foreground">This starts the repayment schedule from today. The person who approved the disbursement cannot record it.</p>
            <Button disabled={!reference.trim() || recordDisb.isPending} onClick={async () => { await recordDisb.mutateAsync({ id: disburse.id, reference, on: today }); setDisburse(null); }}>Record disbursement</Button>
          </DialogContent>
        </Dialog>
      )}
    </DashboardLayout>
  );
}

export default withRoleAccess(LoanOfficerDashboard, { requiredRoles: ["loan_officer", "accountant", "head_of_finance_admin", "centre_manager", "organization_admin", "admin"] });
