import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, CheckCircle } from "lucide-react";
import { FormattedConflict } from "@/services/scheduler/conflictReporter";

interface ConflictPanelProps {
  conflicts: FormattedConflict[];
}

const ConflictPanel = ({ conflicts }: ConflictPanelProps) => {
  if (conflicts.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <CheckCircle className="h-12 w-12 text-primary mx-auto mb-3" />
          <p className="font-medium">No Conflicts</p>
          <p className="text-sm text-muted-foreground mt-1">
            All lessons were successfully placed in the timetable.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            {conflicts.length} Conflict{conflicts.length !== 1 ? 's' : ''} Detected
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {conflicts.map((c, idx) => (
            <div
              key={idx}
              className={`flex items-start gap-3 p-3 rounded-lg border ${
                c.severity === 'error' ? 'border-destructive/30 bg-destructive/5' : 'border-yellow-500/30 bg-yellow-50 dark:bg-yellow-900/10'
              }`}
            >
              <span className="text-xl">{c.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-sm">{c.title}</span>
                  <Badge variant={c.severity === 'error' ? 'destructive' : 'outline'} className="text-xs">
                    {c.severity}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">{c.description}</p>
                <div className="flex gap-3 mt-1 text-xs text-muted-foreground">
                  {c.courseName && <span>Course: {c.courseName}</span>}
                  {c.className && <span>Class: {c.className}</span>}
                  {c.trainerName && <span>Trainer: {c.trainerName}</span>}
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
};

export default ConflictPanel;
