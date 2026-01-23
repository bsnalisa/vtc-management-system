import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FileCheck, Lock, AlertCircle, Users } from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { assessmentCoordinatorNavItems } from "@/lib/navigationConfig";
import { useProfile } from "@/hooks/useProfile";

const AssessmentCoordinatorDashboard = () => {
  const { data: profile } = useProfile();
  
  return (
    <DashboardLayout
      title={`Welcome back, ${profile?.firstname || 'User'}`}
      subtitle="Manage assessments, lock marks, and oversee evaluation processes"
      navItems={assessmentCoordinatorNavItems}
      groupLabel="Assessment Management"
    >
      <div className="space-y-6">

        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending Reviews</CardTitle>
              <FileCheck className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">12</div>
              <p className="text-xs text-muted-foreground">Assessments awaiting review</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Locked Marks</CardTitle>
              <Lock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">45</div>
              <p className="text-xs text-muted-foreground">Assessments locked this term</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Withheld Marks</CardTitle>
              <AlertCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">8</div>
              <p className="text-xs text-muted-foreground">Due to outstanding fees</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Courses</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">24</div>
              <p className="text-xs text-muted-foreground">Courses this academic year</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Common assessment coordination tasks</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="flex items-center gap-3 p-4 border rounded-lg hover:border-primary transition-colors cursor-pointer">
              <FileCheck className="h-6 w-6 text-primary" />
              <div>
                <p className="font-medium">Review Submitted Marks</p>
                <p className="text-xs text-muted-foreground">Check trainer submissions</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-4 border rounded-lg hover:border-primary transition-colors cursor-pointer">
              <Lock className="h-6 w-6 text-primary" />
              <div>
                <p className="font-medium">Lock/Unlock Marks</p>
                <p className="text-xs text-muted-foreground">Control mark editing access</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-4 border rounded-lg hover:border-primary transition-colors cursor-pointer">
              <AlertCircle className="h-6 w-6 text-primary" />
              <div>
                <p className="font-medium">Manage Withheld Marks</p>
                <p className="text-xs text-muted-foreground">Handle fee-related withholdings</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-4 border rounded-lg hover:border-primary transition-colors cursor-pointer">
              <FileCheck className="h-6 w-6 text-primary" />
              <div>
                <p className="font-medium">Generate Reports</p>
                <p className="text-xs text-muted-foreground">Assessment performance reports</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default AssessmentCoordinatorDashboard;
