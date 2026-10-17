import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Plus, Search } from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useUserRole } from "@/hooks/useUserRole";
import { useRoleNavigation } from "@/hooks/useRoleNavigation";
import { useFundingOptions, useFundingSearch } from "@/hooks/useFunding";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { withRoleAccess } from "@/components/withRoleAccess";
import { Access, AuditView, FollowupsView, OverviewView, PaymentsView, RegisterView, ReportsView } from "@/components/funding/FundingViews";
import { NewRecordDialog } from "@/components/funding/FundingDialogs";

const ALL_YEARS = "__all";
const TITLES: Record<string, string> = {
  overview: "NSFAF Funding Dashboard", register: "Trainee Funding Register", applications: "Funding Applications", documents: "Document Verification", awards: "Funding Awards and Agreements",
  progression: "Registration and Academic Progression", payments: "Funding Payments", reconciliation: "Reconciliation and Payment Follow-ups", correspondence: "NSFAF Correspondence",
  enquiries: "Trainee Enquiries", appeals: "Appeals and Exceptional Cases", followups: "Notifications and Follow-ups", reports: "Funding Reports", audit: "Audit Trail",
};

/** Finds a trainee from anywhere on the dashboard by trainee number, name, programme, intake or NSFAF reference. */
function GlobalSearch({ year }: { year: string | null }) {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const { data, isFetching } = useFundingSearch(q, year);
  return (
    <Popover open={open && q.trim().length >= 2} onOpenChange={setOpen}>
      <PopoverAnchor asChild>
        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input aria-label="Search trainees" className="pl-8" value={q} placeholder="Search trainee, number or NSFAF ref." onChange={(e) => { setQ(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)} />
        </div>
      </PopoverAnchor>
      <PopoverContent className="w-[min(24rem,90vw)] p-1" align="start" onOpenAutoFocus={(e) => e.preventDefault()}>
        {isFetching ? <p className="p-3 text-sm text-muted-foreground">Searching…</p> : !data?.length ? <p className="p-3 text-sm text-muted-foreground">No trainees found.</p> : data.map((m) => (
          <button key={m.trainee_uuid} type="button" className="flex w-full flex-col rounded px-3 py-2 text-left text-sm hover:bg-muted"
            onClick={() => { setOpen(false); setQ(""); navigate(m.record_id ? `/funding/${m.record_id}` : `/loan-officer-dashboard?tab=register&new=${encodeURIComponent(m.trainee_number)}`); }}>
            <span className="font-medium">{m.trainee_name}</span>
            <span className="text-xs text-muted-foreground">{m.trainee_number} · {m.programme ?? "No programme"} · {m.record_id ? (m.nsfaf_reference ?? "Funding record") : "No funding record yet"}</span>
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}

function LoanOfficerDashboard() {
  const navigate = useNavigate();
  const { role } = useUserRole();
  const { navItems, groupLabel } = useRoleNavigation();
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") && TITLES[params.get("tab")!] ? params.get("tab")! : "overview";
  const yearParam = params.get("year");
  const { data: options } = useFundingOptions(null);
  // default to the most recent academic year that has trainees
  const year = yearParam === ALL_YEARS ? null : yearParam ?? options?.years?.[0] ?? null;
  const [newOpen, setNewOpen] = useState(false);
  useEffect(() => { if (params.get("new")) setNewOpen(true); }, [params]);

  const access: Access = useMemo(() => ({
    canEdit: role === "loan_officer",
    canReconcile: role === "accountant" || role === "head_of_finance_admin" || role === "debtor_officer",
  }), [role]);
  const qs = (t: string, extra: Record<string, string> = {}) => {
    const p = new URLSearchParams({ tab: t, ...(yearParam ? { year: yearParam } : {}), ...extra });
    return `/loan-officer-dashboard?${p.toString()}`;
  };
  const setYear = (v: string) => { const next = new URLSearchParams(params); next.set("year", v); setParams(next); };
  // filters carried over from the cards (e.g. attention, overall status) seed the register
  const initial = useMemo(() => ({
    ...(params.get("attention") ? { attention: true } : {}),
    ...(params.get("overall") ? { overall: params.get("overall")! } : {}),
  }), [params]);

  return (
    <DashboardLayout navItems={navItems} groupLabel={groupLabel} title={TITLES[tab]} subtitle="Administer NSFAF student funding for trainees. The VTC records NSFAF decisions; it does not approve funding or issue loans.">
      <div className="space-y-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground">
            <Link to={qs("overview")} className="hover:underline">NSFAF Funding</Link>{tab !== "overview" && <> <span aria-hidden>/</span> <span className="text-foreground">{TITLES[tab]}</span></>}
          </nav>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <GlobalSearch year={year} />
            <Select value={year ?? ALL_YEARS} onValueChange={setYear}>
              <SelectTrigger className="w-full sm:w-40" aria-label="Academic year"><SelectValue placeholder="Academic year" /></SelectTrigger>
              <SelectContent><SelectItem value={ALL_YEARS}>All years</SelectItem>{(options?.years ?? []).map((y) => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent>
            </Select>
            {access.canEdit ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild><Button><Plus className="mr-2 h-4 w-4" />Quick action</Button></DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onSelect={() => setNewOpen(true)}>New funding record</DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => navigate(qs("documents"))}>Verify documents</DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => navigate(qs("followups"))}>Review follow-ups</DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => navigate(qs("reports"))}>Open reports</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : <Button variant="outline" onClick={() => navigate(qs("reports"))}>Reports</Button>}
          </div>
        </div>

        {!access.canEdit && (
          <Alert><AlertDescription>You have read access to NSFAF funding records. Only the Loan Officer changes them{access.canReconcile ? "; you can verify payments sent to Finance" : ""}.</AlertDescription></Alert>
        )}

        {tab === "overview" && <OverviewView year={year} access={access} qs={qs} />}
        {tab === "register" && <RegisterView key={`r-${params.toString()}`} year={year} access={access} title="Trainee funding register" description="Search and filter every trainee’s NSFAF funding record. Application, award, registration and payment status are tracked separately." initial={initial} />}
        {tab === "applications" && <RegisterView year={year} access={access} title="Funding applications" description="Applications that are being prepared, submitted or waiting on NSFAF." hideFilters={["award_status", "registration_status", "overall", "reason"]} />}
        {tab === "documents" && <RegisterView year={year} access={access} title="Document verification" description="Records with required documents not yet verified. Open a record to review and verify each document." preset={{ reason: "documents_missing" }} />}
        {tab === "awards" && <RegisterView year={year} access={access} title="Funding awards and agreements" description="Awards confirmed by NSFAF. Records flagged for attention are missing the award letter or agreement." preset={{ award_status: "confirmed" }} />}
        {tab === "progression" && <RegisterView year={year} access={access} title="Registration and academic progression" description="Trainees whose registration for the year is not yet verified, or has a discrepancy." preset={{ reason: "registration_not_verified" }} />}
        {tab === "payments" && <PaymentsView year={year} access={access} />}
        {tab === "reconciliation" && <PaymentsView year={year} access={access} reconciliation />}
        {tab === "correspondence" && <FollowupsView year={year} access={access} kinds={["nsfaf_followup", "document_chase", "discrepancy", "other"]} title="NSFAF correspondence and follow-ups" description="Follow-ups with NSFAF and on missing paperwork. Log letters and emails from a trainee’s record." />}
        {tab === "enquiries" && <FollowupsView year={year} access={access} kinds={["enquiry"]} title="Trainee enquiries" description="Questions from trainees about their funding that need an answer." />}
        {tab === "appeals" && <FollowupsView year={year} access={access} kinds={["appeal"]} title="Appeals and exceptional cases" description="Cases being taken up with NSFAF outside the normal process." />}
        {tab === "followups" && <FollowupsView year={year} access={access} title="Notifications and follow-ups" description="Everything with a due date, soonest first. Overdue items are marked." />}
        {tab === "reports" && <ReportsView year={year} />}
        {tab === "audit" && <AuditView year={year} />}
      </div>
      <NewRecordDialog key={params.get("new") ?? "none"} open={newOpen} year={year} initialQuery={params.get("new") ?? ""} onClose={() => { setNewOpen(false); if (params.get("new")) { const n = new URLSearchParams(params); n.delete("new"); setParams(n, { replace: true }); } }} onCreated={(id) => navigate(`/funding/${id}`)} />
    </DashboardLayout>
  );
}

export default withRoleAccess(LoanOfficerDashboard, { requiredRoles: ["loan_officer", "accountant", "head_of_finance_admin", "debtor_officer", "centre_manager", "organization_admin", "admin"] });
