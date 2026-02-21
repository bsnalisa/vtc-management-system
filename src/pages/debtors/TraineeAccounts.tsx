import { DashboardLayout } from "@/components/DashboardLayout";
import { useRoleNavigation } from "@/hooks/useRoleNavigation";
import { TraineeAccountsView } from "@/components/debtor/TraineeAccountsView";

const TraineeAccountsPage = () => {
  const { navItems, groupLabel } = useRoleNavigation();
  return (
    <DashboardLayout
      title="Trainee Accounts"
      subtitle="Read-only view of trainee financial profiles"
      navItems={navItems}
      groupLabel={groupLabel}
    >
      <TraineeAccountsView />
    </DashboardLayout>
  );
};

export default TraineeAccountsPage;
