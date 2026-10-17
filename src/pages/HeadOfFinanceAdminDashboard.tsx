import { useNavigate } from "react-router-dom";
import { AlertCircle, Banknote, Building2, ClipboardCheck, Clock, FileText, Landmark, Package, ReceiptText, Scale, Wallet, Wrench } from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { useRoleNavigation } from "@/hooks/useRoleNavigation";
import { useProfile } from "@/hooks/useProfile";
import { useFinanceMonthly, useFinanceOverview, money } from "@/hooks/useFinance";
import { useProcessTypes } from "@/hooks/useWorkflows";
import { getRoleDisplayName } from "@/lib/roleUtils";
import { BudgetUtilisation, IncomeExpenditureChart } from "@/components/finance/FinanceCharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { withRoleAccess } from "@/components/withRoleAccess";
import { useFundingOverview } from "@/hooks/useFunding";

function NsfafFundingCard() {
  const navigate = useNavigate();
  const { data: o } = useFundingOverview(null);
  if (!o) return null;
  return (
    <Card>
      <CardHeader><CardTitle>NSFAF funding</CardTitle><CardDescription>Funding recorded by the Loan Officer. Payments need Finance verification; none of it is owed to the VTC.</CardDescription></CardHeader>
      <CardContent className="space-y-1 text-sm">
        <div className="flex justify-between"><span>Trainees with a funding record</span><span className="font-medium">{o.tracked}</span></div>
        <div className="flex justify-between"><span>Awards confirmed by NSFAF</span><span className="font-medium">{o.confirmed}</span></div>
        <div className="flex justify-between"><span>Payments awaiting reconciliation</span><span className="font-medium">{o.awaiting_reconciliation}</span></div>
        <Button variant="link" className="h-auto p-0" onClick={() => navigate("/loan-officer-dashboard?tab=reconciliation")}>Open reconciliation</Button>
      </CardContent>
    </Card>
  );
}

function HeadOfFinanceAdminDashboard() {
  const navigate = useNavigate();
  const { navItems, groupLabel } = useRoleNavigation();
  const { data: profile } = useProfile();
  const { data: s, isLoading, error } = useFinanceOverview();
  const { data: monthly } = useFinanceMonthly(12);
  const { data: types } = useProcessTypes();
  const typeLabel = (c: string) => types?.find((t) => t.code === c)?.label ?? c;

  const budgetTotal = s?.budgets.reduce((a, b) => a + Number(b.total), 0) ?? 0;
  const budgetSpent = s?.budgets.reduce((a, b) => a + Number(b.spent), 0) ?? 0;
  const utilisation = budgetTotal > 0 ? Math.round((budgetSpent / budgetTotal) * 100) : 0;

  const stats = s ? [
    { label: "Awaiting your approval", value: s.approvals.pending, icon: ClipboardCheck, hint: "In your approval queue", tone: s.approvals.pending > 0 ? ("primary" as const) : ("secondary" as const) },
    { label: "Overdue approvals", value: s.approvals.overdue, icon: Clock, hint: "Past their response time", tone: s.approvals.overdue > 0 ? ("destructive" as const) : ("secondary" as const) },
    { label: "Returned for correction", value: s.approvals.returned, icon: FileText, hint: "Waiting for the officer" },
    { label: "Decided in 30 days", value: `${s.approvals.approved_30d} / ${s.approvals.rejected_30d}`, icon: Scale, hint: "Approved / rejected" },
    { label: "Payables outstanding", value: money(s.payables.outstanding), icon: Wallet, hint: `${s.payables.overdue_count} overdue`, tone: s.payables.overdue_count > 0 ? ("destructive" as const) : ("accent" as const) },
    { label: "Receivables outstanding", value: money(s.receivables.outstanding), icon: Banknote, hint: `${s.receivables.debtors} debtor accounts`, tone: "accent" as const },
    { label: "Budget used", value: `${utilisation}%`, icon: Landmark, hint: `${money(budgetSpent)} of ${money(budgetTotal)}`, progress: utilisation },
    { label: "Assets", value: s.assets.count, icon: Package, hint: `${s.assets.open_maintenance} open maintenance jobs` },
  ] : [];

  return (
    <DashboardLayout title={`Welcome back, ${profile?.firstname || "User"}`} subtitle="Finance and administration" navItems={navItems} groupLabel={groupLabel}>
      <DashboardShell
        name={profile?.firstname || undefined}
        heroIcon={Landmark}
        heroSubtitle="Approvals, creditors, debtors, loans, assets and maintenance in one view."
        stats={stats}
        actions={[
          { icon: ClipboardCheck, label: "Approval Centre", desc: "Decide submissions", url: "/finance-approvals", badge: s?.approvals.pending },
          { icon: FileText, label: "My Approvals", desc: "Your own requests", url: "/my-approvals" },
          { icon: ReceiptText, label: "Creditors", desc: "Supplier invoices", url: "/creditors-officer-dashboard", badge: s?.payables.awaiting_approval },
          { icon: Banknote, label: "Debtor Adjustments", desc: "Write-offs and credits", url: "/debtors/adjustments", badge: s?.receivables.adjustments_pending },
          { icon: Wrench, label: "Asset Requests", desc: "Purchases and repairs", url: "/asset-requests", badge: s?.assets.requests_pending },
          { icon: Building2, label: "Bank Reconciliation", desc: "Match statement lines", url: "/bank-reconciliation", badge: s?.reconciliation.unmatched_lines },
        ]}
        actionCols={6}
      >
        {isLoading && <p className="text-sm text-muted-foreground">Loading figures…</p>}
        {error && <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertDescription>Could not load the finance figures: {(error as Error).message}</AlertDescription></Alert>}
        {s && (
          <>
            <div className="grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader><CardTitle>Pending approvals by officer</CardTitle><CardDescription>Who is waiting for you</CardDescription></CardHeader>
                <CardContent className="space-y-2">
                  {!s.approvals.by_originator.length && <p className="text-sm text-muted-foreground">Nothing is waiting for your approval.</p>}
                  {s.approvals.by_originator.map((o) => (
                    <div key={o.user_id} className="flex items-center justify-between border-b pb-2">
                      <div><p className="font-medium">{o.name}</p><p className="text-xs text-muted-foreground">{o.role ? getRoleDisplayName(o.role as never) : ""}</p></div>
                      <Badge>{o.count}</Badge>
                    </div>
                  ))}
                  {s.approvals.by_type.length > 0 && (
                    <div className="pt-2 flex flex-wrap gap-2">
                      {s.approvals.by_type.map((t) => <Badge key={t.process_type} variant="outline">{typeLabel(t.process_type)}: {t.count}</Badge>)}
                    </div>
                  )}
                  <Button variant="link" className="px-0" onClick={() => navigate("/finance-approvals")}>Open the Approval Centre</Button>
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle>Compliance indicators</CardTitle><CardDescription>Things that should not be left waiting</CardDescription></CardHeader>
                <CardContent className="space-y-2 text-sm">
                  {[
                    ["Overdue approvals", s.approvals.overdue],
                    ["Supplier invoices overdue for payment", s.payables.overdue_count],
                    ["Supplier invoices due in 7 days", s.payables.due_7d_count],
                    ["Approved payments not yet paid", s.payables.approved_unpaid],
                    ["Approved journal entries not yet posted", s.journals.approved_unposted],
                    ["Bank statement lines not matched", s.reconciliation.unmatched_lines],
                    ["Debtor adjustments approved but not applied", s.receivables.adjustments_pending],
                  ].map(([label, n]) => (
                    <div key={label as string} className="flex items-center justify-between border-b pb-1">
                      <span>{label}</span><Badge variant={Number(n) > 0 ? "destructive" : "outline"}>{n}</Badge>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              <IncomeExpenditureChart data={monthly ?? []} />
              <BudgetUtilisation budgets={s.budgets} />
            </div>
            <div className="grid gap-4 lg:grid-cols-3">
              <Card>
                <CardHeader><CardTitle>Debtors by age</CardTitle><CardDescription>Outstanding fees</CardDescription></CardHeader>
                <CardContent className="space-y-1 text-sm">
                  {[["0 to 30 days", s.receivables.aged_30], ["31 to 60 days", s.receivables.aged_60], ["61 to 90 days", s.receivables.aged_90], ["Over 90 days", s.receivables.aged_over_90]].map(([l, v]) => (
                    <div key={l as string} className="flex justify-between"><span>{l}</span><span className="font-medium">{money(v as number)}</span></div>
                  ))}
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle>Creditors</CardTitle><CardDescription>Supplier invoices</CardDescription></CardHeader>
                <CardContent className="space-y-1 text-sm">
                  <div className="flex justify-between"><span>Outstanding</span><span className="font-medium">{money(s.payables.outstanding)}</span></div>
                  <div className="flex justify-between"><span>Overdue</span><span className="font-medium">{money(s.payables.overdue_total)}</span></div>
                  <div className="flex justify-between"><span>Awaiting approval</span><span className="font-medium">{s.payables.awaiting_approval}</span></div>
                  <div className="flex justify-between"><span>Approved, not paid</span><span className="font-medium">{s.payables.approved_unpaid}</span></div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle>Assets and maintenance</CardTitle><CardDescription>Registered assets and spending</CardDescription></CardHeader>
                <CardContent className="space-y-1 text-sm">
                  <div className="flex justify-between"><span>Assets registered</span><span className="font-medium">{s.assets.count}</span></div>
                  <div className="flex justify-between"><span>Requests awaiting approval</span><span className="font-medium">{s.assets.requests_pending}</span></div>
                  <div className="flex justify-between"><span>Open maintenance jobs</span><span className="font-medium">{s.assets.open_maintenance}</span></div>
                  <div className="flex justify-between"><span>Maintenance spend</span><span className="font-medium">{money(s.assets.maintenance_spend)}</span></div>
                </CardContent>
              </Card>
            </div>
            <NsfafFundingCard />
          </>
        )}
      </DashboardShell>
    </DashboardLayout>
  );
}

export default withRoleAccess(HeadOfFinanceAdminDashboard, { requiredRoles: ["head_of_finance_admin", "centre_manager", "organization_admin", "admin"] });
