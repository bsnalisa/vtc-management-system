import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useCentreTargets, useCmFinance, useCmQuality, useCmStaffing, useCmStakeholders } from "@/hooks/useCentreManagerPanels";
import { TargetNote } from "./TargetNote";

const money = (n: number | null | undefined) => `N$ ${Math.round(Number(n ?? 0)).toLocaleString("en-ZA")}`;
const pct = (n: number | null | undefined) => (n == null ? "–" : `${n}%`);
const label = (v: string) => v.replace(/_/g, " ");
const day = (d: string | null) => (d ? new Date(d).toLocaleDateString(undefined, { dateStyle: "medium" }) : "no date");

function Wait({ error, loading, children }: { error: unknown; loading: boolean; children: React.ReactNode }) {
  if (error) return <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertDescription>{(error as Error).message}</AlertDescription></Alert>;
  if (loading) return <Skeleton className="h-64" aria-busy="true" />;
  return <>{children}</>;
}
const Row = ({ k, v, note }: { k: string; v: React.ReactNode; note?: React.ReactNode }) => (
  <div className="flex items-center justify-between gap-3 border-b py-2 text-sm last:border-0"><span className="text-muted-foreground">{k}</span><span className="flex items-center gap-2 font-medium">{v}{note}</span></div>
);
const Empty = ({ text }: { text: string }) => <p className="text-sm text-muted-foreground">{text}</p>;

export function FinancePanel({ active }: { active: boolean }) {
  const navigate = useNavigate();
  const [year, setYear] = useState<string | null>(null);
  const { data: f, isLoading, error } = useCmFinance(year, active);
  const { data: targets } = useCentreTargets(active);
  return (
    <Wait error={error} loading={isLoading || !f}>
      {f && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <label htmlFor="cm-year" className="text-muted-foreground">Academic year</label>
            <select id="cm-year" className="h-9 rounded-md border border-input bg-background px-2" value={f.year ?? ""} onChange={(e) => setYear(e.target.value)}>
              {f.years.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader><CardTitle>Fees</CardTitle><CardDescription>Billed against collected for {f.year ?? "the year"}</CardDescription></CardHeader>
              <CardContent className="space-y-3">
                <Progress value={f.fees.collection_rate ?? 0} />
                <Row k="Collected" v={`${money(f.fees.collected)} of ${money(f.fees.billed)}`} note={<TargetNote indicator="collection_rate" value={f.fees.collection_rate} targets={targets} />} />
                <Row k="Collection rate" v={pct(f.fees.collection_rate)} />
                <Row k="Outstanding" v={money(f.fees.outstanding)} /><Row k="Trainees owing" v={f.fees.debtors} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Budget against spend</CardTitle><CardDescription>Departmental budgets for {f.year ?? "the year"}; "committed" is the value of orders placed</CardDescription></CardHeader>
              <CardContent>
                {f.budgets.length === 0 ? <Empty text="No budget has been entered for this year. The Head of Finance and Administration records departmental budgets." /> : (
                  <div className="space-y-3">{f.budgets.map((b) => (
                    <div key={b.department}>
                      <div className="mb-1 flex flex-wrap items-center justify-between gap-2 text-sm"><span className="font-medium">{b.department}</span><span>{money(b.spent)} of {money(b.total)} <TargetNote indicator="budget_utilisation" value={b.utilisation} targets={targets} /></span></div>
                      <Progress value={Math.min(100, b.utilisation ?? 0)} />
                      <p className="mt-1 text-xs text-muted-foreground">{money(b.remaining)} remaining · {money(b.committed)} committed in orders</p>
                    </div>
                  ))}</div>
                )}
              </CardContent>
            </Card>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader><CardTitle>NSFAF funding</CardTitle><CardDescription>Awards and payments recorded for {f.year ?? "the year"} (administered by the Loan Officer)</CardDescription></CardHeader>
              <CardContent>
                <Row k="Funding cases" v={f.funding.cases} /><Row k="Awarded" v={money(f.funding.awarded)} /><Row k="Payments received" v={money(f.funding.received)} />
                <Row k="Payments awaiting reconciliation" v={<Badge variant={f.funding.payments_awaiting_reconciliation ? "destructive" : "secondary"}>{f.funding.payments_awaiting_reconciliation}</Badge>} />
                {f.funding.by_award_status.map((s) => <Row key={s.status} k={label(s.status)} v={s.count} />)}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex-row flex-wrap items-start justify-between gap-2 space-y-0"><div><CardTitle>Requisitions and spending</CardTitle><CardDescription>From the approval process to delivery</CardDescription></div>
                <Button variant="outline" size="sm" onClick={() => navigate("/requisitions?tab=centre")}>All requisitions</Button></CardHeader>
              <CardContent>
                <Row k="Waiting for a decision" v={f.requisitions.awaiting_decision} note={f.requisitions.awaiting_my_decision > 0 ? <Badge variant="destructive">{f.requisitions.awaiting_my_decision} for you</Badge> : undefined} />
                <Row k="Approved, awaiting procurement" v={f.requisitions.approved_awaiting_procurement} /><Row k="On order" v={f.requisitions.on_order} />
                <Row k="Overdue deliveries" v={<Badge variant={f.requisitions.overdue_deliveries ? "destructive" : "secondary"}>{f.requisitions.overdue_deliveries}</Badge>} />
                <Row k="Closed in the last 30 days" v={f.requisitions.closed_last_30_days} />
                <Row k={`Ordered value in ${f.year ?? "the year"}`} v={money(f.requisitions.ordered_value)} />
                {f.requisitions.orders_without_value > 0 && <p className="mt-2 text-xs text-muted-foreground">{f.requisitions.orders_without_value} order(s) have no value recorded yet, so spending is understated.</p>}
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </Wait>
  );
}

export function QualityPanel({ active }: { active: boolean }) {
  const { data: q, isLoading, error } = useCmQuality(active);
  const { data: targets } = useCentreTargets(active);
  return (
    <Wait error={error} loading={isLoading || !q}>
      {q && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader><CardTitle>Qualifications and standards</CardTitle><CardDescription>Approval status of the qualifications the centre delivers</CardDescription></CardHeader>
            <CardContent>
              <Row k="Approved and active" v={q.qualifications.approved} /><Row k="Waiting for approval" v={q.qualifications.pending_approval} />
              <Row k="In draft" v={q.qualifications.draft} /><Row k="Rejected" v={q.qualifications.rejected} />
              <Row k="Trades with no approved qualification" v={<Badge variant={q.qualifications.trades_without_approved_qualification ? "destructive" : "secondary"}>{q.qualifications.trades_without_approved_qualification}</Badge>} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Assessment and certification</CardTitle><CardDescription>Approved results only</CardDescription></CardHeader>
            <CardContent>
              <Row k="Pass rate" v={pct(q.results.pass_rate)} note={<TargetNote indicator="pass_rate" value={q.results.pass_rate} targets={targets} />} />
              <Row k="Results decided" v={q.results.decided} /><Row k="Results awaiting approval" v={<Badge variant={q.results.awaiting_approval ? "destructive" : "secondary"}>{q.results.awaiting_approval}</Badge>} />
              <Row k="Assessment cycles open / locked" v={`${q.assessment_cycles.open} / ${q.assessment_cycles.locked}`} />
              <Row k="Attendance, last 30 days" v={pct(q.attendance.rate_30_days)} note={<TargetNote indicator="attendance_rate" value={q.attendance.rate_30_days} targets={targets} />} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Progression</CardTitle><CardDescription>Completion and dropout across the centre's registrations</CardDescription></CardHeader>
            <CardContent>
              <Row k="Registered" v={q.progression.registered} /><Row k="Completed" v={q.progression.completed} /><Row k="Withdrawn" v={q.progression.withdrawn} />
              <Row k="Completion rate" v={pct(q.progression.completion_rate)} note={<TargetNote indicator="completion_rate" value={q.progression.completion_rate} targets={targets} />} />
              <Row k="Dropout rate" v={pct(q.progression.dropout_rate)} note={<TargetNote indicator="dropout_rate" value={q.progression.dropout_rate} targets={targets} />} />
              {q.progression.by_status.map((s) => <Row key={s.status} k={label(s.status)} v={s.count} />)}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Delivery plans</CardTitle><CardDescription>Trainers' plans by status</CardDescription></CardHeader>
            <CardContent>{q.delivery_plans.length === 0 ? <Empty text="No delivery plans have been submitted yet." /> : q.delivery_plans.map((p) => <Row key={p.status} k={label(p.status)} v={p.count} />)}</CardContent>
          </Card>
        </div>
      )}
    </Wait>
  );
}

export function StaffingPanel({ active }: { active: boolean }) {
  const { data: s, isLoading, error } = useCmStaffing(active);
  const { data: targets } = useCentreTargets(active);
  return (
    <Wait error={error} loading={isLoading || !s}>
      {s && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader><CardTitle>Capacity</CardTitle><CardDescription>Teaching load and staff</CardDescription></CardHeader>
            <CardContent>
              <Row k="Active trainers" v={s.trainers} /><Row k="Active trainees" v={s.active_trainees} />
              <Row k="Trainees per trainer" v={s.trainees_per_trainer ?? "–"} note={<TargetNote indicator="trainees_per_trainer" value={s.trainees_per_trainer} targets={targets} />} />
              <Row k="Staff in all roles" v={s.staff} />
              <Row k="On leave today" v={s.leave.on_leave_today} /><Row k="Leave requests waiting" v={s.leave.pending} /><Row k="Leave days this month" v={s.leave.days_this_month} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Posts and vacancies</CardTitle><CardDescription>Approved posts (kept by the HR officer) against people in the role</CardDescription></CardHeader>
            <CardContent>
              {s.establishment.length === 0 ? <Empty text="No establishment has been entered yet. The HR officer lists the approved posts, and vacancies appear here." /> : (
                <Table><TableHeader><TableRow><TableHead>Post</TableHead><TableHead className="text-right">Approved</TableHead><TableHead className="text-right">Filled</TableHead><TableHead className="text-right">Vacant</TableHead></TableRow></TableHeader>
                  <TableBody>{s.establishment.map((e) => <TableRow key={e.role}><TableCell>{e.post}</TableCell><TableCell className="text-right">{e.approved}</TableCell><TableCell className="text-right">{e.filled}</TableCell><TableCell className="text-right"><Badge variant={e.vacant ? "destructive" : "secondary"}>{e.vacant}</Badge></TableCell></TableRow>)}</TableBody></Table>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Appraisals</CardTitle></CardHeader>
            <CardContent><Row k="Appraisals still open" v={s.appraisals.open} /><Row k="Staff with no appraisal this year" v={<Badge variant={s.appraisals.staff_without_review_this_year ? "destructive" : "secondary"}>{s.appraisals.staff_without_review_this_year}</Badge>} /></CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Contracts ending in 90 days</CardTitle></CardHeader>
            <CardContent>{s.contracts_ending_90_days.length === 0 ? <Empty text="No contracts end in the next 90 days." /> : s.contracts_ending_90_days.map((c, i) => <Row key={i} k={`${c.name}${c.job_title ? ` (${c.job_title})` : ""}`} v={day(c.end_date)} />)}</CardContent>
          </Card>
        </div>
      )}
    </Wait>
  );
}

export function StakeholdersPanel({ active }: { active: boolean }) {
  const navigate = useNavigate();
  const { data: s, isLoading, error } = useCmStakeholders(active);
  return (
    <Wait error={error} loading={isLoading || !s}>
      {s && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader className="flex-row flex-wrap items-start justify-between gap-2 space-y-0"><div><CardTitle>Reports and reviews due</CardTitle><CardDescription>Kept by your PA as tasks of type report or review</CardDescription></div>
              <Button variant="outline" size="sm" onClick={() => navigate("/pa-dashboard")}>Open the registers</Button></CardHeader>
            <CardContent>
              <Row k="Open" v={s.reports_and_reviews.open} /><Row k="Overdue" v={<Badge variant={s.reports_and_reviews.overdue ? "destructive" : "secondary"}>{s.reports_and_reviews.overdue}</Badge>} /><Row k="Completed in 90 days" v={s.reports_and_reviews.done_last_90_days} />
              {s.reports_and_reviews.items.length === 0 ? <Empty text="Nothing is listed. Ask your PA to add reports and reviews with their due dates." /> : s.reports_and_reviews.items.map((i, n) => <Row key={n} k={`${i.title} (${i.kind})`} v={<span className={i.overdue ? "text-destructive" : ""}>{day(i.due_on)}</span>} />)}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Correspondence</CardTitle><CardDescription>Letters and messages from the NTA, government and industry that are still open</CardDescription></CardHeader>
            <CardContent>
              <Row k="Open" v={s.correspondence.open} /><Row k="Overdue replies" v={<Badge variant={s.correspondence.overdue ? "destructive" : "secondary"}>{s.correspondence.overdue}</Badge>} />
              {s.correspondence.items.length === 0 ? <Empty text="No open correspondence." /> : s.correspondence.items.map((c) => <Row key={c.reference} k={`${c.reference} · ${c.party}: ${c.subject}`} v={<span className={c.overdue ? "text-destructive" : ""}>{day(c.due_on)}</span>} />)}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Meetings, next 14 days</CardTitle></CardHeader>
            <CardContent>{s.meetings_next_14_days.length === 0 ? <Empty text="No meetings are scheduled." /> : s.meetings_next_14_days.map((m, i) => <Row key={i} k={m.title} v={day(m.on)} />)}</CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Industry placements</CardTitle></CardHeader>
            <CardContent><Row k="Placements recorded" v={s.placements.total} /></CardContent>
          </Card>
        </div>
      )}
    </Wait>
  );
}
