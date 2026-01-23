import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, CheckCircle, Clock, AlertCircle, UserCheck, Briefcase, Building, BookOpen } from "lucide-react";
import { headOfTraineeSupportNavItems } from "@/lib/navigationConfig";
import { useTraineeUpdateRequests } from "@/hooks/useTraineeUpdateRequests";
import { useTrainees } from "@/hooks/useTrainees";
import { useNavigate } from "react-router-dom";

const HeadOfTraineeSupportDashboard = () => {
  const navigate = useNavigate();
  const { data: pendingRequests } = useTraineeUpdateRequests("pending");
  const { data: trainees } = useTrainees();

  const stats = [
    {
      title: "Pending Approvals",
      value: pendingRequests?.length || 0,
      icon: Clock,
      color: "text-amber-600",
      bgColor: "bg-amber-50",
      onClick: () => navigate("/trainee-support/pending-approvals"),
    },
    {
      title: "Total Trainees",
      value: trainees?.length || 0,
      icon: Users,
      color: "text-blue-600",
      bgColor: "bg-blue-50",
    },
    {
      title: "Registration Tasks",
      value: 12,
      icon: UserCheck,
      color: "text-green-600",
      bgColor: "bg-green-50",
    },
    {
      title: "Active Placements",
      value: 45,
      icon: Briefcase,
      color: "text-purple-600",
      bgColor: "bg-purple-50",
    },
  ];

  const officerActivities = [
    {
      title: "Registration Officer",
      icon: UserCheck,
      pendingTasks: 8,
      completedThisWeek: 24,
      color: "text-blue-600",
    },
    {
      title: "Placement Officer",
      icon: Briefcase,
      pendingTasks: 5,
      completedThisWeek: 18,
      color: "text-purple-600",
    },
    {
      title: "Liaison Officer",
      icon: Users,
      pendingTasks: 3,
      completedThisWeek: 12,
      color: "text-green-600",
    },
    {
      title: "Hostel Coordinator",
      icon: Building,
      pendingTasks: 7,
      completedThisWeek: 15,
      color: "text-amber-600",
    },
    {
      title: "Resource Center",
      icon: BookOpen,
      pendingTasks: 2,
      completedThisWeek: 9,
      color: "text-cyan-600",
    },
  ];

  return (
    <DashboardLayout
      title="Head of Trainee Support Dashboard"
      subtitle="Manage and oversee all trainee support operations"
      navItems={headOfTraineeSupportNavItems}
      groupLabel="Trainee Support"
    >
      <div className="space-y-6">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((stat) => {
            const Icon = stat.icon;
            return (
              <Card
                key={stat.title}
                className={stat.onClick ? "cursor-pointer hover:shadow-md transition-shadow" : ""}
                onClick={stat.onClick}
              >
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    {stat.title}
                  </CardTitle>
                  <div className={`p-2 rounded-lg ${stat.bgColor}`}>
                    <Icon className={`h-4 w-4 ${stat.color}`} />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stat.value}</div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Pending Approvals Alert */}
        {pendingRequests && pendingRequests.length > 0 && (
          <Card className="border-amber-200 bg-amber-50">
            <CardHeader>
              <div className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-amber-600" />
                <CardTitle className="text-amber-900">Action Required</CardTitle>
              </div>
              <CardDescription className="text-amber-700">
                You have {pendingRequests.length} pending approval request{pendingRequests.length !== 1 ? "s" : ""} waiting for your review
              </CardDescription>
            </CardHeader>
          </Card>
        )}

        {/* Officer Activity Overview */}
        <Card>
          <CardHeader>
            <CardTitle>Department Supervision</CardTitle>
            <CardDescription>Activity summary from your team officers</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {officerActivities.map((officer) => {
                const Icon = officer.icon;
                return (
                  <Card key={officer.title}>
                    <CardHeader className="pb-3">
                      <div className="flex items-center gap-2">
                        <Icon className={`h-5 w-5 ${officer.color}`} />
                        <CardTitle className="text-sm">{officer.title}</CardTitle>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Pending:</span>
                        <Badge variant="secondary">{officer.pendingTasks}</Badge>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Completed (This Week):</span>
                        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                          {officer.completedThisWeek}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Trainee Overview */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Trainee Status Overview</CardTitle>
              <CardDescription>Current trainee distribution</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm">Active Trainees</span>
                <Badge>{trainees?.filter(t => t.status === "active").length || 0}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">With Pending Updates</span>
                <Badge variant="secondary">
                  {trainees?.filter(t => t.has_pending_update).length || 0}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Full Time</span>
                <Badge variant="outline">
                  {trainees?.filter(t => t.training_mode === "fulltime").length || 0}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Block & Day Release</span>
                <Badge variant="outline">
                  {trainees?.filter(t => t.training_mode === "bdl").length || 0}
                </Badge>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
              <CardDescription>Latest updates from your team</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-start gap-3 text-sm">
                  <CheckCircle className="h-4 w-4 text-green-600 mt-0.5" />
                  <div>
                    <p className="font-medium">Trainee registered</p>
                    <p className="text-muted-foreground text-xs">Registration Officer • 2 hours ago</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 text-sm">
                  <Clock className="h-4 w-4 text-amber-600 mt-0.5" />
                  <div>
                    <p className="font-medium">Enrollment update pending</p>
                    <p className="text-muted-foreground text-xs">Registration Officer • 5 hours ago</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 text-sm">
                  <CheckCircle className="h-4 w-4 text-green-600 mt-0.5" />
                  <div>
                    <p className="font-medium">Placement arranged</p>
                    <p className="text-muted-foreground text-xs">Placement Officer • Yesterday</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default HeadOfTraineeSupportDashboard;
