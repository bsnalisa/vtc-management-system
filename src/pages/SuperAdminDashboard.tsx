import { Link, useLocation } from "react-router-dom";
import { SuperAdminLayout } from "@/components/SuperAdminLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useOrganizations } from "@/hooks/useOrganizations";
import { useSuperAdminStats } from "@/hooks/useSuperAdminStats";
import { useProfile } from "@/hooks/useProfile";
import {
  Building2,
  Users,
  Package,
  Shield,
  TrendingUp,
  Activity,
  Plus,
  Eye,
  Settings,
  CheckCircle2,
  Clock,
  Home,
  BarChart3,
  UserCog,
} from "lucide-react";

// Chart components
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

const SuperAdminDashboard = () => {
  const location = useLocation();
  const { data: organizations, isLoading: orgsLoading } = useOrganizations();
  const { data: stats, isLoading: statsLoading } = useSuperAdminStats();
  const { data: profile } = useProfile();

  // Use real data from stats
  const growthData = stats?.monthlyGrowth || [];

  // Build package distribution from real data
  const packageColors = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#06b6d4'];
  const packageDistribution = Object.entries(stats?.packageDistribution || {}).map(([name, value], index) => ({
    name,
    value: value as number,
    color: packageColors[index % packageColors.length],
  }));

  // Real system metrics
  const systemMetrics = [
    { name: 'Trainees', value: stats?.totalTrainees || 0, target: 500 },
    { name: 'Trainers', value: stats?.totalTrainers || 0, target: 50 },
    { name: 'Users', value: stats?.totalUsers || 0, target: 100 },
  ];

  if (orgsLoading || statsLoading) {
    return (
      <SuperAdminLayout>
        <div className="flex items-center justify-center h-64">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
        </div>
      </SuperAdminLayout>
    );
  }

  const recentOrganizations = organizations?.slice(0, 5) || [];
  const activeOrgs = stats?.activeOrgs || 0;
  const totalOrgs = stats?.totalOrgs || 0;
  const healthPercentage = totalOrgs > 0 ? Math.round((activeOrgs / totalOrgs) * 100) : 0;

  return (
    <SuperAdminLayout>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold">Welcome back, {profile?.firstname || 'User'}</h1>
            <p className="text-muted-foreground mt-2">System-wide metrics and VTC management</p>
          </div>
          <Button asChild>
            <Link to="/super-admin/organizations">
              <Plus className="mr-2 h-4 w-4" />
              Add Organization
            </Link>
          </Button>
        </div>

        {/* Top Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total VTCs</CardTitle>
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.totalOrgs || 0}</div>
              <p className="text-xs text-muted-foreground mt-1">
                <span className="text-primary font-medium">{stats?.activeOrgs || 0}</span> active
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Users</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.totalUsers || 0}</div>
              <div className="h-2 bg-muted rounded-full mt-2">
                <div 
                  className="h-full bg-primary rounded-full" 
                  style={{ width: `${Math.min((stats?.totalUsers || 0) / 1000 * 100, 100)}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1">Across all organizations</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Packages</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.activePackages || 0}</div>
              <p className="text-xs text-muted-foreground mt-1">
                <span className="text-orange-500 font-medium">{stats?.trialPackages || 0}</span> trials
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">System Health</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{healthPercentage}%</div>
              <div className="h-2 bg-muted rounded-full mt-2">
                <div 
                  className={`h-full rounded-full ${
                    healthPercentage >= 90 ? 'bg-green-500' : 
                    healthPercentage >= 70 ? 'bg-yellow-500' : 'bg-red-500'
                  }`}
                  style={{ width: `${healthPercentage}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1">Platform uptime</p>
            </CardContent>
          </Card>
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Growth Chart */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Platform Growth
              </CardTitle>
              <CardDescription>Monthly growth of organizations and users</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={growthData}>
                    <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line 
                      type="monotone" 
                      dataKey="organizations" 
                      stroke="#3b82f6" 
                      strokeWidth={2}
                      name="Organizations"
                    />
                    <Line 
                      type="monotone" 
                      dataKey="users" 
                      stroke="#8b5cf6" 
                      strokeWidth={2}
                      name="Users"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Package Distribution */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Package Distribution
              </CardTitle>
              <CardDescription>Current package usage across organizations</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={packageDistribution}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {packageDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => [`${value} organizations`, 'Count']} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* System Performance */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                System Performance
              </CardTitle>
              <CardDescription>Key performance indicators</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={systemMetrics}>
                    <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="value" name="Current" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="target" name="Target" fill="#94a3b8" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Organizations & System Status */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Organizations */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Recent Organizations
              </CardTitle>
              <CardDescription>Latest registered VTCs</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {recentOrganizations.map((org: any) => (
                  <div key={org.id} className="flex items-center justify-between p-3 rounded-lg border">
                    <div className="flex-1">
                      <p className="font-medium">{org.name}</p>
                      <p className="text-xs text-muted-foreground">{org.subdomain || 'No subdomain'}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={org.active ? "default" : "secondary"}>
                        {org.active ? "Active" : "Inactive"}
                      </Badge>
                      <Button variant="ghost" size="sm" asChild>
                        <Link to={`/super-admin/organizations`}>
                          <Eye className="h-4 w-4" />
                        </Link>
                      </Button>
                    </div>
                  </div>
                ))}
                {recentOrganizations.length === 0 && (
                  <p className="text-center text-muted-foreground py-8">No organizations yet</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* System Status */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                System Status
              </CardTitle>
              <CardDescription>Platform health indicators</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-3 rounded-lg border">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                  <div>
                    <p className="font-medium">Active Organizations</p>
                    <p className="text-xs text-muted-foreground">Operational VTCs</p>
                  </div>
                </div>
                <span className="text-2xl font-bold">{stats?.activeOrgs || 0}</span>
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg border">
                <div className="flex items-center gap-3">
                  <Clock className="h-5 w-5 text-orange-500" />
                  <div>
                    <p className="font-medium">Trial Packages</p>
                    <p className="text-xs text-muted-foreground">Organizations on trial</p>
                  </div>
                </div>
                <span className="text-2xl font-bold">{stats?.trialPackages || 0}</span>
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg border">
                <div className="flex items-center gap-3">
                  <TrendingUp className="h-5 w-5 text-blue-500" />
                  <div>
                    <p className="font-medium">Total Trainees</p>
                    <p className="text-xs text-muted-foreground">Platform-wide</p>
                  </div>
                </div>
                <span className="text-2xl font-bold">{stats?.totalTrainees || 0}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Detailed Statistics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Hostel Statistics */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Home className="h-5 w-5" />
                Hostel Operations
              </CardTitle>
              <CardDescription>Accommodation overview</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Total Rooms</span>
                <span className="font-bold">{stats?.totalRooms || 0}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Total Capacity</span>
                <span className="font-bold">{stats?.totalCapacity || 0}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Current Occupancy</span>
                <span className="font-bold">{stats?.currentOccupancy || 0}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Occupancy Rate</span>
                <Badge variant={stats?.occupancyRate >= 80 ? "default" : stats?.occupancyRate >= 50 ? "secondary" : "outline"}>
                  {stats?.occupancyRate || 0}%
                </Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Active Allocations</span>
                <span className="font-bold">{stats?.totalAllocations || 0}</span>
              </div>
            </CardContent>
          </Card>

          {/* Asset & Stock Statistics */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Asset & Stock
              </CardTitle>
              <CardDescription>Inventory overview</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Total Assets</span>
                <span className="font-bold">{stats?.totalAssets || 0}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Stock Categories</span>
                <span className="font-bold">{stats?.totalStockCategories || 0}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Stock Items</span>
                <span className="font-bold">{stats?.totalStockItems || 0}</span>
              </div>
            </CardContent>
          </Card>

          {/* Billing Statistics */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Financial Overview
              </CardTitle>
              <CardDescription>Revenue & payments</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Total Revenue</span>
                <span className="font-bold text-green-600">${(stats?.totalRevenue || 0).toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Pending Payments</span>
                <span className="font-bold text-orange-500">${(stats?.pendingPayments || 0).toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Active Subscriptions</span>
                <span className="font-bold">{stats?.activePackages || 0}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Platform Administration
            </CardTitle>
            <CardDescription>Manage system-level configurations and access</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Button variant="outline" asChild className="h-auto py-6 flex-col gap-2">
                <Link to="/super-admin/organizations">
                  <Building2 className="h-6 w-6" />
                  <span className="text-sm">Organizations</span>
                </Link>
              </Button>
              <Button variant="outline" asChild className="h-auto py-6 flex-col gap-2">
                <Link to="/super-admin/packages">
                  <Package className="h-6 w-6" />
                  <span className="text-sm">Packages</span>
                </Link>
              </Button>
              <Button variant="outline" asChild className="h-auto py-6 flex-col gap-2">
                <Link to="/super-admin/users">
                  <Users className="h-6 w-6" />
                  <span className="text-sm">Users</span>
                </Link>
              </Button>
              <Button variant="outline" asChild className="h-auto py-6 flex-col gap-2">
                <Link to="/super-admin/config">
                  <Settings className="h-6 w-6" />
                  <span className="text-sm">Configuration</span>
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </SuperAdminLayout>
  );
};

export default SuperAdminDashboard;