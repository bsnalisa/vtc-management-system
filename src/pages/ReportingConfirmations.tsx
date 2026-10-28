import { DashboardLayout } from "@/components/DashboardLayout";
import { withRoleAccess } from "@/components/withRoleAccess";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { ChangeRequestsList } from "@/components/workflow/ChangeRequestsList";
import { useRoleNavigation } from "@/hooks/useRoleNavigation";
import { useChangeRequests } from "@/hooks/useReportingStructure";

// The Super Admin confirms changes to the reporting line of the Accountant, Head of Finance and Administration and Centre Manager
function ReportingConfirmations() {
  const { navItems, groupLabel } = useRoleNavigation();
  const { data, isLoading, error } = useChangeRequests(true);
  const pending = (data ?? []).filter((r) => r.status === "pending");
  const decided = (data ?? []).filter((r) => r.status !== "pending");
  return (
    <DashboardLayout title="Reporting confirmations" subtitle="Changes to who approves money and centre decisions" navItems={navItems} groupLabel={groupLabel}>
      <div className="mx-auto max-w-4xl space-y-6">
        {isLoading && <LoadingSpinner text="Loading..." className="py-8" />}
        {error && <Alert variant="destructive"><AlertDescription>{(error as Error).message}</AlertDescription></Alert>}
        <Card>
          <CardHeader><CardTitle>Waiting for you</CardTitle><CardDescription>Organisation Admins request these; nothing changes until you confirm.</CardDescription></CardHeader>
          <CardContent><ChangeRequestsList rows={pending} canDecide showCentre /></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Recently decided</CardTitle></CardHeader>
          <CardContent><ChangeRequestsList rows={decided} canDecide={false} showCentre /></CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
export default withRoleAccess(ReportingConfirmations, { requiredRoles: ["super_admin"] });
