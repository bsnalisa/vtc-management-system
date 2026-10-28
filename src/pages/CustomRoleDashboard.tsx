import { DashboardLayout } from "@/components/DashboardLayout";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { WidgetRenderer } from "@/components/dashboard/widgets/WidgetRenderer";
import { useMyDashboard } from "@/hooks/useRoleFactory";
import { useOrganizationContext } from "@/hooks/useOrganizationContext";
import { useRoleNavigation } from "@/hooks/useRoleNavigation";

// The dashboard of the roles made in the role factory: only the widgets the approved role includes
export default function CustomRoleDashboard() {
  const { navItems, groupLabel } = useRoleNavigation();
  const { organizationId } = useOrganizationContext();
  const { data, isLoading, error } = useMyDashboard(organizationId);
  return (
    <DashboardLayout title="My role dashboard" subtitle="Figures for the roles you hold" navItems={navItems} groupLabel={groupLabel}>
      <div className="space-y-4">
        {isLoading && <LoadingSpinner text="Loading..." className="py-8" />}
        {error && <Alert variant="destructive"><AlertDescription>{(error as Error).message}</AlertDescription></Alert>}
        {data && (
          <>
            <div className="flex flex-wrap items-center gap-2 text-sm"><span className="text-muted-foreground">Your roles:</span>{data.roles.map((r) => <Badge key={r} variant="secondary">{r}</Badge>)}</div>
            {!data.widgets.length && <Alert><AlertDescription>Your role has no dashboard widgets yet. Ask the Super Admin which figures it should show.</AlertDescription></Alert>}
            <div className="grid gap-4 lg:grid-cols-2">
              {organizationId && data.widgets.map((w) => <div key={w.code} className={w.kind === "table" || w.kind === "stats" ? "lg:col-span-2" : ""}><WidgetRenderer org={organizationId} widget={w} /></div>)}
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
