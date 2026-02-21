import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useRoleActivity, useRoleActivitySummary } from "@/hooks/useRoleActivity";
import { useRoleNavigation } from "@/hooks/useRoleNavigation";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Activity, TrendingUp, Users, Zap } from "lucide-react";
import { format } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import { getRoleDisplayName } from "@/lib/roleUtils";
import { useProfile } from "@/hooks/useProfile";

export default function RoleActivityDashboard() {
  const { navItems, groupLabel } = useRoleNavigation();
  const { data: activitySummary, isLoading: summaryLoading } = useRoleActivitySummary();
  const { data: recentActivity, isLoading: activityLoading } = useRoleActivity();
  const { data: profile } = useProfile();

  // Group by role for the chart
  const roleChartData = activitySummary?.reduce((acc, curr) => {
    const existing = acc.find(item => item.role === curr.role);
    if (existing) {
      existing.activities += curr.activity_count;
      existing.users += curr.unique_users;
    } else {
      acc.push({
        role: getRoleDisplayName(curr.role as any) || curr.role,
        activities: curr.activity_count,
        users: curr.unique_users,
      });
    }
    return acc;
  }, [] as { role: string; activities: number; users: number }[]) || [];

  // Top modules by activity
  const topModules = activitySummary
    ?.sort((a, b) => b.activity_count - a.activity_count)
    .slice(0, 10) || [];

  // Calculate stats
  const totalActivities = activitySummary?.reduce((sum, item) => sum + item.activity_count, 0) || 0;
  const totalUsers = new Set(activitySummary?.map(item => item.unique_users) || []).size;
  const activeRoles = new Set(activitySummary?.map(item => item.role) || []).size;

  return (
    <DashboardLayout
      title={`Welcome back, ${profile?.firstname || 'User'}`}
      subtitle="Monitor role-based activity and usage patterns"
      navItems={navItems}
      groupLabel={groupLabel}
    >
      <div className="space-y-6">
        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Activities</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summaryLoading ? <Skeleton className="h-8 w-20" /> : totalActivities.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">Last 30 days</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Users</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summaryLoading ? <Skeleton className="h-8 w-20" /> : totalUsers}</div>
              <p className="text-xs text-muted-foreground">Unique users</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Roles</CardTitle>
              <Zap className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summaryLoading ? <Skeleton className="h-8 w-20" /> : activeRoles}</div>
              <p className="text-xs text-muted-foreground">In use</p>
            </CardContent>
          </Card>
        </div>

        {/* Activity by Role Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Activity by Role</CardTitle>
            <CardDescription>Distribution of activities across different roles</CardDescription>
          </CardHeader>
          <CardContent>
            {summaryLoading ? (
              <Skeleton className="h-80 w-full" />
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={roleChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="role" angle={-45} textAnchor="end" height={100} />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="activities" fill="hsl(var(--primary))" name="Activities" />
                  <Bar dataKey="users" fill="hsl(var(--chart-2))" name="Users" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Top Modules */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Most Active Modules
              </CardTitle>
              <CardDescription>Modules with highest usage in the last 30 days</CardDescription>
            </CardHeader>
            <CardContent>
              {summaryLoading ? (
                <div className="space-y-2">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Module</TableHead>
                      <TableHead className="text-right">Activities</TableHead>
                      <TableHead className="text-right">Users</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {topModules.map((item) => (
                      <TableRow key={`${item.role}-${item.module_code}`}>
                        <TableCell className="font-medium">
                          <div>
                            <div className="text-sm">{item.module_code.replace(/_/g, ' ')}</div>
                            <div className="text-xs text-muted-foreground">
                              {getRoleDisplayName(item.role as any) || item.role}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge variant="secondary">{item.activity_count}</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge variant="outline">{item.unique_users}</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Recent Activity */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Recent Activity
              </CardTitle>
              <CardDescription>Latest user activities across all roles</CardDescription>
            </CardHeader>
            <CardContent>
              {activityLoading ? (
                <div className="space-y-2">
                  {[...Array(10)].map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : (
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {recentActivity?.slice(0, 20).map((activity) => (
                    <div key={activity.id} className="flex items-start gap-3 text-sm border-b pb-2 last:border-0">
                      <div className="flex-1">
                        <div className="font-medium">
                          {activity.module_code.replace(/_/g, ' ')}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {getRoleDisplayName(activity.role as any) || activity.role} · {activity.action}
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground whitespace-nowrap">
                        {format(new Date(activity.created_at), 'MMM dd, HH:mm')}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
