import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, BookOpen, Calendar, GraduationCap, ChevronRight, ClipboardList, MessageSquare, FileText, Clock } from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { trainerNavItems } from "@/lib/navigationConfig";
import { useProfile } from "@/hooks/useProfile";
import { useTrainerStats } from "@/hooks/useTrainerStats";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";

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

  const greeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  };

  return (
    <DashboardLayout
      title=""
      subtitle=""
      navItems={trainerNavItems}
      groupLabel="Trainer Tools"
    >
      <div className="space-y-8">
        {/* Hero greeting */}
        <div className="rounded-xl bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border p-6">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/15 text-primary">
              <GraduationCap className="h-7 w-7" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">
                {greeting()}, {profile?.firstname || "Trainer"}
              </h1>
              <p className="text-muted-foreground mt-0.5">
                Here's an overview of your classes and assessments
              </p>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="relative overflow-hidden">
            <div className="absolute top-0 right-0 h-20 w-20 translate-x-4 -translate-y-4 rounded-full bg-primary/10" />
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">My Classes</CardTitle>
              <BookOpen className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              {isLoading ? <Skeleton className="h-8 w-16" /> : (
                <div className="text-3xl font-bold">{stats?.myClasses || 0}</div>
              )}
              <p className="text-xs text-muted-foreground mt-1">Active this term</p>
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden">
            <div className="absolute top-0 right-0 h-20 w-20 translate-x-4 -translate-y-4 rounded-full bg-secondary/20" />
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Students</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {isLoading ? <Skeleton className="h-8 w-16" /> : (
                <div className="text-3xl font-bold">{stats?.totalStudents || 0}</div>
              )}
              <p className="text-xs text-muted-foreground mt-1">Across all classes</p>
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden">
            <div className="absolute top-0 right-0 h-20 w-20 translate-x-4 -translate-y-4 rounded-full bg-accent/30" />
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Gradebooks</CardTitle>
              <ClipboardList className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {isLoading ? <Skeleton className="h-8 w-16" /> : (
                <div className="text-3xl font-bold">{stats?.myClasses || 0}</div>
              )}
              <p className="text-xs text-muted-foreground mt-1">Active gradebooks</p>
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden">
            <div className="absolute top-0 right-0 h-20 w-20 translate-x-4 -translate-y-4 rounded-full bg-destructive/10" />
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Attendance</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">—</div>
              <p className="text-xs text-muted-foreground mt-1">Today's registers</p>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <div>
          <h2 className="text-lg font-semibold mb-3">Quick Actions</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {[
              { icon: BookOpen, label: "Gradebooks", desc: "Manage marks", url: "/gradebooks", color: "text-primary" },
              { icon: ClipboardList, label: "Attendance", desc: "Mark register", url: "/attendance", color: "text-primary" },
              { icon: Users, label: "My Classes", desc: "View students", url: "/classes", color: "text-primary" },
              { icon: Calendar, label: "Timetable", desc: "View schedule", url: "/timetable", color: "text-primary" },
              { icon: MessageSquare, label: "Messages", desc: "Inbox", url: "/messages", color: "text-primary" },
            ].map(({ icon: Icon, label, desc, url, color }) => (
              <button
                key={url}
                onClick={() => navigate(url)}
                className="flex items-center gap-3 rounded-lg border bg-card p-4 text-left transition-all hover:bg-accent hover:shadow-sm active:scale-[0.98]"
              >
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 ${color}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="font-medium text-sm">{label}</p>
                  <p className="text-xs text-muted-foreground">{desc}</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* My Classes Detail */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  <GraduationCap className="h-5 w-5 text-primary" /> My Classes
                </CardTitle>
                <CardDescription>Classes assigned to you with enrolled students</CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={() => navigate("/classes")}>
                View All <ChevronRight className="h-3.5 w-3.5 ml-1" />
              </Button>
            </div>
          </CardHeader>
          <Separator />
          <CardContent className="pt-4">
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2].map(i => <Skeleton key={i} className="h-20 w-full rounded-lg" />)}
              </div>
            ) : stats?.classes && stats.classes.length > 0 ? (
              <div className="space-y-3">
                {stats.classes.map((cls) => (
                  <div
                    key={cls.id}
                    className="group flex items-center justify-between rounded-lg border p-4 transition-all hover:border-primary/30 hover:bg-accent/50 cursor-pointer"
                    onClick={() => navigate('/classes')}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="font-semibold">{cls.class_name}</span>
                        <Badge variant="outline" className="text-xs font-mono">{cls.class_code}</Badge>
                        <Badge variant="secondary" className="text-xs">{trainingModeLabel(cls.training_mode)}</Badge>
                      </div>
                      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1"><BookOpen className="h-3 w-3" />{cls.trade_name}</span>
                        <span>Level {cls.level}</span>
                        <span>{cls.academic_year}</span>
                      </div>
                      {cls.capacity && (
                        <div className="mt-2.5 flex items-center gap-2">
                          <Progress value={(cls.student_count / cls.capacity) * 100} className="h-1.5 flex-1 max-w-[200px]" />
                          <span className="text-xs text-muted-foreground font-medium">{cls.student_count}/{cls.capacity}</span>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-4 ml-4">
                      <div className="text-right">
                        <div className="text-2xl font-bold">{cls.student_count}</div>
                        <div className="text-xs text-muted-foreground">students</div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-10 text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                  <BookOpen className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-medium mb-1">No Classes Assigned</h3>
                <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                  You haven't been assigned to any classes yet. Contact your Head of Training for assignment.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default TrainerDashboard;
