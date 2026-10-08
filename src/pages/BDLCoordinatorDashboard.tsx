import { useMemo } from "react";
import { Link } from "react-router-dom";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { BookOpen, CalendarClock, GraduationCap, Layers, TrendingUp, UserX, Users, FileText, Video, ClipboardCheck } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DashboardLayout } from "@/components/DashboardLayout";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { withRoleAccess } from "@/components/withRoleAccess";
import { useRoleNavigation } from "@/hooks/useRoleNavigation";
import { useProfile } from "@/hooks/useProfile";
import { contentPercent, isInactive, overallPercent, useAllClassProgress, useBdlClasses, useVirtualSessions } from "@/hooks/useBdl";
import { BDL_ROLES } from "@/components/bdl/BdlClassSelect";

const BDLCoordinatorDashboard = () => {
  const { navItems, groupLabel } = useRoleNavigation();
  const { data: profile } = useProfile();
  const { data: classes = [], isLoading, error } = useBdlClasses();
  const { data: sessions = [], error: sessionError } = useVirtualSessions();
  const progress = useAllClassProgress(classes.map((c) => c.id));

  const now = Date.now();
  const next = useMemo(() => sessions.filter((s) => s.status === "scheduled" && new Date(s.starts_at).getTime() >= now).slice(0, 5), [sessions, now]);
  const inWeek = next.length && sessions.filter((s) => s.status === "scheduled" && new Date(s.starts_at).getTime() >= now && new Date(s.starts_at).getTime() <= now + 7 * 86400000).length;
  const classNames = new Map(classes.map((c) => [c.id, c.class_name]));

  const allRows = progress.byClass.flatMap((c) => c.rows.map((r) => ({ ...r, classId: c.classId })));
  const avgContent = allRows.length ? Math.round(allRows.reduce((s, r) => s + contentPercent(r), 0) / allRows.length) : 0;
  const behind = allRows.filter((r) => isInactive(r.last_activity)).sort((a, b) => overallPercent(a) - overallPercent(b));
  const chart = progress.byClass.filter((c) => c.rows.length).map((c) => ({
    name: classNames.get(c.classId) ?? "Class", value: Math.round(c.rows.reduce((s, r) => s + contentPercent(r), 0) / c.rows.length),
  }));
  const enrolled = classes.reduce((s, c) => s + c.enrolled, 0);
  const loading = isLoading || progress.isLoading;

  return (
    <DashboardLayout title="Blended Learning" subtitle="Blended and distance learning overview" navItems={navItems} groupLabel={groupLabel}>
      <DashboardShell
        name={profile?.firstname || undefined}
        heroIcon={Layers}
        heroSubtitle="Blended classes, virtual sessions and trainee engagement."
        stats={[
          { label: "Blended classes", value: classes.length, icon: BookOpen, loading: isLoading, hint: "Training mode: blended / distance" },
          { label: "Enrolled trainees", value: enrolled, icon: Users, loading: isLoading, hint: "Active enrolments", tone: "secondary" },
          { label: "Sessions in 7 days", value: inWeek || 0, icon: CalendarClock, hint: "Scheduled virtual sessions", tone: "accent" },
          { label: "Content completion", value: `${avgContent}%`, icon: TrendingUp, loading, progress: avgContent, hint: "Average across trainees" },
        ]}
        actions={[
          { icon: BookOpen, label: "Blended classes", desc: "Classes and learning spaces", url: "/bdl/courses" },
          { icon: FileText, label: "Materials", desc: "Manage class content", url: "/bdl/materials" },
          { icon: Video, label: "Virtual sessions", desc: "Schedule live sessions", url: "/bdl/sessions" },
          { icon: TrendingUp, label: "Progress", desc: "Trainee engagement", url: "/bdl/progress", badge: behind.length || undefined },
          { icon: GraduationCap, label: "Learning space", desc: "Assignments and quizzes", url: "/learning" },
          { icon: ClipboardCheck, label: "Reports", desc: "Centre reports", url: "/reports" },
          { icon: ClipboardCheck, label: "My approvals", desc: "Items awaiting you", url: "/my-approvals" },
        ]}
        actionCols={4}
      >
        {(error || sessionError || progress.error) && (
          <p className="text-sm text-destructive">Could not load some figures: {((error || sessionError || progress.error) as Error).message}</p>
        )}
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader><CardTitle className="text-base">Content completion by class</CardTitle><CardDescription>Average share of published content trainees have marked done</CardDescription></CardHeader>
            <CardContent>
              {chart.length ? (
                <div className="h-[250px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chart} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                      <YAxis domain={[0, 100]} unit="%" tick={{ fontSize: 11 }} />
                      <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }} />
                      <Bar dataKey="value" name="Completion %" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : <p className="text-sm text-muted-foreground text-center py-8">{loading ? "Loading..." : "No enrolled trainees in blended classes yet."}</p>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Next sessions</CardTitle><CardDescription>Upcoming virtual sessions</CardDescription></CardHeader>
            <CardContent className="space-y-2">
              {next.map((s) => (
                <div key={s.id} className="flex justify-between gap-2 border-b pb-2 text-sm">
                  <div className="min-w-0"><p className="font-medium">{s.title}</p><p className="text-muted-foreground">{classNames.get(s.class_id) ?? ""}</p></div>
                  <span className="text-muted-foreground shrink-0">{new Date(s.starts_at).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}</span>
                </div>
              ))}
              {!next.length && <p className="text-sm text-muted-foreground text-center py-8">No sessions scheduled.</p>}
              <Button variant="link" asChild className="px-0"><Link to="/bdl/sessions">Manage sessions</Link></Button>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><UserX className="h-4 w-4" />Trainees falling behind</CardTitle>
            <CardDescription>No activity for 14+ days ({behind.length} trainee{behind.length === 1 ? "" : "s"})</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {behind.slice(0, 8).map((r) => (
              <div key={`${r.classId}-${r.trainee_id}`} className="flex justify-between gap-2 border-b pb-2 text-sm">
                <div><p className="font-medium">{r.first_name} {r.last_name}</p><p className="text-muted-foreground">{classNames.get(r.classId)}</p></div>
                <div className="text-right"><Badge variant="outline">{overallPercent(r)}% done</Badge><p className="text-xs text-muted-foreground mt-1">{r.last_activity ? new Date(r.last_activity).toLocaleDateString() : "No activity"}</p></div>
              </div>
            ))}
            {!behind.length && <p className="text-sm text-muted-foreground text-center py-6">{loading ? "Loading..." : "Every enrolled trainee has been active recently."}</p>}
            {behind.length > 0 && <Button variant="link" asChild className="px-0"><Link to="/bdl/progress">See full progress</Link></Button>}
          </CardContent>
        </Card>
      </DashboardShell>
    </DashboardLayout>
  );
};

export default withRoleAccess(BDLCoordinatorDashboard, { requiredRoles: [...BDL_ROLES] });
