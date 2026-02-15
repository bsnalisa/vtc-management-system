import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, GraduationCap, BookOpen, Calendar, ClipboardCheck, BarChart3, FileText, Link2 } from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useNavigate } from "react-router-dom";
import { useHODStats } from "@/hooks/useHODStats";
import { useQualifications } from "@/hooks/useQualifications";
import { useTrainers } from "@/hooks/useTrainers";
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

const HeadOfTrainingDashboard = () => {
  const navigate = useNavigate();
  const { data: stats, isLoading } = useHODStats();
  const { data: profile } = useProfile();
  const { data: qualifications } = useQualifications();
  const { data: trainers } = useTrainers();
  const { organizationId } = useOrganizationContext();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [selectedQualification, setSelectedQualification] = useState<string>("");
  const [selectedTrainer, setSelectedTrainer] = useState<string>("");

  // Fetch trainer-qualification assignments
  const { data: trainerQualifications } = useQuery({
    queryKey: ["trainer_qualifications", organizationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trainer_qualifications")
        .select("*, trainers(id, full_name, trainer_id), qualifications(id, qualification_title, qualification_code)")
        .eq("organization_id", organizationId!);
      if (error) throw error;
      return data;
    },
    enabled: !!organizationId,
  });

  const assignMutation = useMutation({
    mutationFn: async () => {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error("Not authenticated");

      const { error } = await supabase.from("trainer_qualifications").insert({
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
      const { error } = await supabase.from("trainer_qualifications").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trainer_qualifications"] });
      toast({ title: "Success", description: "Assignment removed" });
    },
  });

  const approvedQualifications = qualifications?.filter(q => q.status === "approved") || [];
  const pendingApprovals = qualifications?.filter(q => q.status === "pending_approval") || [];

  return (
    <DashboardLayout
      title={`Welcome back, ${profile?.firstname || 'User'}`}
      subtitle="Academic & Training Operations Management"
      navItems={headOfTrainingNavItems}
      groupLabel="Training Management"
    >
      <div className="space-y-6">
        {/* Stats Cards - Real Data */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
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
              <p className="text-xs text-muted-foreground">Teaching staff</p>
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
              <CardTitle className="text-sm font-medium">Trades</CardTitle>
              <BookOpen className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{isLoading ? "..." : stats?.totalTrades || 0}</div>
              <p className="text-xs text-muted-foreground">Active trades</p>
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
        </div>

        {/* Quick Actions & Pending Approvals */}
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="h-5 w-5" />
                Training Management
              </CardTitle>
              <CardDescription>Manage curriculum and training modules</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button className="w-full" onClick={() => navigate('/training-modules')}>
                Training Modules
              </Button>
              <Button variant="outline" className="w-full" onClick={() => navigate('/classes')}>
                Class Management
              </Button>
              <Button variant="outline" className="w-full" onClick={() => navigate('/trade-management')}>
                Trade Management
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ClipboardCheck className="h-5 w-5" />
                Pending Approvals
              </CardTitle>
              <CardDescription>
                {pendingApprovals.length} qualification(s) awaiting approval
              </CardDescription>
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
                <Button variant="outline" className="w-full" onClick={() => navigate('/qualification-approvals')}>
                  View All Approvals
                </Button>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Trainer-Qualification Assignments */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Link2 className="h-5 w-5" />
                  Trainer-Qualification Assignments
                </CardTitle>
                <CardDescription>Assign trainers to qualifications they deliver</CardDescription>
              </div>
              <Button onClick={() => setAssignDialogOpen(true)}>
                Assign Trainer
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {!trainerQualifications || trainerQualifications.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                No trainer-qualification assignments yet. Click "Assign Trainer" to get started.
              </p>
            ) : (
              <div className="space-y-2">
                {trainerQualifications.map((tq: any) => (
                  <div key={tq.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{tq.trainers?.full_name || "Unknown"}</p>
                      <p className="text-xs text-muted-foreground">
                        {tq.qualifications?.qualification_title} ({tq.qualifications?.qualification_code})
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => removeMutation.mutate(tq.id)}
                    >
                      Remove
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Actions Row */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Academic and training operations</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Button variant="outline" className="h-auto py-4 flex-col gap-2" onClick={() => navigate('/timetable')}>
                <Calendar className="h-5 w-5" />
                <span>Timetable</span>
              </Button>
              <Button variant="outline" className="h-auto py-4 flex-col gap-2" onClick={() => navigate('/assessment-results')}>
                <ClipboardCheck className="h-5 w-5" />
                <span>Assessments</span>
              </Button>
              <Button variant="outline" className="h-auto py-4 flex-col gap-2" onClick={() => navigate('/analytics')}>
                <BarChart3 className="h-5 w-5" />
                <span>Analytics</span>
              </Button>
              <Button variant="outline" className="h-auto py-4 flex-col gap-2" onClick={() => navigate('/reports')}>
                <FileText className="h-5 w-5" />
                <span>Reports</span>
              </Button>
            </div>
          </CardContent>
        </Card>
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
                <SelectTrigger>
                  <SelectValue placeholder="Select trainer" />
                </SelectTrigger>
                <SelectContent>
                  {trainers?.filter(t => t.active).map((trainer) => (
                    <SelectItem key={trainer.id} value={trainer.id}>
                      {trainer.full_name} ({trainer.trainer_id})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Qualification</label>
              <Select value={selectedQualification} onValueChange={setSelectedQualification}>
                <SelectTrigger>
                  <SelectValue placeholder="Select qualification" />
                </SelectTrigger>
                <SelectContent>
                  {approvedQualifications.map((q) => (
                    <SelectItem key={q.id} value={q.id}>
                      {q.qualification_title} ({q.qualification_code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setAssignDialogOpen(false)}>Cancel</Button>
              <Button
                onClick={() => assignMutation.mutate()}
                disabled={!selectedTrainer || !selectedQualification || assignMutation.isPending}
              >
                {assignMutation.isPending ? "Assigning..." : "Assign"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default HeadOfTrainingDashboard;
