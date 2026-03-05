import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useRoleNavigation } from "@/hooks/useRoleNavigation";
import { useAssessmentTemplates, useTemplateComponents } from "@/hooks/useAssessmentTemplates";
import { useSummativeResults, useSaveSummativeMark, useQualificationTrainees } from "@/hooks/useQualificationResults";
import { useCycleStatus } from "@/hooks/useAssessmentCycles";
import { useToast } from "@/hooks/use-toast";
import { generateSAExcelTemplate } from "@/lib/saTemplateGenerator";
import { FileSpreadsheet, Save, Download, Upload, Lock, CheckCircle, AlertTriangle } from "lucide-react";

const SummativeAssessment = () => {
  const { navItems, groupLabel } = useRoleNavigation();
  const { toast } = useToast();

  const { data: templates } = useAssessmentTemplates("approved");
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [academicYear, setAcademicYear] = useState(new Date().getFullYear().toString());

  const selectedTemplate = templates?.find(t => t.id === selectedTemplateId);
  const qualificationId = selectedTemplate?.qualification_id;

  const { data: templateComponents } = useTemplateComponents(selectedTemplateId || undefined);
  const { data: trainees } = useQualificationTrainees(qualificationId, undefined);
  const { data: existingResults } = useSummativeResults(qualificationId, academicYear);
  const saveMark = useSaveSummativeMark();
  const { data: cycleStatus } = useCycleStatus(qualificationId, academicYear);
  const isCycleLocked = cycleStatus?.status === "locked" || cycleStatus?.status === "archived";

  // Fetch CA marks directly from gradebook_marks via template_component_id link
  // This works even before SA marks are saved (ca_final_results only populates on SA save)
  const { data: caResults } = useQuery({
    queryKey: ["ca-live-results", qualificationId, academicYear, templateComponents],
    queryFn: async () => {
      if (!qualificationId || !academicYear || !templateComponents || !trainees) return [];
      const componentIds = templateComponents.map((c: any) => c.id);
      const traineeIds = trainees.map((t: any) => t.id);
      
      if (componentIds.length === 0 || traineeIds.length === 0) return [];

      // Fetch all gradebook marks linked to these template components
      const { data: marks, error } = await supabase
        .from("gradebook_marks")
        .select(`
          trainee_id,
          marks_obtained,
          component:component_id(
            id,
            max_marks,
            template_component_id,
            gradebook:gradebook_id(qualification_id, academic_year)
          )
        `)
        .in("trainee_id", traineeIds)
        .not("marks_obtained", "is", null);

      if (error) throw error;
      if (!marks) return [];

      // Filter to relevant qualification/year and aggregate by template_component_id + trainee
      const aggregated: Record<string, { sum: number; count: number }> = {};
      for (const m of marks as any[]) {
        const comp = m.component;
        if (!comp?.template_component_id) continue;
        const gb = comp.gradebook;
        if (!gb || gb.qualification_id !== qualificationId || gb.academic_year !== academicYear) continue;
        if (!componentIds.includes(comp.template_component_id)) continue;

        const key = `${m.trainee_id}__${comp.template_component_id}`;
        if (!aggregated[key]) aggregated[key] = { sum: 0, count: 0 };
        const pct = (m.marks_obtained / (comp.max_marks || 100)) * 100;
        aggregated[key].sum += pct;
        aggregated[key].count += 1;
      }

      return Object.entries(aggregated).map(([key, val]) => {
        const [trainee_id, template_component_id] = key.split("__");
        return {
          trainee_id,
          template_component_id,
          ca_average: Math.round((val.sum / val.count) * 100) / 100,
        };
      });
    },
    enabled: !!qualificationId && !!academicYear && !!templateComponents && !!trainees,
  });

  // Marks editing state: { `${componentId}_${traineeId}`: { marks: string, maxMarks: number } }
  const [editingMarks, setEditingMarks] = useState<Record<string, { marks: string; maxMarks: number }>>({});

  const getExistingResult = (componentId: string, traineeId: string) => {
    return existingResults?.find((r: any) => r.template_component_id === componentId && r.trainee_id === traineeId);
  };

  const handleSaveMark = async (componentId: string, traineeId: string) => {
    const key = `${componentId}_${traineeId}`;
    const edit = editingMarks[key];
    if (!edit || !qualificationId) return;

    await saveMark.mutateAsync({
      template_component_id: componentId,
      trainee_id: traineeId,
      qualification_id: qualificationId,
      academic_year: academicYear,
      marks_obtained: parseFloat(edit.marks),
      max_marks: edit.maxMarks,
    });

    setEditingMarks(prev => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const handleDownloadTemplate = () => {
    if (!templateComponents || !trainees || !selectedTemplate) return;
    const qualCode = selectedTemplate.qualifications?.qualification_code || "N/A";
    generateSAExcelTemplate({
      qualCode,
      academicYear,
      theoryComponents: templateComponents.filter((c: any) => c.component_type === "theory"),
      practicalComponents: templateComponents.filter((c: any) => c.component_type === "practical"),
      trainees: trainees as any,
      caResults: caResults || [],
    });
    toast({ title: "Excel Template Downloaded" });
  };

  const theoryComponents = templateComponents?.filter((c: any) => c.component_type === "theory") || [];
  const practicalComponents = templateComponents?.filter((c: any) => c.component_type === "practical") || [];

  return (
    <DashboardLayout
      title="Summative Assessment"
      subtitle="Record external examination marks per qualification template"
      navItems={navItems}
      groupLabel={groupLabel}
    >
      <div className="space-y-6 max-w-7xl mx-auto">
        {/* Filters */}
        <Card>
          <CardContent className="py-4">
            <div className="flex flex-wrap gap-4 items-end">
              <div className="min-w-[250px]">
                <Label>Qualification Template</Label>
                <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                  <SelectTrigger><SelectValue placeholder="Select approved template" /></SelectTrigger>
                  <SelectContent>
                    {templates?.map(t => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.qualifications?.qualification_code} – {t.qualifications?.qualification_title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="w-[120px]">
                <Label>Academic Year</Label>
                <Input value={academicYear} onChange={e => setAcademicYear(e.target.value)} />
              </div>
              {selectedTemplateId && (
                <Button variant="outline" onClick={handleDownloadTemplate}>
                  <Download className="h-4 w-4 mr-2" />Download Excel Template
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {selectedTemplateId && selectedTemplate && (
          <>
            {/* Pass thresholds info */}
            <div className="flex gap-4 text-sm">
              <Badge variant="outline" className="text-sm py-1 px-3">
                Theory Pass: ≥{selectedTemplate.theory_pass_mark}%
              </Badge>
              <Badge variant="outline" className="text-sm py-1 px-3">
                Practical Pass: ≥{selectedTemplate.practical_pass_mark}%
              </Badge>
            </div>

            {isCycleLocked && (
              <Card className="border-destructive/50 bg-destructive/5">
                <CardContent className="py-3 flex items-center gap-3">
                  <AlertTriangle className="h-5 w-5 text-destructive shrink-0" />
                  <div>
                    <p className="font-medium text-sm">Assessment Cycle Locked</p>
                    <p className="text-xs text-muted-foreground">
                      This cycle was locked on {cycleStatus?.locked_at ? new Date(cycleStatus.locked_at).toLocaleDateString("en-ZA") : "—"}.
                      No further SA marks can be recorded or modified.
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}

            <Tabs defaultValue="theory">
              <TabsList>
                {theoryComponents.length > 0 && <TabsTrigger value="theory">Theory ({theoryComponents.length})</TabsTrigger>}
                {practicalComponents.length > 0 && <TabsTrigger value="practical">Practical ({practicalComponents.length})</TabsTrigger>}
              </TabsList>

              {[
                { key: "theory", comps: theoryComponents, passMark: selectedTemplate.theory_pass_mark },
                { key: "practical", comps: practicalComponents, passMark: selectedTemplate.practical_pass_mark },
              ].map(({ key, comps, passMark }) => (
                <TabsContent key={key} value={key} className="space-y-4">
                  {comps.map((comp: any) => (
                    <Card key={comp.id}>
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <CardTitle className="text-base">{comp.component_name}</CardTitle>
                            <CardDescription className="capitalize">{comp.component_type} · Pass mark: ≥{passMark}%</CardDescription>
                          </div>
                          <Badge variant="outline"><FileSpreadsheet className="h-3 w-3 mr-1" />SA Entry</Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="p-0">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="min-w-[150px]">Trainee</TableHead>
                              <TableHead className="w-[120px] text-center">Marks (/100)</TableHead>
                              <TableHead className="w-[100px] text-center">%</TableHead>
                              <TableHead className="w-[100px] text-center">Status</TableHead>
                              <TableHead className="w-[80px] text-center">Action</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {trainees?.map((trainee: any) => {
                              const existing = getExistingResult(comp.id, trainee.id);
                              const editKey = `${comp.id}_${trainee.id}`;
                              const editing = editingMarks[editKey];
                              const currentMarks = editing?.marks ?? (existing?.marks_obtained != null ? String(existing.marks_obtained) : "");
                              const pct = existing?.percentage;
                              const isLocked = existing?.is_locked;

                              return (
                                <TableRow key={trainee.id}>
                                  <TableCell>
                                    <div className="font-medium text-sm">{trainee.first_name} {trainee.last_name}</div>
                                    <div className="text-xs text-muted-foreground font-mono">{trainee.trainee_id}</div>
                                  </TableCell>
                                  <TableCell className="text-center">
                                    {(isLocked && !editing) || isCycleLocked ? (
                                      <span className="font-semibold">{existing?.marks_obtained ?? "—"}</span>
                                    ) : (
                                      <Input
                                        type="number"
                                        min={0}
                                        max={100}
                                        className="w-20 mx-auto text-center"
                                        value={currentMarks}
                                        onChange={e => setEditingMarks(prev => ({
                                          ...prev,
                                          [editKey]: { marks: e.target.value, maxMarks: 100 }
                                        }))}
                                      />
                                    )}
                                  </TableCell>
                                  <TableCell className="text-center">
                                    {pct != null ? (
                                      <span className={pct >= passMark ? "text-green-600 font-semibold" : "text-destructive font-semibold"}>
                                        {pct.toFixed(1)}%
                                      </span>
                                    ) : editing?.marks ? (
                                      <span className="text-muted-foreground">
                                        {((parseFloat(editing.marks) / 100) * 100).toFixed(1)}%
                                      </span>
                                    ) : "—"}
                                  </TableCell>
                                  <TableCell className="text-center">
                                    {pct != null ? (
                                      <Badge variant={pct >= passMark ? "default" : "destructive"}>
                                        {pct >= passMark ? "Pass" : "Fail"}
                                      </Badge>
                                    ) : <Badge variant="secondary">Pending</Badge>}
                                  </TableCell>
                                  <TableCell className="text-center">
                                    {editing ? (
                                      <Button
                                        size="sm"
                                        onClick={() => handleSaveMark(comp.id, trainee.id)}
                                        disabled={saveMark.isPending || !editing.marks}
                                      >
                                        <Save className="h-3 w-3" />
                                      </Button>
                                    ) : isLocked ? (
                                      <Lock className="h-4 w-4 mx-auto text-muted-foreground" />
                                    ) : null}
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                            {(!trainees || trainees.length === 0) && (
                              <TableRow>
                                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                                  No trainees found for this qualification.
                                </TableCell>
                              </TableRow>
                            )}
                          </TableBody>
                        </Table>
                      </CardContent>
                    </Card>
                  ))}
                </TabsContent>
              ))}
            </Tabs>
          </>
        )}

        {!selectedTemplateId && (
          <Card className="border-dashed">
            <CardContent className="py-12 text-center">
              <FileSpreadsheet className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
              <h3 className="font-semibold text-lg mb-2">Select a Qualification</h3>
              <p className="text-muted-foreground">Choose an approved assessment template above to begin recording summative marks.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
};

export default SummativeAssessment;
