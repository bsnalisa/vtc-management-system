import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useTrainees } from "@/hooks/useTrainees";
import { useTraineeEnrollments } from "@/hooks/useEnrollments";
import { useTraineeResults, useRecordAssessmentResult } from "@/hooks/useAssessmentResults";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useRoleNavigation } from "@/hooks/useRoleNavigation";
import { Badge } from "@/components/ui/badge";

const AssessmentResults = () => {
  const { role, navItems, groupLabel } = useRoleNavigation();
  const { data: trainees } = useTrainees();
  const [selectedTrainee, setSelectedTrainee] = useState("");
  const [selectedEnrollment, setSelectedEnrollment] = useState("");
  
  const { data: enrollments } = useTraineeEnrollments(selectedTrainee);
  const { data: results } = useTraineeResults(selectedTrainee, selectedEnrollment);
  const recordResult = useRecordAssessmentResult();

  const [editingResults, setEditingResults] = useState<Record<string, { marks: string; competency: string }>>({});

  // Check if user can edit (not a trainee viewing their own results)
  const canEdit = role !== "trainee";

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
    });

    // Clear editing state
    setEditingResults((prev) => {
      const newState = { ...prev };
      delete newState[result.id];
      return newState;
    });
  };

  const totalCredits = results?.reduce((sum, r) => sum + (r.unit_standards?.credit || 0), 0) || 0;
  const completedCredits = results?.filter((r) => r.competency_status === "competent").reduce((sum, r) => sum + (r.unit_standards?.credit || 0), 0) || 0;

  return (
    <DashboardLayout
      title="Assessment Results"
      subtitle={canEdit ? "Record and manage trainee assessment results" : "View your assessment results"}
      navItems={navItems}
      groupLabel={groupLabel}
    >
      <div className="space-y-6">
        <div className="max-w-7xl mx-auto space-y-6">

          <Card>
            <CardHeader>
              <CardTitle>{canEdit ? "Select Trainee and Course" : "Select Course"}</CardTitle>
              <CardDescription>
                {canEdit ? "Choose a trainee and their active enrollment" : "View your assessment progress"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                {canEdit && (
                  <div className="space-y-2">
                    <Label>Trainee</Label>
                    <Select value={selectedTrainee} onValueChange={(value) => {
                      setSelectedTrainee(value);
                      setSelectedEnrollment("");
                    }}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select trainee" />
                      </SelectTrigger>
                      <SelectContent>
                        {trainees?.map((trainee) => (
                          <SelectItem key={trainee.id} value={trainee.id}>
                            {trainee.trainee_id} - {trainee.first_name} {trainee.last_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="space-y-2">
                  <Label>Course Enrollment</Label>
                  <Select value={selectedEnrollment} onValueChange={setSelectedEnrollment} disabled={canEdit && !selectedTrainee}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select enrollment" />
                    </SelectTrigger>
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
                  <div>
                    <p className="text-sm font-medium">Total Credits: {totalCredits}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium">Completed Credits: {completedCredits}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium">
                      Progress: {totalCredits > 0 ? Math.round((completedCredits / totalCredits) * 100) : 0}%
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {results && results.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Unit Standards & Results</CardTitle>
                <CardDescription>
                  {canEdit ? "Record assessment results for each unit standard" : "Your assessment results"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Unit No.</TableHead>
                      <TableHead>Module Title</TableHead>
                      <TableHead>Level</TableHead>
                      <TableHead>Credits</TableHead>
                      <TableHead>Marks</TableHead>
                      <TableHead>Competency</TableHead>
                      {canEdit && <TableHead>Action</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {results.map((result) => (
                      <TableRow key={result.id}>
                        <TableCell>{result.unit_standards?.unit_no}</TableCell>
                        <TableCell>{result.unit_standards?.module_title}</TableCell>
                        <TableCell>{result.unit_standards?.level}</TableCell>
                        <TableCell>{result.unit_standards?.credit}</TableCell>
                        <TableCell>
                          {canEdit ? (
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
                          {canEdit ? (
                            <Select
                              value={editingResults[result.id]?.competency ?? result.competency_status}
                              onValueChange={(value) => handleCompetencyChange(result.id, value)}
                            >
                              <SelectTrigger className="w-40">
                                <SelectValue />
                              </SelectTrigger>
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
                        {canEdit && (
                          <TableCell>
                            <Button
                              size="sm"
                              onClick={() => handleSaveResult(result)}
                              disabled={!editingResults[result.id]}
                            >
                              Save
                            </Button>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default AssessmentResults;
