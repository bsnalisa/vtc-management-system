import { useMemo, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useRoleNavigation } from "@/hooks/useRoleNavigation";
import { withRoleAccess } from "@/components/withRoleAccess";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { AssessmentRequest, useAssessmentRequests } from "@/hooks/useAssessmentRequests";
import { ScheduleDialog } from "@/components/rpl/ScheduleDialog";

const dayKey = (iso: string) => new Date(iso).toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" });
const time = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

const RplSchedule = () => {
  const { navItems, groupLabel } = useRoleNavigation();
  const { data, isLoading, error } = useAssessmentRequests("rpl");
  const [target, setTarget] = useState<AssessmentRequest | null>(null);

  const { days, unscheduled } = useMemo(() => {
    const all = data ?? [];
    const scheduled = all.filter((r) => r.scheduled_at && r.status === "assessment_scheduled")
      .sort((a, b) => new Date(a.scheduled_at!).getTime() - new Date(b.scheduled_at!).getTime());
    const groups = new Map<string, AssessmentRequest[]>();
    scheduled.forEach((r) => { const k = dayKey(r.scheduled_at!); groups.set(k, [...(groups.get(k) ?? []), r]); });
    return {
      days: Array.from(groups.entries()),
      unscheduled: all.filter((r) => r.status === "submitted" || r.status === "under_review" || r.status === "more_info_needed"),
    };
  }, [data]);

  return (
    <DashboardLayout title="RPL Schedule" subtitle="Plan and track RPL assessment sessions" navItems={navItems} groupLabel={groupLabel}>
      {isLoading ? <LoadingSpinner text="Loading schedule..." /> : error ? (
        <p role="alert" className="text-sm text-destructive">Could not load the schedule: {(error as Error).message}</p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader><CardTitle>Scheduled assessments</CardTitle><CardDescription>Grouped by day, earliest first</CardDescription></CardHeader>
            <CardContent className="space-y-5">
              {days.map(([day, items]) => (
                <section key={day} aria-label={day}>
                  <h3 className="mb-2 text-sm font-semibold">{day}</h3>
                  <ul className="space-y-2">
                    {items.map((r) => (
                      <li key={r.id} className="flex flex-col gap-2 rounded-md border p-3 text-sm sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <div className="font-medium">{time(r.scheduled_at!)} - {r.applicant_name} <Badge variant="outline" className="ml-1">{r.reference_number}</Badge></div>
                          <div className="text-muted-foreground">{r.qualifications?.qualification_title ?? "No qualification"}</div>
                          <div className="text-muted-foreground">Venue: {r.venue ?? "-"} · Assessor: {r.assessor_name ?? "-"}</div>
                        </div>
                        <Button size="sm" variant="outline" onClick={() => setTarget(r)}>Reschedule</Button>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
              {!days.length && <p className="text-sm text-muted-foreground text-center py-6">No assessments scheduled.</p>}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Unscheduled ({unscheduled.length})</CardTitle><CardDescription>Applications that still need an assessment date</CardDescription></CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {unscheduled.map((r) => (
                  <li key={r.id} className="flex flex-col gap-2 rounded-md border p-3 text-sm sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="font-medium">{r.applicant_name} <Badge variant="outline" className="ml-1">{r.reference_number}</Badge></div>
                      <div className="text-muted-foreground">{r.qualifications?.qualification_title ?? "No qualification"} · {r.status.replace(/_/g, " ")}</div>
                    </div>
                    <Button size="sm" onClick={() => setTarget(r)}>Schedule</Button>
                  </li>
                ))}
              </ul>
              {!unscheduled.length && <p className="text-sm text-muted-foreground text-center py-6">Nothing waiting for a date.</p>}
            </CardContent>
          </Card>
        </div>
      )}
      <ScheduleDialog request={target} onClose={() => setTarget(null)} />
    </DashboardLayout>
  );
};

export default withRoleAccess(RplSchedule, {
  requiredRoles: ["rpl_coordinator", "assessment_coordinator", "admin", "organization_admin", "head_of_training"],
});
