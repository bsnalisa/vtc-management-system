import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DashboardLayout } from "@/components/DashboardLayout";
import { traineeNavItems } from "@/lib/navigationConfig";
import { Calendar, Clock, BookOpen, Loader2 } from "lucide-react";
import { withRoleAccess } from "@/components/withRoleAccess";
import { useTraineeUserId, useTraineeRecord, useTraineeEnrollments, useTraineeAssessmentResults } from "@/hooks/useTraineePortalData";

const TraineeExamTimetablePage = () => {
  const userId = useTraineeUserId();
  const { data: trainee, isLoading: tLoading } = useTraineeRecord(userId);
  const { data: results, isLoading: rLoading } = useTraineeAssessmentResults(trainee?.id);

  const isLoading = tLoading || rLoading;

  if (isLoading) {
    return (
      <DashboardLayout title="Exam Timetable" subtitle="View your upcoming examinations" navItems={traineeNavItems} groupLabel="Trainee iEnabler">
        <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      </DashboardLayout>
    );
  }

  // Show pending assessments (unit standards not yet assessed)
  const pendingAssessments = results?.filter(r => !r.competency_status || r.competency_status === "pending") || [];
  const completedAssessments = results?.filter(r => r.competency_status === "competent" || r.competency_status === "not_yet_competent") || [];

  return (
    <DashboardLayout title="Exam Timetable" subtitle="View your assessments" navItems={traineeNavItems} groupLabel="Trainee iEnabler">
      <div className="space-y-6">
        {/* Pending Assessments */}
        <Card className="border-0 shadow-md">
          <CardHeader>
            <CardTitle>Pending Assessments</CardTitle>
            <CardDescription>{pendingAssessments.length} assessment(s) pending</CardDescription>
          </CardHeader>
          <CardContent>
            {pendingAssessments.length === 0 ? (
              <div className="text-center py-8">
                <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
                <h3 className="font-semibold">No Pending Assessments</h3>
                <p className="text-muted-foreground">All your assessments have been completed or none are scheduled yet.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {pendingAssessments.map((item: any) => (
                  <div key={item.id} className="flex flex-col md:flex-row md:items-center justify-between p-4 rounded-lg border hover:bg-muted/50 transition-colors">
                    <div className="flex items-start gap-4 mb-4 md:mb-0">
                      <div className="p-3 rounded-lg bg-primary/10"><BookOpen className="h-5 w-5 text-primary" /></div>
                      <div>
                        <h4 className="font-semibold">{item.unit_standards?.title || "Unit Standard"}</h4>
                        <p className="text-sm text-muted-foreground">{item.unit_standards?.unit_standard_id || ""} • {item.unit_standards?.credit || 0} credits</p>
                      </div>
                    </div>
                    <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />Pending</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Completed Assessments */}
        {completedAssessments.length > 0 && (
          <Card className="border-0 shadow-md">
            <CardHeader>
              <CardTitle>Completed Assessments</CardTitle>
              <CardDescription>{completedAssessments.length} assessment(s) completed</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {completedAssessments.map((item: any) => (
                  <div key={item.id} className="flex flex-col md:flex-row md:items-center justify-between p-4 rounded-lg border">
                    <div className="flex items-start gap-4 mb-4 md:mb-0">
                      <div className="p-3 rounded-lg bg-muted"><BookOpen className="h-5 w-5 text-muted-foreground" /></div>
                      <div>
                        <h4 className="font-medium">{item.unit_standards?.title || "Unit Standard"}</h4>
                        <div className="flex items-center gap-3 text-sm text-muted-foreground">
                          <span>{item.unit_standards?.unit_standard_id || ""}</span>
                          {item.assessment_date && (
                            <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{new Date(item.assessment_date).toLocaleDateString("en-ZA")}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {item.marks_obtained !== null && <span className="font-bold">{item.marks_obtained}%</span>}
                      <Badge className={item.competency_status === "competent" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}>
                        {item.competency_status === "competent" ? "Competent" : "Not Yet Competent"}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Exam Guidelines */}
        <Card className="border-0 shadow-md">
          <CardHeader><CardTitle>Examination Guidelines</CardTitle></CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              {["Arrive at least 30 minutes before the scheduled start time", "Bring your student ID card and examination permit", "No electronic devices allowed in the examination room", "For practical exams, wear appropriate PPE and safety gear", "Late arrivals may not be permitted to enter after 30 minutes"].map((rule, i) => (
                <li key={i} className="flex items-start gap-2"><div className="w-2 h-2 rounded-full bg-primary mt-2" /><span>{rule}</span></li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default withRoleAccess(TraineeExamTimetablePage, { requiredRoles: ["trainee"] });
