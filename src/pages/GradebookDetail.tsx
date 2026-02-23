import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useRoleNavigation } from "@/hooks/useRoleNavigation";
import {
  useGradebook, useGradebookComponents, useGradebookGroups, useGradebookTrainees,
  useGradebookMarks, useGradebookFeedbackList, useGradebookCAScores,
  useCreateComponent, useCreateComponentGroup, useDeleteComponent,
  useAddGradebookTrainees, useSaveMark, useSaveFeedback, useSubmitGradebook,
} from "@/hooks/useGradebooks";
import { useOrganizationContext } from "@/hooks/useOrganizationContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Plus, Trash2, Send, Lock, Users, BookOpen, Calculator, MessageSquare } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// Fetch available trainees for the gradebook's qualification
const useAvailableTrainees = (qualificationId?: string) => {
  return useQuery({
    queryKey: ["available-trainees-for-gb", qualificationId],
    queryFn: async () => {
      if (!qualificationId) return [];
      const { data, error } = await supabase
        .from("trainees")
        .select("id, trainee_id, first_name, last_name, level")
        .eq("qualification_id", qualificationId)
        .eq("status", "active")
        .order("last_name");
      if (error) throw error;
      return data || [];
    },
    enabled: !!qualificationId,
  });
};

const GradebookDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { navItems, groupLabel } = useRoleNavigation();

  const { data: gradebook, isLoading: gbLoading } = useGradebook(id);
  const { data: groups } = useGradebookGroups(id);
  const { data: components } = useGradebookComponents(id);
  const { data: gbTrainees } = useGradebookTrainees(id);
  const { data: marks } = useGradebookMarks(id);
  const { data: feedbackList } = useGradebookFeedbackList(id);
  const { data: caScores } = useGradebookCAScores(id);
  const { data: availableTrainees } = useAvailableTrainees(gradebook?.qualification_id);

  const createComponent = useCreateComponent();
  const createGroup = useCreateComponentGroup();
  const deleteComponent = useDeleteComponent();
  const addTrainees = useAddGradebookTrainees();
  const saveMark = useSaveMark();
  const saveFeedback = useSaveFeedback();
  const submitGradebook = useSubmitGradebook();

  const [compDialog, setCompDialog] = useState(false);
  const [compForm, setCompForm] = useState({ name: "", component_type: "test", max_marks: "100", group_id: "" });
  const [traineeDialog, setTraineeDialog] = useState(false);
  const [selectedTraineeIds, setSelectedTraineeIds] = useState<string[]>([]);

  // Mark editing state: { `${componentId}_${traineeId}`: { marks, competency, feedback } }
  const [editingMarks, setEditingMarks] = useState<Record<string, { marks: string; competency: string; feedback: string }>>({});

  const isDraft = gradebook?.status === "draft";
  const isLocked = gradebook?.is_locked;

  const getMark = (componentId: string, traineeId: string) => {
    return marks?.find((m: any) => m.component_id === componentId && m.trainee_id === traineeId);
  };

  const getFeedback = (componentId: string, traineeId: string) => {
    return feedbackList?.find((f: any) => f.component_id === componentId && f.trainee_id === traineeId);
  };

  const getCA = (traineeId: string) => {
    return caScores?.find((c: any) => c.trainee_id === traineeId);
  };

  const handleAddComponent = async () => {
    if (!id || !compForm.name) return;
    await createComponent.mutateAsync({
      gradebook_id: id,
      name: compForm.name,
      component_type: compForm.component_type,
      max_marks: parseFloat(compForm.max_marks) || 100,
      group_id: compForm.group_id || undefined,
      sort_order: (components?.length || 0) + 1,
    });
    setCompDialog(false);
    setCompForm({ name: "", component_type: "test", max_marks: "100", group_id: "" });
  };

  const handleAddTrainees = async () => {
    if (!id || selectedTraineeIds.length === 0) return;
    await addTrainees.mutateAsync({ gradebook_id: id, trainee_ids: selectedTraineeIds });
    setTraineeDialog(false);
    setSelectedTraineeIds([]);
  };

  const handleSaveMark = async (componentId: string, traineeId: string) => {
    const key = `${componentId}_${traineeId}`;
    const edit = editingMarks[key];
    if (!edit || !id) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await saveMark.mutateAsync({
      gradebook_id: id,
      component_id: componentId,
      trainee_id: traineeId,
      marks_obtained: edit.marks ? parseFloat(edit.marks) : undefined,
      competency_status: edit.competency || "pending",
      entered_by: user.id,
    });

    if (edit.feedback) {
      await saveFeedback.mutateAsync({
        gradebook_id: id,
        component_id: componentId,
        trainee_id: traineeId,
        feedback_text: edit.feedback,
        is_final: false,
        written_by: user.id,
      });
    }

    setEditingMarks(prev => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
    toast({ title: "Saved" });
  };

  const handleSubmit = async () => {
    if (!id) return;
    await submitGradebook.mutateAsync(id);
  };

  const enrolledIds = new Set(gbTrainees?.map((gt: any) => gt.trainee_id) || []);
  const unenrolledTrainees = availableTrainees?.filter((t: any) => !enrolledIds.has(t.id)) || [];

  if (gbLoading) {
    return (
      <DashboardLayout title="Loading..." subtitle="" navItems={navItems} groupLabel={groupLabel}>
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      </DashboardLayout>
    );
  }

  if (!gradebook) {
    return (
      <DashboardLayout title="Gradebook Not Found" subtitle="" navItems={navItems} groupLabel={groupLabel}>
        <Card><CardContent className="py-12 text-center">
          <p className="text-muted-foreground">This gradebook could not be found.</p>
          <Button className="mt-4" onClick={() => navigate("/gradebooks")}>Back to Gradebooks</Button>
        </CardContent></Card>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      title={gradebook.title}
      subtitle={`${(gradebook as any).qualifications?.qualification_code || ""} • Level ${gradebook.level} • ${gradebook.academic_year}`}
      navItems={navItems}
      groupLabel={groupLabel}
    >
      <div className="space-y-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between">
          <Button variant="ghost" onClick={() => navigate("/gradebooks")}>
            <ArrowLeft className="h-4 w-4 mr-2" />Back to Gradebooks
          </Button>
          <div className="flex items-center gap-2">
            <Badge variant={gradebook.status === "draft" ? "secondary" : "default"}>
              {gradebook.status?.replace(/_/g, " ").toUpperCase()}
            </Badge>
            {isLocked && <Badge variant="outline"><Lock className="h-3 w-3 mr-1" />Structure Locked</Badge>}
          </div>
        </div>

        {/* Info bar */}
        <Card>
          <CardContent className="py-4">
            <div className="flex flex-wrap gap-6 text-sm">
              <div><span className="text-muted-foreground">CA Weighting:</span> <strong>{gradebook.test_weight}% Test / {gradebook.mock_weight}% Mock</strong></div>
              <div><span className="text-muted-foreground">Components:</span> <strong>{components?.length || 0}</strong></div>
              <div><span className="text-muted-foreground">Trainees:</span> <strong>{gbTrainees?.length || 0}</strong></div>
              {gradebook.intake_label && <div><span className="text-muted-foreground">Intake:</span> <strong>{gradebook.intake_label}</strong></div>}
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="components" className="space-y-4">
          <TabsList>
            <TabsTrigger value="components"><BookOpen className="h-4 w-4 mr-1" />Components</TabsTrigger>
            <TabsTrigger value="marks"><Calculator className="h-4 w-4 mr-1" />Marks Entry</TabsTrigger>
            <TabsTrigger value="trainees"><Users className="h-4 w-4 mr-1" />Trainees</TabsTrigger>
            <TabsTrigger value="ca"><Calculator className="h-4 w-4 mr-1" />CA Scores</TabsTrigger>
          </TabsList>

          {/* ─── COMPONENTS TAB ─── */}
          <TabsContent value="components" className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-semibold">Assessment Components</h3>
              {isDraft && !isLocked && (
                <Dialog open={compDialog} onOpenChange={setCompDialog}>
                  <DialogTrigger asChild>
                    <Button size="sm"><Plus className="h-4 w-4 mr-1" />Add Component</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Add Assessment Component</DialogTitle>
                      <DialogDescription>Define a test, mock, practical, or assignment.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label>Name</Label>
                        <Input placeholder="e.g. Test 1, Mock Exam" value={compForm.name} onChange={e => setCompForm(p => ({ ...p, name: e.target.value }))} />
                      </div>
                      <div>
                        <Label>Type</Label>
                        <Select value={compForm.component_type} onValueChange={v => setCompForm(p => ({ ...p, component_type: v }))}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="test">Test</SelectItem>
                            <SelectItem value="mock">Mock</SelectItem>
                            <SelectItem value="assignment">Assignment</SelectItem>
                            <SelectItem value="practical">Practical</SelectItem>
                            <SelectItem value="other">Other</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Max Marks</Label>
                        <Input type="number" value={compForm.max_marks} onChange={e => setCompForm(p => ({ ...p, max_marks: e.target.value }))} />
                      </div>
                      {groups && groups.length > 0 && (
                        <div>
                          <Label>Group (optional)</Label>
                          <Select value={compForm.group_id} onValueChange={v => setCompForm(p => ({ ...p, group_id: v }))}>
                            <SelectTrigger><SelectValue placeholder="No group" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="">No group</SelectItem>
                              {groups.map((g: any) => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setCompDialog(false)}>Cancel</Button>
                      <Button onClick={handleAddComponent} disabled={createComponent.isPending || !compForm.name}>
                        {createComponent.isPending ? "Adding..." : "Add Component"}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              )}
            </div>

            {isLocked && (
              <div className="flex items-center gap-2 p-3 bg-muted rounded-lg text-sm text-muted-foreground">
                <Lock className="h-4 w-4" />
                Structure is locked. Components cannot be added or removed after the first mark is entered.
              </div>
            )}

            {components && components.length > 0 ? (
              <Card>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Group</TableHead>
                        <TableHead>Max Marks</TableHead>
                        {isDraft && !isLocked && <TableHead className="w-16"></TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {components.map((c: any) => (
                        <TableRow key={c.id}>
                          <TableCell className="font-medium">{c.name}</TableCell>
                          <TableCell><Badge variant="outline" className="capitalize">{c.component_type}</Badge></TableCell>
                          <TableCell>{(c.group as any)?.name || "—"}</TableCell>
                          <TableCell>{c.max_marks}</TableCell>
                          {isDraft && !isLocked && (
                            <TableCell>
                              <Button size="icon" variant="ghost" onClick={() => deleteComponent.mutate({ id: c.id, gradebook_id: id! })}>
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </TableCell>
                          )}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            ) : (
              <Card className="border-dashed">
                <CardContent className="py-8 text-center text-muted-foreground">
                  <p>No components defined yet. Add tests, mocks, and practicals.</p>
                </CardContent>
              </Card>
            )}

            {/* Quick group creation */}
            {isDraft && !isLocked && (
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => createGroup.mutate({ gradebook_id: id!, name: "Theory", group_type: "theory", sort_order: 1 })}>
                  + Theory Group
                </Button>
                <Button size="sm" variant="outline" onClick={() => createGroup.mutate({ gradebook_id: id!, name: "Practical", group_type: "practical", sort_order: 2 })}>
                  + Practical Group
                </Button>
              </div>
            )}
          </TabsContent>

          {/* ─── MARKS ENTRY TAB ─── */}
          <TabsContent value="marks" className="space-y-4">
            {components && components.length > 0 && gbTrainees && gbTrainees.length > 0 ? (
              <>
                {isDraft && (
                  <div className="flex justify-end">
                    <Button onClick={handleSubmit} disabled={submitGradebook.isPending}>
                      <Send className="h-4 w-4 mr-2" />{submitGradebook.isPending ? "Submitting..." : "Submit for Review"}
                    </Button>
                  </div>
                )}
                <Card>
                  <CardContent className="p-0 overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="sticky left-0 bg-background z-10 min-w-[160px]">Trainee</TableHead>
                          {components.map((c: any) => (
                            <TableHead key={c.id} className="min-w-[140px] text-center">
                              <div>{c.name}</div>
                              <div className="text-xs font-normal text-muted-foreground capitalize">({c.component_type}) /{c.max_marks}</div>
                            </TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {gbTrainees.map((gt: any) => {
                          const trainee = gt.trainees;
                          return (
                            <TableRow key={gt.id}>
                              <TableCell className="sticky left-0 bg-background z-10 font-medium">
                                <div>{trainee?.first_name} {trainee?.last_name}</div>
                                <div className="text-xs text-muted-foreground font-mono">{trainee?.trainee_id}</div>
                              </TableCell>
                              {components.map((c: any) => {
                                const key = `${c.id}_${gt.trainee_id}`;
                                const existingMark = getMark(c.id, gt.trainee_id);
                                const existingFb = getFeedback(c.id, gt.trainee_id);
                                const editing = editingMarks[key];
                                const currentMarks = editing?.marks ?? (existingMark?.marks_obtained != null ? String(existingMark.marks_obtained) : "");
                                const currentCompetency = editing?.competency ?? existingMark?.competency_status ?? "pending";
                                const currentFeedback = editing?.feedback ?? existingFb?.feedback_text ?? "";
                                const hasEdits = !!editing;

                                return (
                                  <TableCell key={c.id} className="text-center p-2">
                                    {isDraft ? (
                                      <div className="space-y-1">
                                        <Input
                                          type="number"
                                          placeholder="Mark"
                                          className="w-20 mx-auto text-center"
                                          value={currentMarks}
                                          onChange={e => setEditingMarks(prev => ({
                                            ...prev,
                                            [key]: { marks: e.target.value, competency: currentCompetency, feedback: currentFeedback }
                                          }))}
                                        />
                                        <Select
                                          value={currentCompetency}
                                          onValueChange={v => setEditingMarks(prev => ({
                                            ...prev,
                                            [key]: { marks: currentMarks, competency: v, feedback: currentFeedback }
                                          }))}
                                        >
                                          <SelectTrigger className="w-full text-xs h-7">
                                            <SelectValue />
                                          </SelectTrigger>
                                          <SelectContent>
                                            <SelectItem value="pending">Pending</SelectItem>
                                            <SelectItem value="competent">C</SelectItem>
                                            <SelectItem value="not_yet_competent">NYC</SelectItem>
                                          </SelectContent>
                                        </Select>
                                        <Textarea
                                          placeholder="Feedback..."
                                          className="text-xs min-h-[40px]"
                                          value={currentFeedback}
                                          onChange={e => setEditingMarks(prev => ({
                                            ...prev,
                                            [key]: { marks: currentMarks, competency: currentCompetency, feedback: e.target.value }
                                          }))}
                                        />
                                        {hasEdits && (
                                          <Button size="sm" className="w-full h-7 text-xs" onClick={() => handleSaveMark(c.id, gt.trainee_id)} disabled={saveMark.isPending}>
                                            Save
                                          </Button>
                                        )}
                                      </div>
                                    ) : (
                                      <div className="space-y-1">
                                        <div className="font-semibold">{existingMark?.marks_obtained ?? "—"}</div>
                                        <Badge variant={existingMark?.competency_status === "competent" ? "default" : existingMark?.competency_status === "not_yet_competent" ? "destructive" : "secondary"} className="text-xs">
                                          {existingMark?.competency_status === "competent" ? "C" : existingMark?.competency_status === "not_yet_competent" ? "NYC" : "P"}
                                        </Badge>
                                        {existingFb?.feedback_text && (
                                          <p className="text-xs text-muted-foreground mt-1">{existingFb.feedback_text}</p>
                                        )}
                                      </div>
                                    )}
                                  </TableCell>
                                );
                              })}
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </>
            ) : (
              <Card className="border-dashed">
                <CardContent className="py-8 text-center text-muted-foreground">
                  <p>{!components?.length ? "Add assessment components first." : "Add trainees to this gradebook first."}</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* ─── TRAINEES TAB ─── */}
          <TabsContent value="trainees" className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-semibold">Enrolled Trainees ({gbTrainees?.length || 0})</h3>
              {isDraft && (
                <Dialog open={traineeDialog} onOpenChange={setTraineeDialog}>
                  <DialogTrigger asChild>
                    <Button size="sm"><Plus className="h-4 w-4 mr-1" />Add Trainees</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Add Trainees to Gradebook</DialogTitle>
                      <DialogDescription>Select trainees enrolled in this qualification.</DialogDescription>
                    </DialogHeader>
                    <div className="max-h-[300px] overflow-y-auto space-y-2">
                      {unenrolledTrainees.length > 0 ? unenrolledTrainees.map((t: any) => (
                        <label key={t.id} className="flex items-center gap-3 p-2 rounded hover:bg-muted cursor-pointer">
                          <input
                            type="checkbox"
                            checked={selectedTraineeIds.includes(t.id)}
                            onChange={e => {
                              if (e.target.checked) setSelectedTraineeIds(prev => [...prev, t.id]);
                              else setSelectedTraineeIds(prev => prev.filter(id => id !== t.id));
                            }}
                          />
                          <div>
                            <div className="font-medium text-sm">{t.first_name} {t.last_name}</div>
                            <div className="text-xs text-muted-foreground font-mono">{t.trainee_id}</div>
                          </div>
                        </label>
                      )) : (
                        <p className="text-sm text-muted-foreground text-center py-4">All trainees already enrolled.</p>
                      )}
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setTraineeDialog(false)}>Cancel</Button>
                      <Button onClick={handleAddTrainees} disabled={addTrainees.isPending || selectedTraineeIds.length === 0}>
                        Add {selectedTraineeIds.length} Trainee(s)
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              )}
            </div>
            {gbTrainees && gbTrainees.length > 0 ? (
              <Card>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Trainee ID</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Level</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {gbTrainees.map((gt: any) => (
                        <TableRow key={gt.id}>
                          <TableCell className="font-mono">{gt.trainees?.trainee_id}</TableCell>
                          <TableCell>{gt.trainees?.first_name} {gt.trainees?.last_name}</TableCell>
                          <TableCell>{gt.trainees?.level}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            ) : (
              <Card className="border-dashed">
                <CardContent className="py-8 text-center text-muted-foreground">
                  <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No trainees enrolled yet.</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* ─── CA SCORES TAB ─── */}
          <TabsContent value="ca" className="space-y-4">
            <h3 className="font-semibold">Continuous Assessment Scores (Auto-Calculated)</h3>
            <p className="text-sm text-muted-foreground">
              CA = Test Avg × {gradebook.test_weight}% + Mock Avg × {gradebook.mock_weight}%
            </p>
            {caScores && caScores.length > 0 ? (
              <Card>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Trainee</TableHead>
                        <TableHead className="text-center">Test Avg (%)</TableHead>
                        <TableHead className="text-center">Mock Avg (%)</TableHead>
                        <TableHead className="text-center">Theory (%)</TableHead>
                        <TableHead className="text-center">Practical (%)</TableHead>
                        <TableHead className="text-center">CA Score</TableHead>
                        <TableHead className="text-center">Competency</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {caScores.map((ca: any) => {
                        const trainee = gbTrainees?.find((gt: any) => gt.trainee_id === ca.trainee_id)?.trainees;
                        return (
                          <TableRow key={ca.id}>
                            <TableCell>
                              <div className="font-medium">{trainee?.first_name} {trainee?.last_name}</div>
                              <div className="text-xs text-muted-foreground font-mono">{trainee?.trainee_id}</div>
                            </TableCell>
                            <TableCell className="text-center">{ca.test_average != null ? ca.test_average.toFixed(1) : "—"}</TableCell>
                            <TableCell className="text-center">{ca.mock_average != null ? ca.mock_average.toFixed(1) : "—"}</TableCell>
                            <TableCell className="text-center">{ca.theory_score != null ? ca.theory_score.toFixed(1) : "—"}</TableCell>
                            <TableCell className="text-center">{ca.practical_score != null ? ca.practical_score.toFixed(1) : "—"}</TableCell>
                            <TableCell className="text-center font-bold">{ca.ca_score != null ? ca.ca_score.toFixed(1) : "—"}</TableCell>
                            <TableCell className="text-center">
                              <Badge variant={ca.overall_competency === "competent" ? "default" : ca.overall_competency === "not_yet_competent" ? "destructive" : "secondary"}>
                                {ca.overall_competency === "competent" ? "Competent" : ca.overall_competency === "not_yet_competent" ? "NYC" : "Pending"}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            ) : (
              <Card className="border-dashed">
                <CardContent className="py-8 text-center text-muted-foreground">
                  <Calculator className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>CA scores will appear once marks are entered.</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default GradebookDetail;
