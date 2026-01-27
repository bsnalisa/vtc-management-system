import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DashboardLayout } from "@/components/DashboardLayout";
import { traineeNavItems } from "@/lib/navigationConfig";
import { CheckCircle, Clock, AlertCircle, FileCheck, GraduationCap, CreditCard, Home } from "lucide-react";
import { withRoleAccess } from "@/components/withRoleAccess";
import { Progress } from "@/components/ui/progress";

const TraineeAdmissionStatusPage = () => {
  // Mock admission status - in production, fetch from trainee_applications
  const admissionData = {
    applicationNumber: "APP-2025-00123",
    submittedDate: "January 15, 2025",
    qualificationStatus: "provisionally_qualified",
    registrationStatus: "pending_payment",
    qualificationRemarks: "All entry requirements met. Proceed with payment.",
    overallProgress: 75,
  };

  const stages = [
    {
      id: 1,
      title: "Application Submitted",
      description: "Your application has been received",
      icon: FileCheck,
      status: "completed",
      date: "Jan 15, 2025",
    },
    {
      id: 2,
      title: "Document Verification",
      description: "Documents reviewed and verified",
      icon: FileCheck,
      status: "completed",
      date: "Jan 18, 2025",
    },
    {
      id: 3,
      title: "Qualification Check",
      description: "Entry requirements verified",
      icon: GraduationCap,
      status: "completed",
      date: "Jan 20, 2025",
    },
    {
      id: 4,
      title: "Payment Required",
      description: "Complete fee payment to proceed",
      icon: CreditCard,
      status: "current",
      date: "In Progress",
    },
    {
      id: 5,
      title: "Hostel Allocation",
      description: "Room assignment (if applicable)",
      icon: Home,
      status: "pending",
      date: "Pending",
    },
    {
      id: 6,
      title: "Registration Complete",
      description: "Full registration confirmed",
      icon: CheckCircle,
      status: "pending",
      date: "Pending",
    },
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed": return "bg-green-500";
      case "current": return "bg-blue-500 animate-pulse";
      case "pending": return "bg-gray-300";
      default: return "bg-gray-300";
    }
  };

  const getStatusIcon = (status: string, Icon: any) => {
    if (status === "completed") return <CheckCircle className="h-5 w-5 text-white" />;
    if (status === "current") return <Clock className="h-5 w-5 text-white" />;
    return <Icon className="h-5 w-5 text-gray-500" />;
  };

  return (
    <DashboardLayout
      title="Admission Status"
      subtitle="Track your application progress"
      navItems={traineeNavItems}
      groupLabel="Trainee iEnabler"
    >
      <div className="space-y-6">
        {/* Summary Card */}
        <Card className="border-0 shadow-md bg-gradient-to-r from-primary/5 to-primary/10">
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Application Number</p>
                <p className="text-xl font-bold font-mono">{admissionData.applicationNumber}</p>
                <p className="text-sm text-muted-foreground mt-1">Submitted: {admissionData.submittedDate}</p>
              </div>
              <div className="flex flex-col items-end">
                <Badge className="bg-yellow-100 text-yellow-800 mb-2">
                  <Clock className="h-3 w-3 mr-1" />
                  Payment Pending
                </Badge>
                <div className="w-48">
                  <div className="flex justify-between text-sm mb-1">
                    <span>Progress</span>
                    <span className="font-medium">{admissionData.overallProgress}%</span>
                  </div>
                  <Progress value={admissionData.overallProgress} className="h-2" />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Current Action Required */}
        <Card className="border-0 shadow-md border-l-4 border-l-yellow-500">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-full bg-yellow-100">
                <AlertCircle className="h-6 w-6 text-yellow-600" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-lg">Action Required: Complete Payment</h3>
                <p className="text-muted-foreground mt-1">
                  Your application has been provisionally approved. Please complete your fee payment to proceed with registration.
                </p>
                <div className="mt-4 flex gap-2">
                  <Button>Pay Now</Button>
                  <Button variant="outline">View Fee Breakdown</Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Application Timeline */}
        <Card className="border-0 shadow-md">
          <CardHeader>
            <CardTitle>Application Timeline</CardTitle>
            <CardDescription>Follow your admission journey step by step</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="relative">
              {stages.map((stage, index) => (
                <div key={stage.id} className="flex gap-4 pb-8 last:pb-0">
                  {/* Timeline line */}
                  <div className="flex flex-col items-center">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${getStatusColor(stage.status)}`}>
                      {getStatusIcon(stage.status, stage.icon)}
                    </div>
                    {index < stages.length - 1 && (
                      <div className={`w-0.5 flex-1 mt-2 ${
                        stage.status === "completed" ? "bg-green-500" : "bg-gray-200"
                      }`} />
                    )}
                  </div>
                  
                  {/* Content */}
                  <div className="flex-1 pt-1.5">
                    <div className="flex items-center justify-between">
                      <h4 className={`font-medium ${stage.status === "pending" ? "text-muted-foreground" : ""}`}>
                        {stage.title}
                      </h4>
                      <span className={`text-sm ${stage.status === "pending" ? "text-muted-foreground" : ""}`}>
                        {stage.date}
                      </span>
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
          <CardHeader>
            <CardTitle>Qualification Assessment</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="p-4 rounded-lg bg-green-50 border border-green-200">
              <div className="flex items-start gap-3">
                <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                <div>
                  <p className="font-medium text-green-800">Provisionally Qualified</p>
                  <p className="text-sm text-green-700 mt-1">{admissionData.qualificationRemarks}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default withRoleAccess(TraineeAdmissionStatusPage, {
  requiredRoles: ["trainee"],
});
