import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, BookOpen, Calendar, GraduationCap, ChevronRight, ClipboardList } from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { trainerNavItems } from "@/lib/navigationConfig";
import { useProfile } from "@/hooks/useProfile";
import { useTrainerStats } from "@/hooks/useTrainerStats";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

const TrainerDashboard = () => {
  const navigate = useNavigate();
  const { data: profile } = useProfile();
  const { data: stats, isLoading } = useTrainerStats();

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
      subtitle="Your classes and gradebook overview"
      navItems={trainerNavItems}
      groupLabel="Trainer Tools"
    >
      <div className="space-y-6">
        {/* Stats Grid */}
        <div className="grid gap-4 md:grid-cols-2">
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

          <Card className="border-l-4 border-l-secondary">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Students</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
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
        </div>

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
          <CardContent className="grid gap-4 md:grid-cols-3">
            <Button variant="outline" className="h-auto py-4 flex-col gap-2" onClick={() => navigate('/gradebooks')}>
              <BookOpen className="h-6 w-6 text-primary" />
              <div className="text-center">
                <p className="font-medium">Gradebooks</p>
                <p className="text-xs text-muted-foreground">Manage marks & assessments</p>
              </div>
            </Button>
            <Button variant="outline" className="h-auto py-4 flex-col gap-2" onClick={() => navigate('/attendance')}>
              <ClipboardList className="h-6 w-6 text-primary" />
              <div className="text-center">
                <p className="font-medium">Mark Attendance</p>
                <p className="text-xs text-muted-foreground">Record student attendance</p>
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
