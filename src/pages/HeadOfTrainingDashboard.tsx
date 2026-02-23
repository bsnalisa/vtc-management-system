import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, GraduationCap, BookOpen, Calendar, ClipboardCheck, FileText, Link2, AlertTriangle, CheckCircle, RotateCcw, Briefcase, Award, ChevronRight, Shield, BarChart3 } from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useNavigate } from "react-router-dom";
import { useHODStats, useActiveTrainers } from "@/hooks/useHODStats";
import { useQualifications } from "@/hooks/useQualifications";
import { Button } from "@/components/ui/button";
import { headOfTrainingNavItems } from "@/lib/navigationConfig";
import { useProfile } from "@/hooks/useProfile";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useOrganizationContext } from "@/hooks/useOrganizationContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useAssessmentResultsByStatus, useApproveAssessments, useReturnAssessments } from "@/hooks/useAssessmentResults";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";

const HeadOfTrainingDashboard = () => {
  const navigate = useNavigate();
  const { data: stats, isLoading } = useHODStats();
  const { data: profile } = useProfile();
  const { data: qualifications } = useQualifications();
  const { organizationId } = useOrganizationContext();
  const { data: activeTrainers } = useActiveTrainers(organizationId);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [selectedQualification, setSelectedQualification] = useState<string>("");
  const [selectedTrainer, setSelectedTrainer] = useState<string>("");
  const [returnDialogOpen, setReturnDialogOpen] = useState(false);
  const [returnReason, setReturnReason] = useState("");
  const [selectedAssessmentIds, setSelectedAssessmentIds] = useState<string[]>([]);

  // Fetch trainer-qualification assignments
  const { data: trainerQualifications } = useQuery({
    queryKey: ["trainer_qualifications", organizationId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("trainer_qualifications")
        .select("*, qualifications(id, qualification_title, qualification_code)")
        .eq("organization_id", organizationId!);
      if (error) throw error;

      if (data && data.length > 0) {
        const trainerIds = [...new Set(data.map((tq: any) => tq.trainer_id))];
        const { data: trainers } = await (supabase as any)
          .from("trainers")
          .select("id, full_name, email")
          .in("id", trainerIds);
        const trainerMap = (trainers || []).reduce((acc: any, t: any) => {
          acc[t.id] = t;
          return acc;
        }, {});
        return data.map((tq: any) => ({
          ...tq,
          trainer_profile: trainerMap[tq.trainer_id]
            ? { firstname: trainerMap[tq.trainer_id].full_name, surname: "" }
            : null,
        }));
      }
      return data;
    },
    enabled: !!organizationId,
  });

  const { data: submittedResults } = useAssessmentResultsByStatus(["submitted_by_trainer"], organizationId);
  const approveAssessments = useApproveAssessments();
  const returnAssessments = useReturnAssessments();

  const assignMutation = useMutation({
    mutationFn: async () => {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error("Not authenticated");
      const { error } = await (supabase as any).from("trainer_qualifications").insert({
        trainer_id: selectedTrainer,
        qualification_id: selectedQualification,
        assigned_by: user.user.id,
        organization_id: organizationId!,
      });
      if (error) {
        if (error.code === '23505') throw new Error("This trainer is already assigned to this qualification");
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trainer_qualifications"] });
      toast({ title: "Success", description: "Trainer assigned to qualification" });
      setAssignDialogOpen(false);
      setSelectedQualification("");
      setSelectedTrainer("");
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const removeMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("trainer_qualifications").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trainer_qualifications"] });
      toast({ title: "Success", description: "Assignment removed" });
    },
  });

  const approvedQualifications = qualifications?.filter(q => q.status === "approved") || [];
  const pendingApprovals = qualifications?.filter(q => q.status === "pending_approval") || [];
  const pendingAssessmentCount = submittedResults?.length || 0;

  const toggleAssessmentSelect = (id: string) => {
    setSelectedAssessmentIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const handleApprove = async () => {
    if (selectedAssessmentIds.length === 0) return;
    await approveAssessments.mutateAsync(selectedAssessmentIds);
    setSelectedAssessmentIds([]);
  };

  const handleReturn = async () => {
    if (selectedAssessmentIds.length === 0 || !returnReason.trim()) return;
    await returnAssessments.mutateAsync({ resultIds: selectedAssessmentIds, reason: returnReason });
    setSelectedAssessmentIds([]);
    setReturnReason("");
    setReturnDialogOpen(false);
  };

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
      navItems={headOfTrainingNavItems}
      groupLabel="Training Management"
    >
      <div className="space-y-8">
        {/* Hero Greeting */}
        <div className="rounded-xl bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border p-6">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/15 text-primary">
              <Shield className="h-7 w-7" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">
                {greeting()}, {profile?.firstname || "User"}
              </h1>
              <p className="text-muted-foreground mt-0.5">
                Academic Command Center — oversee training, assessments & qualifications
              </p>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="relative overflow-hidden">
            <div className="absolute top-0 right-0 h-20 w-20 translate-x-4 -translate-y-4 rounded-full bg-primary/10" />
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Trainees</CardTitle>
              <Users className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              {isLoading ? <Skeleton className="h-8 w-16" /> : (
                <div className="text-3xl font-bold">{stats?.totalTrainees || 0}</div>
              )}
              <p className="text-xs text-muted-foreground mt-1">Active trainees</p>
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden">
            <div className="absolute top-0 right-0 h-20 w-20 translate-x-4 -translate-y-4 rounded-full bg-secondary/20" />
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Active Trainers</CardTitle>
              <GraduationCap className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {isLoading ? <Skeleton className="h-8 w-16" /> : (
                <div className="text-3xl font-bold">{stats?.totalTrainers || 0}</div>
              )}
              <p className="text-xs text-muted-foreground mt-1">Assigned trainers</p>
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden">
            <div className="absolute top-0 right-0 h-20 w-20 translate-x-4 -translate-y-4 rounded-full bg-accent/30" />
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Qualifications</CardTitle>
              <Award className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {isLoading ? <Skeleton className="h-8 w-16" /> : (
                <div className="text-3xl font-bold">{stats?.totalQualifications || 0}</div>
              )}
              <p className="text-xs text-muted-foreground mt-1">Approved qualifications</p>
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden">
            <div className="absolute top-0 right-0 h-20 w-20 translate-x-4 -translate-y-4 rounded-full bg-destructive/10" />
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Pending Reviews</CardTitle>
              <AlertTriangle className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{pendingAssessmentCount}</div>
              <p className="text-xs text-muted-foreground mt-1">Assessments awaiting approval</p>
            </CardContent>
          </Card>
        </div>

        {/* Secondary Stats Row */}
        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Active Trades</CardTitle>
              <Briefcase className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {isLoading ? <Skeleton className="h-6 w-12" /> : (
                <div className="text-2xl font-bold">{stats?.totalTrades || 0}</div>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Active Classes</CardTitle>
              <BookOpen className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {isLoading ? <Skeleton className="h-6 w-12" /> : (
                <div className="text-2xl font-bold">{stats?.totalClasses || 0}</div>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Competency Rate</CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {isLoading ? <Skeleton className="h-6 w-12" /> : (
                <>
                  <div className="text-2xl font-bold">{stats?.competencyRate || 0}%</div>
                  <Progress value={stats?.competencyRate || 0} className="h-1.5 mt-2" />
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
              { icon: Briefcase, label: "Trades", desc: "Manage trades", url: "/trade-management" },
              { icon: BookOpen, label: "Classes", desc: "Class management", url: "/classes" },
              { icon: Calendar, label: "Timetable", desc: "View schedule", url: "/timetable" },
              { icon: ClipboardCheck, label: "Assessments", desc: "Review results", url: "/assessment-results" },
              { icon: FileText, label: "Reports", desc: "Generate reports", url: "/reports" },
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

        {/* Tabbed Content */}
        <Tabs defaultValue="approvals" className="space-y-4">
          <TabsList>
            <TabsTrigger value="approvals">
              Pending Approvals
              {pendingApprovals.length > 0 && <Badge variant="secondary" className="ml-2 h-5 px-1.5">{pendingApprovals.length}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="trainers">
              Active Trainers <Badge variant="secondary" className="ml-2 h-5 px-1.5">{activeTrainers?.length || 0}</Badge>
            </TabsTrigger>
            <TabsTrigger value="assessments">
              Assessment Review {pendingAssessmentCount > 0 && <Badge variant="destructive" className="ml-2 h-5 px-1.5">{pendingAssessmentCount}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="assignments">Trainer Assignments</TabsTrigger>
          </TabsList>

          {/* Pending Approvals Tab */}
          <TabsContent value="approvals" className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <ClipboardCheck className="h-5 w-5 text-primary" /> Qualification Approvals
                    </CardTitle>
                    <CardDescription>{pendingApprovals.length} qualification(s) awaiting your approval</CardDescription>
                  </div>
                  {pendingApprovals.length > 0 && (
                    <Button variant="outline" size="sm" onClick={() => navigate('/qualification-approvals')}>
                      View All <ChevronRight className="h-3.5 w-3.5 ml-1" />
                    </Button>
                  )}
                </div>
              </CardHeader>
              <Separator />
              <CardContent className="pt-4">
                {pendingApprovals.length === 0 ? (
                  <div className="py-10 text-center">
                    <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                      <CheckCircle className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <h3 className="text-lg font-medium mb-1">All Clear</h3>
                    <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                      No qualifications pending approval. All submissions have been reviewed.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {pendingApprovals.slice(0, 5).map((q) => (
                      <div key={q.id} className="group flex items-center justify-between rounded-lg border p-4 transition-all hover:border-primary/30 hover:bg-accent/50 cursor-pointer" onClick={() => navigate('/qualification-approvals')}>
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                            <Award className="h-5 w-5" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-sm truncate">{q.qualification_title}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <Badge variant="outline" className="text-xs font-mono">{q.qualification_code}</Badge>
                              <span className="text-xs text-muted-foreground">NQF {q.nqf_level}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <Badge variant="secondary" className="bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400">Pending</Badge>
                          <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Active Trainers Tab */}
          <TabsContent value="trainers" className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Users className="h-5 w-5 text-primary" /> Active Trainers
                    </CardTitle>
                    <CardDescription>Trainers currently active in the system</CardDescription>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => navigate("/trainers")}>
                    Manage <ChevronRight className="h-3.5 w-3.5 ml-1" />
                  </Button>
                </div>
              </CardHeader>
              <Separator />
              <CardContent className="pt-4">
                {!activeTrainers || activeTrainers.length === 0 ? (
                  <div className="py-10 text-center">
                    <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                      <Users className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <h3 className="text-lg font-medium mb-1">No Active Trainers</h3>
                    <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                      No users have been assigned the trainer role yet.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {activeTrainers.map((trainer: any) => (
                      <div
                        key={trainer.id}
                        className="flex items-center justify-between rounded-lg border p-4 transition-all hover:border-primary/30 hover:bg-accent/50"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold text-sm">
                            {(trainer.display_name || "?").charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-sm">{trainer.display_name}</p>
                            <p className="text-xs text-muted-foreground">{trainer.email || "No email"}</p>
                          </div>
                        </div>
                        <div className="text-right text-xs text-muted-foreground">
                          {trainer.phone || "—"}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Assessment Review Tab */}
          <TabsContent value="assessments" className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <ClipboardCheck className="h-5 w-5 text-primary" /> Assessments Submitted by Trainers
                    </CardTitle>
                    <CardDescription>Review marks and approve or return for revision</CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        if (selectedAssessmentIds.length === 0) {
                          toast({ title: "Select assessments", description: "Please select at least one assessment to return.", variant: "destructive" });
                          return;
                        }
                        setReturnDialogOpen(true);
                      }}
                      disabled={selectedAssessmentIds.length === 0}
                    >
                      <RotateCcw className="h-4 w-4 mr-2" />Return ({selectedAssessmentIds.length})
                    </Button>
                    <Button size="sm" onClick={handleApprove} disabled={selectedAssessmentIds.length === 0 || approveAssessments.isPending}>
                      <CheckCircle className="h-4 w-4 mr-2" />
                      {approveAssessments.isPending ? "Approving..." : `Approve (${selectedAssessmentIds.length})`}
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <Separator />
              <CardContent className="pt-4">
                {!submittedResults || submittedResults.length === 0 ? (
                  <div className="py-10 text-center">
                    <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                      <CheckCircle className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <h3 className="text-lg font-medium mb-1">No Pending Reviews</h3>
                    <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                      All submitted assessments have been reviewed.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-10">
                            <Checkbox
                              checked={selectedAssessmentIds.length === submittedResults.length}
                              onCheckedChange={() => {
                                if (selectedAssessmentIds.length === submittedResults.length) {
                                  setSelectedAssessmentIds([]);
                                } else {
                                  setSelectedAssessmentIds(submittedResults.map((r: any) => r.id));
                                }
                              }}
                            />
                          </TableHead>
                          <TableHead>Trainee</TableHead>
                          <TableHead>Course</TableHead>
                          <TableHead>Unit Standard</TableHead>
                          <TableHead>Marks</TableHead>
                          <TableHead>Competency</TableHead>
                          <TableHead>Submitted</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {submittedResults.map((result: any) => (
                          <TableRow key={result.id}>
                            <TableCell>
                              <Checkbox
                                checked={selectedAssessmentIds.includes(result.id)}
                                onCheckedChange={() => toggleAssessmentSelect(result.id)}
                              />
                            </TableCell>
                            <TableCell>
                              <p className="font-medium">{result.trainees?.first_name} {result.trainees?.last_name}</p>
                              <p className="text-xs text-muted-foreground font-mono">{result.trainees?.trainee_id}</p>
                            </TableCell>
                            <TableCell>
                              <p className="text-sm">{result.trainee_enrollments?.courses?.name}</p>
                            </TableCell>
                            <TableCell>
                              <p className="text-sm">{result.unit_standards?.module_title}</p>
                              <p className="text-xs text-muted-foreground">{result.unit_standards?.unit_no}</p>
                            </TableCell>
                            <TableCell className="font-medium">{result.marks_obtained ?? "-"}</TableCell>
                            <TableCell>
                              <Badge variant={result.competency_status === "competent" ? "default" : result.competency_status === "not_yet_competent" ? "destructive" : "secondary"}>
                                {result.competency_status?.replace(/_/g, " ") || "Pending"}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {result.submitted_at ? new Date(result.submitted_at).toLocaleDateString("en-ZA") : "-"}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Trainer Assignments Tab */}
          <TabsContent value="assignments" className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Link2 className="h-5 w-5 text-primary" /> Trainer-Qualification Assignments
                    </CardTitle>
                    <CardDescription>Assign trainers to qualifications they deliver</CardDescription>
                  </div>
                  <Button size="sm" onClick={() => setAssignDialogOpen(true)}>
                    <Link2 className="h-4 w-4 mr-2" /> Assign Trainer
                  </Button>
                </div>
              </CardHeader>
              <Separator />
              <CardContent className="pt-4">
                {!trainerQualifications || trainerQualifications.length === 0 ? (
                  <div className="py-10 text-center">
                    <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                      <Link2 className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <h3 className="text-lg font-medium mb-1">No Assignments Yet</h3>
                    <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                      Assign trainers to qualifications so they can create gradebooks and manage assessments.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {trainerQualifications.map((tq: any) => (
                      <div key={tq.id} className="flex items-center justify-between rounded-lg border p-4 transition-all hover:border-primary/30 hover:bg-accent/50">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold text-sm">
                            {(tq.trainer_profile?.firstname || "?").charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-sm">
                              {tq.trainer_profile ? `${tq.trainer_profile.firstname} ${tq.trainer_profile.surname}`.trim() : "Unknown Trainer"}
                            </p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <Badge variant="outline" className="text-xs font-mono">{tq.qualifications?.qualification_code}</Badge>
                              <span className="text-xs text-muted-foreground truncate">{tq.qualifications?.qualification_title}</span>
                            </div>
                          </div>
                        </div>
                        <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive shrink-0" onClick={() => removeMutation.mutate(tq.id)}>Remove</Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Assign Trainer Dialog */}
      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Trainer to Qualification</DialogTitle>
            <DialogDescription>Select a trainer and qualification to create an assignment.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Trainer</label>
              <Select value={selectedTrainer} onValueChange={setSelectedTrainer}>
                <SelectTrigger><SelectValue placeholder="Select trainer" /></SelectTrigger>
                <SelectContent>
                  {activeTrainers?.map((trainer: any) => (
                    <SelectItem key={trainer.id} value={trainer.id}>
                      {trainer.display_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Qualification</label>
              <Select value={selectedQualification} onValueChange={setSelectedQualification}>
                <SelectTrigger><SelectValue placeholder="Select qualification" /></SelectTrigger>
                <SelectContent>
                  {approvedQualifications.map((q) => (
                    <SelectItem key={q.id} value={q.id}>{q.qualification_title} ({q.qualification_code})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setAssignDialogOpen(false)}>Cancel</Button>
              <Button onClick={() => assignMutation.mutate()} disabled={!selectedTrainer || !selectedQualification || assignMutation.isPending}>
                {assignMutation.isPending ? "Assigning..." : "Assign"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Return Assessment Dialog */}
      <Dialog open={returnDialogOpen} onOpenChange={setReturnDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Return Assessments to Trainer</DialogTitle>
            <DialogDescription>Provide a reason for returning {selectedAssessmentIds.length} assessment(s).</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Textarea
              placeholder="Reason for returning (e.g., marks need verification, missing data...)"
              value={returnReason}
              onChange={(e) => setReturnReason(e.target.value)}
              rows={3}
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setReturnDialogOpen(false)}>Cancel</Button>
              <Button variant="destructive" onClick={handleReturn} disabled={!returnReason.trim() || returnAssessments.isPending}>
                {returnAssessments.isPending ? "Returning..." : "Return to Trainer"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default HeadOfTrainingDashboard;
