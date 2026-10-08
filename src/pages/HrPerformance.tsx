import { useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { DashboardLayout } from "@/components/DashboardLayout";
import { withRoleAccess } from "@/components/withRoleAccess";
import { ReviewDialog } from "@/components/hr/ReviewDialog";
import { useRoleNavigation } from "@/hooks/useRoleNavigation";
import { PerformanceReview, fmtDate, labelOf, useAllReviews, useStaffDirectory } from "@/hooks/useHr";

const HrPerformance = () => {
  const { navItems, groupLabel } = useRoleNavigation();
  const reviews = useAllReviews();
  const directory = useStaffDirectory();
  const [period, setPeriod] = useState("all");
  const [status, setStatus] = useState("all");
  const [dialog, setDialog] = useState<{ review: PerformanceReview | null } | null>(null);

  const staff = directory.data ?? [];
  const byId = useMemo(() => new Map(staff.map((s) => [s.user_id, s])), [staff]);
  const all = reviews.data ?? [];
  const periods = useMemo(() => Array.from(new Set(all.map((r) => r.period))).sort().reverse(), [all]);
  const rows = all.filter((r) => (period === "all" || r.period === period) && (status === "all" || r.status === status));

  const departments = useMemo(() => {
    const acc = new Map<string, { sum: number; n: number }>();
    for (const r of rows) {
      if (!r.rating || r.status === "draft") continue;
      const d = byId.get(r.employee_user_id)?.department ?? "No department";
      const cur = acc.get(d) ?? { sum: 0, n: 0 };
      acc.set(d, { sum: cur.sum + r.rating, n: cur.n + 1 });
    }
    return Array.from(acc, ([name, v]) => ({ name, avg: v.sum / v.n, n: v.n })).sort((a, b) => b.avg - a.avg);
  }, [rows, byId]);

  const loading = reviews.isLoading || directory.isLoading;
  const err = (reviews.error ?? directory.error) as Error | null;

  return (
    <DashboardLayout title="Performance Reviews" subtitle="Record reviews and share them with employees" navItems={navItems} groupLabel={groupLabel}>
      <div className="space-y-6">
        <Card className="border-0 shadow-md">
          <CardHeader className="flex-col sm:flex-row items-start justify-between space-y-0 gap-3">
            <div><CardTitle>Reviews</CardTitle><CardDescription>{rows.length} shown</CardDescription></div>
            <Button onClick={() => setDialog({ review: null })}>New review</Button>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col gap-2 sm:flex-row">
              <Select value={period} onValueChange={setPeriod}>
                <SelectTrigger className="sm:w-[170px]"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="all">All periods</SelectItem>{periods.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
              </Select>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="sm:w-[170px]"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="all">All statuses</SelectItem>{["draft", "submitted", "acknowledged"].map((s) => <SelectItem key={s} value={s}>{labelOf(s)}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {loading && <LoadingSpinner text="Loading reviews" />}
            {err && <p role="alert" className="text-sm text-destructive">Could not load reviews: {err.message}</p>}
            {!loading && !err && (
              <Table>
                <TableHeader><TableRow><TableHead>Employee</TableHead><TableHead>Department</TableHead><TableHead>Period</TableHead><TableHead>Rating</TableHead><TableHead>Status</TableHead><TableHead>Created</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>{byId.get(r.employee_user_id)?.full_name ?? "Unknown"}</TableCell>
                      <TableCell>{byId.get(r.employee_user_id)?.department ?? "-"}</TableCell>
                      <TableCell>{r.period}</TableCell>
                      <TableCell>{r.rating ? `${r.rating} / 5` : "-"}</TableCell>
                      <TableCell><Badge variant={r.status === "draft" ? "outline" : r.status === "submitted" ? "secondary" : "default"}>{labelOf(r.status)}</Badge></TableCell>
                      <TableCell>{fmtDate(r.created_at)}</TableCell>
                      <TableCell className="text-right"><Button size="sm" variant="outline" onClick={() => setDialog({ review: r })} disabled={r.status !== "draft"}>{r.status === "draft" ? "Edit" : "Locked"}</Button></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
            {!loading && !err && !rows.length && <p className="text-sm text-muted-foreground text-center py-8">No reviews match. Create the first review to get started.</p>}
          </CardContent>
        </Card>
        <Card className="border-0 shadow-md">
          <CardHeader><CardTitle>Average rating by department</CardTitle><CardDescription>Submitted and acknowledged reviews in the current filter.</CardDescription></CardHeader>
          <CardContent>
            {departments.length ? (
              <ul className="space-y-3">
                {departments.map((d) => (
                  <li key={d.name}>
                    <div className="flex justify-between text-sm"><span>{d.name} <span className="text-muted-foreground">({d.n} review{d.n === 1 ? "" : "s"})</span></span><span className="font-semibold">{d.avg.toFixed(1)} / 5</span></div>
                    <div className="mt-1 h-2 rounded-full bg-muted"><div className="h-2 rounded-full bg-primary" style={{ width: `${(d.avg / 5) * 100}%` }} /></div>
                  </li>
                ))}
              </ul>
            ) : <p className="text-sm text-muted-foreground text-center py-4">No rated, submitted reviews yet.</p>}
          </CardContent>
        </Card>
      </div>
      <ReviewDialog open={!!dialog} review={dialog?.review ?? null} staff={staff} onClose={() => setDialog(null)} />
    </DashboardLayout>
  );
};

export default withRoleAccess(HrPerformance, { requiredRoles: ["hr_officer", "admin", "organization_admin"] });
