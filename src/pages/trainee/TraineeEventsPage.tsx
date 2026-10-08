import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { traineeNavItems } from "@/lib/navigationConfig";
import { withRoleAccess } from "@/components/withRoleAccess";
import { useExtracurricularEvents } from "@/hooks/useTraineeAffairs";
import { useOrganizationContext } from "@/hooks/useOrganizationContext";
import { htmlTable, printHtml } from "@/lib/printDocument";

const TraineeEventsPage = () => {
  const { data, isLoading } = useExtracurricularEvents();
  const { organizationName, settings } = useOrganizationContext();
  const cutoff = Date.now() - 30 * 86400000; // upcoming events plus the last 30 days
  const events = (data ?? []).filter((e) => new Date(e.start_date).getTime() >= cutoff);
  const upcoming = events.filter((e) => new Date(e.start_date).getTime() >= Date.now());
  const label = (c: string) => c.replace(/_/g, " ");

  const print = () =>
    printHtml("Calendar of activities",
      htmlTable(["Date", "Activity", "Type", "Venue"], events.map((e) => [new Date(e.start_date).toLocaleString(), e.title, label(e.category), e.location ?? ""])),
      { name: organizationName, logoUrl: settings?.logo_url });

  return (
    <DashboardLayout title="Calendar & Events" subtitle="Sport, clubs, trade fairs, workshops and other activities" navItems={traineeNavItems} groupLabel="Trainee iEnabler">
      <Card className="border-0 shadow-md">
        <CardHeader className="flex-row items-start justify-between space-y-0">
          <div><CardTitle>Activities</CardTitle><CardDescription>You are reminded before each event. {upcoming.length} coming up.</CardDescription></div>
          <Button variant="outline" size="sm" disabled={!events.length} onClick={print}><Printer className="h-4 w-4 mr-2" />Print</Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {events.map((e) => {
            const past = new Date(e.start_date).getTime() < Date.now();
            return (
              <div key={e.id} className={`border rounded-md p-3 text-sm ${past ? "opacity-60" : ""}`}>
                <div className="flex justify-between items-center gap-2">
                  <span className="font-medium">{e.title}</span>
                  <Badge variant="secondary">{label(e.category)}</Badge>
                </div>
                <div className="text-muted-foreground">{new Date(e.start_date).toLocaleString()}{e.location ? ` · ${e.location}` : ""}</div>
                {e.description && <p className="mt-1">{e.description}</p>}
              </div>
            );
          })}
          {!isLoading && !events.length && <p className="text-sm text-muted-foreground text-center py-8">No activities are scheduled.</p>}
        </CardContent>
      </Card>
    </DashboardLayout>
  );
};

export default withRoleAccess(TraineeEventsPage, { requiredRoles: ["trainee"] });
