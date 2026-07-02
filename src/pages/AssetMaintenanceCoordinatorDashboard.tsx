import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Package, Wrench, TrendingDown, FileText, HardHat } from "lucide-react";
import { useAssets } from "@/hooks/useAssets";
import { useAssetMaintenance } from "@/hooks/useAssetMaintenance";
import { withRoleAccess } from "@/components/withRoleAccess";
import { DashboardLayout } from "@/components/DashboardLayout";
import { assetMaintenanceNavItems } from "@/lib/navigationConfig";
import { useProfile } from "@/hooks/useProfile";
import { DashboardShell } from "@/components/dashboard/DashboardShell";

function AssetMaintenanceCoordinatorDashboard() {
  const navigate = useNavigate();
  const { data: assets, isLoading } = useAssets();
  const { data: underRepairAssets } = useAssets("under_repair");
  const { data: maintenanceRecords } = useAssetMaintenance();
  const { data: profile } = useProfile();

  const totalValue = assets?.reduce((sum, a) => sum + (a.current_value || a.purchase_cost), 0) || 0;
  const totalAssets = assets?.length || 0;
  const upcomingMaintenance = maintenanceRecords?.filter(
    (m) => m.next_maintenance_date && new Date(m.next_maintenance_date) <= new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
  ).length || 0;
  const repairCount = underRepairAssets?.length || 0;

  return (
    <DashboardLayout
      title={`Welcome back, ${profile?.firstname || "User"}`}
      subtitle="Manage assets and maintenance schedules"
      navItems={assetMaintenanceNavItems}
      groupLabel="Asset Management"
    >
      <DashboardShell
        name={profile?.firstname || undefined}
        heroIcon={HardHat}
        heroSubtitle="Track assets, servicing and repair operations."
        stats={[
          { label: "Total Assets", value: totalAssets, icon: Package, hint: "Registered assets", loading: isLoading },
          { label: "Total Value", value: `R ${totalValue.toLocaleString("en-ZA", { maximumFractionDigits: 0 })}`, icon: TrendingDown, hint: "Current value", tone: "accent" },
          { label: "Under Repair", value: repairCount, icon: Wrench, hint: "Needs attention", tone: repairCount > 0 ? "destructive" : "secondary" },
          { label: "Upcoming Service", value: upcomingMaintenance, icon: FileText, hint: "Next 30 days", tone: "secondary" },
        ]}
        actions={[
          { icon: Package, label: "Assets", desc: "Register & manage", url: "/assets" },
          { icon: Wrench, label: "Maintenance", desc: "Repairs & inspections", url: "/assets", badge: repairCount || undefined },
          { icon: TrendingDown, label: "Depreciation", desc: "Value tracking", url: "/assets" },
          { icon: FileText, label: "Schedule", desc: "Upcoming servicing", url: "/assets", badge: upcomingMaintenance || undefined },
        ]}
        actionCols={4}
      >
        {underRepairAssets && underRepairAssets.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Assets Under Repair</CardTitle>
              <CardDescription>Assets requiring immediate attention</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {underRepairAssets.slice(0, 5).map((asset) => (
                  <div key={asset.id} className="flex justify-between items-center border-b pb-2">
                    <div>
                      <p className="font-medium">{asset.asset_name}</p>
                      <p className="text-sm text-muted-foreground">{asset.asset_code}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm capitalize">{asset.condition.replace("_", " ")}</p>
                      <p className="text-xs text-muted-foreground">{asset.location || "No location"}</p>
                    </div>
                  </div>
                ))}
                {underRepairAssets.length > 5 && (
                  <Button variant="link" onClick={() => navigate("/assets")} className="w-full">
                    View all {underRepairAssets.length} assets
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </DashboardShell>
    </DashboardLayout>
  );
}

export default withRoleAccess(AssetMaintenanceCoordinatorDashboard, {
  requiredRoles: ["asset_maintenance_coordinator", "admin", "super_admin"],
});
