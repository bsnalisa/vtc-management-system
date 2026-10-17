import { ReactNode, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, ArrowDown, ArrowUp, ArrowUpDown, CheckCircle2, Download, Eye, FileCheck2, MessageSquarePlus, MoreHorizontal, Plus, UserCheck } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { SearchInput } from "@/components/ui/search-input";
import { EmptyState } from "@/components/ui/empty-state";
import { RecordCard } from "@/components/ui/record-card";
import { DataTablePagination } from "@/components/ui/data-table-pagination";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { downloadCsv } from "@/components/finance/FinanceCharts";
import { money } from "@/hooks/useFinance";
import {
  FundingCase, FundingFilters, fetchAllFundingCases, useFundingActivity, useFundingCases, useFundingCoverage, useFundingFollowups, useFundingOptions,
  useFundingOverview, useFundingPayments, useFundingRegister, useSendPaymentToFinance,
} from "@/hooks/useFunding";
import {
  APPLICATION_STATUS, ATTENTION_LABEL, AWARD_STATUS, CATEGORY_LABEL, EVENT_LABEL, FOLLOWUP_KIND_LABEL, FundingBadge, OVERALL_STATUS, PAYMENT_STATUS, RECIPIENT_LABEL,
  REGISTRATION_STATUS, daysSince, formatDate, formatDateTime, isOverdue, label,
} from "./config";
import { FollowupDialog, NoteDialog, ReconcileDialog, RegistrationDialog, ResolveDialog } from "./FundingDialogs";
import { toast } from "sonner";

export interface Access { canEdit: boolean; canReconcile: boolean }
const Loading = () => <div className="space-y-2" aria-busy="true">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-10 w-full" />)}</div>;
const ErrorNote = ({ error }: { error: unknown }) => <Alert variant="destructive"><AlertDescription>{(error as Error)?.message ?? "Something went wrong loading this data."}</AlertDescription></Alert>;
const ALL = "__all";

// ---------------------------------------------------------------------------
// Case actions (view, update, contact, follow-up, registration)
// ---------------------------------------------------------------------------
function CaseActions({ c, access }: { c: FundingCase; access: Access }) {
  const [dlg, setDlg] = useState<"note" | "followup" | "registration" | null>(null);
  const close = () => setDlg(null);
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" aria-label={`Actions for ${c.trainee_name}`}><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem asChild><Link to={`/funding/${c.id}`}><Eye className="mr-2 h-4 w-4" />View record</Link></DropdownMenuItem>
          {access.canEdit && <>
            <DropdownMenuItem asChild><Link to={`/funding/${c.id}?edit=application`}><FileCheck2 className="mr-2 h-4 w-4" />Update status</Link></DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setDlg("note")}><MessageSquarePlus className="mr-2 h-4 w-4" />Add note / record contact</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setDlg("followup")}><Plus className="mr-2 h-4 w-4" />Add follow-up</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setDlg("registration")}><UserCheck className="mr-2 h-4 w-4" />Verify registration</DropdownMenuItem>
          </>}
        </DropdownMenuContent>
      </DropdownMenu>
      {dlg === "note" && <NoteDialog id={c.id} open onClose={close} initialType="contact" title="Add note or record contact" />}
      {dlg === "followup" && <FollowupDialog id={c.id} open onClose={close} />}
      {dlg === "registration" && <RegistrationDialog c={c} open onClose={close} />}
    </>
  );
}

const caseRow = (c: FundingCase) => ({
  "Trainee number": c.trainee_number, "Trainee name": c.trainee_name, Programme: c.programme ?? "", Level: c.level ?? "", Intake: c.intake ?? "", "Academic year": c.academic_year,
  "Funding category": CATEGORY_LABEL[c.funding_category] ?? c.funding_category, "NSFAF reference": c.nsfaf_reference ?? "",
  "Application status": label(APPLICATION_STATUS, c.application_status), "Award status": label(AWARD_STATUS, c.award_status),
  "Registration verification": label(REGISTRATION_STATUS, c.registration_status), "Payment status": label(PAYMENT_STATUS, c.payment_status),
  "Confirmed amount (N$)": c.awarded_amount ?? "", "Reconciled payments (N$)": c.amount_paid, "Needs attention": c.attention.map((a) => ATTENTION_LABEL[a]?.label ?? a).join("; "),
  "Last updated": formatDate(c.updated_at), "Next action": c.next_action ?? "",
});
const exportCases = (name: string, rows: FundingCase[], year: string | null) => {
  if (!rows.length) { toast.info("There is nothing to export for these filters"); return; }
  downloadCsv(`${name}-${year ?? "all-years"}-${new Date().toISOString().slice(0, 10)}.csv`, rows.map(caseRow));
  toast.success(`Exported ${rows.length} records (generated ${formatDate(new Date().toISOString())})`);
};

// ---------------------------------------------------------------------------
// Overview
// ---------------------------------------------------------------------------
function StatCard({ title, value, hint, to, tone }: { title: string; value: ReactNode; hint?: ReactNode; to: string; tone?: "warn" }) {
  return (
    <Link to={to} className="group block rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label={`${title}: ${typeof value === "number" ? value : ""}. Open the list.`}>
      <Card className="h-full transition-colors group-hover:border-primary/50">
        <CardContent className="p-4">
          <p className="text-sm text-muted-foreground">{title}</p>
          <p className={`mt-1 text-3xl font-semibold ${tone === "warn" ? "text-destructive" : ""}`}>{value}</p>
          {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
        </CardContent>
      </Card>
    </Link>
  );
}

const trend = (now: number, before: number | undefined, prevYear: string | undefined) =>
  before === undefined || prevYear === undefined ? undefined : `${prevYear}: ${before}${before ? ` (${now >= before ? "+" : ""}${now - before})` : ""}`;

export function OverviewView({ year, access, qs }: { year: string | null; access: Access; qs: (tab: string, extra?: Record<string, string>) => string }) {
  const { data: o, isLoading, error } = useFundingOverview(year);
  const { data: cases, isLoading: loadingCases } = useFundingCases(year, { attention: true });
  const { data: activity, isLoading: loadingActivity } = useFundingActivity(year, 10);
  const [filter, setFilter] = useState<string>(ALL);
  if (error) return <ErrorNote error={error} />;
  const queue = (cases ?? []).filter((c) => filter === ALL || c.attention.includes(filter));
  const total = Object.values(o?.distribution ?? {}).reduce((a, b) => a + b, 0);
  const unrecorded = o ? Math.max(o.trainees_total - o.tracked, 0) : 0;
  return (
    <div className="space-y-6">
      <section aria-label="Summary" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {isLoading || !o ? [0, 1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-28" />) : <>
          <StatCard title="Total trainees tracked" value={o.tracked} to={qs("register")} hint={<>{unrecorded > 0 ? `${unrecorded} enrolled trainees have no funding record yet. ` : ""}{trend(o.tracked, o.previous?.tracked, o.previous?.year)}</>} />
          <StatCard title="Funding applications pending" value={o.pending_applications} to={qs("applications")} hint="Awaiting documents, submission or an NSFAF decision" />
          <StatCard title="Records requiring attention" value={o.needs_attention} to={qs("register", { attention: "1" })} tone={o.needs_attention ? "warn" : undefined} hint="Incomplete documents, unverified registration or other open issues" />
          <StatCard title="Funding confirmed" value={o.confirmed} to={qs("awards")} hint={trend(o.confirmed, o.previous?.confirmed, o.previous?.year) ?? "Awards confirmed by NSFAF"} />
          <StatCard title="Payments awaiting reconciliation" value={o.awaiting_reconciliation} to={qs("reconciliation")} hint="With Finance, or with a discrepancy to resolve" />
          <StatCard title="Outstanding follow-ups" value={o.open_followups} to={qs("followups")} tone={o.overdue_followups ? "warn" : undefined} hint={o.overdue_followups ? `${o.overdue_followups} overdue` : "None overdue"} />
        </>}
      </section>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-1">
          <CardHeader><CardTitle className="text-base">Funding status</CardTitle><CardDescription>Where each tracked trainee stands. NSFAF decides awards; the VTC records them.</CardDescription></CardHeader>
          <CardContent>
            {isLoading ? <Loading /> : !total ? <EmptyState title="No funding records yet" description="Create a funding record for a trainee to start tracking their NSFAF funding." /> : (
              <ul className="space-y-3">
                {Object.entries(OVERALL_STATUS).map(([key]) => {
                  const n = o?.distribution[key] ?? 0;
                  return (
                    <li key={key}>
                      <Link to={qs("register", { overall: key })} className="block rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                        <div className="flex items-center justify-between text-sm"><span>{label(OVERALL_STATUS, key)}</span><span className="font-medium tabular-nums">{n}</span></div>
                        <div className="mt-1 h-2 overflow-hidden rounded bg-muted" role="img" aria-label={`${label(OVERALL_STATUS, key)}: ${n} of ${total}`}><div className="h-full bg-primary" style={{ width: `${(n / total) * 100}%` }} /></div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="xl:col-span-2">
          <CardHeader className="flex-row flex-wrap items-start justify-between gap-2 space-y-0">
            <div><CardTitle className="text-base">My action queue</CardTitle><CardDescription>Cases that need action, most urgent first.</CardDescription></div>
            <Select value={filter} onValueChange={setFilter}>
              <SelectTrigger className="w-full sm:w-64" aria-label="Filter by case type"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value={ALL}>All case types</SelectItem>{Object.entries(ATTENTION_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}</SelectContent>
            </Select>
          </CardHeader>
          <CardContent>
            {loadingCases ? <Loading /> : !queue.length ? <EmptyState icon={CheckCircle2} title="Nothing needs attention" description="Cases appear here when documents, registration, NSFAF responses, payments or follow-ups need action." /> : (
              <ul className="divide-y">
                {[...queue].sort((a, b) => Number(b.attention.includes("followup_overdue")) - Number(a.attention.includes("followup_overdue")) || a.updated_at.localeCompare(b.updated_at)).slice(0, 25).map((c) => {
                  const urgent = c.attention.includes("followup_overdue");
                  return (
                    <li key={c.id} className="flex flex-wrap items-start justify-between gap-3 py-3">
                      <div className="min-w-0 space-y-1">
                        <Link to={`/funding/${c.id}`} className="font-medium hover:underline">{c.trainee_name}</Link>
                        <span className="ml-2 text-xs text-muted-foreground">{c.trainee_number}</span>
                        <p className="text-xs text-muted-foreground">{c.programme ?? "No programme"}{c.intake ? ` · ${c.intake}` : ""} · Updated {formatDate(c.updated_at)} ({daysSince(c.updated_at)} d ago)</p>
                        <div className="flex flex-wrap gap-1">
                          {c.attention.map((a) => <Badge key={a} variant={a === "followup_overdue" ? "destructive" : "secondary"} className="font-normal">{ATTENTION_LABEL[a]?.label ?? a}</Badge>)}
                        </div>
                        <p className="text-sm">Next: {c.next_action || ATTENTION_LABEL[c.attention[0]]?.action}{c.follow_up_due ? <span className={isOverdue(c.follow_up_due) ? "text-destructive" : "text-muted-foreground"}> · due {formatDate(c.follow_up_due)}</span> : null}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {urgent && <AlertTriangle className="h-4 w-4 text-destructive" aria-label="Overdue" />}
                        <FundingBadge vocab={OVERALL_STATUS} value={c.overall_status} />
                        <CaseActions c={c} access={access} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0"><div><CardTitle className="text-base">Recent activity</CardTitle><CardDescription>Taken from the audit trail.</CardDescription></div>
          <Button asChild variant="outline" size="sm"><Link to={qs("audit")}>Full audit trail</Link></Button></CardHeader>
        <CardContent>{loadingActivity ? <Loading /> : <ActivityTable rows={activity ?? []} />}</CardContent>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Activity / audit trail
// ---------------------------------------------------------------------------
function ActivityTable({ rows }: { rows: { id: string; record_id: string; event_type: string; summary: string; created_at: string; actor: string | null; trainee_number?: string; trainee_name?: string }[] }) {
  if (!rows.length) return <EmptyState title="No activity yet" description="Changes to funding records are logged here as they happen." />;
  return (
    <Table>
      <TableHeader><TableRow><TableHead>When</TableHead><TableHead>Action</TableHead><TableHead>Trainee</TableHead><TableHead>By</TableHead></TableRow></TableHeader>
      <TableBody>
        {rows.map((e) => (
          <TableRow key={e.id}>
            <TableCell className="whitespace-nowrap">{formatDateTime(e.created_at)}</TableCell>
            <TableCell><span className="font-medium">{EVENT_LABEL[e.event_type] ?? e.event_type}</span><span className="block max-w-md truncate text-xs text-muted-foreground" title={e.summary}>{e.summary}</span></TableCell>
            <TableCell><Link to={`/funding/${e.record_id}`} className="hover:underline">{e.trainee_name}</Link><span className="block text-xs text-muted-foreground">{e.trainee_number}</span></TableCell>
            <TableCell>{e.actor ?? "System"}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
export function AuditView({ year }: { year: string | null }) {
  const { data, isLoading, error } = useFundingActivity(year, 200);
  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between space-y-0"><div><CardTitle className="text-base">Audit trail</CardTitle><CardDescription>Every significant change, with who made it and when. It cannot be edited or deleted.</CardDescription></div>
        <Button variant="outline" size="sm" disabled={!data?.length} onClick={() => downloadCsv(`funding-audit-${year ?? "all"}.csv`, (data ?? []).map((e) => ({ When: formatDateTime(e.created_at), Action: EVENT_LABEL[e.event_type] ?? e.event_type, Detail: e.summary, "Trainee number": e.trainee_number ?? "", By: e.actor ?? "System" })))}><Download className="mr-2 h-4 w-4" />Export</Button></CardHeader>
      <CardContent>{error ? <ErrorNote error={error} /> : isLoading ? <Loading /> : <ActivityTable rows={data ?? []} />}</CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Funding register (server-side search, filters, sorting and pagination)
// ---------------------------------------------------------------------------
type Sort = "trainee_number" | "trainee_name" | "programme" | "application_status" | "award_status" | "updated_at";
function FilterSelect({ value, onChange, placeholder, options }: { value: string | undefined; onChange: (v: string | undefined) => void; placeholder: string; options: [string, string][] }) {
  return (
    <Select value={value ?? ALL} onValueChange={(v) => onChange(v === ALL ? undefined : v)}>
      <SelectTrigger aria-label={placeholder} className="w-full"><SelectValue placeholder={placeholder} /></SelectTrigger>
      <SelectContent><SelectItem value={ALL}>{placeholder}</SelectItem>{options.map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
    </Select>
  );
}

export function RegisterView({ year, access, title, description, preset = {}, initial = {}, hideFilters = [] }: {
  year: string | null; access: Access; title: string; description: string; preset?: FundingFilters; initial?: FundingFilters; hideFilters?: (keyof FundingFilters)[];
}) {
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<FundingFilters>(initial);
  const [sort, setSort] = useState<Sort>("updated_at");
  const [dir, setDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const { data: options } = useFundingOptions(year);
  const merged = useMemo(() => ({ ...filters, ...preset }), [filters, preset]);
  const { data, isLoading, isFetching, error } = useFundingRegister({ year, search, filters: merged, sort, dir, page, pageSize });
  const [exporting, setExporting] = useState(false);
  const setFilter = (k: keyof FundingFilters) => (v: string | undefined) => { setFilters({ ...filters, [k]: v }); setPage(1); };
  const toggleSort = (s: Sort) => { if (sort === s) setDir(dir === "asc" ? "desc" : "asc"); else { setSort(s); setDir("asc"); } setPage(1); };
  const SortHead = ({ s, children }: { s: Sort; children: ReactNode }) => (
    <TableHead aria-sort={sort === s ? (dir === "asc" ? "ascending" : "descending") : "none"}>
      <button type="button" className="inline-flex items-center gap-1 font-medium hover:text-foreground" onClick={() => toggleSort(s)}>
        {children}{sort === s ? (dir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />) : <ArrowUpDown className="h-3 w-3 opacity-50" />}
      </button>
    </TableHead>
  );
  const show = (k: keyof FundingFilters) => !hideFilters.includes(k) && !(k in preset);
  const rows = data?.rows ?? [];
  const total = data?.total ?? 0;
  const active = Object.values(filters).some(Boolean) || !!search;
  const onExport = async () => { setExporting(true); try { exportCases("funding-register", await fetchAllFundingCases(year, merged), year); } catch (e) { toast.error((e as Error).message); } finally { setExporting(false); } };

  return (
    <Card>
      <CardHeader className="flex-row flex-wrap items-start justify-between gap-2 space-y-0">
        <div><CardTitle className="text-base">{title}</CardTitle><CardDescription>{description}</CardDescription></div>
        <Button variant="outline" size="sm" onClick={onExport} disabled={exporting || !total}><Download className="mr-2 h-4 w-4" />Export CSV</Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <div className="sm:col-span-2"><SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Search trainee number, name, programme, intake or NSFAF reference" /></div>
          {show("programme") && <FilterSelect value={filters.programme} onChange={setFilter("programme")} placeholder="All programmes" options={(options?.programmes ?? []).map((p) => [p, p])} />}
          {show("level") && <FilterSelect value={filters.level} onChange={setFilter("level")} placeholder="All levels" options={(options?.levels ?? []).map((l) => [String(l), `Level ${l}`])} />}
          {show("intake") && <FilterSelect value={filters.intake} onChange={setFilter("intake")} placeholder="All intakes" options={(options?.intakes ?? []).map((i) => [i, i])} />}
          {show("category") && <FilterSelect value={filters.category} onChange={setFilter("category")} placeholder="All funding categories" options={Object.entries(CATEGORY_LABEL)} />}
          {show("application_status") && <FilterSelect value={filters.application_status} onChange={setFilter("application_status")} placeholder="Any application status" options={Object.entries(APPLICATION_STATUS).map(([k, v]) => [k, v.label])} />}
          {show("award_status") && <FilterSelect value={filters.award_status} onChange={setFilter("award_status")} placeholder="Any award status" options={Object.entries(AWARD_STATUS).map(([k, v]) => [k, v.label])} />}
          {show("registration_status") && <FilterSelect value={filters.registration_status} onChange={setFilter("registration_status")} placeholder="Any registration status" options={Object.entries(REGISTRATION_STATUS).map(([k, v]) => [k, v.label])} />}
          {show("overall") && <FilterSelect value={filters.overall} onChange={setFilter("overall")} placeholder="Any funding position" options={Object.entries(OVERALL_STATUS).map(([k, v]) => [k, v.label])} />}
          {show("reason") && <FilterSelect value={filters.reason} onChange={setFilter("reason")} placeholder="Any attention reason" options={Object.entries(ATTENTION_LABEL).map(([k, v]) => [k, v.label])} />}
          {show("attention") && (
            <div className="flex items-center gap-2"><Checkbox id="att" checked={!!filters.attention} onCheckedChange={(c) => { setFilters({ ...filters, attention: c === true }); setPage(1); }} /><Label htmlFor="att">Requires attention only</Label></div>
          )}
        </div>
        {active && <Button variant="link" className="h-auto p-0" onClick={() => { setFilters(initial); setSearch(""); setPage(1); }}>Clear filters</Button>}

        {error ? <ErrorNote error={error} /> : isLoading ? <Loading /> : !rows.length ? (
          <EmptyState variant={active ? "search" : "default"} title={active ? "No records match these filters" : "No funding records yet"} description={active ? "Try removing a filter or searching for something else." : "Use “New funding record” to start tracking a trainee’s NSFAF funding."} />
        ) : (
          <div className={isFetching ? "opacity-70 transition-opacity" : ""}>
            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <SortHead s="trainee_number">Trainee no.</SortHead><SortHead s="trainee_name">Name</SortHead><SortHead s="programme">Programme</SortHead>
                    <TableHead>Intake</TableHead><TableHead>Category</TableHead><TableHead>NSFAF ref.</TableHead>
                    <SortHead s="application_status">Application</SortHead><SortHead s="award_status">Award</SortHead><TableHead>Registration</TableHead>
                    <SortHead s="updated_at">Updated</SortHead><TableHead>Next action</TableHead><TableHead className="w-10"><span className="sr-only">Actions</span></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{c.trainee_number}</TableCell>
                      <TableCell><Link to={`/funding/${c.id}`} className="hover:underline">{c.trainee_name}</Link></TableCell>
                      <TableCell>{c.programme ?? "—"}<span className="block text-xs text-muted-foreground">{c.level ? `Level ${c.level}` : ""}{c.qualification ? ` · ${c.qualification}` : ""}</span></TableCell>
                      <TableCell>{c.intake ?? "—"}<span className="block text-xs text-muted-foreground">{c.academic_year}</span></TableCell>
                      <TableCell>{CATEGORY_LABEL[c.funding_category] ?? c.funding_category}</TableCell>
                      <TableCell>{c.nsfaf_reference ?? "—"}</TableCell>
                      <TableCell><FundingBadge vocab={APPLICATION_STATUS} value={c.application_status} /></TableCell>
                      <TableCell><FundingBadge vocab={AWARD_STATUS} value={c.award_status} /></TableCell>
                      <TableCell><FundingBadge vocab={REGISTRATION_STATUS} value={c.registration_status} /></TableCell>
                      <TableCell>{formatDate(c.updated_at)}</TableCell>
                      <TableCell className="min-w-48 whitespace-normal">{c.next_action ?? (c.attention[0] ? ATTENTION_LABEL[c.attention[0]]?.action : "—")}{c.attention.length > 0 && <AlertTriangle className="ml-1 inline h-3 w-3 text-destructive" aria-label="Requires attention" />}</TableCell>
                      <TableCell><CaseActions c={c} access={access} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="grid gap-3 md:hidden">
              {rows.map((c) => (
                <RecordCard key={c.id} title={c.trainee_name} subtitle={`${c.trainee_number} · ${c.programme ?? "No programme"}`} status={<FundingBadge vocab={OVERALL_STATUS} value={c.overall_status} />}
                  fields={[
                    { label: "Intake / year", value: `${c.intake ?? "—"} · ${c.academic_year}` }, { label: "NSFAF reference", value: c.nsfaf_reference },
                    { label: "Award", value: <FundingBadge vocab={AWARD_STATUS} value={c.award_status} /> }, { label: "Registration", value: <FundingBadge vocab={REGISTRATION_STATUS} value={c.registration_status} /> },
                    { label: "Next action", value: c.next_action ?? (c.attention[0] ? ATTENTION_LABEL[c.attention[0]]?.action : "—") }, { label: "Updated", value: formatDate(c.updated_at) },
                  ]}
                  actions={<><Button asChild size="sm" variant="outline"><Link to={`/funding/${c.id}`}>View record</Link></Button><CaseActions c={c} access={access} /></>} />
              ))}
            </div>
            <DataTablePagination currentPage={page} totalPages={Math.max(1, Math.ceil(total / pageSize))} pageSize={pageSize} totalItems={total} onPageChange={setPage} onPageSizeChange={(s) => { setPageSize(s); setPage(1); }} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Funding payments and reconciliation
// ---------------------------------------------------------------------------
export function PaymentsView({ year, access, reconciliation }: { year: string | null; access: Access; reconciliation?: boolean }) {
  const [status, setStatus] = useState<string>(reconciliation ? ALL : ALL);
  const { data, isLoading, error } = useFundingPayments(year, status === ALL ? null : status);
  const send = useSendPaymentToFinance();
  const [reconcile, setReconcile] = useState<{ id: string; transaction_reference: string | null; amount: number } | null>(null);
  const rows = (data ?? []).filter((p) => !reconciliation || p.reconciliation_status !== "reconciled" || status === "reconciled");
  const totals = rows.reduce((t, p) => t + Number(p.amount), 0);
  return (
    <Card>
      <CardHeader className="flex-row flex-wrap items-start justify-between gap-2 space-y-0">
        <div>
          <CardTitle className="text-base">{reconciliation ? "Reconciliation and payment follow-ups" : "Funding payments"}</CardTitle>
          <CardDescription>NSFAF funding is recorded as received and agreed with Finance. It is never treated as a debt owed to the VTC. Record payments from a trainee’s record once an award is confirmed.</CardDescription>
        </div>
        <div className="flex gap-2">
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-56" aria-label="Filter by reconciliation status"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value={ALL}>{reconciliation ? "All open items" : "All payments"}</SelectItem>{Object.entries(PAYMENT_STATUS).filter(([k]) => !["not_applicable", "awaiting_payment_info"].includes(k)).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}</SelectContent>
          </Select>
          <Button variant="outline" size="sm" disabled={!rows.length} onClick={() => downloadCsv(`funding-payments-${year ?? "all"}.csv`, rows.map((p) => ({
            "Trainee number": p.trainee_number ?? "", Trainee: p.trainee_name ?? "", Category: CATEGORY_LABEL[p.funding_category ?? ""] ?? "", Period: p.funding_period ?? "", "Expected (N$)": p.expected_amount ?? "", "Amount (N$)": p.amount,
            Date: p.payment_date, Reference: p.transaction_reference ?? "", Recipient: RECIPIENT_LABEL[p.recipient] ?? p.recipient, Status: label(PAYMENT_STATUS, p.reconciliation_status), "Finance note": p.finance_note ?? "" })))}>
            <Download className="mr-2 h-4 w-4" />Export CSV</Button>
        </div>
      </CardHeader>
      <CardContent>
        {error ? <ErrorNote error={error} /> : isLoading ? <Loading /> : !rows.length ? (
          <EmptyState title={reconciliation ? "Nothing waiting for reconciliation" : "No payments recorded"} description="Payments appear here once they are recorded against a confirmed NSFAF award." />
        ) : (<>
          <p className="mb-2 text-sm text-muted-foreground">{rows.length} payment{rows.length === 1 ? "" : "s"} · {money(totals)}</p>
          <Table>
            <TableHeader><TableRow><TableHead>Trainee</TableHead><TableHead>Category / period</TableHead><TableHead className="text-right">Expected</TableHead><TableHead className="text-right">Amount</TableHead><TableHead>Date / reference</TableHead><TableHead>Recipient</TableHead><TableHead>Status</TableHead><TableHead>Finance notes</TableHead><TableHead><span className="sr-only">Actions</span></TableHead></TableRow></TableHeader>
            <TableBody>
              {rows.map((p) => (
                <TableRow key={p.id}>
                  <TableCell><Link to={`/funding/${p.record_id}`} className="font-medium hover:underline">{p.trainee_name}</Link><span className="block text-xs text-muted-foreground">{p.trainee_number}</span></TableCell>
                  <TableCell>{CATEGORY_LABEL[p.funding_category ?? ""] ?? "—"}<span className="block text-xs text-muted-foreground">{p.funding_period ?? p.academic_year}</span></TableCell>
                  <TableCell className="text-right">{p.expected_amount != null ? money(p.expected_amount) : "—"}</TableCell>
                  <TableCell className="text-right font-medium">{money(p.amount)}{p.expected_amount != null && Number(p.expected_amount) !== Number(p.amount) && <span className="block text-xs text-destructive">Differs from expected</span>}</TableCell>
                  <TableCell>{formatDate(p.payment_date)}<span className="block text-xs text-muted-foreground">{p.transaction_reference}</span></TableCell>
                  <TableCell>{RECIPIENT_LABEL[p.recipient] ?? p.recipient}{p.recipient_note && <span className="block text-xs text-muted-foreground">{p.recipient_note}</span>}</TableCell>
                  <TableCell><FundingBadge vocab={PAYMENT_STATUS} value={p.reconciliation_status} /></TableCell>
                  <TableCell className="min-w-40 whitespace-normal text-sm">{p.finance_note ?? "—"}</TableCell>
                  <TableCell className="space-x-1 whitespace-nowrap">
                    {access.canEdit && ["payment_recorded", "discrepancy", "follow_up"].includes(p.reconciliation_status) && <Button size="sm" variant="outline" disabled={send.isPending} onClick={() => send.mutate(p.id)}>Send to Finance</Button>}
                    {access.canReconcile && p.reconciliation_status === "pending_finance" && <Button size="sm" onClick={() => setReconcile({ id: p.id, transaction_reference: p.transaction_reference, amount: p.amount })}>Verify</Button>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </>)}
      </CardContent>
      {reconcile && <ReconcileDialog payment={reconcile} onClose={() => setReconcile(null)} />}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Follow-ups, correspondence, enquiries and appeals
// ---------------------------------------------------------------------------
export function FollowupsView({ year, access, kinds, title, description }: { year: string | null; access: Access; kinds?: string[]; title: string; description: string }) {
  const [status, setStatus] = useState("open");
  const { data, isLoading, error } = useFundingFollowups(year, status === ALL ? null : status, null);
  const [resolve, setResolve] = useState<{ id: string; description: string } | null>(null);
  const rows = (data ?? []).filter((f) => !kinds || kinds.includes(f.kind));
  return (
    <Card>
      <CardHeader className="flex-row flex-wrap items-start justify-between gap-2 space-y-0">
        <div><CardTitle className="text-base">{title}</CardTitle><CardDescription>{description}</CardDescription></div>
        <Select value={status} onValueChange={setStatus}><SelectTrigger className="w-40" aria-label="Status"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="open">Open</SelectItem><SelectItem value="resolved">Resolved</SelectItem><SelectItem value={ALL}>All</SelectItem></SelectContent></Select>
      </CardHeader>
      <CardContent>
        {error ? <ErrorNote error={error} /> : isLoading ? <Loading /> : !rows.length ? <EmptyState icon={CheckCircle2} title="Nothing here" description="Add follow-ups, enquiries and appeals from a trainee’s record." /> : (
          <Table>
            <TableHeader><TableRow><TableHead>Trainee</TableHead><TableHead>Type</TableHead><TableHead>Details</TableHead><TableHead>Due</TableHead><TableHead>Assigned</TableHead><TableHead><span className="sr-only">Actions</span></TableHead></TableRow></TableHeader>
            <TableBody>
              {rows.map((f) => (
                <TableRow key={f.id}>
                  <TableCell><Link to={`/funding/${f.record_id}`} className="font-medium hover:underline">{f.trainee_name}</Link><span className="block text-xs text-muted-foreground">{f.trainee_number}</span></TableCell>
                  <TableCell>{FOLLOWUP_KIND_LABEL[f.kind] ?? f.kind}</TableCell>
                  <TableCell className="min-w-56 whitespace-normal">{f.description}{f.resolution_note && <span className="block text-xs text-muted-foreground">Resolved: {f.resolution_note}</span>}</TableCell>
                  <TableCell className={f.status === "open" && isOverdue(f.due_date) ? "font-medium text-destructive" : ""}>{formatDate(f.due_date)}{f.status === "open" && isOverdue(f.due_date) && <span className="block text-xs">Overdue</span>}</TableCell>
                  <TableCell>{f.assigned_name ?? "—"}</TableCell>
                  <TableCell>{access.canEdit && f.status === "open" && <Button size="sm" variant="outline" onClick={() => setResolve({ id: f.id, description: f.description })}>Mark resolved</Button>}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
      {resolve && <ResolveDialog followup={resolve} onClose={() => setResolve(null)} />}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Reports
// ---------------------------------------------------------------------------
const REPORTS: { key: string; title: string; description: string; filters: FundingFilters }[] = [
  { key: "all", title: "Trainees by funding status", description: "Every tracked trainee with application, award, registration and payment status.", filters: {} },
  { key: "pending", title: "Applications submitted and pending", description: "Applications still awaiting an NSFAF decision or information.", filters: { overall: "pending_decision" } },
  { key: "docs", title: "Missing or incomplete documentation", description: "Records with required documents not yet verified.", filters: { reason: "documents_missing" } },
  { key: "awards", title: "Awards recorded", description: "Awards confirmed by NSFAF for the selected year.", filters: { award_status: "confirmed" } },
  { key: "awaiting", title: "Payments awaiting reconciliation", description: "Awards whose payments are with Finance, disputed or missing.", filters: { reason: "payment_awaiting_reconciliation" } },
  { key: "reconciled", title: "Reconciled funding transactions", description: "Awards whose payments Finance has reconciled.", filters: { payment_status: "reconciled" } },
  { key: "followups", title: "Outstanding follow-ups", description: "Records with overdue follow-ups.", filters: { overdue: true } },
  { key: "management", title: "Cases requiring management intervention", description: "Overdue follow-ups, payment discrepancies and progression discrepancies.", filters: { attention: true } },
];
export function ReportsView({ year }: { year: string | null }) {
  const [key, setKey] = useState("all");
  const report = REPORTS.find((r) => r.key === key)!;
  const { data, isLoading, error } = useFundingCases(year, report.filters);
  const { data: coverage, isLoading: loadingCoverage } = useFundingCoverage(year);
  const rows = (data ?? []).filter((c) => key !== "management" || c.attention.some((a) => ["followup_overdue", "payment_awaiting_reconciliation", "progression_discrepancy"].includes(a)))
    .filter((c) => key !== "pending" || ["submitted", "pending_decision", "more_information", "in_progress"].includes(c.application_status))
    .filter((c) => key !== "awaiting" || c.award_status === "confirmed");
  const totals = coverage?.reduce((t, r) => ({ trainees: t.trainees + r.trainees, funded: t.funded + r.funded, with_record: t.with_record + r.with_record, no_record: t.no_record + r.no_record }), { trainees: 0, funded: 0, with_record: 0, no_record: 0 });
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex-row flex-wrap items-start justify-between gap-2 space-y-0">
          <div><CardTitle className="text-base">Funding reports</CardTitle><CardDescription>Built from the records you can access. Exports carry the date they were generated.</CardDescription></div>
          <div className="flex gap-2">
            <Select value={key} onValueChange={setKey}><SelectTrigger className="w-64" aria-label="Report"><SelectValue /></SelectTrigger>
              <SelectContent>{REPORTS.map((r) => <SelectItem key={r.key} value={r.key}>{r.title}</SelectItem>)}</SelectContent></Select>
            <Button variant="outline" size="sm" disabled={!rows.length} onClick={() => exportCases(`funding-report-${report.key}`, rows, year)}><Download className="mr-2 h-4 w-4" />Export CSV</Button>
          </div>
        </CardHeader>
        <CardContent>
          <p className="mb-3 text-sm text-muted-foreground">{report.description} · {rows.length} record{rows.length === 1 ? "" : "s"} · Generated {formatDateTime(new Date().toISOString())}</p>
          {error ? <ErrorNote error={error} /> : isLoading ? <Loading /> : !rows.length ? <EmptyState title="No records for this report" description="Nothing matches this report for the selected academic year." /> : (
            <Table>
              <TableHeader><TableRow><TableHead>Trainee</TableHead><TableHead>Programme / intake</TableHead><TableHead>Application</TableHead><TableHead>Award</TableHead><TableHead>Registration</TableHead><TableHead>Payment</TableHead><TableHead>Open issues</TableHead></TableRow></TableHeader>
              <TableBody>
                {rows.slice(0, 200).map((c) => (
                  <TableRow key={c.id}>
                    <TableCell><Link to={`/funding/${c.id}`} className="font-medium hover:underline">{c.trainee_name}</Link><span className="block text-xs text-muted-foreground">{c.trainee_number}</span></TableCell>
                    <TableCell>{c.programme ?? "—"}<span className="block text-xs text-muted-foreground">{c.intake ?? ""}</span></TableCell>
                    <TableCell><FundingBadge vocab={APPLICATION_STATUS} value={c.application_status} /></TableCell>
                    <TableCell><FundingBadge vocab={AWARD_STATUS} value={c.award_status} /></TableCell>
                    <TableCell><FundingBadge vocab={REGISTRATION_STATUS} value={c.registration_status} /></TableCell>
                    <TableCell><FundingBadge vocab={PAYMENT_STATUS} value={c.payment_status} /></TableCell>
                    <TableCell className="min-w-48 whitespace-normal text-xs">{c.attention.map((a) => ATTENTION_LABEL[a]?.label ?? a).join(", ") || "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          {rows.length > 200 && <p className="mt-2 text-xs text-muted-foreground">Showing the first 200 of {rows.length}. Export for the full list.</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row flex-wrap items-start justify-between gap-2 space-y-0">
          <div><CardTitle className="text-base">Trainee funding coverage</CardTitle><CardDescription>Funded versus unrecorded by programme and level. Trainees without a funding record are shown as “no record”, not as unfunded.</CardDescription></div>
          <Button variant="outline" size="sm" disabled={!coverage?.length} onClick={() => downloadCsv(`funding-coverage-${year ?? "all"}.csv`, (coverage ?? []).map((r) => ({ Programme: r.programme ?? "", Level: r.level, Trainees: r.trainees, "With funding record": r.with_record, "Award confirmed": r.funded, "No record": r.no_record })))}><Download className="mr-2 h-4 w-4" />Export CSV</Button>
        </CardHeader>
        <CardContent>
          {loadingCoverage ? <Loading /> : !coverage?.length ? <EmptyState title="No trainees for this year" /> : (
            <Table>
              <TableHeader><TableRow><TableHead>Programme</TableHead><TableHead>Level</TableHead><TableHead className="text-right">Trainees</TableHead><TableHead className="text-right">Award confirmed</TableHead><TableHead className="text-right">With record</TableHead><TableHead className="text-right">No record</TableHead><TableHead className="w-40">Coverage</TableHead></TableRow></TableHeader>
              <TableBody>
                {coverage.map((r, i) => (
                  <TableRow key={i}>
                    <TableCell>{r.programme ?? "—"}</TableCell><TableCell>{r.level}</TableCell><TableCell className="text-right">{r.trainees}</TableCell>
                    <TableCell className="text-right">{r.funded}</TableCell><TableCell className="text-right">{r.with_record}</TableCell><TableCell className="text-right">{r.no_record}</TableCell>
                    <TableCell><div className="h-2 overflow-hidden rounded bg-muted" role="img" aria-label={`${r.funded} of ${r.trainees} trainees have a confirmed award`}><div className="h-full bg-primary" style={{ width: `${r.trainees ? (r.funded / r.trainees) * 100 : 0}%` }} /></div></TableCell>
                  </TableRow>
                ))}
                {totals && <TableRow className="font-medium"><TableCell colSpan={2}>Total</TableCell><TableCell className="text-right">{totals.trainees}</TableCell><TableCell className="text-right">{totals.funded}</TableCell><TableCell className="text-right">{totals.with_record}</TableCell><TableCell className="text-right">{totals.no_record}</TableCell><TableCell /></TableRow>}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
