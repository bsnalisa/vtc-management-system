import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useQualifications } from "@/hooks/useQualifications";
import { useQualificationUnitStandards } from "@/hooks/useQualifications";
import { useRecordAssessmentResult, useSubmitAssessments } from "@/hooks/useAssessmentResults";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useRoleNavigation } from "@/hooks/useRoleNavigation";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Send, ArrowLeft, GraduationCap, Users, BookOpen } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { useOrganizationContext } from "@/hooks/useOrganizationContext";

// Fetch trainees for a specific qualification
const useTraineesByQualification = (qualificationId?: string) => {
  return useQuery({
    queryKey: ["trainees-by-qualification", qualificationId],
    queryFn: async () => {
      if (!qualificationId) return [];
      const { data, error } = await supabase
        .from("trainees")
        .select(`
          id, trainee_id, first_name, last_name, level, academic_year,
          trades:trade_id (id, name)
        `)
        .eq("qualification_id", qualificationId)
        .eq("status", "active")
        .order("last_name");
      if (error) throw error;
      return data || [];
    },
    enabled: !!qualificationId,
  });
};

// Fetch assessment results for a trainee under a specific qualification's unit standards
const useTraineeQualificationResults = (traineeId?: string, qualificationId?: string) => {
  return useQuery({
    queryKey: ["trainee-qualification-results", traineeId, qualificationId],
    queryFn: async () => {
      if (!traineeId || !qualificationId) return [];

      // Get unit standard IDs for this qualification
      const { data: qus, error: qusError } = await supabase
        .from("qualification_unit_standards")
        .select("unit_standard_id")
        .eq("qualification_id", qualificationId);
      if (qusError) throw qusError;
      const unitStandardIds = (qus || []).map((u: any) => u.unit_standard_id);
      if (unitStandardIds.length === 0) return [];

      const { data, error } = await supabase
        .from("assessment_results")
        .select(`
          *,
          unit_standards:unit_standard_id (id, unit_no, module_title, level, credit)
        `)
        .eq("trainee_id", traineeId)
        .in("unit_standard_id", unitStandardIds);
      if (error) throw error;
      return data || [];
    },
    enabled: !!traineeId && !!qualificationId,
  });
};

const AssessmentResults = () => {
  const { role, navItems, groupLabel } = useRoleNavigation();
  const { organizationId } = useOrganizationContext();
  const { data: qualifications } = useQualifications("approved");

  const [selectedQualification, setSelectedQualification] = useState<string | null>(null);
  const [selectedTrainee, setSelectedTrainee] = useState<string | null>(null);

  const { data: trainees } = useTraineesByQualification(selectedQualification || undefined);
  const { data: unitStandards } = useQualificationUnitStandards(selectedQualification || undefined);
  const { data: results } = useTraineeQualificationResults(selectedTrainee || undefined, selectedQualification || undefined);

  const recordResult = useRecordAssessmentResult();
  const submitAssessments = useSubmitAssessments();

  const [editingResults, setEditingResults] = useState<Record<string, { marks: string; competency: string }>>({});
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const isTrainer = role === "trainer";
  const canEdit = isTrainer;
  const canSubmit = isTrainer;

  const selectedQualData = qualifications?.find(q => q.id === selectedQualification);
  const selectedTraineeData = trainees?.find((t: any) => t.id === selectedTrainee);

  const handleMarkChange = (resultId: string, marks: string) => {
    if (!canEdit) return;
    setEditingResults(prev => ({
      ...prev,
      [resultId]: { ...prev[resultId], marks, competency: prev[resultId]?.competency || "pending" },
    }));
  };

  const handleCompetencyChange = (resultId: string, competency: string) => {
    if (!canEdit) return;
    setEditingResults(prev => ({
      ...prev,
      [resultId]: { ...prev[resultId], competency, marks: prev[resultId]?.marks || "" },
    }));
  };

  const handleSaveResult = async (result: any) => {
    const edited = editingResults[result.id];
    if (!edited || !selectedTrainee) return;

    await recordResult.mutateAsync({
      trainee_id: selectedTrainee,
      enrollment_id: result.enrollment_id,
      unit_standard_id: result.unit_standard_id,
      marks_obtained: edited.marks ? parseFloat(edited.marks) : undefined,
      competency_status: edited.competency as "competent" | "not_yet_competent" | "pending",
      assessment_status: "draft",
    });

    setEditingResults(prev => {
      const newState = { ...prev };
      delete newState[result.id];
      return newState;
    });
  };

  const handleSubmitSelected = async () => {
    if (selectedIds.length === 0) return;
    await submitAssessments.mutateAsync(selectedIds);
    setSelectedIds([]);
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const getStatusBadge = (status: string) => {
    const map: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
      draft: { label: "Draft", variant: "secondary" },
      submitted_by_trainer: { label: "Submitted", variant: "default" },
      returned_to_trainer: { label: "Returned", variant: "destructive" },
      approved_by_hot: { label: "Approved", variant: "default" },
      finalised: { label: "Finalised", variant: "outline" },
    };
    const s = map[status] || { label: status, variant: "secondary" as const };
    return <Badge variant={s.variant}>{s.label}</Badge>;
  };

  const draftResults = results?.filter((r: any) =>
    r.assessment_status === "draft" || r.assessment_status === "returned_to_trainer"
  ) || [];

  const totalCredits = results?.reduce((sum: number, r: any) => sum + (r.unit_standards?.credit || 0), 0) || 0;
  const completedCredits = results?.filter((r: any) => r.competency_status === "competent")
    .reduce((sum: number, r: any) => sum + (r.unit_standards?.credit || 0), 0) || 0;

  // ── VIEW 3: Trainee Results ──
  if (selectedQualification && selectedTrainee) {
    return (
      <DashboardLayout
        title="Assessment Results"
        subtitle={canEdit ? "Capture and submit trainee assessment results" : "View assessment results"}
        navItems={navItems}
        groupLabel={groupLabel}
      >
        <div className="space-y-6 max-w-7xl mx-auto">
          <Button variant="ghost" onClick={() => { setSelectedTrainee(null); setEditingResults({}); setSelectedIds([]); }}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to {selectedQualData?.qualification_title}
          </Button>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="h-5 w-5" />
                {selectedTraineeData?.first_name} {selectedTraineeData?.last_name}
                <Badge variant="outline" className="ml-2">{selectedTraineeData?.trainee_id}</Badge>
              </CardTitle>
              <CardDescription>
                {selectedQualData?.qualification_title} — {selectedQualData?.qualification_code}
              </CardDescription>
            </CardHeader>
            {results && results.length > 0 && (
              <CardContent>
                <div className="flex gap-4 p-4 bg-muted rounded-lg">
                  <p className="text-sm font-medium">Total Credits: {totalCredits}</p>
                  <p className="text-sm font-medium">Completed Credits: {completedCredits}</p>
                  <p className="text-sm font-medium">
                    Progress: {totalCredits > 0 ? Math.round((completedCredits / totalCredits) * 100) : 0}%
                  </p>
                </div>
              </CardContent>
            )}
          </Card>

          {canSubmit && draftResults.length > 0 && (
            <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg border">
              <p className="text-sm text-muted-foreground">
                {selectedIds.length} of {draftResults.length} draft/returned results selected
              </p>
              <Button onClick={handleSubmitSelected} disabled={selectedIds.length === 0 || submitAssessments.isPending}>
                <Send className="h-4 w-4 mr-2" />
                {submitAssessments.isPending ? "Submitting..." : "Submit for Review"}
              </Button>
            </div>
          )}

          {results && results.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>Unit Standard Results</CardTitle>
                <CardDescription>
                  {canEdit ? "Capture marks then submit for Head of Training review" : "Assessment results"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      {canSubmit && <TableHead className="w-10"></TableHead>}
                      <TableHead>Unit No.</TableHead>
                      <TableHead>Module Title</TableHead>
                      <TableHead>Level</TableHead>
                      <TableHead>Credits</TableHead>
                      <TableHead>Marks</TableHead>
                      <TableHead>Competency</TableHead>
                      <TableHead>Status</TableHead>
                      {canEdit && <TableHead>Action</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {results.map((result: any) => {
                      const isEditable = canEdit && (result.assessment_status === "draft" || result.assessment_status === "returned_to_trainer");
                      const isSelectable = canSubmit && (result.assessment_status === "draft" || result.assessment_status === "returned_to_trainer");
                      return (
                        <TableRow key={result.id}>
                          {canSubmit && (
                            <TableCell>
                              {isSelectable && (
                                <Checkbox
                                  checked={selectedIds.includes(result.id)}
                                  onCheckedChange={() => toggleSelect(result.id)}
                                />
                              )}
                            </TableCell>
                          )}
                          <TableCell>{result.unit_standards?.unit_no}</TableCell>
                          <TableCell>
                            {result.unit_standards?.module_title}
                            {result.assessment_status === "returned_to_trainer" && result.return_reason && (
                              <p className="text-xs text-destructive mt-1">Return reason: {result.return_reason}</p>
                            )}
                          </TableCell>
                          <TableCell>{result.unit_standards?.level}</TableCell>
                          <TableCell>{result.unit_standards?.credit}</TableCell>
                          <TableCell>
                            {isEditable ? (
                              <Input
                                type="number"
                                placeholder="Marks"
                                value={editingResults[result.id]?.marks ?? result.marks_obtained ?? ""}
                                onChange={(e) => handleMarkChange(result.id, e.target.value)}
                                className="w-24"
                              />
                            ) : (
                              <span>{result.marks_obtained ?? "-"}</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {isEditable ? (
                              <Select
                                value={editingResults[result.id]?.competency ?? result.competency_status}
                                onValueChange={(value) => handleCompetencyChange(result.id, value)}
                              >
                                <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="pending">Pending</SelectItem>
                                  <SelectItem value="competent">Competent</SelectItem>
                                  <SelectItem value="not_yet_competent">Not Yet Competent</SelectItem>
                                </SelectContent>
                              </Select>
                            ) : (
                              <Badge variant={
                                result.competency_status === "competent" ? "default" :
                                result.competency_status === "not_yet_competent" ? "destructive" : "secondary"
                              }>
                                {result.competency_status?.replace(/_/g, " ") || "Pending"}
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>{getStatusBadge(result.assessment_status || "draft")}</TableCell>
                          {canEdit && (
                            <TableCell>
                              {isEditable && (
                                <Button size="sm" onClick={() => handleSaveResult(result)} disabled={!editingResults[result.id]}>
                                  Save
                                </Button>
                              )}
                            </TableCell>
                          )}
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="py-12 text-center">
                <BookOpen className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                <h3 className="font-semibold">No Assessment Results</h3>
                <p className="text-muted-foreground text-sm">No results found for this trainee under this qualification.</p>
              </CardContent>
            </Card>
          )}
        </div>
      </DashboardLayout>
    );
  }

  // ── VIEW 2: Trainees in Qualification ──
  if (selectedQualification) {
    return (
      <DashboardLayout
        title="Assessment Results"
        subtitle={`Trainees enrolled in ${selectedQualData?.qualification_title || "qualification"}`}
        navItems={navItems}
        groupLabel={groupLabel}
      >
        <div className="space-y-6 max-w-7xl mx-auto">
          <Button variant="ghost" onClick={() => { setSelectedQualification(null); setSelectedTrainee(null); }}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Qualifications
          </Button>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <GraduationCap className="h-5 w-5" />
                {selectedQualData?.qualification_title}
              </CardTitle>
              <CardDescription>
                {selectedQualData?.qualification_code} — NQF Level {selectedQualData?.nqf_level} — {unitStandards?.length || 0} unit standards
              </CardDescription>
            </CardHeader>
            <CardContent>
              {trainees && trainees.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Trainee ID</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Trade</TableHead>
                      <TableHead>Level</TableHead>
                      <TableHead>Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {trainees.map((t: any) => (
                      <TableRow key={t.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setSelectedTrainee(t.id)}>
                        <TableCell className="font-mono">{t.trainee_id}</TableCell>
                        <TableCell className="font-medium">{t.first_name} {t.last_name}</TableCell>
                        <TableCell>{t.trades?.name || "-"}</TableCell>
                        <TableCell>{t.level}</TableCell>
                        <TableCell>
                          <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); setSelectedTrainee(t.id); }}>
                            View Results
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="py-12 text-center">
                  <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                  <h3 className="font-semibold">No Trainees</h3>
                  <p className="text-muted-foreground text-sm">No registered trainees found for this qualification.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  // ── VIEW 1: Qualification List ──
  return (
    <DashboardLayout
      title="Assessment Review"
      subtitle="Select a qualification to view and manage assessment results"
      navItems={navItems}
      groupLabel={groupLabel}
    >
      <div className="space-y-6 max-w-7xl mx-auto">
        {qualifications && qualifications.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {qualifications.map(q => (
              <Card
                key={q.id}
                className="cursor-pointer hover:shadow-lg transition-shadow border-0 shadow-md"
                onClick={() => setSelectedQualification(q.id)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <GraduationCap className="h-8 w-8 text-primary" />
                    <Badge variant="outline">NQF {q.nqf_level}</Badge>
                  </div>
                  <CardTitle className="text-lg mt-2">{q.qualification_title}</CardTitle>
                  <CardDescription>{q.qualification_code}</CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span className="capitalize">{q.qualification_type}</span>
                    <span>•</span>
                    <span>{q.duration_value} {q.duration_unit}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="py-12 text-center">
              <GraduationCap className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
              <h3 className="font-semibold">No Qualifications</h3>
              <p className="text-muted-foreground text-sm">No approved qualifications found. Qualifications must be approved before results can be managed.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
};

export default AssessmentResults;
