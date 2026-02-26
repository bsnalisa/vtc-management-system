import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FileCheck, Lock, CheckCircle, Users, Loader2, ClipboardList, GraduationCap, Calendar, ArrowRight } from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { assessmentCoordinatorNavItems } from "@/lib/navigationConfig";
import { useProfile } from "@/hooks/useProfile";
import { useOrganizationContext } from "@/hooks/useOrganizationContext";
import { useAssessmentResultsByStatus, useFinaliseAssessments } from "@/hooks/useAssessmentResults";
import { useAssessmentTemplates } from "@/hooks/useAssessmentTemplates";
import { useQualifications } from "@/hooks/useQualifications";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const AssessmentCoordinatorDashboard = () => {
  const navigate = useNavigate();
  const { data: profile } = useProfile();
  const { organizationId } = useOrganizationContext();
  const { data: approvedResults, isLoading } = useAssessmentResultsByStatus(["approved_by_hot"], organizationId);
  const { data: finalisedResults } = useAssessmentResultsByStatus(["finalised"], organizationId);
  const { data: templates } = useAssessmentTemplates();
  const { data: qualifications } = useQualifications();
  const finalise = useFinaliseAssessments();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const selectAll = () => {
    if (!approvedResults) return;
    if (selectedIds.length === approvedResults.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(approvedResults.map((r: any) => r.id));
    }
  };

  const handleFinalise = async () => {
    if (selectedIds.length === 0) return;
    await finalise.mutateAsync(selectedIds);
    setSelectedIds([]);
  };

  const pendingCount = approvedResults?.length || 0;
  const finalisedCount = finalisedResults?.length || 0;
  const draftTemplates = templates?.filter(t => t.status === "draft").length || 0;
  const pendingTemplates = templates?.filter(t => t.status === "pending_approval").length || 0;
  const approvedTemplates = templates?.filter(t => t.status === "approved").length || 0;
  const totalQualifications = qualifications?.length || 0;

  return (
    <DashboardLayout
      title={`Welcome back, ${profile?.firstname || 'User'}`}
      subtitle="Assessment governance, templates, and qualification management"
      navItems={assessmentCoordinatorNavItems}
      groupLabel="Assessment Management"
    >
      <div className="space-y-6">
        {/* Quick Actions */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => navigate("/qualifications")}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Qualifications</CardTitle>
              <GraduationCap className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalQualifications}</div>
              <p className="text-xs text-muted-foreground">Total qualifications</p>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => navigate("/assessment-templates")}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Templates</CardTitle>
              <ClipboardList className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{approvedTemplates}</div>
              <p className="text-xs text-muted-foreground">
                {draftTemplates > 0 && `${draftTemplates} draft · `}
                {pendingTemplates > 0 && `${pendingTemplates} pending`}
                {draftTemplates === 0 && pendingTemplates === 0 && "Active templates"}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Awaiting Finalisation</CardTitle>
              <FileCheck className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{pendingCount}</div>
              <p className="text-xs text-muted-foreground">Approved by HoT</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Finalised</CardTitle>
              <Lock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{finalisedCount}</div>
              <p className="text-xs text-muted-foreground">Locked & visible to trainees</p>
            </CardContent>
          </Card>
        </div>

        {/* Finalisation Queue */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Assessments Awaiting Finalisation</CardTitle>
                <CardDescription>Approved by HoT. Review and finalise to make visible to trainees.</CardDescription>
              </div>
              <Button onClick={handleFinalise} disabled={selectedIds.length === 0 || finalise.isPending}>
                <Lock className="h-4 w-4 mr-2" />
                {finalise.isPending ? "Finalising..." : `Finalise (${selectedIds.length})`}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
            ) : !approvedResults || approvedResults.length === 0 ? (
              <div className="text-center py-12">
                <CheckCircle className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                <h3 className="text-lg font-medium">All Caught Up</h3>
                <p className="text-muted-foreground">No assessments awaiting finalisation.</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <Checkbox
                        checked={selectedIds.length === approvedResults.length && approvedResults.length > 0}
                        onCheckedChange={selectAll}
                      />
                    </TableHead>
                    <TableHead>Trainee</TableHead>
                    <TableHead>Course</TableHead>
                    <TableHead>Unit Standard</TableHead>
                    <TableHead>Marks</TableHead>
                    <TableHead>Competency</TableHead>
                    <TableHead>Approved At</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {approvedResults.map((result: any) => (
                    <TableRow key={result.id}>
                      <TableCell>
                        <Checkbox
                          checked={selectedIds.includes(result.id)}
                          onCheckedChange={() => toggleSelect(result.id)}
                        />
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{result.trainees?.first_name} {result.trainees?.last_name}</p>
                          <p className="text-xs text-muted-foreground font-mono">{result.trainees?.trainee_id}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <p className="text-sm">{result.trainee_enrollments?.courses?.name}</p>
                        <p className="text-xs text-muted-foreground">Level {result.trainee_enrollments?.courses?.level}</p>
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
                        {result.hot_approved_at ? new Date(result.hot_approved_at).toLocaleDateString("en-ZA") : "-"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default AssessmentCoordinatorDashboard;
