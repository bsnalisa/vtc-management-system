import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, GraduationCap, BookOpen, Calendar, ClipboardCheck, BarChart3, FileText } from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useNavigate } from "react-router-dom";
import { useDashboardStats } from "@/hooks/useDashboardStats";
import { SidebarGroupLabel, SidebarGroupContent } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { headOfTrainingNavItems } from "@/lib/navigationConfig";
import { useProfile } from "@/hooks/useProfile";

const HeadOfTrainingDashboard = () => {
  const navigate = useNavigate();
  const { data: stats, isLoading } = useDashboardStats();
  const { data: profile } = useProfile();

  const statsContent = (
    <>
      <SidebarGroupLabel>Academic Stats</SidebarGroupLabel>
      <SidebarGroupContent>
        <div className="space-y-3 px-2 py-1">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Trainees</span>
            <span className="font-medium text-primary">{isLoading ? "..." : stats?.totalTrainees || 0}</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Trainers</span>
            <span className="font-medium text-primary">{isLoading ? "..." : stats?.totalTrainers || 0}</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Attendance</span>
            <span className="font-medium text-green-600">92.5%</span>
          </div>
        </div>
      </SidebarGroupContent>
    </>
  );

  return (
    <DashboardLayout
      title={`Welcome back, ${profile?.firstname || 'User'}`}
      subtitle="Academic & Training Operations Management"
      navItems={headOfTrainingNavItems}
      groupLabel="Training Management"
      statsContent={statsContent}
    >
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="text-right">
            <p className="text-sm text-muted-foreground">Academic Year</p>
            <p className="text-lg font-semibold text-foreground">2024/2025</p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Trainees</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{isLoading ? "..." : stats?.totalTrainees || 0}</div>
              <p className="text-xs text-muted-foreground">Active trainees</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Trainers</CardTitle>
              <GraduationCap className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{isLoading ? "..." : stats?.totalTrainers || 0}</div>
              <p className="text-xs text-muted-foreground">Teaching staff</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Attendance Rate</CardTitle>
              <ClipboardCheck className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">92.5%</div>
              <p className="text-xs text-muted-foreground">This month</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Training Modules</CardTitle>
              <BookOpen className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">24</div>
              <p className="text-xs text-muted-foreground">Active modules</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="h-5 w-5" />
                Training Management
              </CardTitle>
              <CardDescription>Manage curriculum and training modules</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button className="w-full" onClick={() => navigate('/training-modules')}>
                Training Modules
              </Button>
              <Button variant="outline" className="w-full" onClick={() => navigate('/classes')}>
                Class Management
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <GraduationCap className="h-5 w-5" />
                Staff & Trainee Management
              </CardTitle>
              <CardDescription>Manage trainers and trainees</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button className="w-full" onClick={() => navigate('/trainers')}>
                Trainer Management
              </Button>
              <Button variant="outline" className="w-full" onClick={() => navigate('/trainees')}>
                Trainee List
              </Button>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Academic and training operations</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Button variant="outline" className="h-auto py-4 flex-col gap-2" onClick={() => navigate('/timetable')}>
                <Calendar className="h-5 w-5" />
                <span>Timetable</span>
              </Button>
              <Button variant="outline" className="h-auto py-4 flex-col gap-2" onClick={() => navigate('/assessment-results')}>
                <ClipboardCheck className="h-5 w-5" />
                <span>Assessments</span>
              </Button>
              <Button variant="outline" className="h-auto py-4 flex-col gap-2" onClick={() => navigate('/analytics')}>
                <BarChart3 className="h-5 w-5" />
                <span>Analytics</span>
              </Button>
              <Button variant="outline" className="h-auto py-4 flex-col gap-2" onClick={() => navigate('/reports')}>
                <FileText className="h-5 w-5" />
                <span>Reports</span>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default HeadOfTrainingDashboard;
