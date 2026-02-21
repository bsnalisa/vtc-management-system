import { DashboardLayout } from "@/components/DashboardLayout";
import { useRoleNavigation } from "@/hooks/useRoleNavigation";
import { FeeTypesManager } from "@/components/fees/FeeTypesManager";

const FeeConfiguration = () => {
  const { navItems, groupLabel } = useRoleNavigation();
  return (
    <DashboardLayout
      title="Fee Configuration"
      subtitle="Manage fee types and amounts"
      navItems={navItems}
      groupLabel={groupLabel}
    >
      <FeeTypesManager />
    </DashboardLayout>
  );
};

export default FeeConfiguration;
