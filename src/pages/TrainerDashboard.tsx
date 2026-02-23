import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ClipboardCheck, Users, BookOpen, Calendar, AlertTriangle, RotateCcw, GraduationCap, ChevronRight } from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { trainerNavItems } from "@/lib/navigationConfig";
import { useProfile } from "@/hooks/useProfile";
import { useTrainerStats } from "@/hooks/useTrainerStats";
import { useAssessmentResultsByStatus } from "@/hooks/useAssessmentResults";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

const TrainerDashboard = () => {
  const navigate = useNavigate();
  const { data: profile } = useProfile();
  const { data: stats, isLoading } = useTrainerStats();
  
  const { data: draftResults } = useAssessmentResultsByStatus(["draft", "returned_to_trainer"]);
  const { data: submittedResults } = useAssessmentResultsByStatus(["submitted_by_trainer"]);

  const draftCount = draftResults?.length || 0;
  const returnedCount = draftResults?.filter((r: any) => r.assessment_status === "returned_to_trainer").length || 0;
  const submittedCount = submittedResults?.length || 0;

  const trainingModeLabel = (mode: string) => {
    switch (mode) {
      case "fulltime": return "Full-time";
      case "bdl": return "BDL";
      case "shortcourse": return "Short Course";
      default: return mode;
    }
  };

  return (
    <DashboardLayout
      title={`Welcome back, ${profile?.firstname || 'Trainer'}`}
      subtitle="Your classes and assessment overview"
      navItems={trainerNavItems}
      groupLabel="Trainer Tools"
    >
      <div className="space-y-6">
        {/* Stats Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card className="border-l-4 border-l-primary">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">My Classes</CardTitle>
              <BookOpen className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              {isLoading ? <Skeleton className="h-8 w-16" /> : (
                <>
                  <div className="text-2xl font-bold">{stats?.myClasses || 0}</div>
                  <p className="text-xs text-muted-foreground">Active classes assigned</p>
                </>
              )}
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-blue-500">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Students</CardTitle>
              <Users className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              {isLoading ? <Skeleton className="h-8 w-16" /> : (
                <>
                  <div className="text-2xl font-bold">{stats?.totalStudents || 0}</div>
                  <p className="text-xs text-muted-foreground">Across all classes</p>
                </>
              )}
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-green-500">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Draft Assessments</CardTitle>
              <ClipboardCheck className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{draftCount}</div>
              <p className="text-xs text-muted-foreground">Ready to submit</p>
            </CardContent>
          </Card>

          <Card className={`border-l-4 ${returnedCount > 0 ? "border-l-amber-500 bg-amber-50/30 dark:bg-amber-950/10" : "border-l-muted"}`}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Returned</CardTitle>
              <RotateCcw className={`h-4 w-4 ${returnedCount > 0 ? "text-amber-500" : "text-muted-foreground"}`} />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${returnedCount > 0 ? "text-amber-600" : ""}`}>{returnedCount}</div>
              <p className="text-xs text-muted-foreground">Need revision</p>
            </CardContent>
          </Card>
        </div>

        {/* Alerts */}
        {returnedCount > 0 && (
          <Card className="border-amber-300 bg-amber-50/30 dark:bg-amber-950/10">
            <CardContent className="py-4">
              <div className="flex items-center gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0" />
                <div className="flex-1">
                  <p className="font-medium">You have {returnedCount} returned assessment(s)</p>
                  <p className="text-sm text-muted-foreground">The Head of Training returned these for revision. Please review and resubmit.</p>
                </div>
                <Button variant="outline" onClick={() => navigate('/assessment-results')}>Review Now</Button>
              </div>
            </CardContent>
          </Card>
        )}

        {submittedCount > 0 && (
          <Card className="border-blue-200 bg-blue-50/30 dark:bg-blue-950/10">
            <CardContent className="py-4">
              <div className="flex items-center gap-3">
                <ClipboardCheck className="h-5 w-5 text-blue-500 shrink-0" />
                <div>
                  <p className="font-medium">{submittedCount} assessment(s) pending HoT review</p>
                  <p className="text-sm text-muted-foreground">These have been submitted and are awaiting Head of Training approval.</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* My Classes Detail */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <GraduationCap className="h-5 w-5" /> My Classes
            </CardTitle>
            <CardDescription>Classes assigned to you with enrolled students</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2].map(i => <Skeleton key={i} className="h-20 w-full" />)}
              </div>
            ) : stats?.classes && stats.classes.length > 0 ? (
              <div className="space-y-3">
                {stats.classes.map((cls) => (
                  <div
                    key={cls.id}
                    className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors cursor-pointer"
                    onClick={() => navigate('/classes')}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold">{cls.class_name}</span>
                        <Badge variant="outline" className="text-xs">{cls.class_code}</Badge>
                      </div>
                      <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                        <span>{cls.trade_name}</span>
                        <span>•</span>
                        <span>Level {cls.level}</span>
                        <span>•</span>
                        <span>{trainingModeLabel(cls.training_mode)}</span>
                        <span>•</span>
                        <span>{cls.academic_year}</span>
                      </div>
                      {cls.capacity && (
                        <div className="mt-2 flex items-center gap-2">
                          <Progress value={(cls.student_count / cls.capacity) * 100} className="h-1.5 flex-1 max-w-[200px]" />
                          <span className="text-xs text-muted-foreground">{cls.student_count}/{cls.capacity} students</span>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-3 ml-4">
                      <div className="text-right">
                        <div className="text-2xl font-bold">{cls.student_count}</div>
                        <div className="text-xs text-muted-foreground">enrolled</div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center">
                <BookOpen className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                <h3 className="text-lg font-medium mb-2">No Classes Assigned</h3>
                <p className="text-muted-foreground">You haven't been assigned to any classes yet. Contact your Head of Training.</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Common trainer tasks</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Button variant="outline" className="h-auto py-4 flex-col gap-2" onClick={() => navigate('/assessment-results')}>
              <ClipboardCheck className="h-6 w-6 text-primary" />
              <div className="text-center">
                <p className="font-medium">Capture Marks</p>
                <p className="text-xs text-muted-foreground">Record & submit assessments</p>
              </div>
            </Button>
            <Button variant="outline" className="h-auto py-4 flex-col gap-2" onClick={() => navigate('/attendance')}>
              <ClipboardCheck className="h-6 w-6 text-primary" />
              <div className="text-center">
                <p className="font-medium">Mark Attendance</p>
                <p className="text-xs text-muted-foreground">Record student attendance</p>
              </div>
            </Button>
            <Button variant="outline" className="h-auto py-4 flex-col gap-2" onClick={() => navigate('/gradebooks')}>
              <BookOpen className="h-6 w-6 text-primary" />
              <div className="text-center">
                <p className="font-medium">Gradebooks</p>
                <p className="text-xs text-muted-foreground">Manage gradebooks</p>
              </div>
            </Button>
            <Button variant="outline" className="h-auto py-4 flex-col gap-2" onClick={() => navigate('/timetable')}>
              <Calendar className="h-6 w-6 text-primary" />
              <div className="text-center">
                <p className="font-medium">Timetable</p>
                <p className="text-xs text-muted-foreground">View schedule</p>
              </div>
            </Button>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default TrainerDashboard;
