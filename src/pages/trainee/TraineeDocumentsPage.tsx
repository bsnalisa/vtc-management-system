import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DashboardLayout } from "@/components/DashboardLayout";
import { traineeNavItems } from "@/lib/navigationConfig";
import { FileText, Upload, Download, Eye, CheckCircle, Clock, AlertCircle, Loader2 } from "lucide-react";
import { withRoleAccess } from "@/components/withRoleAccess";
import { useTraineeUserId, useTraineeApplication } from "@/hooks/useTraineePortalData";

const TraineeDocumentsPage = () => {
  const userId = useTraineeUserId();
  const { data: application, isLoading } = useTraineeApplication(userId);

  if (isLoading) {
    return (
      <DashboardLayout title="My Documents" subtitle="Manage your uploaded documents" navItems={traineeNavItems} groupLabel="Trainee iEnabler">
        <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      </DashboardLayout>
    );
  }

  // Extract document info from application data
  const docs: Array<{ name: string; uploaded: boolean; field: string }> = [
    { name: "National ID / Passport", uploaded: !!(application?.national_id), field: "national_id" },
    { name: "Grade 12 Certificate or Equivalent", uploaded: !!(application?.school_subjects && (application.school_subjects as any[])?.length > 0), field: "school_subjects" },
    { name: "Passport Size Photo", uploaded: !!(application?.photo_path), field: "passport_photo" },
  ];

  const uploadedCount = docs.filter(d => d.uploaded).length;

  return (
    <DashboardLayout title="My Documents" subtitle="Manage your uploaded documents" navItems={traineeNavItems} groupLabel="Trainee iEnabler">
      <div className="space-y-6">
        {/* Summary */}
        <Card className="border-0 shadow-md bg-gradient-to-r from-primary/5 to-primary/10">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-lg">Document Status</h3>
                <p className="text-muted-foreground">{uploadedCount} of {docs.length} documents on record</p>
              </div>
              <Badge variant={uploadedCount === docs.length ? "default" : "secondary"}>
                {uploadedCount === docs.length ? <><CheckCircle className="h-3 w-3 mr-1" />Complete</> : <><Clock className="h-3 w-3 mr-1" />Incomplete</>}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Checklist */}
        <Card className="border-0 shadow-md">
          <CardHeader>
            <CardTitle>Required Documents Checklist</CardTitle>
            <CardDescription>Status of documents based on your application record</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {docs.map((item, index) => (
                <div key={index} className="flex items-center gap-3 p-3 rounded-lg border">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${item.uploaded ? "bg-green-100 text-green-600" : "bg-gray-100 text-gray-400"}`}>
                    {item.uploaded ? <CheckCircle className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                  </div>
                  <span className={item.uploaded ? "font-medium" : "text-muted-foreground"}>{item.name}</span>
                  {item.uploaded && <Badge variant="outline" className="ml-auto bg-green-50 text-green-700 border-green-200">On Record</Badge>}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Application Details */}
        {application && (
          <Card className="border-0 shadow-md">
            <CardHeader>
              <CardTitle>Application Details</CardTitle>
              <CardDescription>Information from your application</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="p-4 rounded-lg bg-muted">
                  <p className="text-sm text-muted-foreground">Application Number</p>
                  <p className="font-mono font-medium">{application.application_number || "N/A"}</p>
                </div>
                <div className="p-4 rounded-lg bg-muted">
                  <p className="text-sm text-muted-foreground">National ID</p>
                  <p className="font-mono font-medium">{application.national_id || "Not provided"}</p>
                </div>
                <div className="p-4 rounded-lg bg-muted">
                  <p className="text-sm text-muted-foreground">Date of Birth</p>
                  <p className="font-medium">{application.date_of_birth ? new Date(application.date_of_birth).toLocaleDateString("en-ZA") : "Not provided"}</p>
                </div>
                <div className="p-4 rounded-lg bg-muted">
                  <p className="text-sm text-muted-foreground">Gender</p>
                  <p className="font-medium capitalize">{application.gender || "Not provided"}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
};

export default withRoleAccess(TraineeDocumentsPage, { requiredRoles: ["trainee"] });
