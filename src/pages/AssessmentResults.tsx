import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useTrainees } from "@/hooks/useTrainees";
import { useTraineeEnrollments } from "@/hooks/useEnrollments";
import { useTraineeResults, useRecordAssessmentResult, useSubmitAssessments } from "@/hooks/useAssessmentResults";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useRoleNavigation } from "@/hooks/useRoleNavigation";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Send } from "lucide-react";

const AssessmentResults = () => {
  const { role, navItems, groupLabel } = useRoleNavigation();
  const { data: trainees } = useTrainees();
  const [selectedTrainee, setSelectedTrainee] = useState("");
  const [selectedEnrollment, setSelectedEnrollment] = useState("");
  
  const { data: enrollments } = useTraineeEnrollments(selectedTrainee);
  const { data: results } = useTraineeResults(selectedTrainee, selectedEnrollment);
  const recordResult = useRecordAssessmentResult();
  const submitAssessments = useSubmitAssessments();

  const [editingResults, setEditingResults] = useState<Record<string, { marks: string; competency: string }>>({});
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Trainers can edit draft/returned, HoT can view, AC can view
  const isTrainer = role === "trainer";
  const canEdit = isTrainer;
  const canSubmit = isTrainer;

  const handleMarkChange = (resultId: string, marks: string) => {
    if (!canEdit) return;
    setEditingResults((prev) => ({
      ...prev,
      [resultId]: { ...prev[resultId], marks, competency: prev[resultId]?.competency || "pending" },
    }));
  };

  const handleCompetencyChange = (resultId: string, competency: string) => {
    if (!canEdit) return;
    setEditingResults((prev) => ({
      ...prev,
      [resultId]: { ...prev[resultId], competency, marks: prev[resultId]?.marks || "" },
    }));
  };

  const handleSaveResult = async (result: any) => {
    const edited = editingResults[result.id];
    if (!edited) return;

    await recordResult.mutateAsync({
      trainee_id: selectedTrainee,
      enrollment_id: selectedEnrollment,
      unit_standard_id: result.unit_standard_id,
      marks_obtained: edited.marks ? parseFloat(edited.marks) : undefined,
      competency_status: edited.competency as "competent" | "not_yet_competent" | "pending",
      assessment_status: "draft",
    });

    setEditingResults((prev) => {
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

  const draftResults = results?.filter((r: any) =>
    r.assessment_status === "draft" || r.assessment_status === "returned_to_trainer"
  ) || [];

  const totalCredits = results?.reduce((sum, r) => sum + (r.unit_standards?.credit || 0), 0) || 0;
  const completedCredits = results?.filter((r) => r.competency_status === "competent").reduce((sum, r) => sum + (r.unit_standards?.credit || 0), 0) || 0;

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

  return (
    <DashboardLayout
      title="Assessment Results"
      subtitle={canEdit ? "Capture and submit trainee assessment results" : "View assessment results"}
      navItems={navItems}
      groupLabel={groupLabel}
    >
      <div className="space-y-6 max-w-7xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>Select Trainee and Course</CardTitle>
            <CardDescription>Choose a trainee and their active enrollment to manage results</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Trainee</Label>
                <Select value={selectedTrainee} onValueChange={(value) => {
                  setSelectedTrainee(value);
                  setSelectedEnrollment("");
                  setSelectedIds([]);
                }}>
                  <SelectTrigger><SelectValue placeholder="Select trainee" /></SelectTrigger>
                  <SelectContent>
                    {trainees?.map((trainee) => (
                      <SelectItem key={trainee.id} value={trainee.id}>
                        {trainee.trainee_id} - {trainee.first_name} {trainee.last_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Course Enrollment</Label>
                <Select value={selectedEnrollment} onValueChange={setSelectedEnrollment} disabled={!selectedTrainee}>
                  <SelectTrigger><SelectValue placeholder="Select enrollment" /></SelectTrigger>
                  <SelectContent>
                    {enrollments?.map((enrollment) => (
                      <SelectItem key={enrollment.id} value={enrollment.id}>
                        {enrollment.courses?.name} - Level {enrollment.courses?.level} ({enrollment.status})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {results && results.length > 0 && (
              <div className="flex gap-4 p-4 bg-muted rounded-lg">
                <p className="text-sm font-medium">Total Credits: {totalCredits}</p>
                <p className="text-sm font-medium">Completed Credits: {completedCredits}</p>
                <p className="text-sm font-medium">
                  Progress: {totalCredits > 0 ? Math.round((completedCredits / totalCredits) * 100) : 0}%
                </p>
              </div>
            )}
          </CardContent>
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

        {results && results.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Unit Standards & Results</CardTitle>
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
        )}
      </div>
    </DashboardLayout>
  );
};

export default AssessmentResults;
