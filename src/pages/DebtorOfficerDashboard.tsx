import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DashboardLayout } from "@/components/DashboardLayout";
import { debtorOfficerNavItems } from "@/lib/navigationConfig";
import { useProfile } from "@/hooks/useProfile";
import { DebtorStatsCards } from "@/components/debtor/DebtorStatsCards";
import { PaymentClearanceCenter } from "@/components/debtor/PaymentClearanceCenter";
import { ConnectedDashboardsView } from "@/components/debtor/ConnectedDashboardsView";
import { HostelFeeManagement } from "@/components/debtor/HostelFeeManagement";
import { DollarSign, Building, Link2, FileText } from "lucide-react";
import { FeeManagementTable } from "@/components/fees/FeeManagementTable";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const DebtorOfficerDashboard = () => {
  const { data: profile } = useProfile();
  const [activeTab, setActiveTab] = useState("clearances");

  return (
    <DashboardLayout
      title={`Welcome back, ${profile?.firstname || "User"}`}
      subtitle="Payment clearance hub - Manage fees, payments, and training grants"
      navItems={debtorOfficerNavItems}
      groupLabel="Fee Management"
    >
      <div className="space-y-6">
        {/* Stats Overview */}
        <DebtorStatsCards />

        {/* Connected Dashboards Quick View */}
        <ConnectedDashboardsView />

        {/* Main Content Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="clearances" className="flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              <span className="hidden sm:inline">Payment Clearance</span>
              <span className="sm:hidden">Clearance</span>
            </TabsTrigger>
            <TabsTrigger value="hostel" className="flex items-center gap-2">
              <Building className="h-4 w-4" />
              <span className="hidden sm:inline">Hostel Fees</span>
              <span className="sm:hidden">Hostel</span>
            </TabsTrigger>
            <TabsTrigger value="fees" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              <span className="hidden sm:inline">Fee Records</span>
              <span className="sm:hidden">Fees</span>
            </TabsTrigger>
            <TabsTrigger value="connections" className="flex items-center gap-2">
              <Link2 className="h-4 w-4" />
              <span className="hidden sm:inline">Integrations</span>
              <span className="sm:hidden">Links</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="clearances">
            <PaymentClearanceCenter />
          </TabsContent>

          <TabsContent value="hostel">
            <HostelFeeManagement />
          </TabsContent>

          <TabsContent value="fees">
            <Card>
              <CardHeader>
                <CardTitle>Fee Records</CardTitle>
                <CardDescription>
                  View and manage all trainee fee records
                </CardDescription>
              </CardHeader>
              <CardContent>
                <FeeManagementTable
                  data={[]}
                  onEdit={() => {}}
                  onDelete={() => {}}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="connections">
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    🔗 Dashboard Integration Status
                  </CardTitle>
                  <CardDescription>
                    Real-time synchronization with connected systems
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="p-4 border rounded-lg space-y-2">
                      <div className="flex items-center gap-2">
                        <div className="h-3 w-3 rounded-full bg-green-500 animate-pulse" />
                        <h4 className="font-medium">Registration Dashboard</h4>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Connected - Syncing pending registrations in real-time
                      </p>
                    </div>
                    <div className="p-4 border rounded-lg space-y-2">
                      <div className="flex items-center gap-2">
                        <div className="h-3 w-3 rounded-full bg-green-500 animate-pulse" />
                        <h4 className="font-medium">Hostel Coordinator</h4>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Connected - Hostel fee updates sync automatically
                      </p>
                    </div>
                    <div className="p-4 border rounded-lg space-y-2">
                      <div className="flex items-center gap-2">
                        <div className="h-3 w-3 rounded-full bg-green-500 animate-pulse" />
                        <h4 className="font-medium">Trainee Portal</h4>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Connected - Trainees receive instant payment notifications
                      </p>
                    </div>
                    <div className="p-4 border rounded-lg space-y-2">
                      <div className="flex items-center gap-2">
                        <div className="h-3 w-3 rounded-full bg-green-500 animate-pulse" />
                        <h4 className="font-medium">Fee Records Database</h4>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Connected - All transactions recorded in real-time
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>How It Works</CardTitle>
                  <CardDescription>The payment clearance flow</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-col md:flex-row items-center justify-center gap-4 py-4">
                    <div className="flex flex-col items-center text-center p-4">
                      <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-2">
                        <span className="text-xl">📋</span>
                      </div>
                      <p className="font-medium">Registration Flags</p>
                      <p className="text-xs text-muted-foreground">Pending payment</p>
                    </div>
                    <div className="text-2xl">→</div>
                    <div className="flex flex-col items-center text-center p-4">
                      <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-2">
                        <span className="text-xl">💰</span>
                      </div>
                      <p className="font-medium">Debtor Processes</p>
                      <p className="text-xs text-muted-foreground">Payment cleared</p>
                    </div>
                    <div className="text-2xl">→</div>
                    <div className="flex flex-col items-center text-center p-4">
                      <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-2">
                        <span className="text-xl">✅</span>
                      </div>
                      <p className="font-medium">Status Updated</p>
                      <p className="text-xs text-muted-foreground">All dashboards sync</p>
                    </div>
                    <div className="text-2xl">→</div>
                    <div className="flex flex-col items-center text-center p-4">
                      <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-2">
                        <span className="text-xl">🎉</span>
                      </div>
                      <p className="font-medium">Trainee Notified</p>
                      <p className="text-xs text-muted-foreground">Ready to proceed</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default DebtorOfficerDashboard;
