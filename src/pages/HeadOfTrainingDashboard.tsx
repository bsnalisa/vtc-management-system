import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, GraduationCap, BookOpen, Calendar, ClipboardCheck, BarChart3, FileText, Link2, AlertTriangle, CheckCircle, RotateCcw, Briefcase, Award } from "lucide-react";
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

      // Enrich with trainer name from trainers table
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

  // Submitted assessments awaiting HoT review
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

  return (
    <DashboardLayout
      title={`Welcome back, ${profile?.firstname || 'User'}`}
      subtitle="Academic Command Center"
      navItems={headOfTrainingNavItems}
      groupLabel="Training Management"
    >
      <div className="space-y-6">
        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Trainees</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{isLoading ? "..." : stats?.totalTrainees || 0}</div>
              <p className="text-xs text-muted-foreground">Active trainees</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Trainers</CardTitle>
              <GraduationCap className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{isLoading ? "..." : stats?.totalTrainers || 0}</div>
              <p className="text-xs text-muted-foreground">Users with trainer role</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Trades</CardTitle>
              <Briefcase className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{isLoading ? "..." : stats?.totalTrades || 0}</div>
              <p className="text-xs text-muted-foreground">Registered trades</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Qualifications</CardTitle>
              <Award className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{isLoading ? "..." : stats?.totalQualifications || 0}</div>
              <p className="text-xs text-muted-foreground">Approved qualifications</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Classes</CardTitle>
              <BookOpen className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{isLoading ? "..." : stats?.totalClasses || 0}</div>
              <p className="text-xs text-muted-foreground">Current classes</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Competency Rate</CardTitle>
              <ClipboardCheck className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{isLoading ? "..." : `${stats?.competencyRate || 0}%`}</div>
              <p className="text-xs text-muted-foreground">Assessment pass rate</p>
            </CardContent>
          </Card>
          <Card className={pendingAssessmentCount > 0 ? "border-warning/40 bg-warning/5" : ""}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending Reviews</CardTitle>
              <AlertTriangle className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{pendingAssessmentCount}</div>
              <p className="text-xs text-muted-foreground">Assessments awaiting approval</p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="trainers">
              Active Trainers <Badge variant="secondary" className="ml-2 h-5 px-1.5">{activeTrainers?.length || 0}</Badge>
            </TabsTrigger>
            <TabsTrigger value="assessments">
              Assessment Review {pendingAssessmentCount > 0 && <Badge variant="destructive" className="ml-2 h-5 px-1.5">{pendingAssessmentCount}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="assignments">Trainer Assignments</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><BookOpen className="h-5 w-5" />Training Management</CardTitle>
                  <CardDescription>Manage curriculum and training modules</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  <Button className="w-full" onClick={() => navigate('/trade-management')}>Trade Management</Button>
                  <Button variant="outline" className="w-full" onClick={() => navigate('/classes')}>Class Management</Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><ClipboardCheck className="h-5 w-5" />Pending Approvals</CardTitle>
                  <CardDescription>{pendingApprovals.length} qualification(s) awaiting approval</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {pendingApprovals.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">No pending approvals</p>
                  ) : (
                    pendingApprovals.slice(0, 3).map((q) => (
                      <div key={q.id} className="flex items-center justify-between p-2 border rounded-lg">
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{q.qualification_title}</p>
                          <p className="text-xs text-muted-foreground">{q.qualification_code} · NQF {q.nqf_level}</p>
                        </div>
                        <Badge variant="secondary">Pending</Badge>
                      </div>
                    ))
                  )}
                  {pendingApprovals.length > 0 && (
                    <Button variant="outline" className="w-full" onClick={() => navigate('/qualification-approvals')}>View All Approvals</Button>
                  )}
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader><CardTitle>Quick Actions</CardTitle><CardDescription>Academic and training operations</CardDescription></CardHeader>
              <CardContent>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <Button variant="outline" className="h-auto py-4 flex-col gap-2" onClick={() => navigate('/timetable')}><Calendar className="h-5 w-5" /><span>Timetable</span></Button>
                  <Button variant="outline" className="h-auto py-4 flex-col gap-2" onClick={() => navigate('/assessment-results')}><ClipboardCheck className="h-5 w-5" /><span>Assessments</span></Button>
                  <Button variant="outline" className="h-auto py-4 flex-col gap-2" onClick={() => navigate('/reports')}><FileText className="h-5 w-5" /><span>Reports</span></Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Active Trainers Tab */}
          <TabsContent value="trainers" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5" />Active Trainers</CardTitle>
                <CardDescription>Users assigned the trainer role in the system</CardDescription>
              </CardHeader>
              <CardContent>
                {!activeTrainers || activeTrainers.length === 0 ? (
                  <div className="text-center py-12">
                    <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                    <h3 className="text-lg font-medium">No Active Trainers</h3>
                    <p className="text-muted-foreground">No users have been assigned the trainer role yet.</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Phone</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {activeTrainers.map((trainer: any) => (
                        <TableRow key={trainer.id}>
                          <TableCell className="font-medium">
                            {trainer.firstname} {trainer.surname}
                          </TableCell>
                          <TableCell>{trainer.email || "-"}</TableCell>
                          <TableCell>{trainer.phone || "-"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Assessment Review Tab */}
          <TabsContent value="assessments" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Assessments Submitted by Trainers</CardTitle>
                    <CardDescription>Review marks and approve or return for revision</CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
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
                    <Button onClick={handleApprove} disabled={selectedAssessmentIds.length === 0 || approveAssessments.isPending}>
                      <CheckCircle className="h-4 w-4 mr-2" />
                      {approveAssessments.isPending ? "Approving..." : `Approve (${selectedAssessmentIds.length})`}
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {!submittedResults || submittedResults.length === 0 ? (
                  <div className="text-center py-12">
                    <CheckCircle className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                    <h3 className="text-lg font-medium">No Pending Reviews</h3>
                    <p className="text-muted-foreground">All submitted assessments have been reviewed.</p>
                  </div>
                ) : (
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
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Trainer Assignments Tab */}
          <TabsContent value="assignments" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2"><Link2 className="h-5 w-5" />Trainer-Qualification Assignments</CardTitle>
                    <CardDescription>Assign trainers to qualifications they deliver</CardDescription>
                  </div>
                  <Button onClick={() => setAssignDialogOpen(true)}>Assign Trainer</Button>
                </div>
              </CardHeader>
              <CardContent>
                {!trainerQualifications || trainerQualifications.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">No trainer-qualification assignments yet.</p>
                ) : (
                  <div className="space-y-2">
                    {trainerQualifications.map((tq: any) => (
                      <div key={tq.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">
                            {tq.trainer_profile ? `${tq.trainer_profile.firstname} ${tq.trainer_profile.surname}` : "Unknown Trainer"}
                          </p>
                          <p className="text-xs text-muted-foreground">{tq.qualifications?.qualification_title} ({tq.qualifications?.qualification_code})</p>
                        </div>
                        <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => removeMutation.mutate(tq.id)}>Remove</Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Assign Trainer Dialog — uses activeTrainers from user_roles+profiles */}
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
                      {trainer.firstname} {trainer.surname}
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
