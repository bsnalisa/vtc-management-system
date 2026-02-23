import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useRoleNavigation } from "@/hooks/useRoleNavigation";
import { useMyGradebooks, useCreateGradebook, useDeleteGradebook, useUpdateGradebook, useTrainerQualifications } from "@/hooks/useGradebooks";
import { useOrganizationContext } from "@/hooks/useOrganizationContext";
import { Plus, BookOpen, Lock, Unlock, ChevronRight, Trash2, Pencil } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";

const useCurrentTrainer = () => {
  return useQuery({
    queryKey: ["current-trainer"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data, error } = await supabase
        .from("trainers")
        .select("id, full_name, trainer_id, organization_id")
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
};

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  draft: { label: "Draft", variant: "secondary" },
  submitted: { label: "Submitted", variant: "default" },
  hot_approved: { label: "HoT Approved", variant: "default" },
  ac_approved: { label: "AC Approved", variant: "default" },
  finalised: { label: "Finalised", variant: "outline" },
};

const GradebookManagement = () => {
  const navigate = useNavigate();
  const { navItems, groupLabel } = useRoleNavigation();
  const { organizationId } = useOrganizationContext();
  const { data: gradebooks, isLoading } = useMyGradebooks();
  const { data: trainer } = useCurrentTrainer();
  const { data: trainerQualifications } = useTrainerQualifications(trainer?.id);
  const createGradebook = useCreateGradebook();
  const deleteGradebook = useDeleteGradebook();
  const updateGradebook = useUpdateGradebook();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingGb, setEditingGb] = useState<any>(null);
  const [form, setForm] = useState({
    qualification_id: "",
    academic_year: new Date().getFullYear().toString(),
    intake_label: "",
    level: "1",
    title: "",
    test_weight: "40",
    mock_weight: "60",
  });

  const handleWeightChange = (field: "test_weight" | "mock_weight", value: string) => {
    const numVal = parseInt(value) || 0;
    if (field === "test_weight") {
      setForm(prev => ({ ...prev, test_weight: value, mock_weight: String(100 - numVal) }));
    } else {
      setForm(prev => ({ ...prev, mock_weight: value, test_weight: String(100 - numVal) }));
    }
  };

  const handleCreate = async () => {
    if (!trainer || !organizationId || !form.qualification_id || !form.title) return;
    await createGradebook.mutateAsync({
      organization_id: organizationId,
      qualification_id: form.qualification_id,
      trainer_id: trainer.id,
      academic_year: form.academic_year,
      intake_label: form.intake_label || undefined,
      level: parseInt(form.level),
      title: form.title,
      test_weight: parseInt(form.test_weight),
      mock_weight: parseInt(form.mock_weight),
    });
    setDialogOpen(false);
    setForm({ qualification_id: "", academic_year: new Date().getFullYear().toString(), intake_label: "", level: "1", title: "", test_weight: "40", mock_weight: "60" });
  };

  const handleOpenEdit = (gb: any, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingGb(gb);
    setForm({
      qualification_id: gb.qualification_id,
      academic_year: gb.academic_year,
      intake_label: gb.intake_label || "",
      level: String(gb.level),
      title: gb.title,
      test_weight: String(gb.test_weight),
      mock_weight: String(gb.mock_weight),
    });
    setEditDialogOpen(true);
  };

  const handleUpdate = async () => {
    if (!editingGb) return;
    await updateGradebook.mutateAsync({
      id: editingGb.id,
      title: form.title,
      academic_year: form.academic_year,
      intake_label: form.intake_label || undefined,
      level: parseInt(form.level),
      test_weight: parseInt(form.test_weight),
      mock_weight: parseInt(form.mock_weight),
    });
    setEditDialogOpen(false);
    setEditingGb(null);
  };

  // Use trainer's assigned qualifications
  const qualifications = trainerQualifications || [];

  return (
    <DashboardLayout
      title="My Gradebooks"
      subtitle="Create and manage your assessment gradebooks"
      navItems={navItems}
      groupLabel={groupLabel}
    >
      <div className="space-y-6 max-w-7xl mx-auto">
        <div className="flex justify-between items-center">
          <div>
            <p className="text-sm text-muted-foreground">
              {gradebooks?.length || 0} gradebook(s)
            </p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" />New Gradebook</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>Create Gradebook</DialogTitle>
                <DialogDescription>Define a new gradebook for a qualification assigned to you.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Qualification</Label>
                  {qualifications.length === 0 ? (
                    <p className="text-sm text-muted-foreground mt-1">No qualifications assigned to you. Contact your Head of Training.</p>
                  ) : (
                    <Select value={form.qualification_id} onValueChange={v => {
                      const q = qualifications.find((q: any) => q.id === v);
                      setForm(prev => ({
                        ...prev,
                        qualification_id: v,
                        title: q ? `${q.qualification_title} – L${prev.level} – ${prev.academic_year}` : prev.title,
                      }));
                    }}>
                      <SelectTrigger><SelectValue placeholder="Select qualification" /></SelectTrigger>
                      <SelectContent>
                        {qualifications.map((q: any) => (
                          <SelectItem key={q.id} value={q.id}>{q.qualification_title} ({q.qualification_code})</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Academic Year</Label>
                    <Input value={form.academic_year} onChange={e => setForm(prev => ({ ...prev, academic_year: e.target.value }))} />
                  </div>
                  <div>
                    <Label>Level</Label>
                    <Select value={form.level} onValueChange={v => setForm(prev => ({ ...prev, level: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {[1,2,3,4,5].map(l => <SelectItem key={l} value={String(l)}>Level {l}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label>Intake Label (optional)</Label>
                  <Input placeholder="e.g. January 2026 Intake" value={form.intake_label} onChange={e => setForm(prev => ({ ...prev, intake_label: e.target.value }))} />
                </div>
                <div>
                  <Label>Gradebook Title</Label>
                  <Input value={form.title} onChange={e => setForm(prev => ({ ...prev, title: e.target.value }))} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Test Weight (%)</Label>
                    <Input type="number" min={0} max={100} value={form.test_weight} onChange={e => handleWeightChange("test_weight", e.target.value)} />
                  </div>
                  <div>
                    <Label>Mock Weight (%)</Label>
                    <Input type="number" min={0} max={100} value={form.mock_weight} onChange={e => handleWeightChange("mock_weight", e.target.value)} />
                  </div>
                </div>
                {parseInt(form.test_weight) + parseInt(form.mock_weight) !== 100 && (
                  <p className="text-sm text-destructive">Weights must sum to 100%</p>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                <Button
                  onClick={handleCreate}
                  disabled={createGradebook.isPending || !form.qualification_id || !form.title || (parseInt(form.test_weight) + parseInt(form.mock_weight) !== 100)}
                >
                  {createGradebook.isPending ? "Creating..." : "Create Gradebook"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[1,2,3].map(i => <Skeleton key={i} className="h-48" />)}
          </div>
        ) : gradebooks && gradebooks.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {gradebooks.map((gb: any) => {
              const s = statusConfig[gb.status] || statusConfig.draft;
              const canModify = gb.status === "draft" && !gb.is_locked;
              return (
                <Card
                  key={gb.id}
                  className="cursor-pointer hover:shadow-lg transition-shadow"
                  onClick={() => navigate(`/gradebooks/${gb.id}`)}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <BookOpen className="h-5 w-5 text-primary" />
                        {gb.is_locked ? <Lock className="h-3.5 w-3.5 text-muted-foreground" /> : <Unlock className="h-3.5 w-3.5 text-muted-foreground" />}
                      </div>
                      <div className="flex items-center gap-1">
                        <Badge variant={s.variant}>{s.label}</Badge>
                        {canModify && (
                          <>
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => handleOpenEdit(gb, e)}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => e.stopPropagation()}>
                                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete Gradebook</AlertDialogTitle>
                                  <AlertDialogDescription>Are you sure you want to delete "{gb.title}"? This cannot be undone.</AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => deleteGradebook.mutateAsync(gb.id)}>Delete</AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </>
                        )}
                      </div>
                    </div>
                    <CardTitle className="text-base mt-2">{gb.title}</CardTitle>
                    <CardDescription>
                      {gb.qualifications?.qualification_code} • Level {gb.level} • {gb.academic_year}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="flex items-center justify-between text-sm text-muted-foreground">
                      <span>CA: {gb.test_weight}% Test / {gb.mock_weight}% Mock</span>
                      <ChevronRight className="h-4 w-4" />
                    </div>
                    {gb.intake_label && (
                      <p className="text-xs text-muted-foreground mt-1">{gb.intake_label}</p>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <Card className="border-dashed">
            <CardContent className="py-12 text-center">
              <BookOpen className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
              <h3 className="font-semibold text-lg mb-2">No Gradebooks Yet</h3>
              <p className="text-muted-foreground mb-4">Create your first gradebook to start defining assessments and capturing marks.</p>
              <Button onClick={() => setDialogOpen(true)}><Plus className="h-4 w-4 mr-2" />Create Gradebook</Button>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Edit Gradebook Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Gradebook</DialogTitle>
            <DialogDescription>Update gradebook details.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Gradebook Title</Label>
              <Input value={form.title} onChange={e => setForm(prev => ({ ...prev, title: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Academic Year</Label>
                <Input value={form.academic_year} onChange={e => setForm(prev => ({ ...prev, academic_year: e.target.value }))} />
              </div>
              <div>
                <Label>Level</Label>
                <Select value={form.level} onValueChange={v => setForm(prev => ({ ...prev, level: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[1,2,3,4,5].map(l => <SelectItem key={l} value={String(l)}>Level {l}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Intake Label (optional)</Label>
              <Input value={form.intake_label} onChange={e => setForm(prev => ({ ...prev, intake_label: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Test Weight (%)</Label>
                <Input type="number" min={0} max={100} value={form.test_weight} onChange={e => handleWeightChange("test_weight", e.target.value)} />
              </div>
              <div>
                <Label>Mock Weight (%)</Label>
                <Input type="number" min={0} max={100} value={form.mock_weight} onChange={e => handleWeightChange("mock_weight", e.target.value)} />
              </div>
            </div>
            {parseInt(form.test_weight) + parseInt(form.mock_weight) !== 100 && (
              <p className="text-sm text-destructive">Weights must sum to 100%</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleUpdate} disabled={updateGradebook.isPending || !form.title || (parseInt(form.test_weight) + parseInt(form.mock_weight) !== 100)}>
              {updateGradebook.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default GradebookManagement;
