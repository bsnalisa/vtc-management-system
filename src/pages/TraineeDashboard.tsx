import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  User, BookOpen, ChevronRight, CheckCircle2, Users, Megaphone,
  CalendarDays, CreditCard, AlertCircle, Loader2, GraduationCap,
} from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { traineeNavItems } from "@/lib/navigationConfig";
import { useProfile } from "@/hooks/useProfile";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
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

  if (traineeLoading) {
    return (
      <DashboardLayout title="Trainee Portal" subtitle="" navItems={traineeNavItems} groupLabel="Trainee iEnabler">
        <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Trainee Portal" subtitle="Always stay updated in your trainee portal" navItems={traineeNavItems} groupLabel="Trainee iEnabler">
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Welcome back, {profile?.firstname || trainee?.first_name || "Trainee"}!</h1>
            <p className="text-muted-foreground mt-2">Always stay updated in your trainee portal</p>
          </div>
          <div className="hidden md:flex items-center gap-3">
            <Avatar className="h-12 w-12">
              <AvatarImage src={profile?.avatar_url} />
              <AvatarFallback className="bg-primary/10 text-primary"><User className="h-6 w-6" /></AvatarFallback>
            </Avatar>
            <div className="text-right">
              <p className="font-medium">{trainee?.first_name} {trainee?.last_name}</p>
              <Badge variant="outline" className="mt-1"><CheckCircle2 className="h-3 w-3 mr-1" />{trainee?.status || "Active"}</Badge>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          {/* Finance Overview */}
          <Card className="border-0 shadow-md">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2"><CreditCard className="h-5 w-5 text-blue-600" />Finance Overview</CardTitle>
                <Button variant="ghost" size="sm" onClick={() => navigate("/trainee/finance")}>Details <ChevronRight className="h-4 w-4 ml-1" /></Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2 p-4 rounded-lg bg-gradient-to-r from-blue-50 to-blue-100/50 dark:from-blue-950/30 dark:to-blue-900/20">
                  <p className="text-sm text-muted-foreground">Total Payable</p>
                  <span className="text-3xl font-bold">N$ {totalFees.toLocaleString()}</span>
                </div>
                <div className="space-y-2 p-4 rounded-lg bg-gradient-to-r from-emerald-50 to-emerald-100/50 dark:from-emerald-950/30 dark:to-emerald-900/20">
                  <p className="text-sm text-muted-foreground">Total Paid</p>
                  <span className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">N$ {totalPaid.toLocaleString()}</span>
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-muted-foreground">{paidPercent}% paid</p>
                    <Badge variant="outline" className="bg-white dark:bg-gray-800">Balance: N$ {balance.toLocaleString()}</Badge>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Current Enrollment */}
          <Card className="border-0 shadow-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><GraduationCap className="h-5 w-5" />Current Enrollment</CardTitle>
              <CardDescription>Your active qualification enrollment</CardDescription>
            </CardHeader>
            <CardContent>
              {activeEnrollment ? (
                <div className="p-4 rounded-lg border">
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-md bg-primary/10"><BookOpen className="h-4 w-4 text-primary" /></div>
                    <div className="flex-1">
                      <h3 className="font-semibold">{(activeEnrollment.courses as any)?.trades?.name || (activeEnrollment.courses as any)?.name || "Enrolled Course"}</h3>
                      <div className="flex items-center gap-3 mt-1 flex-wrap">
                        <span className="text-sm text-muted-foreground font-mono">{(activeEnrollment.courses as any)?.code}</span>
                        <Badge variant="secondary">Level {(activeEnrollment.courses as any)?.level}</Badge>
                        <Badge variant="outline">{activeEnrollment.academic_year}</Badge>
                      </div>
                      {results && results.length > 0 && (
                        <div className="mt-3">
                          <div className="flex items-center justify-between text-sm mb-1">
                            <span className="text-muted-foreground">Competency Progress</span>
                            <span className="font-medium">{competentCount}/{totalResults} unit standards</span>
                          </div>
                          <Progress value={totalResults > 0 ? (competentCount / totalResults) * 100 : 0} className="h-2" />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-muted-foreground text-center py-4">No active enrollment found</p>
              )}
            </CardContent>
          </Card>

          {/* Bottom cards */}
          <div className="grid gap-6 md:grid-cols-2">
            {balance > 0 && (
              <Card className="border-0 shadow-md">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg flex items-center gap-2"><AlertCircle className="h-5 w-5 text-amber-500" />Outstanding Balance</CardTitle>
                    <Badge variant="secondary" className="bg-amber-500/10 text-amber-700 dark:text-amber-400">Important</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold mb-2">N$ {balance.toLocaleString()}</p>
                  <p className="text-muted-foreground mb-4">Please clear your outstanding balance.</p>
                  <Button className="w-full" onClick={() => navigate("/trainee/finance")}>View Details</Button>
                </CardContent>
              </Card>
            )}
            <Card className="border-0 shadow-md">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2"><CalendarDays className="h-5 w-5 text-blue-500" />Quick Info</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Trainee ID</span>
                    <span className="font-mono font-medium">{trainee?.trainee_id || "N/A"}</span>
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Trade</span>
                    <span className="font-medium">{(trainee?.trades as any)?.name || "N/A"}</span>
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Level</span>
                    <span className="font-medium">{trainee?.level || "N/A"}</span>
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Training Mode</span>
                    <Badge variant="outline" className="capitalize">{trainee?.training_mode || "N/A"}</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          {/* Announcements */}
          <Card className="border-0 shadow-md">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2"><Megaphone className="h-5 w-5 text-orange-600" />Notices</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {announcements && announcements.length > 0 ? announcements.map((notice: any) => (
                <div key={notice.id} className="p-3 rounded-lg border">
                  <div className="flex items-start justify-between">
                    <h4 className="font-semibold text-sm">{notice.title}</h4>
                    <Badge variant="outline" className="text-xs">{notice.priority}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{notice.content}</p>
                </div>
              )) : (
                <p className="text-sm text-muted-foreground text-center py-4">No announcements</p>
              )}
            </CardContent>
          </Card>

          {/* Quick Stats */}
          <Card className="border-0 shadow-md bg-gradient-to-br from-gray-50 to-gray-100/50 dark:from-gray-900 dark:to-gray-800/50">
            <CardContent className="p-6">
              <h3 className="font-semibold mb-4">Quick Stats</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Competent Results</span>
                  <span className="font-bold">{competentCount}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Pending Assessments</span>
                  <span className="font-bold">{results?.filter(r => !r.competency_status || r.competency_status === "pending").length || 0}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Outstanding Balance</span>
                  <span className="font-bold">N$ {balance.toLocaleString()}</span>
                </div>
              </div>
              <Button className="w-full mt-6" variant="outline" onClick={() => navigate("/trainee/exams/results")}>View Results</Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default TraineeDashboard;
