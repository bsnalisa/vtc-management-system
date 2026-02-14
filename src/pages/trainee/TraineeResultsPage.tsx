import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DashboardLayout } from "@/components/DashboardLayout";
import { traineeNavItems } from "@/lib/navigationConfig";
import { Award, Download, CheckCircle, XCircle, Clock, Loader2 } from "lucide-react";
import { withRoleAccess } from "@/components/withRoleAccess";
import { Progress } from "@/components/ui/progress";
import { useTraineeUserId, useTraineeRecord, useTraineeAssessmentResults } from "@/hooks/useTraineePortalData";

const TraineeResultsPage = () => {
  const userId = useTraineeUserId();
  const { data: trainee, isLoading: tLoading } = useTraineeRecord(userId);
  const { data: results, isLoading: rLoading } = useTraineeAssessmentResults(trainee?.id);

  const isLoading = tLoading || rLoading;

  if (isLoading) {
    return (
      <DashboardLayout title="My Results" subtitle="View your assessment results and progress" navItems={traineeNavItems} groupLabel="Trainee iEnabler">
        <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      </DashboardLayout>
    );
  }

  const totalCredits = results?.reduce((s, r) => s + Number((r.unit_standards as any)?.credit || 0), 0) || 0;
  const earnedCredits = results?.filter(r => r.competency_status === "competent").reduce((s, r) => s + Number((r.unit_standards as any)?.credit || 0), 0) || 0;
  const progressPercentage = totalCredits > 0 ? Math.round((earnedCredits / totalCredits) * 100) : 0;

  const competentCount = results?.filter(r => r.competency_status === "competent").length || 0;
  const notCompetentCount = results?.filter(r => r.competency_status === "not_yet_competent").length || 0;
  const pendingCount = results?.filter(r => !r.competency_status || r.competency_status === "pending").length || 0;

  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case "competent": return <Badge className="bg-green-100 text-green-800"><CheckCircle className="h-3 w-3 mr-1" />Competent</Badge>;
      case "not_yet_competent": return <Badge className="bg-red-100 text-red-800"><XCircle className="h-3 w-3 mr-1" />Not Yet Competent</Badge>;
      default: return <Badge className="bg-gray-100 text-gray-800"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
    }
  };

  return (
    <DashboardLayout title="My Results" subtitle="View your assessment results and progress" navItems={traineeNavItems} groupLabel="Trainee iEnabler">
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-4">
          <Card className="border-0 shadow-md"><CardContent className="p-6"><div className="flex items-center gap-3"><div className="p-3 rounded-lg bg-primary/10"><Award className="h-5 w-5 text-primary" /></div><div><p className="text-sm text-muted-foreground">Credits Earned</p><p className="text-2xl font-bold">{earnedCredits}/{totalCredits}</p></div></div></CardContent></Card>
          <Card className="border-0 shadow-md"><CardContent className="p-6"><div className="flex items-center gap-3"><div className="p-3 rounded-lg bg-green-100"><CheckCircle className="h-5 w-5 text-green-600" /></div><div><p className="text-sm text-muted-foreground">Competent</p><p className="text-2xl font-bold text-green-600">{competentCount}</p></div></div></CardContent></Card>
          <Card className="border-0 shadow-md"><CardContent className="p-6"><div className="flex items-center gap-3"><div className="p-3 rounded-lg bg-red-100"><XCircle className="h-5 w-5 text-red-600" /></div><div><p className="text-sm text-muted-foreground">Not Yet Competent</p><p className="text-2xl font-bold text-red-600">{notCompetentCount}</p></div></div></CardContent></Card>
          <Card className="border-0 shadow-md"><CardContent className="p-6"><div className="flex items-center gap-3"><div className="p-3 rounded-lg bg-gray-100"><Clock className="h-5 w-5 text-gray-600" /></div><div><p className="text-sm text-muted-foreground">Pending</p><p className="text-2xl font-bold">{pendingCount}</p></div></div></CardContent></Card>
        </div>

        <Card className="border-0 shadow-md">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Overall Progress</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between text-sm"><span>Qualification Progress</span><span className="font-medium">{progressPercentage}%</span></div>
              <Progress value={progressPercentage} className="h-3" />
              <p className="text-sm text-muted-foreground">You have earned {earnedCredits} out of {totalCredits} credits.</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md">
          <CardHeader>
            <CardTitle>Unit Standard Results</CardTitle>
            <CardDescription>Detailed results for each unit standard</CardDescription>
          </CardHeader>
          <CardContent>
            {!results || results.length === 0 ? (
              <div className="text-center py-12">
                <Award className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
                <h3 className="font-semibold">No Results Yet</h3>
                <p className="text-muted-foreground">Your assessment results will appear here once assessed.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {results.map((result: any) => (
                  <div key={result.id} className="flex flex-col md:flex-row md:items-center justify-between p-4 rounded-lg border">
                    <div className="flex-1 mb-4 md:mb-0">
                      <h4 className="font-medium">{result.unit_standards?.title || "Unit Standard"}</h4>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span className="font-mono">{result.unit_standards?.unit_standard_id || ""}</span>
                        <span>{result.unit_standards?.credit || 0} credits</span>
                        {result.assessment_date && <span>Assessed: {new Date(result.assessment_date).toLocaleDateString("en-ZA", { year: "numeric", month: "short", day: "numeric" })}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      {result.marks_obtained !== null && result.marks_obtained !== undefined && (
                        <div className="text-right"><p className="text-2xl font-bold">{result.marks_obtained}%</p></div>
                      )}
                      {getStatusBadge(result.competency_status)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default withRoleAccess(TraineeResultsPage, { requiredRoles: ["trainee"] });
