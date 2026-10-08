import { Link } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { DashboardLayout } from "@/components/DashboardLayout";
import { withRoleAccess } from "@/components/withRoleAccess";
import { useRoleNavigation } from "@/hooks/useRoleNavigation";
import { useBdlClasses } from "@/hooks/useBdl";
import { BDL_ROLES, NoBdlClasses } from "@/components/bdl/BdlClassSelect";

const BdlCourses = () => {
  const { navItems, groupLabel } = useRoleNavigation();
  const { data: classes = [], isLoading, error } = useBdlClasses();

  return (
    <DashboardLayout title="Blended Classes" subtitle="Classes delivered through blended or distance learning" navItems={navItems} groupLabel={groupLabel}>
      <div className="space-y-4">
        {isLoading && <LoadingSpinner text="Loading classes..." />}
        {error && <p className="text-sm text-destructive">Could not load classes: {(error as Error).message}</p>}
        {!isLoading && !error && !classes.length && <Card className="border-0 shadow-md"><CardContent><NoBdlClasses /></CardContent></Card>}
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {classes.map((c) => (
            <Card key={c.id} className="border-0 shadow-md">
              <CardHeader>
                <CardTitle className="text-base">{c.class_name}</CardTitle>
                <CardDescription>{c.class_code} - Level {c.level} - {c.academic_year}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <dl className="grid grid-cols-2 gap-x-3 gap-y-1">
                  <dt className="text-muted-foreground">Trade</dt><dd>{c.trade_name ?? "-"}</dd>
                  <dt className="text-muted-foreground">Trainer</dt><dd>{c.trainer_name ?? "Not assigned"}</dd>
                  <dt className="text-muted-foreground">Enrolled trainees</dt><dd>{c.enrolled}</dd>
                </dl>
                <div className="flex gap-2 flex-wrap">
                  <Badge variant="secondary">{c.items_published} content</Badge>
                  <Badge variant="secondary">{c.assignments} assignments</Badge>
                  <Badge variant="secondary">{c.quizzes} quizzes</Badge>
                </div>
                <Button asChild className="w-full"><Link to={`/learning?class=${c.id}`}>Open learning space</Link></Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default withRoleAccess(BdlCourses, { requiredRoles: [...BDL_ROLES] });
