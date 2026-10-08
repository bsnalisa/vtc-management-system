import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { DashboardLayout } from "@/components/DashboardLayout";
import { withRoleAccess } from "@/components/withRoleAccess";
import { useRoleNavigation } from "@/hooks/useRoleNavigation";
import { useBdlClasses } from "@/hooks/useBdl";
import { ContentTab } from "@/components/learning/ContentTab";
import { BDL_ROLES, BdlClassSelect, NoBdlClasses } from "@/components/bdl/BdlClassSelect";

const BdlMaterials = () => {
  const { navItems, groupLabel } = useRoleNavigation();
  const { data: classes = [], isLoading, error } = useBdlClasses();
  const [classId, setClassId] = useState("");
  useEffect(() => { if (!classId && classes.length) setClassId(classes[0].id); }, [classes, classId]);

  return (
    <DashboardLayout title="Blended Materials" subtitle="Learning content across blended classes" navItems={navItems} groupLabel={groupLabel}>
      <div className="space-y-4">
        {isLoading && <LoadingSpinner text="Loading classes..." />}
        {error && <p className="text-sm text-destructive">Could not load classes: {(error as Error).message}</p>}
        {!isLoading && !error && !classes.length && <Card className="border-0 shadow-md"><CardContent><NoBdlClasses /></CardContent></Card>}
        {classes.length > 0 && (
          <>
            <Card className="border-0 shadow-md">
              <CardHeader><CardTitle>Overview</CardTitle><CardDescription>Materials per blended class</CardDescription></CardHeader>
              <CardContent>
                <Table>
                  <TableHeader><TableRow><TableHead>Class</TableHead><TableHead className="text-right">Published</TableHead><TableHead className="text-right">Unpublished drafts</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {classes.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell>{c.class_name} <span className="text-muted-foreground">({c.class_code})</span></TableCell>
                        <TableCell className="text-right">{c.items_published}</TableCell>
                        <TableCell className="text-right">{c.items_draft > 0 ? <Badge variant="outline">{c.items_draft}</Badge> : 0}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-md"><CardContent className="pt-6"><BdlClassSelect classes={classes} value={classId} onChange={setClassId} /></CardContent></Card>
            {classId && <ContentTab key={classId} classId={classId} canManage />}
          </>
        )}
      </div>
    </DashboardLayout>
  );
};

export default withRoleAccess(BdlMaterials, { requiredRoles: [...BDL_ROLES] });
