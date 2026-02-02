import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DashboardLayout } from "@/components/DashboardLayout";
import { debtorOfficerNavItems } from "@/lib/navigationConfig";
import { useProfile } from "@/hooks/useProfile";
import { DebtorStatsCards } from "@/components/debtor/DebtorStatsCards";
import { PaymentClearanceCenter } from "@/components/debtor/PaymentClearanceCenter";
import { HostelFeeManagement } from "@/components/debtor/HostelFeeManagement";
import { DollarSign, Building, FileText } from "lucide-react";
import { FeeRecordsTab } from "@/components/debtor/FeeRecordsTab";

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

        {/* Main Content Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="grid w-full grid-cols-3">
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
          </TabsList>

          <TabsContent value="clearances">
            <PaymentClearanceCenter />
          </TabsContent>

          <TabsContent value="hostel">
            <HostelFeeManagement />
          </TabsContent>

          <TabsContent value="fees">
            <FeeRecordsTab />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default DebtorOfficerDashboard;
