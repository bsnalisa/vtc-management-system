import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, TrendingUp, AlertCircle } from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { debtorOfficerNavItems } from "@/lib/navigationConfig";
import { useProfile } from "@/hooks/useProfile";

const DebtorOfficerDashboard = () => {
  const { data: profile } = useProfile();
  
  return (
    <DashboardLayout
      title={`Welcome back, ${profile?.firstname || 'User'}`}
      subtitle="Manage fees and payments"
      navItems={debtorOfficerNavItems}
      groupLabel="Fee Management"
    >
      <div className="space-y-6">

        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Collected</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">N$2.4M</div>
              <p className="text-xs text-muted-foreground">This academic year</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Outstanding</CardTitle>
              <AlertCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">N$425K</div>
              <p className="text-xs text-muted-foreground">15% of total fees</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Collection Rate</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">85%</div>
              <p className="text-xs text-muted-foreground">+3% from last month</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Fee management tasks</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="flex items-center gap-3 p-4 border rounded-lg hover:border-primary transition-colors cursor-pointer">
              <DollarSign className="h-6 w-6 text-primary" />
              <div>
                <p className="font-medium">Record Payment</p>
                <p className="text-xs text-muted-foreground">Process trainee payments</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-4 border rounded-lg hover:border-primary transition-colors cursor-pointer">
              <AlertCircle className="h-6 w-6 text-primary" />
              <div>
                <p className="font-medium">View Outstanding</p>
                <p className="text-xs text-muted-foreground">Check unpaid balances</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default DebtorOfficerDashboard;
