import { useMemo } from "react";
import { Link } from "react-router-dom";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { AlertTriangle, ArrowRight, CalendarClock, ClipboardCheck, FileText, FolderKanban, ListChecks, Wallet } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { DashboardLayout } from "@/components/DashboardLayout";
import { fmtDate, fmtDateTime, label, money, statusVariant } from "@/components/projects/projectUtils";
import { useRoleNavigation } from "@/hooks/useRoleNavigation";
import { useProfile } from "@/hooks/useProfile";
import { todayIso, useProjectStats, useProjectUpdates } from "@/hooks/useProjects";

const ProjectsCoordinatorDashboard = () => {
  const { navItems, groupLabel } = useRoleNavigation();
  const { data: profile } = useProfile();
  const { stats, projects, milestones } = useProjectStats();
  const updates = useProjectUpdates(undefined, 5);

  const chartData = useMemo(() => Object.entries(stats.byStatus).map(([k, v]) => ({ status: label(k), count: v })), [stats.byStatus]);
  const next = useMemo(() => {
    const today = todayIso();
    return (milestones.data ?? []).filter((m) => m.status !== "done").sort((a, b) => a.due_date.localeCompare(b.due_date)).slice(0, 6)
      .map((m) => ({ ...m, overdue: m.due_date < today }));
  }, [milestones.data]);

  const error = projects.error || milestones.error || updates.error;
  const loading = projects.isLoading || milestones.isLoading;
  const cards = [
    { title: "Active projects", value: stats.byStatus.active, hint: `${stats.total} in total`, icon: FolderKanban, to: "/projects" },
    { title: "Overdue milestones", value: stats.overdueMilestones, hint: "Not done and past due", icon: AlertTriangle, to: "/projects/milestones" },
    { title: "Due in 14 days", value: stats.dueSoonMilestones, hint: "Open milestones", icon: CalendarClock, to: "/projects/milestones" },
    { title: "Budget vs spent", value: `${money(stats.totalSpent)} / ${money(stats.totalBudget)}`, hint: stats.totalBudget > 0 ? `${Math.round((stats.totalSpent / stats.totalBudget) * 100)}% spent` : "No budgets set", icon: Wallet, to: "/projects" },
  ];
  const actions = [
    { label: "Project register", to: "/projects", icon: FolderKanban },
    { label: "Milestones", to: "/projects/milestones", icon: ListChecks },
    { label: "Reports", to: "/reports", icon: FileText },
    { label: "My approvals", to: "/my-approvals", icon: ClipboardCheck },
  ];

  return (
    <DashboardLayout title={`Welcome back, ${profile?.firstname || "User"}`} subtitle="Projects overview" navItems={navItems} groupLabel={groupLabel}>
      <div className="space-y-6">
        {error && <p role="alert" className="text-sm text-destructive">Some figures could not be loaded: {(error as Error).message}</p>}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {cards.map((c) => (
            <Link key={c.title} to={c.to} className="block">
              <Card className="h-full border-0 shadow-md transition-shadow hover:shadow-lg">
                <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">{c.title}</CardTitle><c.icon className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent><div className="text-2xl font-bold break-words">{loading ? "-" : c.value}</div><p className="text-xs text-muted-foreground">{c.hint}</p></CardContent>
              </Card>
            </Link>
          ))}
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          {actions.map((a) => <Button key={a.to} asChild variant="outline"><Link to={a.to}><a.icon className="h-4 w-4 mr-2" />{a.label}<ArrowRight className="h-4 w-4 ml-2" /></Link></Button>)}
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="border-0 shadow-md">
            <CardHeader><CardTitle>Projects by status</CardTitle></CardHeader>
            <CardContent>
              {loading ? <LoadingSpinner text="Loading" /> : !stats.total ? (
                <p className="text-sm text-muted-foreground py-8 text-center">No projects yet. <Link className="text-primary hover:underline" to="/projects">Create the first project</Link>.</p>
              ) : (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="status" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                      <YAxis allowDecimals={false} stroke="hsl(var(--muted-foreground))" fontSize={12} />
                      <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", color: "hsl(var(--foreground))" }} />
                      <Bar dataKey="count" name="Projects" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-0 shadow-md">
            <CardHeader><CardTitle>Next milestones</CardTitle><CardDescription>Open milestones by due date</CardDescription></CardHeader>
            <CardContent>
              {milestones.isLoading ? <LoadingSpinner text="Loading" /> : !next.length ? (
                <p className="text-sm text-muted-foreground py-8 text-center">No open milestones.</p>
              ) : (
                <ul className="space-y-3">
                  {next.map((m) => (
                    <li key={m.id} className="flex items-start justify-between gap-2 text-sm">
                      <div className="min-w-0">
                        <div className="font-medium">{m.title}</div>
                        <Link className="text-xs text-muted-foreground hover:underline" to={`/projects?project=${m.project_id}`}>{m.projects?.project_code} {m.projects?.title}</Link>
                      </div>
                      <div className="text-right shrink-0">
                        <div className={m.overdue ? "text-destructive font-medium" : ""}>{fmtDate(m.due_date)}</div>
                        <Badge variant={statusVariant(m.status)}>{label(m.status)}</Badge>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        <Card className="border-0 shadow-md">
          <CardHeader><CardTitle>Recent updates</CardTitle></CardHeader>
          <CardContent>
            {updates.isLoading ? <LoadingSpinner text="Loading" /> : !updates.data?.length ? (
              <p className="text-sm text-muted-foreground py-6 text-center">No project updates have been posted yet.</p>
            ) : (
              <ul className="space-y-3 text-sm">
                {updates.data.map((u) => (
                  <li key={u.id}>
                    <div className="text-xs text-muted-foreground">
                      <Link className="hover:underline" to={`/projects?project=${u.project_id}`}>{u.projects?.project_code} {u.projects?.title}</Link> - {fmtDateTime(u.created_at)}{u.progress_percent !== null && ` - ${u.progress_percent}%`}
                    </div>
                    <p className="whitespace-pre-wrap">{u.note}</p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default ProjectsCoordinatorDashboard;
