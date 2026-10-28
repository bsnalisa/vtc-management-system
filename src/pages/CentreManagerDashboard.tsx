import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  AlertCircle, AlertTriangle, ArrowDownRight, ArrowUpRight, Banknote, CalendarCheck, ClipboardCheck, FileBarChart, GraduationCap,
  Landmark, LifeBuoy, Percent, TrendingUp, UserCheck, Users, Building2, Wrench, Workflow,
} from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { useRoleNavigation } from "@/hooks/useRoleNavigation";
import { useProfile } from "@/hooks/useProfile";
import { useMyTasks } from "@/hooks/useWorkflows";
import { useCentreManagerOverview } from "@/hooks/useCentreManagerOverview";
import { CentreExecutive } from "@/components/dashboard/CentreExecutive";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FinancePanel, QualityPanel, StaffingPanel, StakeholdersPanel } from "@/components/dashboard/centre/CentrePanels";

const money = (n: number) => `N$ ${Math.round(n).toLocaleString("en-ZA")}`;
const pct = (n: number | null | undefined) => (n == null ? "–" : `${n}%`);
const label = (v: string) => v.replace(/_/g, " ");
const trendConfig = { count: { label: "Applications", color: "hsl(var(--primary))" } } satisfies ChartConfig;
const tradeConfig = { count: { label: "Active trainees", color: "hsl(var(--primary))" } } satisfies ChartConfig;

// Change against the previous period, with an arrow; "good" says which direction is an improvement
const Change = ({ now, before, good = "up" }: { now: number | null | undefined; before: number | null | undefined; good?: "up" | "down" }) => {
  if (now == null || before == null || before === 0) return null;
  const diff = Math.round((now - before) * 10) / 10;
  if (diff === 0) return <span className="text-xs text-muted-foreground">No change</span>;
  const better = (diff > 0) === (good === "up");
  const Icon = diff > 0 ? ArrowUpRight : ArrowDownRight;
  return <span className={`inline-flex items-center gap-0.5 text-xs ${better ? "text-primary" : "text-destructive"}`}><Icon className="h-3 w-3" />{Math.abs(diff)}</span>;
};

const AttentionRow = ({ icon: Icon, text, count, url, hot }: { icon: typeof AlertTriangle; text: string; count: number; url: string; hot?: boolean }) => {
  const navigate = useNavigate();
  return (
    <button type="button" onClick={() => navigate(url)} className="flex w-full items-center justify-between gap-3 border-b py-2 text-left last:border-0 hover:bg-muted/50">
      <span className="flex min-w-0 items-center gap-2 text-sm"><Icon className={`h-4 w-4 shrink-0 ${hot && count > 0 ? "text-destructive" : "text-muted-foreground"}`} /><span className="min-w-0 break-words">{text}</span></span>
      <Badge variant={hot && count > 0 ? "destructive" : "secondary"}>{count}</Badge>
    </button>
  );
};

const CentreManagerDashboard = () => {
  const navigate = useNavigate();
  const { navItems, groupLabel } = useRoleNavigation();
  const { data: profile } = useProfile();
  const { data: o, isLoading, error } = useCentreManagerOverview();
  const { data: tasks, error: tasksError } = useMyTasks();

  useEffect(() => {
    const e = error ?? tasksError;
    if (e) toast.error(`Could not load some dashboard figures: ${(e as Error).message}`);
  }, [error, tasksError]);

  const [tab, setTab] = useState("overview");
  const waiting = tasks ?? [];
  const f = o?.finance;
  const PASS = new Set(["pass", "passed", "competent"]);
  const passed = o?.results.by_status.filter((s) => PASS.has(s.status.toLowerCase())).reduce((n, s) => n + s.count, 0) ?? 0;
  const decided = o?.results.by_status.filter((s) => !/pending/i.test(s.status)).reduce((n, s) => n + s.count, 0) ?? 0;
  const passRate = decided > 0 ? Math.round((1000 * passed) / decided) / 10 : null;

  return (
    <DashboardLayout title={`Welcome back, ${profile?.firstname || "User"}`} subtitle="Centre management" navItems={navItems} groupLabel={groupLabel}>
      <DashboardShell
        name={profile?.firstname || undefined}
        heroIcon={Building2}
        heroSubtitle="How your centre is doing, and what needs your decision."
        stats={[
          { label: "Active trainees", value: o?.trainees.active ?? 0, icon: Users, loading: isLoading, hint: `${o?.trainees.total ?? 0} registered in all` },
          { label: "Applications this month", value: o?.applications.this_month ?? 0, icon: TrendingUp, loading: isLoading, tone: "secondary", hint: `${o?.applications.last_month ?? 0} last month` },
          { label: "Fees collected", value: pct(f?.collection_rate), icon: Percent, loading: isLoading, progress: f?.collection_rate ?? 0, hint: f ? `${money(f.outstanding)} outstanding` : undefined, tone: f && f.collection_rate != null && f.collection_rate < 60 ? "destructive" : "primary" },
          { label: "Attendance (30 days)", value: pct(o?.attendance.rate), icon: CalendarCheck, loading: isLoading, progress: o?.attendance.rate ?? 0, tone: o?.attendance.rate != null && o.attendance.rate < 75 ? "destructive" : "primary" },
          { label: "Assessment pass rate", value: pct(passRate), icon: GraduationCap, loading: isLoading, tone: "accent", hint: `${o?.results.awaiting_approval ?? 0} results awaiting approval` },
          { label: "Waiting for you", value: waiting.length, icon: ClipboardCheck, tone: waiting.length > 0 ? "destructive" : "secondary", hint: "Approvals" },
        ]}
        actions={[
          { icon: ClipboardCheck, label: "My Approvals", desc: "Decisions waiting", url: "/my-approvals", badge: waiting.length },
          { icon: FileBarChart, label: "Reports", desc: "Centre reports", url: "/reports" },
          { icon: Users, label: "Trainees", desc: "Everyone registered", url: "/trainees" },
          { icon: GraduationCap, label: "Certification", desc: "Results and certificates", url: "/reports/certification" },
        ]}
        actionCols={4}
      >
        <Tabs value={tab} onValueChange={setTab} className="space-y-4">
          <TabsList className="h-auto flex-wrap justify-start">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="finance">Finance and spending</TabsTrigger>
            <TabsTrigger value="quality">Quality of training</TabsTrigger>
            <TabsTrigger value="people">Staffing</TabsTrigger>
            <TabsTrigger value="stakeholders">Stakeholders and reports</TabsTrigger>
          </TabsList>
          <TabsContent value="overview" className="space-y-4">
        {isLoading && <div className="flex justify-center py-6"><LoadingSpinner text="Loading centre figures" /></div>}
        {error && <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertDescription>Centre figures could not be loaded: {(error as Error).message}</AlertDescription></Alert>}
        {o && (
          <>
            <Card>
              <CardHeader>
                <CardTitle>Needs your decision</CardTitle>
                <CardDescription>Approvals waiting for you, oldest first</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {waiting.length === 0 && <p className="text-sm text-muted-foreground">Nothing is waiting for you.</p>}
                {[...waiting].sort((a, b) => a.started_at.localeCompare(b.started_at)).slice(0, 6).map((t) => (
                  <button key={t.task_id} type="button" onClick={() => navigate("/my-approvals")} className="flex w-full items-center justify-between gap-3 border-b py-2 text-left last:border-0 hover:bg-muted/50">
                    <span className="min-w-0"><span className="block break-words text-sm font-medium">{t.title}</span><span className="block text-xs text-muted-foreground">{label(t.process_type)} · {t.step_name} · since {new Date(t.started_at).toLocaleDateString()}</span></span>
                    {t.escalated ? <Badge variant="destructive">Escalated</Badge> : t.due_at && new Date(t.due_at) < new Date() ? <Badge variant="destructive">Overdue</Badge> : <Badge variant="secondary">Open</Badge>}
                  </button>
                ))}
                {waiting.length > 6 && <Button variant="link" className="px-0" onClick={() => navigate("/my-approvals")}>See all {waiting.length}</Button>}
              </CardContent>
            </Card>

            <CentreExecutive />

            <div className="grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader><CardTitle>Money</CardTitle><CardDescription>Fees billed against collected</CardDescription></CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2 text-sm"><span>{money(o.finance.collected)} of {money(o.finance.billed)}</span><span className="font-medium">{pct(o.finance.collection_rate)}</span></div>
                    <Progress value={o.finance.collection_rate ?? 0} />
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div><p className="text-muted-foreground">Outstanding</p><p className="font-medium">{money(o.finance.outstanding)}</p></div>
                    <div><p className="text-muted-foreground">Trainees owing</p><p className="font-medium">{o.finance.debtors}</p></div>
                    <div><p className="text-muted-foreground">Hostel fees overdue</p><p className="font-medium">{o.finance.hostel_overdue_count} · {money(o.finance.hostel_overdue_amount)}</p></div>
                    <div><p className="text-muted-foreground">Bank lines to match</p><p className="font-medium">{o.finance.unreconciled_bank_lines}</p></div>
                  </div>
                  <p className="text-xs text-muted-foreground">Finance is read-only here. Changes are made by the debtor officer.</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle>Needs attention</CardTitle><CardDescription>Open items across the centre</CardDescription></CardHeader>
                <CardContent>
                  <AttentionRow icon={AlertTriangle} text="Deferral requests waiting for a decision" count={o.attention.deferrals_pending} url="/deferral-requests" hot />
                  <AttentionRow icon={LifeBuoy} text="Open support tickets" count={o.attention.open_tickets} url="/support-tickets" hot />
                  <AttentionRow icon={Workflow} text={`Approvals in progress${o.attention.oldest_workflow_days != null ? ` (oldest ${o.attention.oldest_workflow_days} days)` : ""}`} count={o.attention.workflows_running} url="/my-approvals" />
                  <AttentionRow icon={Banknote} text="Overdue hostel fees" count={o.finance.hostel_overdue_count} url="/reports" hot />
                  <AttentionRow icon={Landmark} text="Results awaiting approval" count={o.results.awaiting_approval} url="/reports/certification" hot />
                  <AttentionRow icon={Wrench} text="Maintenance jobs open" count={o.attention.maintenance_open} url="/reports" />
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader><CardTitle>Applications</CardTitle><CardDescription>Last six months</CardDescription></CardHeader>
                <CardContent>
                  <ChartContainer config={trendConfig} className="h-52 w-full">
                    <BarChart data={o.applications.trend} margin={{ left: 0, right: 8 }}>
                      <CartesianGrid vertical={false} />
                      <XAxis dataKey="month" tickLine={false} axisLine={false} />
                      <YAxis allowDecimals={false} width={28} tickLine={false} axisLine={false} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Bar dataKey="count" fill="var(--color-count)" radius={4} />
                    </BarChart>
                  </ChartContainer>
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle>Enrolment by trade</CardTitle><CardDescription>Active trainees, largest first</CardDescription></CardHeader>
                <CardContent>
                  {o.trainees.by_trade.length === 0 ? <p className="text-sm text-muted-foreground">No active trainees yet.</p> : (
                    <ChartContainer config={tradeConfig} className="h-52 w-full">
                      <BarChart data={o.trainees.by_trade} layout="vertical" margin={{ left: 0, right: 8 }}>
                        <CartesianGrid horizontal={false} />
                        <XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} />
                        <YAxis type="category" dataKey="trade" width={110} tickLine={false} axisLine={false} />
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <Bar dataKey="count" fill="var(--color-count)" radius={4} />
                      </BarChart>
                    </ChartContainer>
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
              <Card>
                <CardHeader><CardTitle>Teaching</CardTitle><CardDescription>Classes and attendance</CardDescription></CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex justify-between"><span>Active classes</span><span className="font-medium">{o.teaching.classes}</span></div>
                  <div className="flex justify-between"><span>Active trainers</span><span className="font-medium">{o.teaching.trainers}</span></div>
                  <div className="flex items-center justify-between"><span>Attendance, last 30 days</span><span className="flex items-center gap-2 font-medium">{pct(o.attendance.rate)} <Change now={o.attendance.rate} before={o.attendance.previous} /></span></div>
                  <div className="flex justify-between"><span>Assessment cycles still open</span><span className="font-medium">{o.results.open_cycles}</span></div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle>Results</CardTitle><CardDescription>Qualification results by outcome</CardDescription></CardHeader>
                <CardContent className="space-y-2">
                  {o.results.by_status.length === 0 && <p className="text-sm text-muted-foreground">No results recorded yet.</p>}
                  {o.results.by_status.map((s) => (
                    <div key={s.status} className="flex items-center justify-between border-b pb-2 last:border-0"><span className="text-sm capitalize">{label(s.status)}</span><Badge variant="secondary">{s.count}</Badge></div>
                  ))}
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle>People</CardTitle><CardDescription>Staff and leave</CardDescription></CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex justify-between"><span>Staff</span><span className="font-medium">{o.people.staff}</span></div>
                  <div className="flex justify-between"><span>On leave today</span><span className="font-medium">{o.people.on_leave_today}</span></div>
                  <div className="flex justify-between"><span>Leave requests waiting</span><span className="font-medium">{o.people.leave_pending}</span></div>
                  <Button variant="link" className="px-0" onClick={() => navigate("/trainers")}><UserCheck className="mr-1 h-4 w-4" />Trainer list</Button>
                </CardContent>
              </Card>
            </div>
          </>
        )}
          </TabsContent>
          <TabsContent value="finance"><FinancePanel active={tab === "finance"} /></TabsContent>
          <TabsContent value="quality"><QualityPanel active={tab === "quality"} /></TabsContent>
          <TabsContent value="people"><StaffingPanel active={tab === "people"} /></TabsContent>
          <TabsContent value="stakeholders"><StakeholdersPanel active={tab === "stakeholders"} /></TabsContent>
        </Tabs>
      </DashboardShell>
    </DashboardLayout>
  );
};

export default CentreManagerDashboard;
