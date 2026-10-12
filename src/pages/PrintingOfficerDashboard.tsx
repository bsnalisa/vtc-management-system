import { useNavigate } from "react-router-dom";
import { CalendarDays, CheckCircle2, ClipboardCheck, Printer, Users } from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useRoleNavigation } from "@/hooks/useRoleNavigation";
import { useProfile } from "@/hooks/useProfile";
import { useMyTasks } from "@/hooks/useWorkflows";
import { useSittings } from "@/hooks/useAssessmentDevelopment";

const today = () => new Date(new Date().toDateString());

// The Printing & Distribution Officer's home: sittings coming up and whether their papers are ready to print
const PrintingOfficerDashboard = () => {
  const navigate = useNavigate();
  const { navItems, groupLabel } = useRoleNavigation();
  const { data: profile } = useProfile();
  const { data: sittings, isLoading } = useSittings();
  const { data: tasks } = useMyTasks();

  const upcoming = (sittings ?? []).filter((s) => new Date(s.sitting_date) >= today()).sort((a, b) => (a.sitting_date < b.sitting_date ? -1 : 1));
  const toPrint = upcoming.filter((s) => s.paper_id && !s.printing_notified_at);
  const week = upcoming.filter((s) => new Date(s.sitting_date).getTime() - today().getTime() <= 7 * 86400000);
  const noPaper = upcoming.filter((s) => !s.paper_id);

  return (
    <DashboardLayout title={`Welcome back, ${profile?.firstname || "User"}`} subtitle="Printing & distribution" navItems={navItems} groupLabel={groupLabel}>
      <DashboardShell
        name={profile?.firstname || undefined}
        heroIcon={Printer}
        heroSubtitle="Assessment sittings coming up and what is ready to print."
        stats={[
          { label: "Upcoming sittings", value: upcoming.length, icon: CalendarDays, loading: isLoading, tone: "secondary" },
          { label: "This week", value: week.length, icon: Users, loading: isLoading, tone: week.length > 0 ? "primary" : "secondary" },
          { label: "Waiting to be printed", value: toPrint.length, icon: Printer, loading: isLoading, tone: toPrint.length > 0 ? "destructive" : "secondary", hint: "Paper chosen, not yet sent to you" },
          { label: "No paper chosen yet", value: noPaper.length, icon: CheckCircle2, loading: isLoading, tone: "accent" },
          { label: "Waiting for you", value: tasks?.length ?? 0, icon: ClipboardCheck, tone: (tasks?.length ?? 0) > 0 ? "destructive" : "secondary", hint: "Approvals" },
        ]}
        actions={[
          { icon: Printer, label: "Assessment Sittings", desc: "Papers and rosters", url: "/assessment-sittings" },
          { icon: ClipboardCheck, label: "My Approvals", desc: "Pending tasks", url: "/my-approvals", badge: tasks?.length },
        ]}
        actionCols={4}
      >
        <Card>
          <CardHeader><CardTitle>Next sittings</CardTitle><CardDescription>Soonest first</CardDescription></CardHeader>
          <CardContent className="space-y-2">
            {upcoming.length === 0 && <p className="text-sm text-muted-foreground">No sittings are scheduled.</p>}
            {upcoming.slice(0, 6).map((s) => (
              <button key={s.id} type="button" onClick={() => navigate("/assessment-sittings")} className="flex w-full items-center justify-between gap-3 border-b py-2 text-left last:border-0 hover:bg-muted/50">
                <span className="min-w-0"><span className="block break-words text-sm font-medium">{s.title}</span>
                  <span className="block text-xs text-muted-foreground">{new Date(s.sitting_date).toLocaleDateString()}{s.venue ? ` · ${s.venue}` : ""}</span></span>
                {!s.paper_id ? <Badge variant="outline">No paper yet</Badge> : s.printing_notified_at ? <Badge variant="secondary">Sent to print</Badge> : <Badge variant="destructive">To print</Badge>}
              </button>
            ))}
            <Button variant="link" className="px-0" onClick={() => navigate("/assessment-sittings")}>Open assessment sittings</Button>
          </CardContent>
        </Card>
      </DashboardShell>
    </DashboardLayout>
  );
};

export default PrintingOfficerDashboard;
