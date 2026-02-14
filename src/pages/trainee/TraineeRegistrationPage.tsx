import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DashboardLayout } from "@/components/DashboardLayout";
import { traineeNavItems } from "@/lib/navigationConfig";
import { CheckCircle, Clock, FileText, Download, Eye, Loader2 } from "lucide-react";
import { withRoleAccess } from "@/components/withRoleAccess";
import { useTraineeUserId, useTraineeRecord, useTraineeApplication, useTraineeEnrollments } from "@/hooks/useTraineePortalData";

const TraineeRegistrationPage = () => {
  const userId = useTraineeUserId();
  const { data: trainee, isLoading: tLoading } = useTraineeRecord(userId);
  const { data: application, isLoading: aLoading } = useTraineeApplication(userId);
  const { data: enrollments } = useTraineeEnrollments(trainee?.id);

  const isLoading = tLoading || aLoading;

  if (isLoading) {
    return (
      <DashboardLayout title="My Registration" subtitle="View your registration details and status" navItems={traineeNavItems} groupLabel="Trainee iEnabler">
        <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      </DashboardLayout>
    );
  }

  const regStatus = application?.registration_status || trainee?.status || "pending";
  const isRegistered = regStatus === "registered" || regStatus === "fully_registered";
  const tradeName = (trainee?.trades as any)?.name || "N/A";
  const tradeCode = (trainee?.trades as any)?.code || "N/A";
  const level = trainee?.level || application?.preferred_level || "N/A";
  const trainingMode = trainee?.training_mode || application?.preferred_training_mode || "N/A";
  const activeEnrollment = enrollments?.find(e => e.status === "active");
  const qualTitle = (activeEnrollment?.courses as any)?.trades?.name || (activeEnrollment?.courses as any)?.name || tradeName;
  const qualCode = (activeEnrollment?.courses as any)?.code || tradeCode;
  const nqfLevel = (activeEnrollment?.courses as any)?.level || level;

  const statusConfig: Record<string, { color: string; label: string; icon: React.ReactNode }> = {
    applied: { color: "bg-blue-100 text-blue-800", label: "Application Submitted", icon: <Clock className="h-4 w-4" /> },
    provisionally_admitted: { color: "bg-yellow-100 text-yellow-800", label: "Provisionally Admitted", icon: <Clock className="h-4 w-4" /> },
    pending_payment: { color: "bg-orange-100 text-orange-800", label: "Pending Payment", icon: <Clock className="h-4 w-4" /> },
    registered: { color: "bg-green-100 text-green-800", label: "Registered", icon: <CheckCircle className="h-4 w-4" /> },
    fully_registered: { color: "bg-green-100 text-green-800", label: "Fully Registered", icon: <CheckCircle className="h-4 w-4" /> },
  };

  const status = statusConfig[regStatus] || statusConfig.applied;

  const timelineSteps = [
    { label: "Application Submitted", date: application?.created_at ? new Date(application.created_at).toLocaleDateString("en-ZA", { year: "numeric", month: "short", day: "numeric" }) : "N/A", completed: !!application },
    { label: "Qualification Verified", date: application?.screened_at ? new Date(application.screened_at).toLocaleDateString("en-ZA", { year: "numeric", month: "short", day: "numeric" }) : "Pending", completed: application?.qualification_status === "provisionally_qualified" },
    { label: "Application Fee Cleared", date: application?.payment_cleared_at ? new Date(application.payment_cleared_at).toLocaleDateString("en-ZA", { year: "numeric", month: "short", day: "numeric" }) : "Pending", completed: !!(application?.trainee_number) },
    { label: "Registration Fee Cleared", date: isRegistered ? "Cleared" : "Pending", completed: isRegistered },
    { label: "Registration Complete", date: isRegistered ? "Complete" : "Pending", completed: isRegistered },
  ];

  return (
    <DashboardLayout title="My Registration" subtitle="View your registration details and status" navItems={traineeNavItems} groupLabel="Trainee iEnabler">
      <div className="space-y-6">
        <Card className="border-0 shadow-md">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Registration Status</CardTitle>
              <Badge className={status.color}>{status.icon}<span className="ml-1">{status.label}</span></Badge>
            </div>
            <CardDescription>Your current registration status and qualification details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="p-4 rounded-lg bg-muted">
                <p className="text-sm text-muted-foreground mb-1">Qualification / Trade</p>
                <p className="font-medium">{qualTitle}</p>
              </div>
              <div className="p-4 rounded-lg bg-muted">
                <p className="text-sm text-muted-foreground mb-1">Code</p>
                <p className="font-mono font-medium">{qualCode}</p>
              </div>
              <div className="p-4 rounded-lg bg-muted">
                <p className="text-sm text-muted-foreground mb-1">NQF Level / Level</p>
                <p className="font-medium">Level {nqfLevel}</p>
              </div>
              <div className="p-4 rounded-lg bg-muted">
                <p className="text-sm text-muted-foreground mb-1">Training Mode</p>
                <p className="font-medium capitalize">{trainingMode}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md">
          <CardHeader>
            <CardTitle>Registration Timeline</CardTitle>
            <CardDescription>Track your registration journey</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {timelineSteps.map((step, index) => (
                <div key={index} className="flex items-start gap-4">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step.completed ? "bg-green-100 text-green-600" : "bg-gray-100 text-gray-400"}`}>
                    {step.completed ? <CheckCircle className="h-4 w-4" /> : <Clock className="h-4 w-4" />}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium">{step.label}</p>
                    <p className="text-sm text-muted-foreground">{step.date}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4 md:grid-cols-2">
          <Card className="border-0 shadow-md">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-primary/10"><FileText className="h-6 w-6 text-primary" /></div>
                <div className="flex-1">
                  <h3 className="font-semibold">Trainee Number</h3>
                  <p className="text-sm font-mono text-muted-foreground">{trainee?.trainee_id || application?.trainee_number || "Not assigned yet"}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-md">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-blue-100"><Eye className="h-6 w-6 text-blue-600" /></div>
                <div className="flex-1">
                  <h3 className="font-semibold">System Email</h3>
                  <p className="text-sm font-mono text-muted-foreground">{trainee?.system_email || application?.system_email || "Not generated yet"}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default withRoleAccess(TraineeRegistrationPage, { requiredRoles: ["trainee"] });
