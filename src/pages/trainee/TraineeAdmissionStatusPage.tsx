import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DashboardLayout } from "@/components/DashboardLayout";
import { traineeNavItems } from "@/lib/navigationConfig";
import { CheckCircle, Clock, AlertCircle, FileCheck, GraduationCap, CreditCard, Home, Loader2 } from "lucide-react";
import { withRoleAccess } from "@/components/withRoleAccess";
import { Progress } from "@/components/ui/progress";
import { useTraineeUserId, useTraineeRecord, useTraineeApplication } from "@/hooks/useTraineePortalData";

const TraineeAdmissionStatusPage = () => {
  const userId = useTraineeUserId();
  const { data: trainee, isLoading: traineeLoading } = useTraineeRecord(userId);
  const { data: application, isLoading: appLoading } = useTraineeApplication(userId);

  const isLoading = traineeLoading || appLoading;

  if (isLoading) {
    return (
      <DashboardLayout title="Admission Status" subtitle="Track your application progress" navItems={traineeNavItems} groupLabel="Trainee iEnabler">
        <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      </DashboardLayout>
    );
  }

  const appNumber = application?.application_number || trainee?.trainee_id || "N/A";
  const submittedDate = application?.created_at ? new Date(application.created_at).toLocaleDateString("en-ZA", { year: "numeric", month: "long", day: "numeric" }) : "N/A";
  const qualStatus = application?.qualification_status || "pending";
  const regStatus = application?.registration_status || trainee?.status || "pending";

  // Determine stage completion
  const isSubmitted = !!application;
  const isQualified = qualStatus === "provisionally_qualified" || qualStatus === "qualified";
  const hasTraineeNumber = !!(application?.trainee_number || trainee?.trainee_id);
  const isRegistered = regStatus === "registered" || regStatus === "fully_registered";

  const stages = [
    { id: 1, title: "Application Submitted", description: "Your application has been received", icon: FileCheck, status: isSubmitted ? "completed" : "pending", date: submittedDate },
    { id: 2, title: "Qualification Check", description: "Entry requirements verified", icon: GraduationCap, status: isQualified ? "completed" : isSubmitted ? "current" : "pending", date: isQualified ? "Passed" : "In Progress" },
    { id: 3, title: "Application Fee Cleared", description: "Application fee payment verified", icon: CreditCard, status: hasTraineeNumber ? "completed" : isQualified ? "current" : "pending", date: hasTraineeNumber ? "Cleared" : "Pending" },
    { id: 4, title: "Registration Fee Cleared", description: "Registration fee payment verified", icon: CreditCard, status: isRegistered ? "completed" : hasTraineeNumber ? "current" : "pending", date: isRegistered ? "Cleared" : "Pending" },
    { id: 5, title: "Registration Complete", description: "Full registration confirmed", icon: CheckCircle, status: isRegistered ? "completed" : "pending", date: isRegistered ? "Complete" : "Pending" },
  ];

  const completedStages = stages.filter(s => s.status === "completed").length;
  const overallProgress = Math.round((completedStages / stages.length) * 100);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed": return "bg-green-500";
      case "current": return "bg-blue-500 animate-pulse";
      default: return "bg-gray-300";
    }
  };

  const getStatusIcon = (status: string, Icon: any) => {
    if (status === "completed") return <CheckCircle className="h-5 w-5 text-white" />;
    if (status === "current") return <Clock className="h-5 w-5 text-white" />;
    return <Icon className="h-5 w-5 text-gray-500" />;
  };

  const currentStage = stages.find(s => s.status === "current");
  const currentBadgeLabel = isRegistered ? "Registered" : isQualified ? "Qualified" : "In Progress";
  const currentBadgeColor = isRegistered ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800";

  return (
    <DashboardLayout title="Admission Status" subtitle="Track your application progress" navItems={traineeNavItems} groupLabel="Trainee iEnabler">
      <div className="space-y-6">
        {/* Summary Card */}
        <Card className="border-0 shadow-md bg-gradient-to-r from-primary/5 to-primary/10">
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Application Number</p>
                <p className="text-xl font-bold font-mono">{appNumber}</p>
                <p className="text-sm text-muted-foreground mt-1">Submitted: {submittedDate}</p>
              </div>
              <div className="flex flex-col items-end">
                <Badge className={currentBadgeColor}>
                  {isRegistered ? <CheckCircle className="h-3 w-3 mr-1" /> : <Clock className="h-3 w-3 mr-1" />}
                  {currentBadgeLabel}
                </Badge>
                <div className="w-48 mt-2">
                  <div className="flex justify-between text-sm mb-1">
                    <span>Progress</span>
                    <span className="font-medium">{overallProgress}%</span>
                  </div>
                  <Progress value={overallProgress} className="h-2" />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Current Action */}
        {currentStage && (
          <Card className="border-0 shadow-md border-l-4 border-l-yellow-500">
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <div className="p-3 rounded-full bg-yellow-100"><AlertCircle className="h-6 w-6 text-yellow-600" /></div>
                <div>
                  <h3 className="font-semibold text-lg">Current Step: {currentStage.title}</h3>
                  <p className="text-muted-foreground mt-1">{currentStage.description}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Timeline */}
        <Card className="border-0 shadow-md">
          <CardHeader>
            <CardTitle>Application Timeline</CardTitle>
            <CardDescription>Follow your admission journey step by step</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="relative">
              {stages.map((stage, index) => (
                <div key={stage.id} className="flex gap-4 pb-8 last:pb-0">
                  <div className="flex flex-col items-center">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${getStatusColor(stage.status)}`}>
                      {getStatusIcon(stage.status, stage.icon)}
                    </div>
                    {index < stages.length - 1 && (
                      <div className={`w-0.5 flex-1 mt-2 ${stage.status === "completed" ? "bg-green-500" : "bg-gray-200"}`} />
                    )}
                  </div>
                  <div className="flex-1 pt-1.5">
                    <div className="flex items-center justify-between">
                      <h4 className={`font-medium ${stage.status === "pending" ? "text-muted-foreground" : ""}`}>{stage.title}</h4>
                      <span className={`text-sm ${stage.status === "pending" ? "text-muted-foreground" : ""}`}>{stage.date}</span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">{stage.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Qualification Details */}
        <Card className="border-0 shadow-md">
          <CardHeader><CardTitle>Qualification Assessment</CardTitle></CardHeader>
          <CardContent>
            <div className={`p-4 rounded-lg ${isQualified ? "bg-green-50 border border-green-200" : "bg-yellow-50 border border-yellow-200"}`}>
              <div className="flex items-start gap-3">
                {isQualified ? <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" /> : <Clock className="h-5 w-5 text-yellow-600 mt-0.5" />}
                <div>
                  <p className={`font-medium ${isQualified ? "text-green-800" : "text-yellow-800"}`}>
                    {isQualified ? "Provisionally Qualified" : "Qualification Assessment Pending"}
                  </p>
                  <p className={`text-sm mt-1 ${isQualified ? "text-green-700" : "text-yellow-700"}`}>
                    {application?.qualification_remarks || (isQualified ? "All entry requirements met." : "Your application is being reviewed.")}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default withRoleAccess(TraineeAdmissionStatusPage, { requiredRoles: ["trainee"] });
