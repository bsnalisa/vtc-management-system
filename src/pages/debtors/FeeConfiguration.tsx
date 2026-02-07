import { DashboardLayout } from "@/components/DashboardLayout";
import { debtorOfficerNavItems } from "@/lib/navigationConfig";
import { FeeTypesManager } from "@/components/fees/FeeTypesManager";

const FeeConfiguration = () => {
  return (
    <DashboardLayout
      title="Fee Configuration"
      subtitle="Manage fee types and amounts"
      navItems={debtorOfficerNavItems}
      groupLabel="Financial Operations"
    >
      <FeeTypesManager />
    </DashboardLayout>
  );
};

export default FeeConfiguration;
