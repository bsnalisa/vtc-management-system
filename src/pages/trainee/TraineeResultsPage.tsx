import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DashboardLayout } from "@/components/DashboardLayout";
import { traineeNavItems } from "@/lib/navigationConfig";
import { Award, Download, TrendingUp, TrendingDown, Minus, CheckCircle, XCircle, Clock } from "lucide-react";
import { withRoleAccess } from "@/components/withRoleAccess";
import { Progress } from "@/components/ui/progress";

interface Result {
  id: string;
  unitStandard: string;
  unitCode: string;
  credits: number;
  status: "competent" | "not_yet_competent" | "pending";
  marks?: number;
  assessedDate?: string;
}

const TraineeResultsPage = () => {
  // Mock results data - in production, fetch from assessment_results
  const results: Result[] = [
    { id: "1", unitStandard: "Apply Safe Work Practices", unitCode: "US-WLD-001", credits: 5, status: "competent", marks: 85, assessedDate: "Oct 15, 2025" },
    { id: "2", unitStandard: "Prepare Welding Equipment", unitCode: "US-WLD-002", credits: 8, status: "competent", marks: 78, assessedDate: "Oct 20, 2025" },
    { id: "3", unitStandard: "Perform Basic Arc Welding", unitCode: "US-WLD-003", credits: 12, status: "competent", marks: 92, assessedDate: "Nov 5, 2025" },
    { id: "4", unitStandard: "Interpret Technical Drawings", unitCode: "US-WLD-004", credits: 6, status: "not_yet_competent", marks: 45, assessedDate: "Nov 10, 2025" },
    { id: "5", unitStandard: "Apply Quality Control Measures", unitCode: "US-WLD-005", credits: 8, status: "pending" },
    { id: "6", unitStandard: "Perform MIG Welding", unitCode: "US-WLD-006", credits: 15, status: "pending" },
  ];

  const totalCredits = results.reduce((sum, r) => sum + r.credits, 0);
  const earnedCredits = results
    .filter(r => r.status === "competent")
    .reduce((sum, r) => sum + r.credits, 0);
  const progressPercentage = Math.round((earnedCredits / totalCredits) * 100);

  const competentCount = results.filter(r => r.status === "competent").length;
  const notCompetentCount = results.filter(r => r.status === "not_yet_competent").length;
  const pendingCount = results.filter(r => r.status === "pending").length;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "competent":
        return <Badge className="bg-green-100 text-green-800"><CheckCircle className="h-3 w-3 mr-1" />Competent</Badge>;
      case "not_yet_competent":
        return <Badge className="bg-red-100 text-red-800"><XCircle className="h-3 w-3 mr-1" />Not Yet Competent</Badge>;
      case "pending":
        return <Badge className="bg-gray-100 text-gray-800"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
      default:
        return null;
    }
  };

  return (
    <DashboardLayout
      title="My Results"
      subtitle="View your assessment results and progress"
      navItems={traineeNavItems}
      groupLabel="Trainee iEnabler"
    >
      <div className="space-y-6">
        {/* Progress Summary */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card className="border-0 shadow-md">
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-lg bg-primary/10">
                  <Award className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Credits Earned</p>
                  <p className="text-2xl font-bold">{earnedCredits}/{totalCredits}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="border-0 shadow-md">
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-lg bg-green-100">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Competent</p>
                  <p className="text-2xl font-bold text-green-600">{competentCount}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-md">
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-lg bg-red-100">
                  <XCircle className="h-5 w-5 text-red-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Not Yet Competent</p>
                  <p className="text-2xl font-bold text-red-600">{notCompetentCount}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-md">
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-lg bg-gray-100">
                  <Clock className="h-5 w-5 text-gray-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Pending</p>
                  <p className="text-2xl font-bold">{pendingCount}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Overall Progress */}
        <Card className="border-0 shadow-md">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Overall Progress</CardTitle>
              <Button variant="outline" size="sm">
                <Download className="h-4 w-4 mr-2" />
                Download Transcript
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Qualification Progress</span>
                <span className="font-medium">{progressPercentage}%</span>
              </div>
              <Progress value={progressPercentage} className="h-3" />
              <p className="text-sm text-muted-foreground">
                You have earned {earnedCredits} out of {totalCredits} credits required for this qualification.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Results List */}
        <Card className="border-0 shadow-md">
          <CardHeader>
            <CardTitle>Unit Standard Results</CardTitle>
            <CardDescription>Detailed results for each unit standard</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {results.map((result) => (
                <div
                  key={result.id}
                  className="flex flex-col md:flex-row md:items-center justify-between p-4 rounded-lg border"
                >
                  <div className="flex-1 mb-4 md:mb-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-medium">{result.unitStandard}</h4>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span className="font-mono">{result.unitCode}</span>
                      <span>{result.credits} credits</span>
                      {result.assessedDate && <span>Assessed: {result.assessedDate}</span>}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4">
                    {result.marks !== undefined && (
                      <div className="text-right">
                        <p className="text-2xl font-bold">{result.marks}%</p>
                      </div>
                    )}
                    {getStatusBadge(result.status)}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default withRoleAccess(TraineeResultsPage, {
  requiredRoles: ["trainee"],
});
