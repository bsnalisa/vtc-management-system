import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Briefcase, CalendarCheck, CalendarDays, ClipboardCheck, Star, Users } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { LeaveDecisionDialog } from "@/components/hr/LeaveDecisionDialog";
import { useRoleNavigation } from "@/hooks/useRoleNavigation";
import { useProfile } from "@/hooks/useProfile";
import { LeaveRequest, fmtDate, labelOf, useAllLeaveRequests, useAllReviews, useApplicants, useDecideLeave, useStaffDirectory, useVacancies } from "@/hooks/useHr";

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const Stat = ({ icon: Icon, label, value, to }: { icon: typeof Users; label: string; value: number | string; to: string }) => (
  <Link to={to} className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-lg">
    <Card className="hover:shadow-md transition-shadow h-full">
      <CardContent className="p-4 flex items-center gap-3">
        <Icon className="h-8 w-8 text-primary shrink-0" aria-hidden="true" />
        <div><p className="text-2xl font-bold">{value}</p><p className="text-sm text-muted-foreground">{label}</p></div>
      </CardContent>
    </Card>
  </Link>
);

const HROfficerDashboard = () => {
  const { navItems, groupLabel } = useRoleNavigation();
  const { data: profile } = useProfile();
  const directory = useStaffDirectory();
  const leave = useAllLeaveRequests();
  const vacancies = useVacancies();
  const applicants = useApplicants();
  const reviews = useAllReviews();
  const decide = useDecideLeave();
  const [declining, setDeclining] = useState<LeaveRequest | null>(null);
  const [groupBy, setGroupBy] = useState<"department" | "employment_type">("department");

  const staff = directory.data ?? [];
  const names = useMemo(() => new Map(staff.map((s) => [s.user_id, s.full_name ?? s.email ?? "Unknown"])), [staff]);
  const today = iso(new Date());
  const requests = leave.data ?? [];
  const pending = requests.filter((r) => r.status === "pending").sort((a, b) => a.start_date.localeCompare(b.start_date));
  const upcoming = requests.filter((r) => r.status === "approved" && r.end_date >= today).sort((a, b) => a.start_date.localeCompare(b.start_date)).slice(0, 6);
  const openVacancies = (vacancies.data ?? []).filter((v) => v.status === "open");
  const draftReviews = (reviews.data ?? []).filter((r) => r.status === "draft").length;
  const activeStaff = staff.filter((s) => !["resigned", "terminated"].includes(s.employment_status ?? ""));

  const chart = useMemo(() => {
    const acc = new Map<string, number>();
    for (const s of activeStaff) {
      const key = groupBy === "department" ? s.department ?? "No department" : s.employment_type ? labelOf(s.employment_type) : "No HR record";
      acc.set(key, (acc.get(key) ?? 0) + 1);
    }
    return Array.from(acc, ([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [activeStaff, groupBy]);

  const perVacancy = openVacancies.map((v) => ({ v, n: (applicants.data ?? []).filter((a) => a.vacancy_id === v.id).length }));
  const loading = directory.isLoading || leave.isLoading || vacancies.isLoading || reviews.isLoading;
  const err = (directory.error ?? leave.error ?? vacancies.error ?? reviews.error ?? applicants.error) as Error | null;

  return (
    <DashboardLayout title={`Welcome back, ${profile?.firstname || "User"}`} subtitle="HR overview: people, leave, recruitment and performance" navItems={navItems} groupLabel={groupLabel}>
      <div className="space-y-6">
        {err && <p role="alert" className="text-sm text-destructive">Some figures could not be loaded: {err.message}</p>}
        {loading ? <LoadingSpinner text="Loading HR figures" /> : (
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-5">
            <Stat icon={Users} label="Headcount" value={activeStaff.length} to="/hr/employees" />
            <Stat icon={CalendarDays} label="On leave today" value={staff.filter((s) => s.on_leave_today).length} to="/hr/leave" />
            <Stat icon={ClipboardCheck} label="Pending leave requests" value={pending.length} to="/hr/leave" />
            <Stat icon={Briefcase} label="Open vacancies" value={openVacancies.length} to="/hr/recruitment" />
            <Stat icon={Star} label="Reviews in draft" value={draftReviews} to="/hr/performance" />
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader className="flex-row items-start justify-between space-y-0 gap-2 flex-wrap">
              <div><CardTitle className="text-base">Staff by {groupBy === "department" ? "department" : "employment type"}</CardTitle><CardDescription>Excludes resigned and terminated staff</CardDescription></div>
              <Button size="sm" variant="outline" onClick={() => setGroupBy(groupBy === "department" ? "employment_type" : "department")}>Switch view</Button>
            </CardHeader>
            <CardContent>
              {chart.length ? (
                <div className="h-[250px]" role="img" aria-label="Bar chart of staff counts">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chart} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                      <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }} />
                      <Bar dataKey="value" name="Staff" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : <p className="text-sm text-muted-foreground text-center py-10">No staff to chart yet. Add HR records in the staff directory.</p>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Pending leave requests</CardTitle><CardDescription>Approve here, or open a request to decline with a reason</CardDescription></CardHeader>
            <CardContent>
              {pending.length ? (
                <ul className="divide-y">
                  {pending.slice(0, 5).map((r) => (
                    <li key={r.id} className="py-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div className="text-sm"><span className="font-medium">{names.get(r.user_id) ?? "Unknown"}</span><div className="text-muted-foreground">{r.leave_types?.name} - {fmtDate(r.start_date)} to {fmtDate(r.end_date)} ({r.days} days)</div></div>
                      <div className="flex gap-2">
                        <Button size="sm" disabled={decide.isPending} onClick={() => decide.mutate({ id: r.id, approve: true, notes: "" })}>Approve</Button>
                        <Button size="sm" variant="outline" onClick={() => setDeclining(r)}>Decline</Button>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : <p className="text-sm text-muted-foreground text-center py-10">Nothing is waiting for approval.</p>}
              {pending.length > 5 && <Button asChild variant="link" className="px-0"><Link to="/hr/leave">See all {pending.length} requests</Link></Button>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Upcoming leave</CardTitle><CardDescription>Approved leave that has not ended</CardDescription></CardHeader>
            <CardContent>
              {upcoming.length ? (
                <ul className="divide-y">{upcoming.map((r) => (
                  <li key={r.id} className="py-2 text-sm flex flex-col sm:flex-row sm:justify-between gap-1">
                    <span className="font-medium">{names.get(r.user_id) ?? "Unknown"}</span>
                    <span className="text-muted-foreground">{r.leave_types?.name} - {fmtDate(r.start_date)} to {fmtDate(r.end_date)}</span>
                  </li>))}</ul>
              ) : <p className="text-sm text-muted-foreground text-center py-8">No approved leave coming up.</p>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Applicants per open vacancy</CardTitle><CardDescription>Open vacancies and how many people applied</CardDescription></CardHeader>
            <CardContent>
              {perVacancy.length ? (
                <ul className="divide-y">{perVacancy.map(({ v, n }) => (
                  <li key={v.id} className="py-2 text-sm flex justify-between gap-2"><span className="font-medium">{v.title}</span><span className="text-muted-foreground">{n} applicant{n === 1 ? "" : "s"}{v.closes_on ? ` - closes ${fmtDate(v.closes_on)}` : ""}</span></li>
                ))}</ul>
              ) : <p className="text-sm text-muted-foreground text-center py-8">No open vacancies.</p>}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader><CardTitle className="text-base">Quick actions</CardTitle></CardHeader>
          <CardContent className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {[["/hr/employees", "Staff directory", Users], ["/hr/leave", "Leave management", CalendarCheck], ["/hr/recruitment", "Recruitment", Briefcase], ["/hr/performance", "Performance reviews", Star],
              ["/reports", "Reports", ArrowRight], ["/my-approvals", "My approvals", ClipboardCheck], ["/my-hr", "My HR", CalendarDays]].map(([to, label, Icon]) => {
              const I = Icon as typeof Users;
              return <Button key={to as string} asChild variant="outline" className="justify-start"><Link to={to as string}><I className="h-4 w-4 mr-2" />{label as string}</Link></Button>;
            })}
          </CardContent>
        </Card>
      </div>
      <LeaveDecisionDialog request={declining} name={declining ? names.get(declining.user_id) ?? "Unknown" : ""} onClose={() => setDeclining(null)} />
    </DashboardLayout>
  );
};

export default HROfficerDashboard;
