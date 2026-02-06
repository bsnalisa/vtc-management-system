import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DashboardLayout } from "@/components/DashboardLayout";
import { debtorOfficerNavItems } from "@/lib/navigationConfig";
import { useProfile } from "@/hooks/useProfile";
import { DebtorDashboardStats } from "@/components/debtor/DebtorDashboardStats";
import { PaymentClearancePage } from "@/components/debtor/PaymentClearancePage";
import { TraineeAccountsView } from "@/components/debtor/TraineeAccountsView";
import { FeeTypesManager } from "@/components/fees/FeeTypesManager";
import { LayoutDashboard, CreditCard, Wallet, Tag } from "lucide-react";

const DebtorOfficerDashboard = () => {
  const { data: profile } = useProfile();
  const [activeTab, setActiveTab] = useState("overview");

  return (
    <DashboardLayout
      title={`Welcome back, ${profile?.firstname || "User"}`}
      subtitle="Trainee Accounts - Process fees and manage financial clearances"
      navItems={debtorOfficerNavItems}
      groupLabel="Financial Operations"
    >
      <div className="space-y-6">
        {/* Main Content Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview" className="flex items-center gap-2">
              <LayoutDashboard className="h-4 w-4" />
              <span className="hidden sm:inline">Overview</span>
            </TabsTrigger>
            <TabsTrigger value="clearance" className="flex items-center gap-2">
              <CreditCard className="h-4 w-4" />
              <span className="hidden sm:inline">Clearance</span>
            </TabsTrigger>
            <TabsTrigger value="accounts" className="flex items-center gap-2">
              <Wallet className="h-4 w-4" />
              <span className="hidden sm:inline">Accounts</span>
            </TabsTrigger>
            <TabsTrigger value="config" className="flex items-center gap-2">
              <Tag className="h-4 w-4" />
              <span className="hidden sm:inline">Fee Config</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <DebtorDashboardStats />
          </TabsContent>

          <TabsContent value="clearance">
            <PaymentClearancePage />
          </TabsContent>

          <TabsContent value="accounts">
            <TraineeAccountsView />
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
