import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DashboardLayout } from "@/components/DashboardLayout";
import { debtorOfficerNavItems } from "@/lib/navigationConfig";
import { useProfile } from "@/hooks/useProfile";
import { DebtorStatsCards } from "@/components/debtor/DebtorStatsCards";
import { PaymentClearanceCenter } from "@/components/debtor/PaymentClearanceCenter";
import { HostelFeeManagement } from "@/components/debtor/HostelFeeManagement";
import { FeeRecordsTab } from "@/components/debtor/FeeRecordsTab";
import { FeeTypesManager } from "@/components/fees/FeeTypesManager";
import { TraineeFinancialList } from "@/components/fees/TraineeFinancialList";
import { DollarSign, Building, FileText, Tag, Users } from "lucide-react";

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
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="clearances" className="flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              <span className="hidden sm:inline">Clearance</span>
            </TabsTrigger>
            <TabsTrigger value="trainees" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">Trainees</span>
            </TabsTrigger>
            <TabsTrigger value="hostel" className="flex items-center gap-2">
              <Building className="h-4 w-4" />
              <span className="hidden sm:inline">Hostel</span>
            </TabsTrigger>
            <TabsTrigger value="fees" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              <span className="hidden sm:inline">Records</span>
            </TabsTrigger>
            <TabsTrigger value="config" className="flex items-center gap-2">
              <Tag className="h-4 w-4" />
              <span className="hidden sm:inline">Fee Types</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="clearances">
            <PaymentClearanceCenter />
          </TabsContent>

          <TabsContent value="trainees">
            <TraineeFinancialList />
          </TabsContent>

          <TabsContent value="hostel">
            <HostelFeeManagement />
          </TabsContent>

          <TabsContent value="fees">
            <FeeRecordsTab />
          </TabsContent>

          <TabsContent value="config">
            <FeeTypesManager />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default DebtorOfficerDashboard;
