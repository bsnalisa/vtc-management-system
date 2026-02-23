import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Lock, Unlock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TimePeriodRow } from "@/hooks/useScheduler";

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

interface TimetableGridProps {
  entries: any[];
  timeStructure: TimePeriodRow[];
  isLoading: boolean;
  onToggleLock: (id: string, currentlyLocked: boolean) => void;
  courseNames: Map<string, string>;
  classNames: Map<string, string>;
  trainerNames: Map<string, string>;
}

const TimetableGrid = ({
  entries,
  timeStructure,
  isLoading,
  onToggleLock,
  courseNames,
  classNames,
  trainerNames,
}: TimetableGridProps) => {
  // Get unique periods (non-break) sorted
  const periods = timeStructure
    .filter(t => !t.is_break)
    .reduce((acc, t) => {
      if (!acc.find(p => p.period_number === t.period_number)) {
        acc.push(t);
      }
      return acc;
    }, [] as TimePeriodRow[])
    .sort((a, b) => a.period_number - b.period_number);

  // Also include breaks for display
  const allPeriods = timeStructure
    .reduce((acc, t) => {
      if (!acc.find(p => p.period_number === t.period_number)) {
        acc.push(t);
      }
      return acc;
    }, [] as TimePeriodRow[])
    .sort((a, b) => a.period_number - b.period_number);

  // Group entries by class
  const classesByEntry = new Map<string, any[]>();
  entries.forEach(e => {
    const classId = e.class_id;
    if (!classesByEntry.has(classId)) classesByEntry.set(classId, []);
    classesByEntry.get(classId)!.push(e);
  });

  const getEntry = (classEntries: any[], day: string, period: number) => {
    return classEntries.find(e => e.day === day && e.period_number === period);
  };

  if (isLoading) {
    return <div className="text-center py-12 text-muted-foreground">Loading timetable...</div>;
  }

  if (entries.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          No timetable entries yet. Click "Generate Timetable" to create one.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-8">
      {Array.from(classesByEntry.entries()).map(([classId, classEntries]) => {
        const className = classEntries[0]?.classes?.class_name || classNames.get(classId) || classId;

        return (
          <Card key={classId}>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{className}</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto p-0">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="p-2 text-left font-medium text-muted-foreground w-24">Period</th>
                    {DAYS.map(day => (
                      <th key={day} className="p-2 text-center font-medium text-muted-foreground">{day}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {allPeriods.map(period => {
                    if (period.is_break) {
                      return (
                        <tr key={period.period_number} className="bg-muted/50">
                          <td colSpan={6} className="p-1 text-center text-xs text-muted-foreground italic">
                            {period.label || 'Break'} ({period.start_time} - {period.end_time})
                          </td>
                        </tr>
                      );
                    }

                    return (
                      <tr key={period.period_number} className="border-b last:border-0">
                        <td className="p-2 text-xs text-muted-foreground">
                          <div className="font-medium">{period.label || `P${period.period_number}`}</div>
                          <div>{period.start_time}-{period.end_time}</div>
                        </td>
                        {DAYS.map(day => {
                          const entry = getEntry(classEntries, day, period.period_number);
                          if (!entry) {
                            return <td key={day} className="p-1 text-center text-muted-foreground/30">—</td>;
                          }

                          const courseName = entry.courses?.name || courseNames.get(entry.course_id) || '?';
                          const trainer = entry.trainers?.full_name || trainerNames.get(entry.trainer_id) || '';
                          const room = entry.training_rooms?.name || '';

                          return (
                            <td key={day} className="p-1">
                              <div className={`rounded-md p-1.5 text-xs border ${
                                entry.is_locked ? 'bg-accent/60 border-primary/30' : 'bg-card border-border'
                              }`}>
                                <div className="font-medium truncate">{courseName}</div>
                                <div className="text-muted-foreground truncate">{trainer}</div>
                                <div className="flex items-center justify-between mt-0.5">
                                  <span className="text-muted-foreground truncate">{room}</span>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-4 w-4 shrink-0"
                                    onClick={() => onToggleLock(entry.id, entry.is_locked)}
                                  >
                                    {entry.is_locked ? (
                                      <Lock className="h-3 w-3 text-primary" />
                                    ) : (
                                      <Unlock className="h-3 w-3 text-muted-foreground" />
                                    )}
                                  </Button>
                                </div>
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};

export default TimetableGrid;
