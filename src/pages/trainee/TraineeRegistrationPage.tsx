import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DashboardLayout } from "@/components/DashboardLayout";
import { traineeNavItems } from "@/lib/navigationConfig";
import { useProfile } from "@/hooks/useProfile";
import { CheckCircle, Clock, FileText, Download, Eye } from "lucide-react";
import { withRoleAccess } from "@/components/withRoleAccess";

const TraineeRegistrationPage = () => {
  const { data: profile } = useProfile();

  // Mock registration data - in production, fetch from trainee_applications or trainees table
  const registrationStatus = "fully_registered"; // applied | provisionally_admitted | pending_payment | fully_registered
  const qualification = {
    title: "National Certificate in Welding",
    code: "NVC-WLD-001",
    nqfLevel: 3,
    duration: "2 years",
  };

  const statusConfig: Record<string, { color: string; label: string; icon: React.ReactNode }> = {
    applied: { color: "bg-blue-100 text-blue-800", label: "Application Submitted", icon: <Clock className="h-4 w-4" /> },
    provisionally_admitted: { color: "bg-yellow-100 text-yellow-800", label: "Provisionally Admitted", icon: <Clock className="h-4 w-4" /> },
    pending_payment: { color: "bg-orange-100 text-orange-800", label: "Pending Payment", icon: <Clock className="h-4 w-4" /> },
    fully_registered: { color: "bg-green-100 text-green-800", label: "Fully Registered", icon: <CheckCircle className="h-4 w-4" /> },
  };

  const status = statusConfig[registrationStatus] || statusConfig.applied;

  return (
    <DashboardLayout
      title="My Registration"
      subtitle="View your registration details and status"
      navItems={traineeNavItems}
      groupLabel="Trainee iEnabler"
    >
      <div className="space-y-6">
        {/* Registration Status Card */}
        <Card className="border-0 shadow-md">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Registration Status</CardTitle>
              <Badge className={status.color}>
                {status.icon}
                <span className="ml-1">{status.label}</span>
              </Badge>
            </div>
            <CardDescription>Your current registration status and qualification details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="p-4 rounded-lg bg-muted">
                <p className="text-sm text-muted-foreground mb-1">Qualification</p>
                <p className="font-medium">{qualification.title}</p>
              </div>
              <div className="p-4 rounded-lg bg-muted">
                <p className="text-sm text-muted-foreground mb-1">Qualification Code</p>
                <p className="font-mono font-medium">{qualification.code}</p>
              </div>
              <div className="p-4 rounded-lg bg-muted">
                <p className="text-sm text-muted-foreground mb-1">NQF Level</p>
                <p className="font-medium">Level {qualification.nqfLevel}</p>
              </div>
              <div className="p-4 rounded-lg bg-muted">
                <p className="text-sm text-muted-foreground mb-1">Duration</p>
                <p className="font-medium">{qualification.duration}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Registration Timeline */}
        <Card className="border-0 shadow-md">
          <CardHeader>
            <CardTitle>Registration Timeline</CardTitle>
            <CardDescription>Track your registration journey</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[
                { status: "completed", label: "Application Submitted", date: "Jan 15, 2025" },
                { status: "completed", label: "Documents Verified", date: "Jan 18, 2025" },
                { status: "completed", label: "Qualification Confirmed", date: "Jan 20, 2025" },
                { status: registrationStatus === "fully_registered" ? "completed" : "pending", label: "Payment Verified", date: registrationStatus === "fully_registered" ? "Jan 25, 2025" : "Pending" },
                { status: registrationStatus === "fully_registered" ? "completed" : "pending", label: "Registration Complete", date: registrationStatus === "fully_registered" ? "Jan 25, 2025" : "Pending" },
              ].map((step, index) => (
                <div key={index} className="flex items-start gap-4">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                    step.status === "completed" ? "bg-green-100 text-green-600" : "bg-gray-100 text-gray-400"
                  }`}>
                    {step.status === "completed" ? <CheckCircle className="h-4 w-4" /> : <Clock className="h-4 w-4" />}
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

        {/* Quick Actions */}
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="border-0 shadow-md">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-primary/10">
                  <FileText className="h-6 w-6 text-primary" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold">Proof of Registration</h3>
                  <p className="text-sm text-muted-foreground">Download your official registration document</p>
                </div>
                <Button variant="outline" size="sm" disabled={registrationStatus !== "fully_registered"}>
                  <Download className="h-4 w-4 mr-2" />
                  Download
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-md">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-blue-100">
                  <Eye className="h-6 w-6 text-blue-600" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold">View Unit Standards</h3>
                  <p className="text-sm text-muted-foreground">See all unit standards for your qualification</p>
                </div>
                <Button variant="outline" size="sm">
                  View
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default withRoleAccess(TraineeRegistrationPage, {
  requiredRoles: ["trainee"],
});
