import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import {
  User, BookOpen, ChevronRight, CheckCircle2, Megaphone,
  CreditCard, AlertCircle, Loader2, GraduationCap, FileText,
  Calendar, Home, ClipboardCheck, BarChart3, Wallet,
} from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { traineeNavItems } from "@/lib/navigationConfig";
import { useProfile } from "@/hooks/useProfile";
import {
  useTraineeUserId, useTraineeRecord, useTraineeFinancialAccount,
  useTraineeEnrollments, useTraineeAnnouncements, useTraineeAssessmentResults,
} from "@/hooks/useTraineePortalData";
import { useNavigate } from "react-router-dom";

const TraineeDashboard = () => {
  const { data: profile } = useProfile();
  const userId = useTraineeUserId();
  const { data: trainee, isLoading: traineeLoading } = useTraineeRecord(userId);
  const { data: account } = useTraineeFinancialAccount(trainee?.id, null);
  const { data: enrollments } = useTraineeEnrollments(trainee?.id);
  const { data: announcements } = useTraineeAnnouncements(trainee?.organization_id);
  const { data: results } = useTraineeAssessmentResults(trainee?.id);
  const navigate = useNavigate();

  const totalFees = Number(account?.total_fees || 0);
  const totalPaid = Number(account?.total_paid || 0);
  const balance = Number(account?.balance || 0);
  const paidPercent = totalFees > 0 ? Math.round((totalPaid / totalFees) * 100) : 0;

  const activeEnrollment = enrollments?.find(e => e.status === "active");
  const competentCount = results?.filter(r => r.competency_status === "competent").length || 0;
  const totalResults = results?.length || 0;
  const pendingResults = results?.filter(r => !r.competency_status || r.competency_status === "pending").length || 0;
  const competencyRate = totalResults > 0 ? Math.round((competentCount / totalResults) * 100) : 0;

  const greeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  };

  const isLoading = traineeLoading;

  return (
    <DashboardLayout title="" subtitle="" navItems={traineeNavItems} groupLabel="Trainee iEnabler">
      <div className="space-y-8">
        {/* Hero Greeting */}
        <div className="rounded-xl bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border p-6">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/15 text-primary">
              <GraduationCap className="h-7 w-7" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">
                {greeting()}, {profile?.firstname || trainee?.first_name || "Trainee"}
              </h1>
              <p className="text-muted-foreground mt-0.5">
                Your academic portal — track progress, finances & results
              </p>
            </div>
          </div>
        </div>

        {/* Primary Stats Grid */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="relative overflow-hidden">
            <div className="absolute top-0 right-0 h-20 w-20 translate-x-4 -translate-y-4 rounded-full bg-primary/10" />
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Fees</CardTitle>
              <Wallet className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              {isLoading ? <Skeleton className="h-8 w-24" /> : (
                <div className="text-3xl font-bold">N$ {totalFees.toLocaleString()}</div>
              )}
              <p className="text-xs text-muted-foreground mt-1">Total payable amount</p>
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden">
            <div className="absolute top-0 right-0 h-20 w-20 translate-x-4 -translate-y-4 rounded-full bg-emerald-500/10" />
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Amount Paid</CardTitle>
              <CreditCard className="h-4 w-4 text-emerald-600" />
            </CardHeader>
            <CardContent>
              {isLoading ? <Skeleton className="h-8 w-24" /> : (
                <div className="text-3xl font-bold text-emerald-600">{paidPercent}%</div>
              )}
              <p className="text-xs text-muted-foreground mt-1">N$ {totalPaid.toLocaleString()} paid</p>
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden">
            <div className="absolute top-0 right-0 h-20 w-20 translate-x-4 -translate-y-4 rounded-full bg-accent/30" />
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Competent Results</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {isLoading ? <Skeleton className="h-8 w-16" /> : (
                <div className="text-3xl font-bold">{competentCount}</div>
              )}
              <p className="text-xs text-muted-foreground mt-1">of {totalResults} assessments</p>
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden">
            <div className="absolute top-0 right-0 h-20 w-20 translate-x-4 -translate-y-4 rounded-full bg-destructive/10" />
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Outstanding</CardTitle>
              <AlertCircle className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
              {isLoading ? <Skeleton className="h-8 w-24" /> : (
                <div className="text-3xl font-bold">N$ {balance.toLocaleString()}</div>
              )}
              <p className="text-xs text-muted-foreground mt-1">Balance remaining</p>
            </CardContent>
          </Card>
        </div>

        {/* Secondary Stats */}
        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Competency Rate</CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {isLoading ? <Skeleton className="h-6 w-12" /> : (
                <>
                  <div className="text-2xl font-bold">{competencyRate}%</div>
                  <Progress value={competencyRate} className="h-1.5 mt-2" />
                </>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Pending Assessments</CardTitle>
              <ClipboardCheck className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {isLoading ? <Skeleton className="h-6 w-12" /> : (
                <div className="text-2xl font-bold">{pendingResults}</div>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Payment Progress</CardTitle>
              <CreditCard className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {isLoading ? <Skeleton className="h-6 w-12" /> : (
                <>
                  <div className="text-2xl font-bold">{paidPercent}%</div>
                  <Progress value={paidPercent} className="h-1.5 mt-2" />
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <div>
          <h2 className="text-lg font-semibold mb-3">Quick Actions</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {[
              { icon: BarChart3, label: "Results", desc: "View assessments", url: "/trainee/exams/results" },
              { icon: CreditCard, label: "Finance", desc: "View statement", url: "/trainee/finance" },
              { icon: FileText, label: "Documents", desc: "Your documents", url: "/trainee/documents" },
              { icon: Home, label: "Hostel", desc: "Room details", url: "/trainee/hostel" },
              { icon: Calendar, label: "Timetable", desc: "Exam schedule", url: "/trainee/exams/timetable" },
            ].map(({ icon: Icon, label, desc, url }) => (
              <button
                key={url}
                onClick={() => navigate(url)}
                className="flex items-center gap-3 rounded-lg border bg-card p-4 text-left transition-all hover:bg-accent hover:shadow-sm active:scale-[0.98]"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="font-medium text-sm">{label}</p>
                  <p className="text-xs text-muted-foreground">{desc}</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Bottom content: Enrollment + Announcements */}
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            {/* Current Enrollment */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <BookOpen className="h-5 w-5 text-primary" /> Current Enrollment
                    </CardTitle>
                    <CardDescription>Your active qualification details</CardDescription>
                  </div>
                  {activeEnrollment && (
                    <Button variant="outline" size="sm" onClick={() => navigate("/trainee/registration")}>
                      Details <ChevronRight className="h-3.5 w-3.5 ml-1" />
                    </Button>
                  )}
                </div>
              </CardHeader>
              <Separator />
              <CardContent className="pt-4">
                {activeEnrollment ? (
                  <div className="flex items-center gap-3 rounded-lg border p-4 transition-all hover:border-primary/30 hover:bg-accent/50">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <GraduationCap className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">
                        {(activeEnrollment.courses as any)?.trades?.name || (activeEnrollment.courses as any)?.name || "Enrolled Course"}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <Badge variant="outline" className="text-xs font-mono">{(activeEnrollment.courses as any)?.code}</Badge>
                        <Badge variant="secondary" className="text-xs">Level {(activeEnrollment.courses as any)?.level}</Badge>
                        <span className="text-xs text-muted-foreground">{activeEnrollment.academic_year}</span>
                      </div>
                      {totalResults > 0 && (
                        <div className="mt-3">
                          <div className="flex items-center justify-between text-xs mb-1">
                            <span className="text-muted-foreground">Competency Progress</span>
                            <span className="font-medium">{competentCount}/{totalResults}</span>
                          </div>
                          <Progress value={competencyRate} className="h-1.5" />
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="py-10 text-center">
                    <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                      <BookOpen className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <h3 className="text-lg font-medium mb-1">No Active Enrollment</h3>
                    <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                      You don't have an active enrollment yet. Check your admission status for updates.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Trainee Info Card */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <User className="h-5 w-5 text-primary" /> Profile Summary
                </CardTitle>
              </CardHeader>
              <Separator />
              <CardContent className="pt-4">
                <div className="grid grid-cols-2 gap-4">
                  {[
                    { label: "Trainee ID", value: trainee?.trainee_id || "N/A" },
                    { label: "Trade", value: (trainee?.trades as any)?.name || "N/A" },
                    { label: "Level", value: trainee?.level || "N/A" },
                    { label: "Training Mode", value: trainee?.training_mode || "N/A" },
                  ].map(item => (
                    <div key={item.label} className="space-y-1">
                      <p className="text-xs text-muted-foreground">{item.label}</p>
                      <p className="text-sm font-medium capitalize">{item.value}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Announcements Sidebar */}
          <div className="space-y-6">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Megaphone className="h-5 w-5 text-primary" /> Notices
                  </CardTitle>
                  {announcements && announcements.length > 0 && (
                    <Badge variant="secondary" className="h-5 px-1.5">{announcements.length}</Badge>
                  )}
                </div>
              </CardHeader>
              <Separator />
              <CardContent className="pt-4 space-y-3">
                {announcements && announcements.length > 0 ? announcements.map((notice: any) => (
                  <div key={notice.id} className="group rounded-lg border p-3 transition-all hover:border-primary/30 hover:bg-accent/50">
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="font-medium text-sm truncate">{notice.title}</h4>
                      <Badge variant="outline" className="text-xs shrink-0">{notice.priority}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2">{notice.content}</p>
                  </div>
                )) : (
                  <div className="py-8 text-center">
                    <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                      <Megaphone className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <p className="text-sm text-muted-foreground">No announcements</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Outstanding Balance Alert */}
            {balance > 0 && (
              <Card className="border-destructive/20 bg-destructive/5">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-destructive/10">
                      <AlertCircle className="h-5 w-5 text-destructive" />
                    </div>
                    <div>
                      <p className="font-semibold text-sm">Outstanding Balance</p>
                      <p className="text-2xl font-bold">N$ {balance.toLocaleString()}</p>
                    </div>
                  </div>
                  <Button size="sm" className="w-full" onClick={() => navigate("/trainee/finance")}>
                    View Finance <ChevronRight className="h-3.5 w-3.5 ml-1" />
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default TraineeDashboard;
