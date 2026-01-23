import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Package, TrendingDown, ArrowUpDown, Archive } from "lucide-react";
import { useLowStockItems, useStockItems } from "@/hooks/useStockItems";
import { useStockCategories } from "@/hooks/useStockCategories";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { withRoleAccess } from "@/components/withRoleAccess";
import { DashboardLayout } from "@/components/DashboardLayout";
import { stockControlNavItems } from "@/lib/navigationConfig";
import { useProfile } from "@/hooks/useProfile";

function StockControlOfficerDashboard() {
  const navigate = useNavigate();
  const { data: stockItems } = useStockItems();
  const { data: lowStockItems } = useLowStockItems();
  const { data: categories } = useStockCategories();
  const { data: profile } = useProfile();

  const totalValue = stockItems?.reduce((sum, item) => sum + (item.current_quantity * item.unit_cost), 0) || 0;
  const totalItems = stockItems?.length || 0;

  return (
    <DashboardLayout
      title={`Welcome back, ${profile?.firstname || 'User'}`}
      subtitle="Manage inventory and track stock movements"
      navItems={stockControlNavItems}
      groupLabel="Stock Control"
    >
      <div className="space-y-6">

      {lowStockItems && lowStockItems.length > 0 && (
        <Alert variant="destructive">
          <TrendingDown className="h-4 w-4" />
          <AlertDescription>
            {lowStockItems.length} item(s) are below reorder level and need restocking
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Items</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalItems}</div>
            <p className="text-xs text-muted-foreground">
              Across {categories?.length || 0} categories
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Value</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              R {totalValue.toLocaleString("en-ZA", { minimumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-muted-foreground">Current stock value</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Low Stock Alerts</CardTitle>
            <TrendingDown className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{lowStockItems?.length || 0}</div>
            <p className="text-xs text-muted-foreground">Items need restocking</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card className="hover:bg-accent cursor-pointer" onClick={() => navigate("/stock")}>
          <CardHeader>
            <Package className="h-8 w-8 mb-2 text-primary" />
            <CardTitle>Stock Management</CardTitle>
            <CardDescription>View and manage all stock items</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" className="w-full">
              Manage Stock
            </Button>
          </CardContent>
        </Card>

        <Card className="hover:bg-accent cursor-pointer" onClick={() => navigate("/stock")}>
          <CardHeader>
            <ArrowUpDown className="h-8 w-8 mb-2 text-primary" />
            <CardTitle>Stock Movements</CardTitle>
            <CardDescription>Record inflow, outflow, and adjustments</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" className="w-full">
              View Movements
            </Button>
          </CardContent>
        </Card>

        <Card className="hover:bg-accent cursor-pointer" onClick={() => navigate("/stock")}>
          <CardHeader>
            <Archive className="h-8 w-8 mb-2 text-primary" />
            <CardTitle>Categories</CardTitle>
            <CardDescription>Organize stock by categories</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" className="w-full">
              Manage Categories
            </Button>
          </CardContent>
        </Card>
      </div>

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
                    <p className="text-sm">
                      Current: {item.current_quantity} {item.unit_of_measure}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Reorder: {item.reorder_level} {item.unit_of_measure}
                    </p>
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
      </div>
    </DashboardLayout>
  );
}

export default withRoleAccess(StockControlOfficerDashboard, {
  requiredRoles: ["stock_control_officer", "admin", "super_admin"],
});
