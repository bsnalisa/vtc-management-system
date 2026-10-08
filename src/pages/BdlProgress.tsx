import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { ExportMenu } from "@/components/ExportMenu";
import { DashboardLayout } from "@/components/DashboardLayout";
import { withRoleAccess } from "@/components/withRoleAccess";
import { useRoleNavigation } from "@/hooks/useRoleNavigation";
import { INACTIVE_DAYS, ProgressRow, isInactive, overallPercent, useBdlClasses, useClassProgress } from "@/hooks/useBdl";
import { BDL_ROLES, BdlClassSelect, NoBdlClasses } from "@/components/bdl/BdlClassSelect";

const Bar = ({ done, total }: { done: number; total: number }) => (
  <div className="min-w-[8rem] space-y-1">
    <Progress value={total ? (done / total) * 100 : 0} className="h-2" />
    <div className="text-xs text-muted-foreground">{done} / {total}</div>
  </div>
);
const lastText = (d: string | null) => (d ? new Date(d).toLocaleDateString() : "No activity");

const BdlProgress = () => {
  const { navItems, groupLabel } = useRoleNavigation();
  const { data: classes = [], isLoading: loadingClasses, error: classError } = useBdlClasses();
  const [classId, setClassId] = useState("");
  useEffect(() => { if (!classId && classes.length) setClassId(classes[0].id); }, [classes, classId]);
  const { data: rows = [], isLoading, error } = useClassProgress(classId || undefined);

  const exportRows = () => rows.map((r: ProgressRow) => ({
    "Trainee no": r.trainee_number, Name: `${r.first_name} ${r.last_name}`,
    "Content done": `${r.items_done}/${r.items_total}`, "Assignments submitted": `${r.assignments_submitted}/${r.assignments_total}`,
    "Quizzes passed": `${r.quizzes_passed}/${r.quizzes_total}`, "Overall %": overallPercent(r), "Last activity": lastText(r.last_activity),
  }));

  return (
    <DashboardLayout title="Blended Progress" subtitle="How trainees are progressing through blended classes" navItems={navItems} groupLabel={groupLabel}>
      <div className="space-y-4">
        {classError && <p className="text-sm text-destructive">Could not load classes: {(classError as Error).message}</p>}
        {!loadingClasses && !classError && !classes.length && <Card className="border-0 shadow-md"><CardContent><NoBdlClasses /></CardContent></Card>}
        {classes.length > 0 && (
          <Card className="border-0 shadow-md">
            <CardHeader className="flex-row items-end justify-between space-y-0 gap-3 flex-wrap">
              <BdlClassSelect classes={classes} value={classId} onChange={setClassId} loading={loadingClasses} />
              <ExportMenu data={exportRows} filename="blended-progress" title="Blended class progress" disabled={!rows.length} />
            </CardHeader>
            <CardContent className="space-y-2">
              <CardDescription>Trainees with no activity for {INACTIVE_DAYS}+ days are highlighted.</CardDescription>
              {isLoading && <LoadingSpinner size="sm" text="Loading progress..." />}
              {error && <p className="text-sm text-destructive">Could not load progress: {(error as Error).message}</p>}
              <Table>
                <TableHeader>
                  <TableRow><TableHead>Trainee</TableHead><TableHead>Content</TableHead><TableHead>Assignments</TableHead><TableHead>Quizzes</TableHead><TableHead>Overall</TableHead><TableHead>Last activity</TableHead></TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => {
                    const inactive = isInactive(r.last_activity);
                    return (
                      <TableRow key={r.trainee_id} className={inactive ? "bg-destructive/5" : undefined}>
                        <TableCell>{r.first_name} {r.last_name}<div className="text-xs text-muted-foreground">{r.trainee_number}</div></TableCell>
                        <TableCell><Bar done={r.items_done} total={r.items_total} /></TableCell>
                        <TableCell><Bar done={r.assignments_submitted} total={r.assignments_total} /></TableCell>
                        <TableCell><Bar done={r.quizzes_passed} total={r.quizzes_total} /></TableCell>
                        <TableCell className="font-medium">{overallPercent(r)}%</TableCell>
                        <TableCell>{lastText(r.last_activity)} {inactive && <Badge variant="destructive" className="ml-1">Inactive {INACTIVE_DAYS}+ days</Badge>}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              {!isLoading && !error && !rows.length && <p className="text-sm text-muted-foreground text-center py-8">No active trainees are enrolled in this class.</p>}
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
};

export default withRoleAccess(BdlProgress, { requiredRoles: [...BDL_ROLES] });
