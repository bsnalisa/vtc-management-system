import { useNavigate } from "react-router-dom";
import { AlertTriangle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useCentreExecutive } from "@/hooks/useCentreOffice";
import { getRoleDisplayName } from "@/lib/roleUtils";

const pct = (n: number | null | undefined) => (n == null ? "–" : `${n}%`);
const KPI_LABEL: Record<string, string> = {
  collection_rate: "Fees collected", unreconciled_bank_lines: "Bank lines to match", nsfaf_payments_awaiting_reconciliation: "NSFAF payments awaiting reconciliation",
  attendance_rate: "Attendance (30 days)", results_awaiting_approval: "Results awaiting approval", open_assessment_cycles: "Open assessment cycles",
  applications_this_month: "Applications this month", open_tickets: "Open support tickets", deferrals_pending: "Deferrals waiting",
};
const kpiValue = (k: string, v: number | null) => (k.endsWith("_rate") ? pct(v) : v ?? "–");

/** Escalated approvals and department workload for the Centre Manager. Read-only: decisions are made in My Approvals. */
export function CentreExecutive() {
  const navigate = useNavigate();
  const { data: e, isLoading, error } = useCentreExecutive();
  if (error) return <Alert variant="destructive"><AlertDescription>Executive figures could not be loaded: {(error as Error).message}</AlertDescription></Alert>;
  if (isLoading || !e) return <Skeleton className="h-64" aria-busy="true" />;
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex-row flex-wrap items-start justify-between gap-2 space-y-0">
          <div><CardTitle>Escalated approvals</CardTitle><CardDescription>Requests marked escalated, or with a step more than two days overdue. Oldest first.</CardDescription></div>
          <Button variant="outline" size="sm" onClick={() => navigate("/my-approvals")}>Open My Approvals</Button>
        </CardHeader>
        <CardContent>
          {!e.escalated.length ? <p className="text-sm text-muted-foreground">Nothing is escalated or badly overdue.</p> : (
            <Table>
              <TableHeader><TableRow><TableHead>Reference</TableHead><TableHead>Request</TableHead><TableHead>Raised by</TableHead><TableHead>Next action</TableHead><TableHead className="text-right">Open for</TableHead></TableRow></TableHeader>
              <TableBody>
                {e.escalated.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.reference ?? "—"}</TableCell>
                    <TableCell className="min-w-48 whitespace-normal">{r.title}<span className="block text-xs capitalize text-muted-foreground">{r.process_type.replace(/_/g, " ")}</span></TableCell>
                    <TableCell>{r.submitter_role ? getRoleDisplayName(r.submitter_role as never) : "—"}</TableCell>
                    <TableCell className="min-w-48 whitespace-normal text-sm">{r.next_action ?? "—"}</TableCell>
                    <TableCell className="text-right">{r.days_open >= 7 ? <Badge variant="destructive"><AlertTriangle className="mr-1 h-3 w-3" />{r.days_open} d</Badge> : <Badge variant="secondary">{r.days_open} d</Badge>}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Departments</CardTitle><CardDescription>Approval workload over the last 30 days and the main indicators for each department.</CardDescription></CardHeader>
        <CardContent>
          <div className="grid gap-4 lg:grid-cols-2">
            {e.departments.map((d) => (
              <div key={d.code} className="space-y-3 rounded-lg border p-4">
                <div className="flex items-center justify-between gap-2"><h3 className="font-semibold">{d.name}</h3><span className="text-xs text-muted-foreground">{d.staff} staff</span></div>
                <dl className="grid grid-cols-3 gap-2 text-center text-sm">
                  <div><dd className="text-xl font-semibold">{d.pending}</dd><dt className="text-xs text-muted-foreground">In progress</dt></div>
                  <div><dd className={`text-xl font-semibold ${d.overdue ? "text-destructive" : ""}`}>{d.overdue}</dd><dt className="text-xs text-muted-foreground">Overdue</dt></div>
                  <div><dd className={`text-xl font-semibold ${d.escalated ? "text-destructive" : ""}`}>{d.escalated}</dd><dt className="text-xs text-muted-foreground">Escalated</dt></div>
                </dl>
                <p className="text-xs text-muted-foreground">{d.approved_30d} approved · {d.rejected_30d} rejected · {d.avg_days_to_decide != null ? `${d.avg_days_to_decide} days average to decide` : "no decisions yet"}</p>
                {Object.keys(d.kpis).length > 0 && (
                  <ul className="space-y-1 border-t pt-2 text-sm">
                    {Object.entries(d.kpis).map(([k, v]) => <li key={k} className="flex justify-between gap-2"><span className="text-muted-foreground">{KPI_LABEL[k] ?? k}</span><span className="font-medium">{kpiValue(k, v)}</span></li>)}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row flex-wrap items-start justify-between gap-2 space-y-0">
          <div><CardTitle>Your office</CardTitle><CardDescription>From the PA’s registers</CardDescription></div>
          <Button variant="outline" size="sm" onClick={() => navigate("/pa-dashboard")}>Open the office registers</Button>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-5">
          <div><p className="text-muted-foreground">Open letters</p><p className="text-lg font-semibold">{e.office.correspondence_open}</p></div>
          <div><p className="text-muted-foreground">Overdue replies</p><p className={`text-lg font-semibold ${e.office.correspondence_overdue ? "text-destructive" : ""}`}>{e.office.correspondence_overdue}</p></div>
          <div><p className="text-muted-foreground">Meetings, 7 days</p><p className="text-lg font-semibold">{e.office.meetings_next_7_days}</p></div>
          <div><p className="text-muted-foreground">Open tasks</p><p className="text-lg font-semibold">{e.office.tasks_open}</p></div>
          <div><p className="text-muted-foreground">Overdue tasks</p><p className={`text-lg font-semibold ${e.office.tasks_overdue ? "text-destructive" : ""}`}>{e.office.tasks_overdue}</p></div>
        </CardContent>
      </Card>
    </div>
  );
}
