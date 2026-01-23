import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, TrendingUp, Users, GraduationCap, BookOpen, Award } from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { hodNavItems } from "@/lib/navigationConfig";
import { useProfile } from "@/hooks/useProfile";
import { useHODStats } from "@/hooks/useHODStats";
import { EnrollmentChart, FeeCollectionChart } from "@/components/dashboard/DashboardCharts";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

const HODDashboard = () => {
  const { data: profile } = useProfile();
  const { data: stats, isLoading } = useHODStats();
  const navigate = useNavigate();

  // Sample chart data - in production this would come from hooks
  const enrollmentData = [
    { name: "Electrical", value: 45 },
    { name: "Plumbing", value: 32 },
    { name: "Carpentry", value: 28 },
    { name: "Welding", value: 38 },
  ];

  const competencyData = [
    { name: "Competent", value: stats?.competencyRate || 0 },
    { name: "Not Yet", value: 100 - (stats?.competencyRate || 0) },
  ];

  return (
    <DashboardLayout
      title={`Welcome back, ${profile?.firstname || 'User'}`}
      subtitle="Department overview and reporting"
      navItems={hodNavItems}
      groupLabel="Department Management"
    >
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Trainees</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-8 w-20" />
              ) : (
                <>
                  <div className="text-2xl font-bold">{stats?.totalTrainees || 0}</div>
                  <p className="text-xs text-muted-foreground">Active trainees</p>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Trainers</CardTitle>
              <GraduationCap className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-8 w-20" />
              ) : (
                <>
                  <div className="text-2xl font-bold">{stats?.totalTrainers || 0}</div>
                  <p className="text-xs text-muted-foreground">Active trainers</p>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Competency Rate</CardTitle>
              <Award className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-8 w-20" />
              ) : (
                <>
                  <div className="text-2xl font-bold">{stats?.competencyRate || 0}%</div>
                  <p className="text-xs text-muted-foreground">Assessment pass rate</p>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Classes</CardTitle>
              <BookOpen className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-8 w-20" />
              ) : (
                <>
                  <div className="text-2xl font-bold">{stats?.totalClasses || 0}</div>
                  <p className="text-xs text-muted-foreground">
                    Across {stats?.totalTrades || 0} trades
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Charts Section */}
        <div className="grid gap-4 md:grid-cols-2">
          <EnrollmentChart data={enrollmentData} />
          <FeeCollectionChart data={competencyData} />
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Department management and reporting</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Button
              variant="outline"
              className="h-auto py-4 flex-col gap-2"
              onClick={() => navigate("/reports")}
            >
              <FileText className="h-5 w-5" />
              <span>View Reports</span>
            </Button>
            <Button
              variant="outline"
              className="h-auto py-4 flex-col gap-2"
              onClick={() => navigate("/assessment-results")}
            >
              <TrendingUp className="h-5 w-5" />
              <span>Assessments</span>
            </Button>
            <Button
              variant="outline"
              className="h-auto py-4 flex-col gap-2"
              onClick={() => navigate("/classes")}
            >
              <BookOpen className="h-5 w-5" />
              <span>Manage Classes</span>
            </Button>
            <Button
              variant="outline"
              className="h-auto py-4 flex-col gap-2"
              onClick={() => navigate("/trainers")}
            >
              <Users className="h-5 w-5" />
              <span>View Trainers</span>
            </Button>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default HODDashboard;
