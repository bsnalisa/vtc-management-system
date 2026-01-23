import { DashboardLayout } from "@/components/DashboardLayout";
import { 
  adminNavItems, 
  organizationAdminNavItems,
  hodNavItems
} from "@/lib/navigationConfig";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useSuperAdminAnalytics } from "@/hooks/useAnalytics";
import { useAuditLogs } from "@/hooks/useAuditLogs";
import { Building2, Users, Package, Activity } from "lucide-react";
import { format } from "date-fns";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useUserRole } from "@/hooks/useUserRole";

export default function Analytics() {
  const { role } = useUserRole();
  const { data: analytics, isLoading } = useSuperAdminAnalytics();
  const { data: auditLogs } = useAuditLogs();
  
  const getNavItems = () => {
    switch (role) {
      case "organization_admin":
        return organizationAdminNavItems;
      case "hod":
        return hodNavItems;
      default:
        return adminNavItems;
    }
  };
  
  const navItems = getNavItems();

  if (isLoading) {
    return (
      <DashboardLayout
        title="Analytics"
        subtitle="Monitor system-wide metrics and activity"
        navItems={navItems}
        groupLabel="Navigation"
      >
        <div className="flex items-center justify-center h-64">
          <p>Loading analytics...</p>
        </div>
      </DashboardLayout>
    );
  }

  const stats = [
    {
      title: "Total Organizations",
      value: analytics?.totalOrganizations || 0,
      icon: Building2,
      color: "text-blue-600",
    },
    {
      title: "Active Organizations",
      value: analytics?.activeOrganizations || 0,
      icon: Activity,
      color: "text-green-600",
    },
    {
      title: "Total Users",
      value: analytics?.totalUsers || 0,
      icon: Users,
      color: "text-purple-600",
    },
    {
      title: "Active Packages",
      value: Object.keys(analytics?.packageUsage || {}).length,
      icon: Package,
      color: "text-orange-600",
    },
  ];

  return (
    <DashboardLayout
      title="Analytics"
      subtitle="Monitor system-wide metrics and activity"
      navItems={navItems}
      groupLabel="Navigation"
    >
      <div className="space-y-6">

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat) => (
            <Card key={stat.title}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
                <stat.icon className={`h-4 w-4 ${stat.color}`} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Package Usage Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {Object.entries(analytics?.packageUsage || {}).map(([packageName, count]) => (
                <div key={packageName} className="flex items-center justify-between">
                  <span className="font-medium">{packageName}</span>
                  <div className="flex items-center gap-4">
                    <div className="w-64 bg-secondary rounded-full h-2">
                      <div
                        className="bg-primary h-2 rounded-full"
                        style={{
                          width: `${(Number(count) / (analytics?.totalOrganizations || 1)) * 100}%`,
                        }}
                      />
                    </div>
                    <span className="text-sm text-muted-foreground w-12 text-right">
                      {String(count)} orgs
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent System Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Action</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {auditLogs && auditLogs.slice(0, 10).map((log: any) => (
                  <TableRow key={log.id}>
                    <TableCell className="font-medium">{log.action}</TableCell>
                    <TableCell>
                      {log.user?.profiles?.full_name || log.user?.email || "System"}
                    </TableCell>
                    <TableCell>
                      {format(new Date(log.created_at), "MMM d, yyyy HH:mm")}
                    </TableCell>
                  </TableRow>
                ))}
                {(!auditLogs || auditLogs.length === 0) && (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground">
                      No activity logs available
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
