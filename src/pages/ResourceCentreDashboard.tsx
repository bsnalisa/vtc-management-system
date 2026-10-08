import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { AlertCircle, BookOpen, BookMarked, Clock, Coins, Library as LibraryIcon, MessageSquare, LifeBuoy, ClipboardList, Users, BarChart3, Repeat } from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { withRoleAccess } from "@/components/withRoleAccess";
import { useRoleNavigation } from "@/hooks/useRoleNavigation";
import { useProfile } from "@/hooks/useProfile";
import { useResourceCentreStats } from "@/hooks/useResourceCentreStats";
import { ResourceCentreCharts } from "@/components/resource-centre/ResourceCentreCharts";

function ResourceCentreDashboard() {
  const navigate = useNavigate();
  const { navItems, groupLabel } = useRoleNavigation();
  const { data: profile } = useProfile();
  const { data: s, isLoading, error } = useResourceCentreStats();

  useEffect(() => {
    if (error) toast.error(`Could not load resource centre figures: ${(error as Error).message}`);
  }, [error]);

  const stats = s
    ? [
        { label: "Titles", value: s.titles, icon: BookOpen, hint: "In the catalogue" },
        { label: "Copies available", value: `${s.availableCopies}/${s.totalCopies}`, icon: LibraryIcon, hint: "Available / total", tone: "accent" as const },
        { label: "Active loans", value: s.activeLoans, icon: Repeat, hint: "Currently on loan" },
        { label: "Overdue loans", value: s.overdueLoans, icon: Clock, hint: "Past the due date", tone: s.overdueLoans > 0 ? ("destructive" as const) : ("secondary" as const) },
        { label: "Fines outstanding", value: `N$${s.finesOutstanding.toFixed(2)}`, icon: Coins, hint: "Unpaid balance", tone: s.finesOutstanding > 0 ? ("destructive" as const) : ("secondary" as const) },
        { label: "Pending reservations", value: s.pendingReservations, icon: BookMarked, hint: "Waiting or ready" },
        { label: "Active members", value: s.activeMembers, icon: Users, hint: "Registered borrowers", tone: "secondary" as const },
      ]
    : [];

  return (
    <DashboardLayout title={`Welcome back, ${profile?.firstname || "User"}`} subtitle="Resource centre operations" navItems={navItems} groupLabel={groupLabel}>
      <DashboardShell
        name={profile?.firstname || undefined}
        heroIcon={LibraryIcon}
        heroSubtitle="Catalogue, circulation, members and fines at a glance."
        stats={stats}
        actions={[
          { icon: BookOpen, label: "Catalogue", desc: "Add and find items", url: "/library?tab=catalogue" },
          { icon: Repeat, label: "Circulation", desc: "Issue and return", url: "/library?tab=circulation", badge: s?.overdueLoans },
          { icon: Users, label: "Members", desc: "Register borrowers", url: "/library?tab=members" },
          { icon: Coins, label: "Fines", desc: "Collect and waive", url: "/library?tab=fines" },
          { icon: BarChart3, label: "Reports", desc: "Reports and settings", url: "/library?tab=reports" },
          { icon: MessageSquare, label: "Messages", desc: "Inbox", url: "/messages" },
          { icon: LifeBuoy, label: "Support Tickets", desc: "Ask for help", url: "/support-tickets" },
          { icon: ClipboardList, label: "Onboarding", desc: "Your checklist", url: "/onboarding" },
        ]}
        actionCols={4}
      >
        {isLoading && <div className="flex justify-center py-6"><LoadingSpinner text="Loading resource centre figures" /></div>}
        {error && (
          <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertDescription>Resource centre figures could not be loaded: {(error as Error).message}</AlertDescription></Alert>
        )}
        {s && (
          <>
            <ResourceCentreCharts stats={s} />
            <div className="grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader><CardTitle>Overdue loans</CardTitle><CardDescription>Oldest due dates first</CardDescription></CardHeader>
                <CardContent className="space-y-2">
                  {s.overdueList.length === 0 && <p className="text-sm text-muted-foreground">No loans are overdue.</p>}
                  {s.overdueList.map((l) => (
                    <div key={l.id} className="flex items-center justify-between gap-2 border-b pb-2">
                      <div className="min-w-0"><p className="font-medium truncate">{l.title}</p><p className="text-sm text-muted-foreground truncate">{l.member}</p></div>
                      <Badge variant="destructive" className="shrink-0">Due {l.due_date}</Badge>
                    </div>
                  ))}
                  {s.overdueLoans > s.overdueList.length && <Button variant="link" className="px-0" onClick={() => navigate("/library?tab=circulation")}>View all {s.overdueLoans} overdue loans</Button>}
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle>Reservations waiting</CardTitle><CardDescription>Oldest requests first</CardDescription></CardHeader>
                <CardContent className="space-y-2">
                  {s.reservationList.length === 0 && <p className="text-sm text-muted-foreground">No reservations are waiting.</p>}
                  {s.reservationList.map((r) => (
                    <div key={r.id} className="flex items-center justify-between gap-2 border-b pb-2">
                      <div className="min-w-0"><p className="font-medium truncate">{r.title}</p><p className="text-sm text-muted-foreground truncate">{r.member}</p></div>
                      <Badge variant="secondary" className="shrink-0 capitalize">{r.status}</Badge>
                    </div>
                  ))}
                  {s.pendingReservations > s.reservationList.length && <Button variant="link" className="px-0" onClick={() => navigate("/library?tab=reservations")}>View all {s.pendingReservations} reservations</Button>}
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </DashboardShell>
    </DashboardLayout>
  );
}

export default withRoleAccess(ResourceCentreDashboard, {
  requiredRoles: ["resource_center_coordinator", "librarian", "admin", "organization_admin", "super_admin"],
});
