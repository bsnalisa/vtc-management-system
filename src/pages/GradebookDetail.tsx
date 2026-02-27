import { useState, useEffect } from "react";
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
  useHoTApproveGradebook, useReturnGradebook, useACApproveGradebook,
} from "@/hooks/useGradebooks";
import { useOrganizationContext } from "@/hooks/useOrganizationContext";
import { useTemplateForQualification, useTemplateComponents as useTemplateComps } from "@/hooks/useAssessmentTemplates";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Plus, Trash2, Send, Lock, Users, BookOpen, Calculator, MessageSquare, HelpCircle, CheckCircle, XCircle, Link2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useGradebookQueries, useResolveMarkQuery } from "@/hooks/useMarkQueries";

// Fetch available trainees for the gradebook's qualification
// First try class_enrollments matching the qualification's trade, then fall back to direct qualification match
const useAvailableTrainees = (qualificationId?: string, level?: number) => {
  return useQuery({
    queryKey: ["available-trainees-for-gb", qualificationId, level],
    queryFn: async () => {
      if (!qualificationId) return [];
      
      // Get qualification's trade_id
      const { data: qual } = await supabase
        .from("qualifications")
        .select("trade_id")
        .eq("id", qualificationId)
        .single();
      
      // Find trainees matching the trade (and optionally level)
      if (qual?.trade_id) {
        let query = supabase
          .from("trainees")
          .select("id, trainee_id, first_name, last_name, level")
          .eq("trade_id", qual.trade_id)
          .eq("status", "active");
        if (level) query = query.eq("level", level);
        const { data: trainees, error } = await query.order("last_name");
        if (!error && trainees && trainees.length > 0) return trainees;
      }
      
      // Fallback: match by qualification_id on trainees table
      let fallbackQuery = supabase
        .from("trainees")
        .select("id, trainee_id, first_name, last_name, level")
        .eq("qualification_id", qualificationId)
        .eq("status", "active");
      if (level) fallbackQuery = fallbackQuery.eq("level", level);
      const { data, error } = await fallbackQuery.order("last_name");
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
  const { data: availableTrainees } = useAvailableTrainees(gradebook?.qualification_id, gradebook?.level);
  const { data: markQueries } = useGradebookQueries(id);
  const resolveQuery = useResolveMarkQuery();
  const { data: qualTemplate } = useTemplateForQualification(gradebook?.qualification_id);
  const { data: templateComponents } = useTemplateComps(qualTemplate?.id);

  const createComponent = useCreateComponent();
  const createGroup = useCreateComponentGroup();
  const deleteComponent = useDeleteComponent();
  const addTrainees = useAddGradebookTrainees();
  const saveMark = useSaveMark();
  const saveFeedback = useSaveFeedback();
  const submitGradebook = useSubmitGradebook();
  const hotApprove = useHoTApproveGradebook();
  const returnGb = useReturnGradebook();
  const acApprove = useACApproveGradebook();

  const [compDialog, setCompDialog] = useState(false);
  const [compForm, setCompForm] = useState({ name: "", component_type: "test", max_marks: "100", group_id: "", template_component_id: "" });
  const [traineeDialog, setTraineeDialog] = useState(false);
  const [selectedTraineeIds, setSelectedTraineeIds] = useState<string[]>([]);
  const [resolveDialog, setResolveDialog] = useState<{ queryId: string; action: "resolved" | "rejected" } | null>(null);
  const [resolveNotes, setResolveNotes] = useState("");

  // Mark editing state: { `${componentId}_${traineeId}`: { marks, competency, feedback } }
  const [editingMarks, setEditingMarks] = useState<Record<string, { marks: string; competency: string; feedback: string }>>({});

  const { role } = useRoleNavigation();
  const isTrainer = role === "trainer";
  const isHoT = role === "head_of_training";
  const isAC = role === "assessment_coordinator";
  const isDraft = gradebook?.status === "draft";
  const isLocked = gradebook?.is_locked;
  const canEdit = isTrainer && isDraft;
  const canEnterMarks = isTrainer && (isDraft || isLocked);
  const canAddComponents = isTrainer && (isDraft || isLocked);

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
      group_id: compForm.group_id && compForm.group_id !== "none" ? compForm.group_id : undefined,
      sort_order: (components?.length || 0) + 1,
      template_component_id: compForm.template_component_id && compForm.template_component_id !== "none" ? compForm.template_component_id : undefined,
    });
    setCompDialog(false);
    setCompForm({ name: "", component_type: "test", max_marks: "100", group_id: "", template_component_id: "" });
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

  // Auto-enroll all matching trainees when gradebook has none enrolled yet
  useEffect(() => {
    if (
      id &&
      gbTrainees &&
      gbTrainees.length === 0 &&
      availableTrainees &&
      availableTrainees.length > 0 &&
      !addTrainees.isPending
    ) {
      const allIds = availableTrainees.map((t: any) => t.id);
      addTrainees.mutate({ gradebook_id: id, trainee_ids: allIds });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, gbTrainees, availableTrainees]);

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

        {(isHoT || isAC) ? (
          /* ─── HoT / AC: Detailed Component-by-Component Assessment View ─── */
          <div className="space-y-6">
            {isAC && gradebook?.status === "hot_approved" && (
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => {
                  // Generate CSV template for external assessors
                  if (!components || !gbTrainees) return;
                  const headers = ["Trainee ID", "First Name", "Last Name", ...components.map((c: any) => `${c.name} (/${c.max_marks})`), "Assessor Name", "Exam Date"];
                  const rows = gbTrainees.map((gt: any) => {
                    const t = gt.trainees;
                    return [t?.trainee_id || "", t?.first_name || "", t?.last_name || "", ...components.map(() => ""), "", ""].join(",");
                  });
                  const csv = [headers.join(","), ...rows].join("\n");
                  const blob = new Blob([csv], { type: "text/csv" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `exam-template-${gradebook.title.replace(/\s+/g, "-")}.csv`;
                  a.click();
                  URL.revokeObjectURL(url);
                  toast({ title: "Template Downloaded", description: "CSV exam template has been downloaded for external assessors." });
                }}>
                  <BookOpen className="h-4 w-4 mr-2" />Download Exam Template (CSV)
                </Button>
              </div>
            )}
            <div>
              <h3 className="font-semibold text-lg">Trainee Assessment Summary</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Theory CA = Test Avg × {gradebook.test_weight}% + Mock × {gradebook.mock_weight}% (pass: ≥50%) · Practical tasks pass individually (≥60% each)
              </p>
            </div>

            {(() => {
              const testComps = components?.filter((c: any) => c.component_type === "test") || [];
              const mockComps = components?.filter((c: any) => c.component_type === "mock") || [];
              const practicalComps = components?.filter((c: any) => c.component_type === "practical") || [];
              const otherComps = components?.filter((c: any) => !["test", "mock", "practical"].includes(c.component_type)) || [];
              const allComps = [...testComps, ...mockComps, ...practicalComps, ...otherComps];

              if (allComps.length === 0 && (!gbTrainees || gbTrainees.length === 0)) {
                return (
                  <Card className="border-dashed">
                    <CardContent className="py-8 text-center text-muted-foreground">
                      <Calculator className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p>No assessment data available yet.</p>
                    </CardContent>
                  </Card>
                );
              }

              return (
                <Card>
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="sticky left-0 bg-background z-10 min-w-[180px]">Trainee</TableHead>
                            {testComps.map((c: any) => (
                              <TableHead key={c.id} className="text-center min-w-[80px]">
                                <div className="text-xs font-semibold">{c.name}</div>
                                <div className="text-[10px] text-muted-foreground">/{c.max_marks}</div>
                              </TableHead>
                            ))}
                            {testComps.length > 0 && (
                              <TableHead className="text-center min-w-[80px] bg-muted/30">
                                <div className="text-xs font-semibold">Test Avg</div>
                                <div className="text-[10px] text-muted-foreground">%</div>
                              </TableHead>
                            )}
                            {mockComps.map((c: any) => (
                              <TableHead key={c.id} className="text-center min-w-[80px]">
                                <div className="text-xs font-semibold">{c.name}</div>
                                <div className="text-[10px] text-muted-foreground">/{c.max_marks}</div>
                              </TableHead>
                            ))}
                            {(testComps.length > 0 || mockComps.length > 0) && (
                              <TableHead className="text-center min-w-[90px] bg-muted/50">
                                <div className="text-xs font-bold">Theory CA</div>
                                <div className="text-[10px] text-muted-foreground">pass ≥50%</div>
                              </TableHead>
                            )}
                            {practicalComps.map((c: any) => (
                              <TableHead key={c.id} className="text-center min-w-[90px]">
                                <div className="text-xs font-semibold">{c.name}</div>
                                <div className="text-[10px] text-muted-foreground">/{c.max_marks} (≥60%)</div>
                              </TableHead>
                            ))}
                            {otherComps.map((c: any) => (
                              <TableHead key={c.id} className="text-center min-w-[80px]">
                                <div className="text-xs font-semibold">{c.name}</div>
                                <div className="text-[10px] text-muted-foreground">/{c.max_marks}</div>
                              </TableHead>
                            ))}
                            <TableHead className="text-center min-w-[100px] bg-muted/50">
                              <div className="text-xs font-bold">Overall</div>
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {gbTrainees?.map((gt: any) => {
                            const trainee = gt.trainees;
                            const ca = getCA(gt.trainee_id);

                            // Compute test average %
                            const testMarks = testComps.map((c: any) => {
                              const m = getMark(c.id, gt.trainee_id);
                              return m?.marks_obtained != null ? { pct: (m.marks_obtained / c.max_marks) * 100, raw: m.marks_obtained } : null;
                            });
                            const validTests = testMarks.filter(Boolean) as { pct: number; raw: number }[];
                            const testAvg = validTests.length > 0 ? validTests.reduce((s, t) => s + t.pct, 0) / validTests.length : null;

                            // Mock average %
                            const mockMarks = mockComps.map((c: any) => {
                              const m = getMark(c.id, gt.trainee_id);
                              return m?.marks_obtained != null ? (m.marks_obtained / c.max_marks) * 100 : null;
                            });
                            const validMocks = mockMarks.filter((v): v is number => v !== null);
                            const mockAvg = validMocks.length > 0 ? validMocks.reduce((s, v) => s + v, 0) / validMocks.length : null;

                            // Theory CA
                            const theoryCA = (testAvg !== null || mockAvg !== null)
                              ? (testAvg ?? 0) * (gradebook.test_weight / 100) + (mockAvg ?? 0) * (gradebook.mock_weight / 100)
                              : null;
                            const theoryPass = theoryCA !== null && theoryCA >= 50;

                            // Practical marks
                            const practicalResults = practicalComps.map((c: any) => {
                              const m = getMark(c.id, gt.trainee_id);
                              if (m?.marks_obtained == null) return { pct: null, pass: false };
                              const pct = (m.marks_obtained / c.max_marks) * 100;
                              return { pct, pass: pct >= 60 };
                            });
                            const allPracticalsPass = practicalComps.length === 0 || practicalResults.every(p => p.pct !== null && p.pass);

                            return (
                              <TableRow key={gt.id}>
                                <TableCell className="sticky left-0 bg-background z-10">
                                  <div className="font-medium text-sm">{trainee?.first_name} {trainee?.last_name}</div>
                                  <div className="text-xs text-muted-foreground font-mono">{trainee?.trainee_id}</div>
                                </TableCell>
                                {testComps.map((c: any, i: number) => {
                                  const m = getMark(c.id, gt.trainee_id);
                                  return (
                                    <TableCell key={c.id} className="text-center text-sm">
                                      {m?.marks_obtained != null ? m.marks_obtained : "—"}
                                    </TableCell>
                                  );
                                })}
                                {testComps.length > 0 && (
                                  <TableCell className="text-center text-sm font-semibold bg-muted/30">
                                    {testAvg !== null ? testAvg.toFixed(1) : "—"}
                                  </TableCell>
                                )}
                                {mockComps.map((c: any, i: number) => {
                                  const m = getMark(c.id, gt.trainee_id);
                                  return (
                                    <TableCell key={c.id} className="text-center text-sm">
                                      {m?.marks_obtained != null ? m.marks_obtained : "—"}
                                    </TableCell>
                                  );
                                })}
                                {(testComps.length > 0 || mockComps.length > 0) && (
                                  <TableCell className={`text-center text-sm font-bold bg-muted/50 ${theoryCA !== null ? (theoryPass ? "text-green-600" : "text-destructive") : ""}`}>
                                    {theoryCA !== null ? theoryCA.toFixed(1) : "—"}
                                    {theoryCA !== null && (
                                      <div className="text-[10px]">{theoryPass ? "✓ Pass" : "✗ Fail"}</div>
                                    )}
                                  </TableCell>
                                )}
                                {practicalComps.map((c: any, i: number) => {
                                  const p = practicalResults[i];
                                  return (
                                    <TableCell key={c.id} className={`text-center text-sm ${p.pct !== null ? (p.pass ? "text-green-600" : "text-destructive") : ""}`}>
                                      {p.pct !== null ? p.pct.toFixed(1) : "—"}
                                      {p.pct !== null && (
                                        <div className="text-[10px]">{p.pass ? "✓ Pass" : "✗ Fail"}</div>
                                      )}
                                    </TableCell>
                                  );
                                })}
                                {otherComps.map((c: any) => {
                                  const m = getMark(c.id, gt.trainee_id);
                                  return (
                                    <TableCell key={c.id} className="text-center text-sm">
                                      {m?.marks_obtained != null ? m.marks_obtained : "—"}
                                    </TableCell>
                                  );
                                })}
                                <TableCell className="text-center bg-muted/50">
                                  <Badge variant={
                                    (theoryPass && allPracticalsPass) ? "default" :
                                    theoryCA === null && practicalResults.every(p => p.pct === null) ? "secondary" :
                                    "destructive"
                                  }>
                                    {(theoryPass && allPracticalsPass) ? "Competent" :
                                     theoryCA === null && practicalResults.every(p => p.pct === null) ? "Pending" :
                                     "NYC"}
                                  </Badge>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              );
            })()}

            {/* HoT Actions */}
            {isHoT && gradebook?.status === "submitted" && id && (
              <div className="flex gap-2 justify-end">
                <Button onClick={() => hotApprove.mutateAsync(id)} disabled={hotApprove.isPending}>
                  <CheckCircle className="h-4 w-4 mr-2" />{hotApprove.isPending ? "Approving..." : "Approve"}
                </Button>
                <Button variant="destructive" onClick={() => returnGb.mutateAsync({ gradebookId: id, returnTo: "draft" })} disabled={returnGb.isPending}>
                  <XCircle className="h-4 w-4 mr-2" />{returnGb.isPending ? "Returning..." : "Return to Trainer"}
                </Button>
              </div>
            )}

            {/* AC Actions */}
            {isAC && gradebook?.status === "hot_approved" && id && (
              <div className="flex gap-2 justify-end">
                <Button onClick={() => acApprove.mutateAsync(id)} disabled={acApprove.isPending}>
                  <CheckCircle className="h-4 w-4 mr-2" />{acApprove.isPending ? "Approving..." : "Approve (AC)"}
                </Button>
                <Button variant="destructive" onClick={() => returnGb.mutateAsync({ gradebookId: id, returnTo: "submitted" })} disabled={returnGb.isPending}>
                  <XCircle className="h-4 w-4 mr-2" />{returnGb.isPending ? "Returning..." : "Return to HoT"}
                </Button>
              </div>
            )}
          </div>
        ) : (
        <Tabs defaultValue="components" className="space-y-4">
          <TabsList>
            <TabsTrigger value="components"><BookOpen className="h-4 w-4 mr-1" />Components</TabsTrigger>
            <TabsTrigger value="marks"><Calculator className="h-4 w-4 mr-1" />Marks Entry</TabsTrigger>
            <TabsTrigger value="trainees"><Users className="h-4 w-4 mr-1" />Trainees</TabsTrigger>
            <TabsTrigger value="ca"><Calculator className="h-4 w-4 mr-1" />CA Scores</TabsTrigger>
            <TabsTrigger value="queries">
              <HelpCircle className="h-4 w-4 mr-1" />Queries
              {markQueries && markQueries.filter((q: any) => q.status === "open").length > 0 && (
                <Badge variant="destructive" className="ml-1 h-5 px-1.5 text-xs">
                  {markQueries.filter((q: any) => q.status === "open").length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* ─── COMPONENTS TAB ─── */}
          <TabsContent value="components" className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-semibold">Assessment Components</h3>
              {canAddComponents && (
                <Dialog open={compDialog} onOpenChange={setCompDialog}>
                  <DialogTrigger asChild>
                    <Button size="sm"><Plus className="h-4 w-4 mr-1" />Add Component</Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                      <DialogTitle>Add Assessment Component</DialogTitle>
                      <DialogDescription>Select a component type and configure it for your gradebook.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label>Component Type</Label>
                        <Select value={compForm.component_type} onValueChange={v => setCompForm(p => ({ ...p, component_type: v }))}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="test">
                              <div className="flex flex-col items-start">
                                <span className="font-medium">Theory Test</span>
                                <span className="text-xs text-muted-foreground">e.g. Test 1, Test 2 – can cover a group of units</span>
                              </div>
                            </SelectItem>
                            <SelectItem value="practical">
                              <div className="flex flex-col items-start">
                                <span className="font-medium">Practical</span>
                                <span className="text-xs text-muted-foreground">Hands-on assessment – can be per unit or cover multiple units</span>
                              </div>
                            </SelectItem>
                            <SelectItem value="assignment">
                              <div className="flex flex-col items-start">
                                <span className="font-medium">Assignment</span>
                                <span className="text-xs text-muted-foreground">Written or research-based coursework</span>
                              </div>
                            </SelectItem>
                            <SelectItem value="project">
                              <div className="flex flex-col items-start">
                                <span className="font-medium">Project</span>
                                <span className="text-xs text-muted-foreground">Extended project work – individual or group</span>
                              </div>
                            </SelectItem>
                            <SelectItem value="mock">
                              <div className="flex flex-col items-start">
                                <span className="font-medium">Mock Exam</span>
                                <span className="text-xs text-muted-foreground">Practice examination under exam conditions</span>
                              </div>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Name</Label>
                        <Input 
                          placeholder={
                            compForm.component_type === "test" ? "e.g. Test 1 (Units 1-3)" :
                            compForm.component_type === "practical" ? "e.g. Practical 1 – Unit 5" :
                            compForm.component_type === "assignment" ? "e.g. Assignment 1" :
                            compForm.component_type === "project" ? "e.g. Capstone Project" :
                            compForm.component_type === "mock" ? "e.g. Mock Exam 1" : "Component name"
                          }
                          value={compForm.name} 
                          onChange={e => setCompForm(p => ({ ...p, name: e.target.value }))} 
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          {compForm.component_type === "test" && "A test can cover a group of unit standards. Name it Test 1, Test 2, etc."}
                          {compForm.component_type === "practical" && "A practical can assess one unit or a group of units. One unit can have multiple practicals."}
                          {compForm.component_type === "assignment" && "An assignment for written or research work."}
                          {compForm.component_type === "project" && "A project-based assessment component."}
                          {compForm.component_type === "mock" && "A mock examination that simulates final exam conditions."}
                        </p>
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
                              <SelectItem value="none">No group</SelectItem>
                              {groups.map((g: any) => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                      {templateComponents && templateComponents.length > 0 && (
                        <div>
                          <Label className="flex items-center gap-1"><Link2 className="h-3.5 w-3.5" />Link to Template Component</Label>
                          <Select value={compForm.template_component_id} onValueChange={v => setCompForm(p => ({ ...p, template_component_id: v }))}>
                            <SelectTrigger><SelectValue placeholder="Select template component" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">No link</SelectItem>
                              {templateComponents
                                .filter((tc: any) => {
                                  if (["test", "mock"].includes(compForm.component_type)) return tc.component_type === "theory";
                                  return tc.component_type === "practical";
                                })
                                .map((tc: any) => (
                                  <SelectItem key={tc.id} value={tc.id}>
                                    {tc.component_name} ({tc.component_type})
                                  </SelectItem>
                                ))}
                            </SelectContent>
                          </Select>
                          <p className="text-xs text-muted-foreground mt-1">
                            Links this assessment to the official template structure for CA calculation.
                          </p>
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
                Structure is locked. Components cannot be deleted after the first mark is entered, but new ones can still be added.
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
                        {canEdit && !isLocked && <TableHead className="w-16">Delete</TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {components.map((c: any) => (
                        <TableRow key={c.id}>
                          <TableCell className="font-medium">{c.name}</TableCell>
                          <TableCell><Badge variant="outline" className="capitalize">{c.component_type}</Badge></TableCell>
                          <TableCell>{(c.group as any)?.name || "—"}</TableCell>
                          <TableCell>{c.max_marks}</TableCell>
                          {canEdit && !isLocked && (
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
            {canEdit && !isLocked && (
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
                {canEnterMarks && (
                  <div className="flex justify-end">
                    <Button onClick={handleSubmit} disabled={submitGradebook.isPending}>
                      <Send className="h-4 w-4 mr-2" />{submitGradebook.isPending ? "Submitting..." : "Submit for Review"}
                    </Button>
                  </div>
                )}
                {isTrainer && !isDraft && !isLocked && gradebook?.status !== "draft" && (
                  <div className="flex items-center gap-2 p-3 bg-muted rounded-lg text-sm text-muted-foreground">
                    <Lock className="h-4 w-4" />
                    This gradebook has been submitted and marks are now read-only. To edit marks, the gradebook must be returned to draft status.
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
                                    {canEnterMarks ? (
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
              {canEdit && (
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

          {/* ─── CA SCORES TAB (same detailed view as HoT) ─── */}
          <TabsContent value="ca" className="space-y-4">
            <div>
              <h3 className="font-semibold text-lg">Continuous Assessment Scores (Auto-Calculated)</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Theory CA = Test Avg × {gradebook.test_weight}% + Mock × {gradebook.mock_weight}% (pass: ≥50%) · Practical tasks pass individually (≥60% each)
              </p>
            </div>

            {(() => {
              const testComps = components?.filter((c: any) => c.component_type === "test") || [];
              const mockComps = components?.filter((c: any) => c.component_type === "mock") || [];
              const practicalComps = components?.filter((c: any) => c.component_type === "practical") || [];
              const otherComps = components?.filter((c: any) => !["test", "mock", "practical"].includes(c.component_type)) || [];
              const allComps = [...testComps, ...mockComps, ...practicalComps, ...otherComps];

              if (allComps.length === 0 && (!gbTrainees || gbTrainees.length === 0)) {
                return (
                  <Card className="border-dashed">
                    <CardContent className="py-8 text-center text-muted-foreground">
                      <Calculator className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p>CA scores will appear once marks are entered.</p>
                    </CardContent>
                  </Card>
                );
              }

              return (
                <Card>
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="sticky left-0 bg-background z-10 min-w-[180px]">Trainee</TableHead>
                            {testComps.map((c: any) => (
                              <TableHead key={c.id} className="text-center min-w-[80px]">
                                <div className="text-xs font-semibold">{c.name}</div>
                                <div className="text-[10px] text-muted-foreground">/{c.max_marks}</div>
                              </TableHead>
                            ))}
                            {testComps.length > 0 && (
                              <TableHead className="text-center min-w-[80px] bg-muted/30">
                                <div className="text-xs font-semibold">Test Avg</div>
                                <div className="text-[10px] text-muted-foreground">%</div>
                              </TableHead>
                            )}
                            {mockComps.map((c: any) => (
                              <TableHead key={c.id} className="text-center min-w-[80px]">
                                <div className="text-xs font-semibold">{c.name}</div>
                                <div className="text-[10px] text-muted-foreground">/{c.max_marks}</div>
                              </TableHead>
                            ))}
                            {(testComps.length > 0 || mockComps.length > 0) && (
                              <TableHead className="text-center min-w-[90px] bg-muted/50">
                                <div className="text-xs font-bold">Theory CA</div>
                                <div className="text-[10px] text-muted-foreground">pass ≥50%</div>
                              </TableHead>
                            )}
                            {practicalComps.map((c: any) => (
                              <TableHead key={c.id} className="text-center min-w-[90px]">
                                <div className="text-xs font-semibold">{c.name}</div>
                                <div className="text-[10px] text-muted-foreground">/{c.max_marks} (≥60%)</div>
                              </TableHead>
                            ))}
                            {otherComps.map((c: any) => (
                              <TableHead key={c.id} className="text-center min-w-[80px]">
                                <div className="text-xs font-semibold">{c.name}</div>
                                <div className="text-[10px] text-muted-foreground">/{c.max_marks}</div>
                              </TableHead>
                            ))}
                            <TableHead className="text-center min-w-[100px] bg-muted/50">
                              <div className="text-xs font-bold">Overall</div>
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {gbTrainees?.map((gt: any) => {
                            const trainee = gt.trainees;

                            const testMarks = testComps.map((c: any) => {
                              const m = getMark(c.id, gt.trainee_id);
                              return m?.marks_obtained != null ? { pct: (m.marks_obtained / c.max_marks) * 100, raw: m.marks_obtained } : null;
                            });
                            const validTests = testMarks.filter(Boolean) as { pct: number; raw: number }[];
                            const testAvg = validTests.length > 0 ? validTests.reduce((s, t) => s + t.pct, 0) / validTests.length : null;

                            const mockMarks = mockComps.map((c: any) => {
                              const m = getMark(c.id, gt.trainee_id);
                              return m?.marks_obtained != null ? (m.marks_obtained / c.max_marks) * 100 : null;
                            });
                            const validMocks = mockMarks.filter((v): v is number => v !== null);
                            const mockAvg = validMocks.length > 0 ? validMocks.reduce((s, v) => s + v, 0) / validMocks.length : null;

                            const theoryCA = (testAvg !== null || mockAvg !== null)
                              ? (testAvg ?? 0) * (gradebook.test_weight / 100) + (mockAvg ?? 0) * (gradebook.mock_weight / 100)
                              : null;
                            const theoryPass = theoryCA !== null && theoryCA >= 50;

                            const practicalResults = practicalComps.map((c: any) => {
                              const m = getMark(c.id, gt.trainee_id);
                              if (m?.marks_obtained == null) return { pct: null, pass: false };
                              const pct = (m.marks_obtained / c.max_marks) * 100;
                              return { pct, pass: pct >= 60 };
                            });
                            const allPracticalsPass = practicalComps.length === 0 || practicalResults.every(p => p.pct !== null && p.pass);

                            return (
                              <TableRow key={gt.id}>
                                <TableCell className="sticky left-0 bg-background z-10">
                                  <div className="font-medium text-sm">{trainee?.first_name} {trainee?.last_name}</div>
                                  <div className="text-xs text-muted-foreground font-mono">{trainee?.trainee_id}</div>
                                </TableCell>
                                {testComps.map((c: any) => {
                                  const m = getMark(c.id, gt.trainee_id);
                                  return (
                                    <TableCell key={c.id} className="text-center text-sm">
                                      {m?.marks_obtained != null ? m.marks_obtained : "—"}
                                    </TableCell>
                                  );
                                })}
                                {testComps.length > 0 && (
                                  <TableCell className="text-center text-sm font-semibold bg-muted/30">
                                    {testAvg !== null ? testAvg.toFixed(1) : "—"}
                                  </TableCell>
                                )}
                                {mockComps.map((c: any) => {
                                  const m = getMark(c.id, gt.trainee_id);
                                  return (
                                    <TableCell key={c.id} className="text-center text-sm">
                                      {m?.marks_obtained != null ? m.marks_obtained : "—"}
                                    </TableCell>
                                  );
                                })}
                                {(testComps.length > 0 || mockComps.length > 0) && (
                                  <TableCell className={`text-center text-sm font-bold bg-muted/50 ${theoryCA !== null ? (theoryPass ? "text-green-600" : "text-destructive") : ""}`}>
                                    {theoryCA !== null ? theoryCA.toFixed(1) : "—"}
                                    {theoryCA !== null && (
                                      <div className="text-[10px]">{theoryPass ? "✓ Pass" : "✗ Fail"}</div>
                                    )}
                                  </TableCell>
                                )}
                                {practicalComps.map((c: any, i: number) => {
                                  const p = practicalResults[i];
                                  return (
                                    <TableCell key={c.id} className={`text-center text-sm ${p.pct !== null ? (p.pass ? "text-green-600" : "text-destructive") : ""}`}>
                                      {p.pct !== null ? p.pct.toFixed(1) : "—"}
                                      {p.pct !== null && (
                                        <div className="text-[10px]">{p.pass ? "✓ Pass" : "✗ Fail"}</div>
                                      )}
                                    </TableCell>
                                  );
                                })}
                                {otherComps.map((c: any) => {
                                  const m = getMark(c.id, gt.trainee_id);
                                  return (
                                    <TableCell key={c.id} className="text-center text-sm">
                                      {m?.marks_obtained != null ? m.marks_obtained : "—"}
                                    </TableCell>
                                  );
                                })}
                                <TableCell className="text-center bg-muted/50">
                                  <Badge variant={
                                    (theoryPass && allPracticalsPass) ? "default" :
                                    theoryCA === null && practicalResults.every(p => p.pct === null) ? "secondary" :
                                    "destructive"
                                  }>
                                    {(theoryPass && allPracticalsPass) ? "Competent" :
                                     theoryCA === null && practicalResults.every(p => p.pct === null) ? "Pending" :
                                     "NYC"}
                                  </Badge>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              );
            })()}
          </TabsContent>
          {/* ─── QUERIES TAB ─── */}
          <TabsContent value="queries" className="space-y-4">
            <h3 className="font-semibold">Trainee Mark Queries</h3>
            {markQueries && markQueries.length > 0 ? (
              <div className="space-y-3">
                {markQueries.map((q: any) => (
                  <Card key={q.id}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{q.subject}</span>
                            <Badge variant={q.status === "open" ? "destructive" : q.status === "resolved" ? "default" : q.status === "rejected" ? "outline" : "secondary"} className="capitalize text-xs">
                              {q.status.replace(/_/g, " ")}
                            </Badge>
                            <Badge variant="outline" className="capitalize text-xs">{q.query_type.replace(/_/g, " ")}</Badge>
                          </div>
                          <div className="text-sm text-muted-foreground">
                            <span className="font-medium">{q.trainees?.first_name} {q.trainees?.last_name}</span>
                            <span className="mx-1">•</span>
                            <span className="font-mono text-xs">{q.trainees?.trainee_id}</span>
                            <span className="mx-1">•</span>
                            <span>{q.gradebook_components?.name} ({q.gradebook_components?.component_type})</span>
                          </div>
                          <p className="text-sm mt-2">{q.description}</p>
                          {q.resolution_notes && (
                            <div className="mt-2 p-2 bg-muted rounded text-sm">
                              <span className="text-xs font-medium text-muted-foreground">Resolution: </span>
                              {q.resolution_notes}
                            </div>
                          )}
                        </div>
                        {q.status === "open" && (
                          <div className="flex gap-1 shrink-0">
                            <Button size="sm" variant="outline" onClick={() => { setResolveDialog({ queryId: q.id, action: "resolved" }); setResolveNotes(""); }}>
                              <CheckCircle className="h-3.5 w-3.5 mr-1" />Resolve
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => { setResolveDialog({ queryId: q.id, action: "rejected" }); setResolveNotes(""); }}>
                              <XCircle className="h-3.5 w-3.5 mr-1" />Reject
                            </Button>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card className="border-dashed">
                <CardContent className="py-8 text-center text-muted-foreground">
                  <HelpCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No mark queries from trainees.</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
        )}

        {/* Resolve/Reject query dialog */}
        <Dialog open={!!resolveDialog} onOpenChange={(open) => { if (!open) setResolveDialog(null); }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{resolveDialog?.action === "resolved" ? "Resolve Query" : "Reject Query"}</DialogTitle>
              <DialogDescription>
                {resolveDialog?.action === "resolved" 
                  ? "Provide a response to the trainee's query."
                  : "Explain why this query is being rejected."}
              </DialogDescription>
            </DialogHeader>
            <Textarea
              placeholder="Notes / response..."
              value={resolveNotes}
              onChange={(e) => setResolveNotes(e.target.value)}
              rows={3}
            />
            <DialogFooter>
              <Button variant="outline" onClick={() => setResolveDialog(null)}>Cancel</Button>
              <Button
                variant={resolveDialog?.action === "rejected" ? "destructive" : "default"}
                onClick={async () => {
                  if (!resolveDialog) return;
                  await resolveQuery.mutateAsync({
                    queryId: resolveDialog.queryId,
                    status: resolveDialog.action,
                    resolution_notes: resolveNotes,
                  });
                  setResolveDialog(null);
                  setResolveNotes("");
                }}
                disabled={resolveQuery.isPending || !resolveNotes.trim()}
              >
                {resolveQuery.isPending ? "Saving..." : resolveDialog?.action === "resolved" ? "Mark Resolved" : "Reject Query"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};

export default GradebookDetail;
