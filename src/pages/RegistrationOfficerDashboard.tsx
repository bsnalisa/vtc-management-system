import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { UserPlus, Users, GraduationCap, FileText, DollarSign, ClipboardCheck, BookOpen } from "lucide-react";
import { Link } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { registrationOfficerNavItems } from "@/lib/navigationConfig";
import { useApplicationStats } from "@/hooks/useTraineeApplications";
import { useTrades } from "@/hooks/useTrades";
import { useProfile } from "@/hooks/useProfile";
import { useTrainees } from "@/hooks/useTrainees";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

const RegistrationOfficerDashboard = () => {
  const { data: stats } = useApplicationStats();
  const { data: trades } = useTrades();
  const { data: profile } = useProfile();
  const { data: trainees } = useTrainees();

  // Count registered trainees from the trainees table (only active)
  const registeredTraineeCount = trainees?.filter(t => t.status === "active").length || 0;

  const tradeChartData =
    trades?.map((trade) => ({
      name: trade.code,
      applications: stats?.byTrade?.[trade.id] || 0,
    })) || [];

  return (
    <DashboardLayout
      title={`Welcome back, ${profile?.firstname || 'User'}`}
      subtitle="Manage trainee applications and registrations"
      navItems={registrationOfficerNavItems}
      groupLabel="Registration"
    >
      <div className="space-y-4">
        {/* Stats Cards */}
        <div className="grid gap-2 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
          <Card className="p-0">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 pb-1">
              <CardTitle className="text-xs font-medium">Total Applications</CardTitle>
              <FileText className="h-3.5 w-3.5 text-muted-foreground" />
            </CardHeader>
            <CardContent className="p-3 pt-0">
              <div className="text-xl font-bold">{stats?.totalApplications || 0}</div>
              <p className="text-[10px] text-muted-foreground">All time</p>
            </CardContent>
          </Card>

          <Card className="p-0">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 pb-1">
              <CardTitle className="text-xs font-medium">Pending Screening</CardTitle>
              <ClipboardCheck className="h-3.5 w-3.5 text-warning" />
            </CardHeader>
            <CardContent className="p-3 pt-0">
              <div className="text-xl font-bold text-warning">{stats?.pending || 0}</div>
              <p className="text-[10px] text-muted-foreground">Awaiting review</p>
            </CardContent>
          </Card>

          <Card className="p-0">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 pb-1">
              <CardTitle className="text-xs font-medium">Prov. Qualified</CardTitle>
              <ClipboardCheck className="h-3.5 w-3.5 text-primary" />
            </CardHeader>
            <CardContent className="p-3 pt-0">
              <div className="text-xl font-bold text-primary">{stats?.provisionallyQualified || 0}</div>
              <p className="text-[10px] text-muted-foreground">Ready for registration</p>
            </CardContent>
          </Card>

          <Card className="p-0">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 pb-1">
              <CardTitle className="text-xs font-medium">Registered Trainees</CardTitle>
              <Users className="h-3.5 w-3.5 text-muted-foreground" />
            </CardHeader>
            <CardContent className="p-3 pt-0">
              <div className="text-xl font-bold">{registeredTraineeCount}</div>
              <p className="text-[10px] text-muted-foreground">Active in system</p>
            </CardContent>
          </Card>

          <Card className="p-0">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 pb-1">
              <CardTitle className="text-xs font-medium">Pending Payments</CardTitle>
              <DollarSign className="h-3.5 w-3.5 text-muted-foreground" />
            </CardHeader>
            <CardContent className="p-3 pt-0">
              <div className="text-xl font-bold">{stats?.pendingPayment || 0}</div>
              <p className="text-[10px] text-muted-foreground">Awaiting clearance</p>
            </CardContent>
          </Card>

          <Card className="p-0">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 pb-1">
              <CardTitle className="text-xs font-medium">Available Trades</CardTitle>
              <BookOpen className="h-3.5 w-3.5 text-muted-foreground" />
            </CardHeader>
            <CardContent className="p-3 pt-0">
              <div className="text-xl font-bold">{trades?.length || 0}</div>
              <p className="text-[10px] text-muted-foreground">Training programs</p>
            </CardContent>
          </Card>
        </div>

        {/* Chart and Quick Actions */}
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-base">Applications per Trade</CardTitle>
              <CardDescription className="text-xs">Distribution across trades</CardDescription>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              {tradeChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={tradeChartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <Bar dataKey="applications" fill="hsl(var(--primary))" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-center py-6 text-muted-foreground text-sm">No data available</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-base">Quick Actions</CardTitle>
              <CardDescription className="text-xs">Registration tasks</CardDescription>
            </CardHeader>
            <CardContent className="p-4 pt-2 space-y-2">
              <Link to="/applications-inbox">
                <div className="flex items-center gap-2 p-2.5 border rounded-lg hover:border-primary transition-colors cursor-pointer">
                  <FileText className="h-5 w-5 text-primary shrink-0" />
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">Applications Inbox</p>
                    <p className="text-[10px] text-muted-foreground truncate">Screen new applications</p>
                  </div>
                </div>
              </Link>
              <Link to="/applications">
                <div className="flex items-center gap-2 p-2.5 border rounded-lg hover:border-primary transition-colors cursor-pointer">
                  <ClipboardCheck className="h-5 w-5 text-primary shrink-0" />
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">Admission Results</p>
                    <p className="text-[10px] text-muted-foreground truncate">View screening outcomes</p>
                  </div>
                </div>
              </Link>
              <Link to="/trainees">
                <div className="flex items-center gap-2 p-2.5 border rounded-lg hover:border-primary transition-colors cursor-pointer">
                  <Users className="h-5 w-5 text-primary shrink-0" />
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">Trainee List</p>
                    <p className="text-[10px] text-muted-foreground truncate">View registered trainees</p>
                  </div>
                </div>
              </Link>
            </CardContent>
          </Card>
        </div>

        {/* Registration Pipeline and Popular Trades */}
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader className="p-4 pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <ClipboardCheck className="h-4 w-4" />
                Registration Pipeline
              </CardTitle>
              <CardDescription className="text-xs">Current status breakdown</CardDescription>
            </CardHeader>
            <CardContent className="p-4 pt-2 space-y-2">
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">Pending Screening</span>
                <span className="font-medium text-warning">{stats?.pending || 0}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">Qualified for Registration</span>
                <span className="font-medium text-primary">{stats?.provisionallyQualified || 0}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">Awaiting Payment</span>
                <span className="font-medium text-warning">{stats?.pendingPayment || 0}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">Registered Trainees</span>
                <span className="font-medium text-primary">{registeredTraineeCount}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="p-4 pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <BookOpen className="h-4 w-4" />
                Popular Trades
              </CardTitle>
              <CardDescription className="text-xs">Most applied-for programs</CardDescription>
            </CardHeader>
            <CardContent className="p-4 pt-2 space-y-1.5">
              {tradeChartData
                .sort((a, b) => b.applications - a.applications)
                .slice(0, 5)
                .map((trade, index) => (
                  <div key={trade.name} className="flex justify-between items-center text-sm">
                    <span>
                      <span className="font-medium mr-1.5">{index + 1}.</span>
                      {trade.name}
                    </span>
                    <span className="font-medium">{trade.applications}</span>
                  </div>
                ))}
              {tradeChartData.length === 0 && (
                <p className="text-center text-muted-foreground py-2 text-sm">No data available</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default RegistrationOfficerDashboard;
