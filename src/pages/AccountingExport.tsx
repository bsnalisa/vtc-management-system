import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Download, FileSpreadsheet, Info, Loader2 } from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useRoleNavigation } from "@/hooks/useRoleNavigation";
import { withRoleAccess } from "@/components/withRoleAccess";
import { useOrganizationContext } from "@/hooks/useOrganizationContext";
import { supabase } from "@/integrations/supabase/client";
import { exportBrandedExcel, exportToCSV } from "@/lib/exportUtils";
import { toast } from "sonner";

// Newer than the generated Supabase types, so access untyped.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

interface PaymentRow {
  payment_date: string; amount: number; payment_method: string | null; reference_number: string | null;
  fee_records: { academic_year: string; trainees: { trainee_id: string; first_name: string; last_name: string } | null } | null;
}

const PAGE = 1000;
const today = () => new Date().toISOString().slice(0, 10);
const yearStart = () => `${new Date().getFullYear()}-01-01`;
const fixed = (n: number) => Number(n).toFixed(2);

async function fetchPayments(from: string, to: string): Promise<PaymentRow[]> {
  const all: PaymentRow[] = [];
  for (let start = 0; ; start += PAGE) {
    const { data, error } = await db.from("payments")
      .select("payment_date,amount,payment_method,reference_number,fee_records(academic_year,trainees(trainee_id,first_name,last_name))")
      .gte("payment_date", from).lte("payment_date", to).order("payment_date").order("id").range(start, start + PAGE - 1);
    if (error) throw error;
    all.push(...(data as PaymentRow[]));
    if ((data as PaymentRow[]).length < PAGE) break;
  }
  return all;
}

const AccountingExport = () => {
  const { navItems, groupLabel } = useRoleNavigation();
  const { organizationName, settings } = useOrganizationContext();
  const [from, setFrom] = useState(yearStart());
  const [to, setTo] = useState(today());
  const [debitAccount, setDebitAccount] = useState("Bank");
  const [creditAccount, setCreditAccount] = useState("Student fees receivable");
  const [busy, setBusy] = useState<string | null>(null);
  const valid = !!from && !!to && from <= to;

  const { data: payments, isLoading, error } = useQuery({
    queryKey: ["accounting-export-payments", from, to], enabled: valid,
    queryFn: () => fetchPayments(from, to),
  });
  const total = (payments ?? []).reduce((s, p) => s + Number(p.amount), 0);

  const ledger = () => (payments ?? []).map((p) => ({
    "Payment date": p.payment_date,
    "Trainee number": p.fee_records?.trainees?.trainee_id ?? "",
    "Name": p.fee_records?.trainees ? `${p.fee_records.trainees.first_name} ${p.fee_records.trainees.last_name}` : "",
    "Academic year": p.fee_records?.academic_year ?? "",
    "Amount": fixed(p.amount),
    "Payment method": p.payment_method ?? "",
    "Reference": p.reference_number ?? "",
  }));

  const journal = () => (payments ?? []).flatMap((p) => {
    const t = p.fee_records?.trainees;
    const ref = p.reference_number || t?.trainee_id || "";
    const narration = `Student fee payment${t ? `: ${t.first_name} ${t.last_name} (${t.trainee_id})` : ""}`;
    return [
      { Date: p.payment_date, Reference: ref, Account: debitAccount.trim(), Debit: fixed(p.amount), Credit: "", Narration: narration },
      { Date: p.payment_date, Reference: ref, Account: creditAccount.trim(), Debit: "", Credit: fixed(p.amount), Narration: narration },
    ];
  });

  const run = async (name: string, fn: () => void | Promise<void>) => {
    setBusy(name);
    try { await fn(); } catch (e) { toast.error(e instanceof Error ? e.message : "The export failed"); } finally { setBusy(null); }
  };
  const need = () => { if (!payments?.length) { toast.error("There are no payments in this date range"); return false; } return true; };
  const range = `${from}_to_${to}`;

  return (
    <DashboardLayout title="Accounting Export" subtitle="Export payments for your accounting package" navItems={navItems} groupLabel={groupLabel}>
      <div className="space-y-4 max-w-3xl">
        <Alert>
          <Info className="h-4 w-4" />
          <AlertTitle>File export, not a live integration</AlertTitle>
          <AlertDescription>This creates files you can import into an accounting package yourself. Nothing is sent to or synchronised with any accounting system.</AlertDescription>
        </Alert>

        <Card className="border-0 shadow-md">
          <CardHeader><CardTitle>Payments to export</CardTitle><CardDescription>Choose the payment date range.</CardDescription></CardHeader>
          <CardContent className="space-y-3">
            <div className="grid sm:grid-cols-2 gap-3 max-w-md">
              <div className="space-y-1.5"><Label>From</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
              <div className="space-y-1.5"><Label>To</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
            </div>
            {!valid && <p className="text-sm text-destructive">Choose a start date that is not after the end date.</p>}
            {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
            {error && <p className="text-sm text-destructive">{(error as Error).message}</p>}
            {payments && <p className="text-sm">{payments.length} payments totalling <strong>N$ {total.toLocaleString("en-ZA", { minimumFractionDigits: 2 })}</strong>.</p>}
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md">
          <CardHeader><CardTitle>Ledger</CardTitle><CardDescription>One row per payment: date, trainee number, name, academic year, amount, method and reference.</CardDescription></CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button variant="outline" disabled={!!busy || !payments?.length} onClick={() => run("csv", () => { if (need()) exportToCSV(ledger(), `payments-ledger-${range}`); })}>
              <Download className="h-4 w-4 mr-2" />Ledger CSV
            </Button>
            <Button variant="outline" disabled={!!busy || !payments?.length}
              onClick={() => run("xlsx", async () => { if (need()) await exportBrandedExcel(ledger(), `payments-ledger-${range}`, { title: `Payments ${from} to ${to}`, organizationName: organizationName ?? "", logoUrl: settings?.logo_url }); })}>
              {busy === "xlsx" ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileSpreadsheet className="h-4 w-4 mr-2" />}Ledger Excel
            </Button>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md">
          <CardHeader><CardTitle>Double-entry journal</CardTitle><CardDescription>Each payment becomes two lines: a debit to the first account and a credit to the second. Columns: Date, Reference, Account, Debit, Credit, Narration.</CardDescription></CardHeader>
          <CardContent className="space-y-3">
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Debit account</Label><Input value={debitAccount} onChange={(e) => setDebitAccount(e.target.value)} /></div>
              <div className="space-y-1.5"><Label>Credit account</Label><Input value={creditAccount} onChange={(e) => setCreditAccount(e.target.value)} /></div>
            </div>
            <Button disabled={!!busy || !payments?.length || !debitAccount.trim() || !creditAccount.trim()}
              onClick={() => run("journal", () => { if (need()) exportToCSV(journal(), `payments-journal-${range}`); })}>
              <Download className="h-4 w-4 mr-2" />Journal CSV
            </Button>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default withRoleAccess(AccountingExport, { requiredRoles: ["admin", "organization_admin", "debtor_officer"] });
