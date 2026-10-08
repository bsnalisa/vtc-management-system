import { useMemo, useRef, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, Upload, Search } from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useRoleNavigation } from "@/hooks/useRoleNavigation";
import { withRoleAccess } from "@/components/withRoleAccess";
import { useTrainees } from "@/hooks/useTrainees";
import {
  useApplyBankLine, useBankImports, useBankLines, useImportBankStatement, useOpenFeeRecords, useSetBankLineStatus,
  type BankLineStatus, type BankStatementLine,
} from "@/hooks/useBankReconciliation";
import { detectMapping, parseBankCsv, type BankParseResult, type ColumnMapping } from "@/lib/bankStatementCsv";
import { toast } from "sonner";

const money = (n: number) => n.toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const NONE = "none";
const STATUS_LABEL: Record<BankLineStatus, string> = { matched: "Matched", unmatched: "Unmatched", applied: "Applied", ignored: "Ignored" };
const STATUS_VARIANT: Record<BankLineStatus, "default" | "secondary" | "outline" | "destructive"> = { matched: "secondary", unmatched: "destructive", applied: "default", ignored: "outline" };
const FIELDS: { key: keyof ColumnMapping; label: string }[] = [
  { key: "date", label: "Date" }, { key: "description", label: "Description" }, { key: "reference", label: "Reference" },
  { key: "amount", label: "Amount (one column)" }, { key: "credit", label: "Credit (money in)" }, { key: "debit", label: "Debit (money out)" },
];

// ---- apply dialog for rows without an automatic match ----
const ApplyDialog = ({ line, onClose }: { line: BankStatementLine | null; onClose: () => void }) => {
  const { data: trainees } = useTrainees();
  const apply = useApplyBankLine();
  const [search, setSearch] = useState("");
  const [picked, setPicked] = useState<string | null>(null);
  const [feeId, setFeeId] = useState<string>("");
  const traineeId = picked ?? line?.matched_trainee_id ?? null;
  const { data: fees, isLoading } = useOpenFeeRecords(traineeId);
  const matches = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q || !trainees) return [];
    return trainees.filter((t) => t.trainee_id.toLowerCase().includes(q) || `${t.first_name} ${t.last_name}`.toLowerCase().includes(q)).slice(0, 6);
  }, [search, trainees]);
  const who = trainees?.find((t) => t.id === traineeId);
  const close = () => { setSearch(""); setPicked(null); setFeeId(""); onClose(); };

  return (
    <Dialog open={!!line} onOpenChange={(o) => { if (!o) close(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Apply payment to a fee record</DialogTitle>
          <DialogDescription>{line ? `${line.txn_date}, N$ ${money(line.amount)}, ${line.reference || line.description || ""}` : ""}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input className="pl-9" placeholder="Search trainee number or name" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          {matches.length > 0 && (
            <div className="border rounded-md divide-y">
              {matches.map((t) => (
                <button key={t.id} type="button" className="w-full text-left px-3 py-2 text-sm hover:bg-muted"
                  onClick={() => { setPicked(t.id); setFeeId(""); setSearch(""); }}>
                  {t.first_name} {t.last_name} <span className="text-muted-foreground">({t.trainee_id})</span>
                </button>
              ))}
            </div>
          )}
          {who && <p className="text-sm">Trainee: <strong>{who.first_name} {who.last_name}</strong> ({who.trainee_id})</p>}
          {traineeId && (
            <div className="space-y-1.5">
              <Label>Open fee record</Label>
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : !fees?.length ? (
                <p className="text-sm text-muted-foreground">This trainee has no fee record with a balance owing.</p>
              ) : (
                <Select value={feeId} onValueChange={setFeeId}>
                  <SelectTrigger><SelectValue placeholder="Choose a fee record" /></SelectTrigger>
                  <SelectContent>
                    {fees.map((f) => <SelectItem key={f.id} value={f.id}>{f.academic_year}, balance N$ {money(Number(f.balance))}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={close}>Cancel</Button>
          <Button disabled={!line || !feeId || apply.isPending}
            onClick={async () => { if (!line) return; try { await apply.mutateAsync({ lineId: line.id, feeRecordId: feeId }); close(); } catch { /* shown by onError */ } }}>
            {apply.isPending ? "Applying..." : "Apply payment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const BankReconciliation = () => {
  const { navItems, groupLabel } = useRoleNavigation();
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState("");
  const [text, setText] = useState<string | null>(null);
  const [bank, setBank] = useState("");
  const [parsed, setParsed] = useState<BankParseResult | null>(null);
  const [mapping, setMapping] = useState<ColumnMapping | null>(null);
  const [importFilter, setImportFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<"all" | BankLineStatus>("all");
  const [applying, setApplying] = useState<BankStatementLine | null>(null);

  const importMutation = useImportBankStatement();
  const { data: imports } = useBankImports();
  const { data: lines, isLoading, error } = useBankLines(importFilter === "all" ? null : importFilter);
  const apply = useApplyBankLine();
  const setStatus = useSetBankLineStatus();

  const totals = useMemo(() => {
    const t = { received: 0, applied: 0, outstanding: 0 };
    (lines ?? []).forEach((l) => {
      const a = Number(l.amount);
      if (a <= 0 || l.status === "ignored") return;
      t.received += a;
      if (l.status === "applied") t.applied += a; else t.outstanding += a;
    });
    return t;
  }, [lines]);
  const shown = (lines ?? []).filter((l) => statusFilter === "all" || l.status === statusFilter);

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    try {
      const content = await f.text();
      const r = parseBankCsv(content);
      setFileName(f.name); setText(content); setParsed(r); setMapping(r.mapping);
      if (r.needsMapping) toast.message("Choose which column is which, then apply the mapping");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The file could not be read");
    }
  };
  const applyMapping = () => { if (text !== null && mapping) setParsed(parseBankCsv(text, mapping)); };
  const reset = () => { setText(null); setParsed(null); setMapping(null); setFileName(""); if (fileRef.current) fileRef.current.value = ""; };
  const doImport = async () => {
    if (!parsed?.lines.length) return;
    try {
      const r = await importMutation.mutateAsync({ fileName, bank, lines: parsed.lines });
      setImportFilter(r.importIds.length === 1 ? r.importIds[0] : "all");
      reset();
    } catch { /* shown by onError */ }
  };
  const run = async (p: Promise<unknown>) => { try { await p; } catch { /* shown by onError */ } };

  return (
    <DashboardLayout title="Bank Reconciliation" subtitle="Import a bank statement and match deposits to fee records" navItems={navItems} groupLabel={groupLabel}>
      <div className="space-y-4">
        <Card className="border-0 shadow-md">
          <CardHeader><CardTitle>Import bank statement</CardTitle><CardDescription>CSV with date, description, reference and amount (or credit and debit) columns. Lines already imported are skipped.</CardDescription></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-3 max-w-2xl">
              <div className="space-y-1.5"><Label>Statement file (.csv)</Label><Input ref={fileRef} type="file" accept=".csv,text/csv,text/plain" onChange={(e) => onFile(e.target.files?.[0])} /></div>
              <div className="space-y-1.5"><Label>Bank name (optional)</Label><Input value={bank} onChange={(e) => setBank(e.target.value)} placeholder="e.g. Bank Windhoek" /></div>
            </div>

            {parsed && mapping && (
              <div className="space-y-3">
                {parsed.needsMapping && <p className="text-sm text-destructive">The column headings were not recognised. Choose a column for the date and for the amount (or credit/debit).</p>}
                <details open={parsed.needsMapping}>
                  <summary className="text-sm cursor-pointer">Column mapping</summary>
                  <div className="grid sm:grid-cols-3 gap-3 mt-2">
                    {FIELDS.map((f) => (
                      <div key={f.key} className="space-y-1.5">
                        <Label>{f.label}</Label>
                        <Select value={mapping[f.key] >= 0 ? String(mapping[f.key]) : NONE} onValueChange={(v) => setMapping({ ...mapping, [f.key]: v === NONE ? -1 : Number(v) })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value={NONE}>Not in file</SelectItem>
                            {parsed.headers.map((h, i) => <SelectItem key={i} value={String(i)}>{h || `Column ${i + 1}`}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2 mt-2">
                    <Button size="sm" variant="outline" onClick={applyMapping}>Apply mapping</Button>
                    <Button size="sm" variant="ghost" onClick={() => setMapping(detectMapping(parsed.headers))}>Detect automatically</Button>
                  </div>
                </details>

                {!parsed.needsMapping && (
                  <>
                    <p className="text-sm">{parsed.lines.length} of {parsed.rowCount} rows can be imported{parsed.errors.length ? `; ${parsed.errors.length} cannot be read and will be left out` : ""}.</p>
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Description</TableHead><TableHead>Reference</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader>
                        <TableBody>
                          {parsed.lines.slice(0, 8).map((l, i) => (
                            <TableRow key={i}><TableCell>{l.date}</TableCell><TableCell>{l.description}</TableCell><TableCell>{l.reference}</TableCell><TableCell className="text-right">{money(l.amount)}</TableCell></TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                    {parsed.errors.length > 0 && (
                      <div className="border border-destructive/40 rounded-md p-3 text-sm space-y-1">
                        <div className="font-medium text-destructive">Rows that could not be read</div>
                        {parsed.errors.slice(0, 10).map((e) => <div key={e.row}>Row {e.row}: {e.message}</div>)}
                        {parsed.errors.length > 10 && <div className="text-muted-foreground">and {parsed.errors.length - 10} more</div>}
                      </div>
                    )}
                  </>
                )}
                <div className="flex gap-2">
                  <Button onClick={doImport} disabled={parsed.needsMapping || !parsed.lines.length || importMutation.isPending}>
                    {importMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}Import {parsed.lines.length} lines
                  </Button>
                  <Button variant="outline" onClick={reset} disabled={importMutation.isPending}>Cancel</Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md">
          <CardHeader className="space-y-3">
            <div><CardTitle>Reconciliation</CardTitle><CardDescription>Apply matched deposits, or choose a fee record for the rest.</CardDescription></div>
            <div className="flex flex-wrap gap-3">
              <Select value={importFilter} onValueChange={setImportFilter}>
                <SelectTrigger className="w-64"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All imports</SelectItem>
                  {(imports ?? []).map((i) => <SelectItem key={i.id} value={i.id}>{i.file_name} ({new Date(i.imported_at).toLocaleDateString()})</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as "all" | BankLineStatus)}>
                <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  {(Object.keys(STATUS_LABEL) as BankLineStatus[]).map((s) => <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-3 gap-3 text-sm max-w-xl">
              <div><div className="text-xs text-muted-foreground">Received</div><div className="font-semibold">N$ {money(totals.received)}</div></div>
              <div><div className="text-xs text-muted-foreground">Applied</div><div className="font-semibold">N$ {money(totals.applied)}</div></div>
              <div><div className="text-xs text-muted-foreground">Outstanding</div><div className="font-semibold">N$ {money(totals.outstanding)}</div></div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading && <Loader2 className="h-5 w-5 animate-spin" />}
            {error && <p className="text-sm text-destructive">{(error as Error).message}</p>}
            <div className="overflow-x-auto">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Date</TableHead><TableHead>Description</TableHead><TableHead>Reference</TableHead><TableHead className="text-right">Amount</TableHead>
                  <TableHead>Trainee</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Action</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {shown.map((l) => (
                    <TableRow key={l.id}>
                      <TableCell className="whitespace-nowrap">{l.txn_date}</TableCell>
                      <TableCell className="max-w-xs truncate" title={l.description ?? ""}>{l.description}</TableCell>
                      <TableCell>{l.reference}</TableCell>
                      <TableCell className="text-right whitespace-nowrap">{money(Number(l.amount))}</TableCell>
                      <TableCell>{l.trainees ? `${l.trainees.first_name} ${l.trainees.last_name} (${l.trainees.trainee_id})` : ""}</TableCell>
                      <TableCell><Badge variant={STATUS_VARIANT[l.status]}>{STATUS_LABEL[l.status]}</Badge></TableCell>
                      <TableCell className="text-right whitespace-nowrap space-x-2">
                        {l.status === "matched" && <Button size="sm" disabled={apply.isPending} onClick={() => run(apply.mutateAsync({ lineId: l.id }))}>Apply</Button>}
                        {l.status === "unmatched" && Number(l.amount) > 0 && <Button size="sm" variant="outline" onClick={() => setApplying(l)}>Choose fee record</Button>}
                        {(l.status === "matched" || l.status === "unmatched") && <Button size="sm" variant="ghost" disabled={setStatus.isPending} onClick={() => run(setStatus.mutateAsync({ lineId: l.id, ignore: true }))}>Ignore</Button>}
                        {l.status === "ignored" && <Button size="sm" variant="ghost" disabled={setStatus.isPending} onClick={() => run(setStatus.mutateAsync({ lineId: l.id, ignore: false }))}>Restore</Button>}
                      </TableCell>
                    </TableRow>
                  ))}
                  {!isLoading && !shown.length && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No lines to show.</TableCell></TableRow>}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
      <ApplyDialog key={applying?.id ?? "none"} line={applying} onClose={() => setApplying(null)} />
    </DashboardLayout>
  );
};

export default withRoleAccess(BankReconciliation, { requiredRoles: ["admin", "organization_admin", "debtor_officer"] });
