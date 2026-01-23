import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Shield, Settings, MessageSquare, Activity, BookOpen } from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useNavigate } from "react-router-dom";
import { SidebarGroupLabel, SidebarGroupContent } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { useUsers } from "@/hooks/useUsers";
import { useOrganizationContext } from "@/hooks/useOrganizationContext";
import { useSupportTickets } from "@/hooks/useSupportTickets";
import { useOrganizationModules } from "@/hooks/useModules";
import { organizationAdminNavItems } from "@/lib/navigationConfig";
import { useProfile } from "@/hooks/useProfile";
import { EnrollmentTrendChart, ModuleUsageChart } from "@/components/dashboard/DashboardCharts";

const OrganizationAdminDashboard = () => {
  const navigate = useNavigate();
  const { organizationId } = useOrganizationContext();
  const { data: users } = useUsers(organizationId);
  const { data: tickets } = useSupportTickets();
  const { data: organizationModules } = useOrganizationModules(organizationId);
  const { data: profile } = useProfile();

  const activeUsers = users?.length || 0;
  const openTickets = tickets?.filter(t => t.status === 'open').length || 0;
  const activeModules = organizationModules?.filter(m => m.enabled).length || 0;

  // Sample trend data - in production this would come from analytics
  const enrollmentTrends = [
    { month: "Jan", enrollments: 45, completions: 12 },
    { month: "Feb", enrollments: 52, completions: 18 },
    { month: "Mar", enrollments: 48, completions: 22 },
    { month: "Apr", enrollments: 61, completions: 28 },
    { month: "May", enrollments: 55, completions: 35 },
    { month: "Jun", enrollments: 67, completions: 40 },
  ];

  const moduleUsageData = [
    { name: "Trainees", value: 156 },
    { name: "Finance", value: 89 },
    { name: "Reports", value: 67 },
    { name: "Classes", value: 45 },
    { name: "Settings", value: 23 },
  ];

  const statsContent = (
    <>
      <SidebarGroupLabel>Quick Stats</SidebarGroupLabel>
      <SidebarGroupContent>
        <div className="space-y-3 px-2 py-1">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Active Users</span>
            <span className="font-medium text-primary">{activeUsers}</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Open Tickets</span>
            <span className="font-medium text-orange-600">{openTickets}</span>
          </div>
        </div>
      </SidebarGroupContent>
    </>
  );

  return (
    <DashboardLayout
      title={`Welcome back, ${profile?.firstname || 'User'}`}
      subtitle="Technical & Administrative Management"
      navItems={organizationAdminNavItems}
      groupLabel="Navigation"
      statsContent={statsContent}
    >
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="text-right">
            <p className="text-sm text-muted-foreground">System Role</p>
            <p className="text-lg font-semibold text-foreground">Organization Administrator</p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Users</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{users?.length || 0}</div>
              <p className="text-xs text-muted-foreground">{activeUsers} active</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Open Tickets</CardTitle>
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{openTickets}</div>
              <p className="text-xs text-muted-foreground">Support requests</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">System Status</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">Healthy</div>
              <p className="text-xs text-muted-foreground">All systems operational</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Modules</CardTitle>
              <BookOpen className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{activeModules}</div>
              <p className="text-xs text-muted-foreground">
                Modules available under subscription
              </p>
              <Button 
                variant="link" 
                size="sm" 
                className="px-0 mt-2 h-auto"
                onClick={() => navigate('/modules-management')}
              >
                Manage Modules →
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Charts Section */}
        <div className="grid gap-4 md:grid-cols-3">
          <EnrollmentTrendChart data={enrollmentTrends} />
          <ModuleUsageChart data={moduleUsageData} />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                User Management
              </CardTitle>
              <CardDescription>Manage system users and access</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button className="w-full" onClick={() => navigate('/users')}>
                View All Users
              </Button>
              <Button variant="outline" className="w-full" onClick={() => navigate('/roles')}>
                Manage Roles
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Organization Settings
              </CardTitle>
              <CardDescription>Configure organization preferences</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button className="w-full" onClick={() => navigate('/organization-settings')}>
                Organization Settings
              </Button>
              <Button variant="outline" className="w-full" onClick={() => navigate('/system-logs')}>
                View System Logs
              </Button>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Administrative tasks and controls</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Button variant="outline" className="h-auto py-4 flex-col gap-2" onClick={() => navigate('/users')}>
                <Users className="h-5 w-5" />
                <span>User Registration</span>
              </Button>
              <Button variant="outline" className="h-auto py-4 flex-col gap-2" onClick={() => navigate('/roles')}>
                <Shield className="h-5 w-5" />
                <span>Role Assignment</span>
              </Button>
              <Button variant="outline" className="h-auto py-4 flex-col gap-2" onClick={() => navigate('/support-tickets')}>
                <MessageSquare className="h-5 w-5" />
                <span>Support Tickets</span>
              </Button>
              <Button variant="outline" className="h-auto py-4 flex-col gap-2" onClick={() => navigate('/organization-settings')}>
                <Settings className="h-5 w-5" />
                <span>Settings</span>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default OrganizationAdminDashboard;
