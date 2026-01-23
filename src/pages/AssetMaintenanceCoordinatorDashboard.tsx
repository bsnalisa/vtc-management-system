import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Package, Wrench, TrendingDown, FileText } from "lucide-react";
import { useAssets } from "@/hooks/useAssets";
import { useAssetMaintenance } from "@/hooks/useAssetMaintenance";
import { withRoleAccess } from "@/components/withRoleAccess";
import { DashboardLayout } from "@/components/DashboardLayout";
import { assetMaintenanceNavItems } from "@/lib/navigationConfig";
import { useProfile } from "@/hooks/useProfile";

function AssetMaintenanceCoordinatorDashboard() {
  const navigate = useNavigate();
  const { data: assets } = useAssets();
  const { data: activeAssets } = useAssets("active");
  const { data: underRepairAssets } = useAssets("under_repair");
  const { data: maintenanceRecords } = useAssetMaintenance();
  const { data: profile } = useProfile();

  const totalValue = assets?.reduce((sum, asset) => sum + (asset.current_value || asset.purchase_cost), 0) || 0;
  const totalAssets = assets?.length || 0;
  const upcomingMaintenance = maintenanceRecords?.filter(
    m => m.next_maintenance_date && new Date(m.next_maintenance_date) <= new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
  ).length || 0;

  return (
    <DashboardLayout
      title={`Welcome back, ${profile?.firstname || 'User'}`}
      subtitle="Manage assets and maintenance schedules"
      navItems={assetMaintenanceNavItems}
      groupLabel="Asset Management"
    >
      <div className="space-y-6">

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Assets</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalAssets}</div>
            <p className="text-xs text-muted-foreground">Registered assets</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Value</CardTitle>
            <TrendingDown className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              R {totalValue.toLocaleString("en-ZA", { minimumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-muted-foreground">Current value</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Under Repair</CardTitle>
            <Wrench className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{underRepairAssets?.length || 0}</div>
            <p className="text-xs text-muted-foreground">Needs attention</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Upcoming Maintenance</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{upcomingMaintenance}</div>
            <p className="text-xs text-muted-foreground">Next 30 days</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card className="hover:bg-accent cursor-pointer" onClick={() => navigate("/assets")}>
          <CardHeader>
            <Package className="h-8 w-8 mb-2 text-primary" />
            <CardTitle>Asset Management</CardTitle>
            <CardDescription>Register and manage all organizational assets</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" className="w-full">
              Manage Assets
            </Button>
          </CardContent>
        </Card>

        <Card className="hover:bg-accent cursor-pointer" onClick={() => navigate("/assets")}>
          <CardHeader>
            <Wrench className="h-8 w-8 mb-2 text-primary" />
            <CardTitle>Maintenance Records</CardTitle>
            <CardDescription>Track repairs, inspections, and servicing</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" className="w-full">
              View Maintenance
            </Button>
          </CardContent>
        </Card>

        <Card className="hover:bg-accent cursor-pointer" onClick={() => navigate("/assets")}>
          <CardHeader>
            <TrendingDown className="h-8 w-8 mb-2 text-primary" />
            <CardTitle>Depreciation</CardTitle>
            <CardDescription>Calculate and track asset depreciation</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" className="w-full">
              View Depreciation
            </Button>
          </CardContent>
        </Card>
      </div>

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
      </div>
    </DashboardLayout>
  );
}

export default withRoleAccess(AssetMaintenanceCoordinatorDashboard, {
  requiredRoles: ["asset_maintenance_coordinator", "admin", "super_admin"],
});
