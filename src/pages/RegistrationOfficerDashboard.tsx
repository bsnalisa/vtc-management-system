import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, FileText, DollarSign, ClipboardCheck, BookOpen, ChevronRight, UserPlus, Shield, Clock, CheckCircle } from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { registrationOfficerNavItems } from "@/lib/navigationConfig";
import { useApplicationStats } from "@/hooks/useTraineeApplications";
import { useTrades } from "@/hooks/useTrades";
import { useProfile } from "@/hooks/useProfile";
import { useTrainees } from "@/hooks/useTrainees";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

const RegistrationOfficerDashboard = () => {
  const navigate = useNavigate();
  const { data: stats, isLoading } = useApplicationStats();
  const { data: trades } = useTrades();
  const { data: profile } = useProfile();
  const { data: trainees } = useTrainees();

  const registeredTraineeCount = trainees?.filter(t => t.status === "active").length || 0;

  const tradeChartData =
    trades?.map((trade) => ({
      name: trade.code,
      fullName: trade.name,
      applications: stats?.byTrade?.[trade.id] || 0,
    }))
    .sort((a, b) => b.applications - a.applications) || [];

  const totalPipeline = (stats?.pending || 0) + (stats?.provisionallyQualified || 0) + (stats?.pendingPayment || 0) + registeredTraineeCount;
  const registrationRate = totalPipeline > 0 ? Math.round((registeredTraineeCount / totalPipeline) * 100) : 0;

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
      navItems={registrationOfficerNavItems}
      groupLabel="Registration"
    >
      <div className="space-y-8">
        {/* Hero Greeting */}
        <div className="rounded-xl bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border p-6">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/15 text-primary">
              <UserPlus className="h-7 w-7" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">
                {greeting()}, {profile?.firstname || "User"}
              </h1>
              <p className="text-muted-foreground mt-0.5">
                Registration Command Center — manage applications, screening & enrollment
              </p>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="relative overflow-hidden">
            <div className="absolute top-0 right-0 h-20 w-20 translate-x-4 -translate-y-4 rounded-full bg-primary/10" />
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Applications</CardTitle>
              <FileText className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              {isLoading ? <Skeleton className="h-8 w-16" /> : (
                <div className="text-3xl font-bold">{stats?.totalApplications || 0}</div>
              )}
              <p className="text-xs text-muted-foreground mt-1">All time submissions</p>
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden">
            <div className="absolute top-0 right-0 h-20 w-20 translate-x-4 -translate-y-4 rounded-full bg-amber-500/10" />
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Pending Screening</CardTitle>
              <Clock className="h-4 w-4 text-amber-500" />
            </CardHeader>
            <CardContent>
              {isLoading ? <Skeleton className="h-8 w-16" /> : (
                <div className="text-3xl font-bold text-amber-600 dark:text-amber-400">{stats?.pending || 0}</div>
              )}
              <p className="text-xs text-muted-foreground mt-1">Awaiting review</p>
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden">
            <div className="absolute top-0 right-0 h-20 w-20 translate-x-4 -translate-y-4 rounded-full bg-accent/30" />
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Prov. Qualified</CardTitle>
              <ClipboardCheck className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              {isLoading ? <Skeleton className="h-8 w-16" /> : (
                <div className="text-3xl font-bold">{stats?.provisionallyQualified || 0}</div>
              )}
              <p className="text-xs text-muted-foreground mt-1">Ready for registration</p>
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden">
            <div className="absolute top-0 right-0 h-20 w-20 translate-x-4 -translate-y-4 rounded-full bg-secondary/20" />
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Registered Trainees</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {isLoading ? <Skeleton className="h-8 w-16" /> : (
                <div className="text-3xl font-bold">{registeredTraineeCount}</div>
              )}
              <p className="text-xs text-muted-foreground mt-1">Active in system</p>
            </CardContent>
          </Card>
        </div>

        {/* Secondary Stats */}
        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Pending Payments</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {isLoading ? <Skeleton className="h-6 w-12" /> : (
                <div className="text-2xl font-bold">{stats?.pendingPayment || 0}</div>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Available Trades</CardTitle>
              <BookOpen className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {isLoading ? <Skeleton className="h-6 w-12" /> : (
                <div className="text-2xl font-bold">{trades?.length || 0}</div>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Registration Rate</CardTitle>
              <Shield className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {isLoading ? <Skeleton className="h-6 w-12" /> : (
                <>
                  <div className="text-2xl font-bold">{registrationRate}%</div>
                  <Progress value={registrationRate} className="h-1.5 mt-2" />
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <div>
          <h2 className="text-lg font-semibold mb-3">Quick Actions</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { icon: FileText, label: "Applications Inbox", desc: "Screen new applications", url: "/applications-inbox", badge: stats?.pending },
              { icon: ClipboardCheck, label: "Admission Results", desc: "View screening outcomes", url: "/applications" },
              { icon: Users, label: "Trainee List", desc: "View registered trainees", url: "/trainees" },
            ].map(({ icon: Icon, label, desc, url, badge }) => (
              <button
                key={url}
                onClick={() => navigate(url)}
                className="flex items-center gap-3 rounded-lg border bg-card p-4 text-left transition-all hover:bg-accent hover:shadow-sm active:scale-[0.98]"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-sm">{label}</p>
                    {badge ? <Badge variant="secondary" className="h-5 px-1.5 text-xs">{badge}</Badge> : null}
                  </div>
                  <p className="text-xs text-muted-foreground">{desc}</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Chart and Pipeline */}
        <div className="grid gap-4 lg:grid-cols-3">
          {/* Chart */}
          <Card className="lg:col-span-2">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">Applications per Trade</CardTitle>
                  <CardDescription>Distribution across training programs</CardDescription>
                </div>
              </div>
            </CardHeader>
            <Separator />
            <CardContent className="pt-4">
              {tradeChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={tradeChartData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} className="text-muted-foreground" />
                    <YAxis tick={{ fontSize: 11 }} className="text-muted-foreground" />
                    <Tooltip
                      contentStyle={{ borderRadius: "8px", border: "1px solid hsl(var(--border))", background: "hsl(var(--card))" }}
                      labelFormatter={(label) => {
                        const found = tradeChartData.find(t => t.name === label);
                        return found?.fullName || label;
                      }}
                    />
                    <Bar dataKey="applications" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="py-10 text-center">
                  <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                    <BookOpen className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <p className="text-sm text-muted-foreground">No application data available</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Registration Pipeline */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <ClipboardCheck className="h-5 w-5 text-primary" /> Pipeline
              </CardTitle>
              <CardDescription>Current status breakdown</CardDescription>
            </CardHeader>
            <Separator />
            <CardContent className="pt-4 space-y-4">
              {[
                { label: "Pending Screening", value: stats?.pending || 0, color: "bg-amber-500" },
                { label: "Qualified", value: stats?.provisionallyQualified || 0, color: "bg-primary" },
                { label: "Awaiting Payment", value: stats?.pendingPayment || 0, color: "bg-orange-500" },
                { label: "Registered", value: registeredTraineeCount, color: "bg-emerald-500" },
              ].map((item) => (
                <div key={item.label} className="space-y-1.5">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">{item.label}</span>
                    <span className="font-semibold">{item.value}</span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                    <div
                      className={`h-full rounded-full ${item.color} transition-all`}
                      style={{ width: `${totalPipeline > 0 ? (item.value / totalPipeline) * 100 : 0}%` }}
                    />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Popular Trades */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  <BookOpen className="h-5 w-5 text-primary" /> Popular Trades
                </CardTitle>
                <CardDescription>Most applied-for training programs</CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={() => navigate('/trade-management')}>
                View All <ChevronRight className="h-3.5 w-3.5 ml-1" />
              </Button>
            </div>
          </CardHeader>
          <Separator />
          <CardContent className="pt-4">
            {tradeChartData.length > 0 ? (
              <div className="space-y-3">
                {tradeChartData.slice(0, 5).map((trade, index) => (
                  <div key={trade.name} className="flex items-center justify-between rounded-lg border p-3 transition-all hover:border-primary/30 hover:bg-accent/50">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary text-sm font-bold">
                        {index + 1}
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">{trade.fullName}</p>
                        <Badge variant="outline" className="text-xs font-mono mt-0.5">{trade.name}</Badge>
                      </div>
                    </div>
                    <Badge variant="secondary" className="text-sm font-semibold">{trade.applications}</Badge>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-10 text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                  <CheckCircle className="h-8 w-8 text-muted-foreground" />
                </div>
                <p className="text-sm text-muted-foreground">No trade data available</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default RegistrationOfficerDashboard;
