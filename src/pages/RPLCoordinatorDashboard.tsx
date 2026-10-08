import { Link } from "react-router-dom";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Award, CalendarClock, CheckCircle2, ClipboardList, FileCheck, Globe, Clock } from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useRoleNavigation } from "@/hooks/useRoleNavigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { useAssessmentRequests } from "@/hooks/useAssessmentRequests";
import { useAllRplCreditMappings, usePublicRplWaitingCount } from "@/hooks/useRpl";

const STATUS_ORDER = ["submitted", "more_info_needed", "under_review", "assessment_scheduled", "approved", "rejected"];
const QUICK = [
  { to: "/rpl/applications", label: "Applications" }, { to: "/rpl/portfolio", label: "Portfolios" }, { to: "/rpl/schedule", label: "Schedule" },
  { to: "/rpl/credits", label: "Credits" }, { to: "/assessment-requests", label: "All assessment requests" }, { to: "/reports", label: "Reports" }, { to: "/my-approvals", label: "My approvals" },
];

const RPLCoordinatorDashboard = () => {
  const { navItems, groupLabel } = useRoleNavigation();
  const { data: rpl = [], isLoading, error } = useAssessmentRequests("rpl");
  const { data: credits = [], error: creditsError } = useAllRplCreditMappings();
  const { data: publicWaiting, error: publicError } = usePublicRplWaitingCount();

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const count = (...s: string[]) => rpl.filter((r) => s.includes(r.status)).length;
  const decidedThisMonth = rpl.filter((r) => (r.status === "approved" || r.status === "rejected") && r.decided_at && new Date(r.decided_at).getTime() >= monthStart).length;
  const creditsThisMonth = credits.filter((c) => c.decision === "granted" && new Date(c.decided_at).getTime() >= monthStart).reduce((s, c) => s + c.credits, 0);
  const chart = STATUS_ORDER.map((s) => ({ status: s.replace(/_/g, " "), requests: count(s) }));
  const upcoming = rpl.filter((r) => r.status === "assessment_scheduled" && r.scheduled_at && new Date(r.scheduled_at).getTime() >= Date.now())
    .sort((a, b) => new Date(a.scheduled_at!).getTime() - new Date(b.scheduled_at!).getTime()).slice(0, 5);
  const longest = rpl.filter((r) => r.status === "submitted" || r.status === "under_review" || r.status === "more_info_needed")
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()).slice(0, 5);
  const days = (iso: string) => Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);

  const stats = [
    { title: "New", value: count("submitted"), note: "Not yet picked up", icon: ClipboardList },
    { title: "Under review", value: count("under_review", "more_info_needed"), note: "Being assessed or awaiting applicant", icon: FileCheck },
    { title: "Scheduled", value: count("assessment_scheduled"), note: "Assessment date set", icon: CalendarClock },
    { title: "Decided this month", value: decidedThisMonth, note: "Approved or rejected", icon: CheckCircle2 },
    { title: "Public applications", value: publicWaiting ?? "-", note: "Waiting for follow-up", icon: Globe },
    { title: "Credits granted", value: creditsThisMonth, note: "This month", icon: Award },
  ];
  const loadError = error ?? creditsError ?? publicError;

  return (
    <DashboardLayout title="RPL Coordinator Dashboard" subtitle="Recognition of Prior Learning applications and assessments" navItems={navItems} groupLabel={groupLabel}>
      <div className="space-y-6">
        {loadError && <p role="alert" className="text-sm text-destructive">Some figures could not be loaded: {(loadError as Error).message}</p>}
        {isLoading ? <LoadingSpinner text="Loading RPL figures..." /> : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {stats.map((s) => (
                <Card key={s.title}>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">{s.title}</CardTitle><s.icon className="h-4 w-4 text-muted-foreground" /></CardHeader>
                  <CardContent><div className="text-2xl font-bold">{s.value}</div><p className="text-xs text-muted-foreground">{s.note}</p></CardContent>
                </Card>
              ))}
            </div>
            <Card>
              <CardHeader><CardTitle>Quick actions</CardTitle></CardHeader>
              <CardContent className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                {QUICK.map((q) => <Button key={q.to} asChild variant="outline"><Link to={q.to}>{q.label}</Link></Button>)}
              </CardContent>
            </Card>
            <div className="grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader><CardTitle>Requests by status</CardTitle><CardDescription>All RPL requests</CardDescription></CardHeader>
                <CardContent>
                  {rpl.length ? (
                    <ResponsiveContainer width="100%" height={240}>
                      <BarChart data={chart}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="status" tick={{ fontSize: 11 }} interval={0} angle={-20} textAnchor="end" height={60} />
                        <YAxis allowDecimals={false} />
                        <Tooltip />
                        <Bar dataKey="requests" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : <p className="text-sm text-muted-foreground text-center py-10">No RPL requests yet.</p>}
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle className="flex items-center gap-2"><Clock className="h-4 w-4" />Waiting longest</CardTitle><CardDescription>Open applications, oldest first</CardDescription></CardHeader>
                <CardContent>
                  <ul className="space-y-2 text-sm">
                    {longest.map((r) => (
                      <li key={r.id} className="flex items-center justify-between gap-2 rounded-md border p-2">
                        <div><div className="font-medium">{r.applicant_name}</div><div className="text-muted-foreground">{r.reference_number} · {r.status.replace(/_/g, " ")}</div></div>
                        <Badge variant="secondary">{days(r.created_at)} d</Badge>
                      </li>
                    ))}
                  </ul>
                  {!longest.length && <p className="text-sm text-muted-foreground text-center py-6">No open applications.</p>}
                </CardContent>
              </Card>
            </div>
            <Card>
              <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between space-y-0">
                <div><CardTitle>Upcoming assessments</CardTitle><CardDescription>Next scheduled RPL assessments</CardDescription></div>
                <Button asChild variant="outline"><Link to="/rpl/schedule">Open schedule</Link></Button>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm">
                  {upcoming.map((r) => (
                    <li key={r.id} className="rounded-md border p-2">
                      <div className="font-medium">{new Date(r.scheduled_at!).toLocaleString()} - {r.applicant_name}</div>
                      <div className="text-muted-foreground">{r.qualifications?.qualification_title ?? "-"} · {r.venue ?? "no venue"} · {r.assessor_name ?? "no assessor"}</div>
                    </li>
                  ))}
                </ul>
                {!upcoming.length && <p className="text-sm text-muted-foreground text-center py-6">No assessments scheduled.</p>}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </DashboardLayout>
  );
};

export default RPLCoordinatorDashboard;
