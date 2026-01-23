import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ClipboardCheck, Users, FileText, BookOpen, Calendar } from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { trainerNavItems } from "@/lib/navigationConfig";
import { useProfile } from "@/hooks/useProfile";
import { useTrainerStats } from "@/hooks/useTrainerStats";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";

const TrainerDashboard = () => {
  const navigate = useNavigate();
  const { data: profile } = useProfile();
  const { data: stats, isLoading } = useTrainerStats();
  
  return (
    <DashboardLayout
      title={`Welcome back, ${profile?.firstname || 'User'}`}
      subtitle="Manage your classes and attendance"
      navItems={trainerNavItems}
      groupLabel="Trainer Tools"
    >
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">My Classes</CardTitle>
              <BookOpen className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <>
                  <div className="text-2xl font-bold">{stats?.myClasses || 0}</div>
                  <p className="text-xs text-muted-foreground">Active classes assigned</p>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Students</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <>
                  <div className="text-2xl font-bold">{stats?.totalStudents || 0}</div>
                  <p className="text-xs text-muted-foreground">Across all classes</p>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Attendance Today</CardTitle>
              <ClipboardCheck className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <>
                  <div className="text-2xl font-bold">{stats?.attendanceRate || 0}%</div>
                  <p className="text-xs text-muted-foreground">
                    {stats?.presentToday || 0} of {stats?.attendanceToday || 0} recorded
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">This Week</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">-</div>
              <p className="text-xs text-muted-foreground">Sessions completed</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Common trainer tasks</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-3">
            <Button 
              variant="outline" 
              className="h-auto py-4 flex-col gap-2"
              onClick={() => navigate('/attendance')}
            >
              <ClipboardCheck className="h-6 w-6 text-primary" />
              <div className="text-center">
                <p className="font-medium">Mark Attendance</p>
                <p className="text-xs text-muted-foreground">Record student attendance</p>
              </div>
            </Button>
            <Button 
              variant="outline" 
              className="h-auto py-4 flex-col gap-2"
              onClick={() => navigate('/classes')}
            >
              <BookOpen className="h-6 w-6 text-primary" />
              <div className="text-center">
                <p className="font-medium">My Classes</p>
                <p className="text-xs text-muted-foreground">View assigned classes</p>
              </div>
            </Button>
            <Button 
              variant="outline" 
              className="h-auto py-4 flex-col gap-2"
              onClick={() => navigate('/reports')}
            >
              <FileText className="h-6 w-6 text-primary" />
              <div className="text-center">
                <p className="font-medium">View Reports</p>
                <p className="text-xs text-muted-foreground">Class attendance reports</p>
              </div>
            </Button>
          </CardContent>
        </Card>

        {stats?.myClasses === 0 && !isLoading && (
          <Card className="border-dashed">
            <CardContent className="py-8 text-center">
              <BookOpen className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
              <h3 className="text-lg font-medium mb-2">No Classes Assigned</h3>
              <p className="text-muted-foreground mb-4">
                You haven't been assigned to any classes yet. Contact your administrator.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
};

export default TrainerDashboard;
