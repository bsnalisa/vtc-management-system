import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { AlertCircle, ClipboardCheck, FileText, FileBarChart, History, LifeBuoy, Settings, Shield, UserCheck, Users, CalendarClock, GraduationCap, Boxes } from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { useRoleNavigation } from "@/hooks/useRoleNavigation";
import { useProfile } from "@/hooks/useProfile";
import { useOrganizationContext } from "@/hooks/useOrganizationContext";
import { useOrganizationModules } from "@/hooks/useModules";
import { useMyTasks } from "@/hooks/useWorkflows";
import { useOrgAdminStats } from "@/hooks/useOrgAdminStats";
import { SetupChecklist } from "@/components/org-admin/SetupChecklist";

const label = (v: string) => v.replace(/_/g, " ");

const OrganizationAdminDashboard = () => {
  const navigate = useNavigate();
  const { navItems, groupLabel } = useRoleNavigation();
  const { organizationId } = useOrganizationContext();
  const { data: profile } = useProfile();
  const { data: s, isLoading, error } = useOrgAdminStats();
  const { data: modules, error: modulesError } = useOrganizationModules(organizationId);
  const { data: tasks, error: tasksError } = useMyTasks();

  useEffect(() => {
    const e = error ?? modulesError ?? tasksError;
    if (e) toast.error(`Could not load some dashboard figures: ${(e as Error).message}`);
  }, [error, modulesError, tasksError]);

  const trainees = s?.traineesByStatus.reduce((n, t) => n + t.count, 0) ?? 0;
  const pending = tasks?.length ?? 0;

  return (
    <DashboardLayout title={`Welcome back, ${profile?.firstname || "User"}`} subtitle="Centre administration" navItems={navItems} groupLabel={groupLabel}>
      <DashboardShell
        name={profile?.firstname || undefined}
        heroIcon={Settings}
        heroSubtitle="Users, setup, approvals and modules for your centre."
        stats={[
          { label: "Users", value: s?.totalUsers ?? 0, icon: Users, loading: isLoading, hint: "With a role in this centre" },
          { label: "Trainees", value: trainees, icon: GraduationCap, loading: isLoading, hint: "All statuses" },
          { label: "Applications this month", value: s?.applicationsThisMonth ?? 0, icon: FileText, loading: isLoading, tone: "secondary" },
          { label: "Open tickets", value: s?.openTickets ?? 0, icon: LifeBuoy, loading: isLoading, tone: (s?.openTickets ?? 0) > 0 ? "destructive" : "secondary", hint: "Open or in progress" },
          { label: "Pending approvals", value: pending, icon: ClipboardCheck, hint: "Waiting for you", tone: pending > 0 ? "destructive" : "secondary" },
          { label: "Enabled modules", value: modules?.length ?? 0, icon: Boxes, hint: "Under your subscription", tone: "accent" },
        ]}
        actions={[
          { icon: Users, label: "Users", desc: "Accounts and roles", url: "/users" },
          { icon: Settings, label: "Organization Settings", desc: "Logo and identity", url: "/organization-settings" },
          { icon: Shield, label: "Roles", desc: "Role management", url: "/roles" },
          { icon: CalendarClock, label: "Registration Windows", desc: "Application periods", url: "/registration-windows" },
          { icon: FileText, label: "Document Settings", desc: "Templates and numbering", url: "/document-settings" },
          { icon: FileBarChart, label: "Reports", desc: "Centre reports", url: "/reports" },
          { icon: History, label: "System Logs", desc: "Audit trail", url: "/system-logs" },
          { icon: UserCheck, label: "My Approvals", desc: "Pending tasks", url: "/my-approvals", badge: pending },
        ]}
        actionCols={4}
      >
        {isLoading && <div className="flex justify-center py-6"><LoadingSpinner text="Loading centre figures" /></div>}
        {error && <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertDescription>Centre figures could not be loaded: {(error as Error).message}</AlertDescription></Alert>}
        {s && (
          <>
            <SetupChecklist setup={s.setup} />
            <div className="grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader><CardTitle>Users by role</CardTitle><CardDescription>Distinct users per role</CardDescription></CardHeader>
                <CardContent className="space-y-2">
                  {s.usersByRole.length === 0 && <p className="text-sm text-muted-foreground">No users have roles yet.</p>}
                  {s.usersByRole.map((r) => (
                    <div key={r.role} className="flex items-center justify-between border-b pb-2 last:border-0">
                      <span className="text-sm capitalize">{label(r.role)}</span><Badge variant="secondary">{r.count}</Badge>
                    </div>
                  ))}
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle>Trainees by status</CardTitle><CardDescription>Everyone registered in this centre</CardDescription></CardHeader>
                <CardContent className="space-y-2">
                  {s.traineesByStatus.length === 0 && <p className="text-sm text-muted-foreground">No trainees have been registered yet.</p>}
                  {s.traineesByStatus.map((t) => (
                    <div key={t.status} className="flex items-center justify-between border-b pb-2 last:border-0">
                      <span className="text-sm capitalize">{label(t.status)}</span><Badge variant="secondary">{t.count}</Badge>
                    </div>
                  ))}
                  <Button variant="link" className="px-0" onClick={() => navigate("/trainees")}>Open trainee list</Button>
                </CardContent>
              </Card>
            </div>
            <Card>
              <CardHeader><CardTitle>Enabled modules</CardTitle><CardDescription>Features available to your centre</CardDescription></CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                {(modules ?? []).length === 0 && <p className="text-sm text-muted-foreground">No modules are enabled.</p>}
                {(modules ?? []).map((m) => <Badge key={m.id} variant="outline">{m.modules?.name ?? "Module"}</Badge>)}
                <Button variant="link" className="px-0 w-full justify-start" onClick={() => navigate("/modules-management")}>Manage modules</Button>
              </CardContent>
            </Card>
          </>
        )}
      </DashboardShell>
    </DashboardLayout>
  );
};

export default OrganizationAdminDashboard;
