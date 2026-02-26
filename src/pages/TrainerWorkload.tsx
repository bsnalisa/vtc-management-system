import { DashboardLayout } from "@/components/DashboardLayout";
import { useRoleNavigation } from "@/hooks/useRoleNavigation";
import { withRoleAccess } from "@/components/withRoleAccess";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, Users, Clock, BookOpen } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganizationContext } from "@/hooks/useOrganizationContext";

const MAX_WEEKLY_HOURS = 30;
const MAX_CLASSES = 8;

interface TrainerWorkloadData {
  id: string;
  full_name: string;
  trainer_id: string;
  email: string;
  class_count: number;
  total_periods: number;
  qualifications: string[];
  weekly_hours: number;
}

const useTrainerWorkload = () => {
  const { organizationId } = useOrganizationContext();

  return useQuery({
    queryKey: ["trainer-workload", organizationId],
    queryFn: async () => {
      if (!organizationId) return [];

      // Get trainers
      const { data: trainers, error: tError } = await supabase
        .from("trainers")
        .select("id, full_name, trainer_id, email")
        .eq("organization_id", organizationId)
        .eq("active", true);

      if (tError) throw tError;

      // Get classes per trainer
      const { data: classes, error: cError } = await supabase
        .from("classes")
        .select("id, trainer_id, qualification_id, qualifications:qualification_id(qualification_title)")
        .eq("organization_id", organizationId)
        .eq("active", true);

      if (cError) throw cError;

      // Get timetable entries for period count
      const { data: timetableEntries, error: teError } = await supabase
        .from("timetable_entries")
        .select("id, trainer_id")
        .eq("organization_id", organizationId);

      if (teError) throw teError;

      return (trainers || []).map((trainer): TrainerWorkloadData => {
        const trainerClasses = (classes || []).filter((c: any) => c.trainer_id === trainer.id);
        const trainerPeriods = (timetableEntries || []).filter((e: any) => e.trainer_id === trainer.id);
        const qualNames = [...new Set(
          trainerClasses
            .map((c: any) => c.qualifications?.qualification_title)
            .filter(Boolean)
        )];

        return {
          id: trainer.id,
          full_name: trainer.full_name || "Unknown",
          trainer_id: trainer.trainer_id || "",
          email: trainer.email || "",
          class_count: trainerClasses.length,
          total_periods: trainerPeriods.length,
          qualifications: qualNames as string[],
          weekly_hours: trainerPeriods.length, // 1 period ≈ 1 hour
        };
      });
    },
    enabled: !!organizationId,
  });
};

const TrainerWorkloadPage = () => {
  const { navItems, groupLabel } = useRoleNavigation();
  const { data: workload, isLoading } = useTrainerWorkload();

  const overloaded = workload?.filter((t) => t.weekly_hours > MAX_WEEKLY_HOURS || t.class_count > MAX_CLASSES) || [];

  return (
    <DashboardLayout
      title="Trainer Workload"
      subtitle="Review trainer allocation and identify overloads"
      navItems={navItems}
      groupLabel={groupLabel}
    >
      <div className="space-y-6">
        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Trainers</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{workload?.length || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg Weekly Hours</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {workload?.length
                  ? Math.round(workload.reduce((sum, t) => sum + t.weekly_hours, 0) / workload.length)
                  : 0}
              </div>
            </CardContent>
          </Card>
          <Card className={overloaded.length > 0 ? "border-destructive" : ""}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Overloaded</CardTitle>
              <AlertTriangle className={`h-4 w-4 ${overloaded.length > 0 ? "text-destructive" : "text-muted-foreground"}`} />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${overloaded.length > 0 ? "text-destructive" : ""}`}>
                {overloaded.length}
              </div>
              <p className="text-xs text-muted-foreground">&gt;{MAX_WEEKLY_HOURS}h/week or &gt;{MAX_CLASSES} classes</p>
            </CardContent>
          </Card>
        </div>

        {/* Workload Table */}
        <Card>
          <CardHeader>
            <CardTitle>Trainer Allocation Summary</CardTitle>
            <CardDescription>Review each trainer's class count, weekly hours, and linked qualifications.</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Trainer</TableHead>
                    <TableHead>ID</TableHead>
                    <TableHead>Classes</TableHead>
                    <TableHead>Weekly Hours</TableHead>
                    <TableHead>Qualifications</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {workload?.map((trainer) => {
                    const isOverloaded = trainer.weekly_hours > MAX_WEEKLY_HOURS || trainer.class_count > MAX_CLASSES;
                    return (
                      <TableRow key={trainer.id} className={isOverloaded ? "bg-destructive/5" : ""}>
                        <TableCell className="font-medium">{trainer.full_name}</TableCell>
                        <TableCell className="text-muted-foreground font-mono text-sm">{trainer.trainer_id}</TableCell>
                        <TableCell>{trainer.class_count}</TableCell>
                        <TableCell>{trainer.weekly_hours}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {trainer.qualifications.length > 0
                              ? trainer.qualifications.map((q, i) => (
                                  <Badge key={i} variant="outline" className="text-xs">{q}</Badge>
                                ))
                              : <span className="text-muted-foreground text-sm">None assigned</span>}
                          </div>
                        </TableCell>
                        <TableCell>
                          {isOverloaded ? (
                            <Badge variant="destructive" className="flex items-center gap-1 w-fit">
                              <AlertTriangle className="h-3 w-3" /> Overloaded
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-green-600 border-green-600">Normal</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default withRoleAccess(TrainerWorkloadPage, {
  requiredRoles: ["head_of_training"],
});
