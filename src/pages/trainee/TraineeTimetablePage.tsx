import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Clock, MapPin, User } from "lucide-react";
import { LoadingIndicator } from "@/components/ui/loading-spinner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DashboardLayout } from "@/components/DashboardLayout";
import { traineeNavItems } from "@/lib/navigationConfig";
import { withRoleAccess } from "@/components/withRoleAccess";
import { useTraineeUserId, useTraineeRecord } from "@/hooks/useTraineePortalData";
import { useTraineeTimetable } from "@/hooks/useTraineeTimetable";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
const hhmm = (t?: string) => (t ? t.slice(0, 5) : "");

const TraineeTimetablePage = () => {
  const userId = useTraineeUserId();
  const { data: trainee, isLoading: tLoading, error: tError } = useTraineeRecord(userId);
  const { data, isLoading: ttLoading, error } = useTraineeTimetable(trainee?.id, trainee?.organization_id);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    if (tError) toast.error(`Could not load your record: ${(tError as Error).message}`);
  }, [tError]);
  useEffect(() => {
    if (error) toast.error(`Could not load your timetable: ${(error as Error).message}`);
  }, [error]);

  const entries = useMemo(() => data?.entries ?? [], [data]);
  // one choice per academic year + term, newest first
  const options = useMemo(() => {
    const keys = Array.from(new Set(entries.map((e) => `${e.academic_year}|${e.term}`)));
    return keys.sort((a, b) => {
      const [ya, ta] = a.split("|"); const [yb, tb] = b.split("|");
      return yb.localeCompare(ya) || Number(tb) - Number(ta);
    });
  }, [entries]);
  const active = selected && options.includes(selected) ? selected : options[0];

  const timeOf = (day: string, period: number) => data?.periods.find((p) => p.day === day && p.period_number === period);
  const visible = useMemo(() => entries.filter((e) => `${e.academic_year}|${e.term}` === active), [entries, active]);

  const wrap = (children: React.ReactNode) => (
    <DashboardLayout title="Class Timetable" subtitle="Your weekly lessons" navItems={traineeNavItems} groupLabel="Trainee iEnabler">{children}</DashboardLayout>
  );

  if (tLoading || ttLoading) return wrap(<div className="flex items-center justify-center h-64"><LoadingIndicator className="h-8 w-8 text-muted-foreground" /></div>);
  if (error || tError) return wrap(<Card><CardContent className="py-8 text-center text-destructive">Error loading your timetable: {((error ?? tError) as Error).message}</CardContent></Card>);
  if (!visible.length) {
    return wrap(
      <Card><CardContent className="py-16 text-center">
        <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
        <h3 className="font-semibold text-lg">No timetable yet</h3>
        <p className="text-muted-foreground text-sm mt-1">{data?.classCount ? "No lessons have been scheduled for your class yet." : "You are not enrolled in an active class."}</p>
      </CardContent></Card>,
    );
  }

  const [year, term] = (active ?? "|").split("|");
  return wrap(
    <div className="space-y-4 max-w-4xl">
      {options.length > 1 && (
        <Select value={active} onValueChange={setSelected}>
          <SelectTrigger className="w-full sm:w-[240px]"><SelectValue /></SelectTrigger>
          <SelectContent>{options.map((o) => { const [y, t] = o.split("|"); return <SelectItem key={o} value={o}>{y} - Term {t}</SelectItem>; })}</SelectContent>
        </Select>
      )}
      {DAYS.map((day) => {
        const items = visible.filter((e) => e.day === day).sort((a, b) => a.period_number - b.period_number);
        if (!items.length) return null;
        return (
          <Card key={day}>
            <CardHeader className="pb-3"><CardTitle className="text-base">{day}</CardTitle><CardDescription>{year} - Term {term}</CardDescription></CardHeader>
            <CardContent className="space-y-2">
              {items.map((e) => {
                const p = timeOf(e.day, e.period_number);
                return (
                  <div key={e.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-lg border p-3">
                    <div>
                      <p className="font-semibold">{e.courses?.name ?? "Lesson"}{e.courses?.code ? ` (${e.courses.code})` : ""}</p>
                      <p className="text-xs text-muted-foreground">{e.classes?.class_name}</p>
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{p ? `${hhmm(p.start_time)}-${hhmm(p.end_time)}` : `Period ${e.period_number}`}</span>
                      {e.training_rooms && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{e.training_rooms.name}</span>}
                      {e.trainers && <span className="flex items-center gap-1"><User className="h-3 w-3" />{e.trainers.full_name}</span>}
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        );
      })}
    </div>,
  );
};

export default withRoleAccess(TraineeTimetablePage, { requiredRoles: ["trainee"] });
