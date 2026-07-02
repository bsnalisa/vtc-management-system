import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Package, TrendingDown, ArrowUpDown, Archive, Boxes } from "lucide-react";
import { useLowStockItems, useStockItems } from "@/hooks/useStockItems";
import { useStockCategories } from "@/hooks/useStockCategories";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { withRoleAccess } from "@/components/withRoleAccess";
import { DashboardLayout } from "@/components/DashboardLayout";
import { stockControlNavItems } from "@/lib/navigationConfig";
import { useProfile } from "@/hooks/useProfile";
import { DashboardShell } from "@/components/dashboard/DashboardShell";

function StockControlOfficerDashboard() {
  const navigate = useNavigate();
  const { data: stockItems, isLoading } = useStockItems();
  const { data: lowStockItems } = useLowStockItems();
  const { data: categories } = useStockCategories();
  const { data: profile } = useProfile();

  const totalValue = stockItems?.reduce((sum, item) => sum + (item.current_quantity * item.unit_cost), 0) || 0;
  const totalItems = stockItems?.length || 0;
  const lowCount = lowStockItems?.length || 0;

  return (
    <DashboardLayout
      title={`Welcome back, ${profile?.firstname || "User"}`}
      subtitle="Manage inventory and track stock movements"
      navItems={stockControlNavItems}
      groupLabel="Stock Control"
    >
      <DashboardShell
        name={profile?.firstname || undefined}
        heroIcon={Boxes}
        heroSubtitle="Inventory, movements and reorder alerts at a glance."
        stats={[
          { label: "Total Items", value: totalItems, icon: Package, hint: `${categories?.length || 0} categories`, loading: isLoading },
          { label: "Total Value", value: `R ${totalValue.toLocaleString("en-ZA", { maximumFractionDigits: 0 })}`, icon: Archive, hint: "Current stock value", tone: "accent", loading: isLoading },
          { label: "Low Stock", value: lowCount, icon: TrendingDown, hint: "Need restocking", tone: lowCount > 0 ? "destructive" : "secondary" },
          { label: "Categories", value: categories?.length || 0, icon: Archive, hint: "Configured groups", tone: "secondary" },
        ]}
        actions={[
          { icon: Package, label: "Stock Items", desc: "Browse & manage", url: "/stock" },
          { icon: ArrowUpDown, label: "Movements", desc: "In / out / adjust", url: "/stock" },
          { icon: Archive, label: "Categories", desc: "Organise inventory", url: "/stock" },
          { icon: TrendingDown, label: "Reorder List", desc: "Low stock queue", url: "/stock", badge: lowCount || undefined },
        ]}
        actionCols={4}
      >
        {lowStockItems && lowStockItems.length > 0 && (
          <Alert variant="destructive">
            <TrendingDown className="h-4 w-4" />
            <AlertDescription>
              {lowStockItems.length} item(s) are below reorder level and need restocking
            </AlertDescription>
          </Alert>
        )}

        {lowStockItems && lowStockItems.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Low Stock Items</CardTitle>
              <CardDescription>Items that need restocking</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {lowStockItems.slice(0, 5).map((item) => (
                  <div key={item.id} className="flex justify-between items-center border-b pb-2">
                    <div>
                      <p className="font-medium">{item.item_name}</p>
                      <p className="text-sm text-muted-foreground">{item.item_code}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm">Current: {item.current_quantity} {item.unit_of_measure}</p>
                      <p className="text-xs text-muted-foreground">Reorder: {item.reorder_level} {item.unit_of_measure}</p>
                    </div>
                  </div>
                ))}
                {lowStockItems.length > 5 && (
                  <Button variant="link" onClick={() => navigate("/stock")} className="w-full">
                    View all {lowStockItems.length} low stock items
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

export default withRoleAccess(StockControlOfficerDashboard, {
  requiredRoles: ["stock_control_officer", "admin", "super_admin"],
});
