import { DashboardLayout } from "@/components/DashboardLayout";
import { withRoleAccess } from "@/components/withRoleAccess";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { AssignmentsPanel } from "@/components/rolefactory/AssignmentsPanel";
import { useOrganizationContext } from "@/hooks/useOrganizationContext";
import { useRoleNavigation } from "@/hooks/useRoleNavigation";

function RoleAssignments() {
  const { navItems, groupLabel } = useRoleNavigation();
  const { organizationId } = useOrganizationContext();
  return (
    <DashboardLayout title="Custom roles" subtitle="Give staff the roles the Super Admin has approved" navItems={navItems} groupLabel={groupLabel}>
      <Card><CardHeader><CardTitle>Role assignments</CardTitle><CardDescription>Roles defined and approved by the Super Admin.</CardDescription></CardHeader>
        <CardContent><AssignmentsPanel org={organizationId} /></CardContent></Card>
    </DashboardLayout>
  );
}
export default withRoleAccess(RoleAssignments, { requiredRoles: ["organization_admin", "admin"] });
