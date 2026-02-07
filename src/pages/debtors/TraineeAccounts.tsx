import { DashboardLayout } from "@/components/DashboardLayout";
import { debtorOfficerNavItems } from "@/lib/navigationConfig";
import { TraineeAccountsView } from "@/components/debtor/TraineeAccountsView";

const TraineeAccountsPage = () => {
  return (
    <DashboardLayout
      title="Trainee Accounts"
      subtitle="Read-only view of trainee financial profiles"
      navItems={debtorOfficerNavItems}
      groupLabel="Financial Operations"
    >
      <TraineeAccountsView />
    </DashboardLayout>
  );
};

export default TraineeAccountsPage;
