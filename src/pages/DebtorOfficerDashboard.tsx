import { DashboardLayout } from "@/components/DashboardLayout";
import { debtorOfficerNavItems } from "@/lib/navigationConfig";
import { useProfile } from "@/hooks/useProfile";
import { DebtorDashboardStats } from "@/components/debtor/DebtorDashboardStats";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { FileText, GraduationCap, History, ArrowRight } from "lucide-react";
import { useFinancialQueueStats } from "@/hooks/useFinancialQueue";

const DebtorOfficerDashboard = () => {
  const { data: profile } = useProfile();
  const { data: stats } = useFinancialQueueStats();

  return (
    <DashboardLayout
      title={`Welcome back, ${profile?.firstname || "User"}`}
      subtitle="Financial Operations Dashboard - Process fees and manage clearances"
      navItems={debtorOfficerNavItems}
      groupLabel="Financial Operations"
    >
      <div className="space-y-6">
        {/* KPI Stats */}
        <DebtorDashboardStats />

        {/* Quick Actions */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="hover:shadow-md transition-shadow border-l-4 border-l-violet-500">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <FileText className="h-5 w-5 text-violet-600" />
                Application Fees
              </CardTitle>
              <CardDescription>
                Clear fees to create trainee identities
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-3xl font-bold text-violet-600">
                    {stats?.applicationFeesPending || 0}
                  </p>
                  <p className="text-sm text-muted-foreground">pending</p>
                </div>
                <Button asChild variant="outline" className="border-violet-200 text-violet-700 hover:bg-violet-50">
                  <Link to="/debtors/application-fees">
                    Process
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="hover:shadow-md transition-shadow border-l-4 border-l-sky-500">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <GraduationCap className="h-5 w-5 text-sky-600" />
                Registration Fees
              </CardTitle>
              <CardDescription>
                Clear fees to complete enrollment
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-3xl font-bold text-sky-600">
                    {stats?.registrationFeesPending || 0}
                  </p>
                  <p className="text-sm text-muted-foreground">pending</p>
                </div>
                <Button asChild variant="outline" className="border-sky-200 text-sky-700 hover:bg-sky-50">
                  <Link to="/debtors/registration-fees">
                    Process
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="hover:shadow-md transition-shadow border-l-4 border-l-emerald-500">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <History className="h-5 w-5 text-emerald-600" />
                Payment History
              </CardTitle>
              <CardDescription>
                View cleared payments and audit trail
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-3xl font-bold text-emerald-600">
                    {stats?.cleared || 0}
                  </p>
                  <p className="text-sm text-muted-foreground">cleared</p>
                </div>
                <Button asChild variant="outline" className="border-emerald-200 text-emerald-700 hover:bg-emerald-50">
                  <Link to="/debtors/cleared-payments">
                    View
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Workflow Explanation */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Workflow Lifecycle</CardTitle>
            <CardDescription>
              Financial queue is the single source of truth for all payment-related operations
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="px-3 py-1 rounded-full bg-muted font-medium">APPLIED</span>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
              <span className="px-3 py-1 rounded-full bg-violet-100 text-violet-800 font-medium">APPLICATION_FEE_PENDING</span>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
              <span className="px-3 py-1 rounded-full bg-amber-100 text-amber-800 font-medium">PROVISIONALLY_ADMITTED</span>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
              <span className="px-3 py-1 rounded-full bg-sky-100 text-sky-800 font-medium">REGISTRATION_FEE_PENDING</span>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
              <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 font-medium">REGISTERED</span>
            </div>
            <div className="mt-4 grid gap-2 text-sm text-muted-foreground">
              <p>• <strong>Application Fee Clearance:</strong> Creates trainee number, system email, and auth account</p>
              <p>• <strong>Registration Fee Clearance:</strong> Completes enrollment and activates full system access</p>
              <p>• <strong>Identity creation only occurs after application fee is cleared</strong></p>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default DebtorOfficerDashboard;
