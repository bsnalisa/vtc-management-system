import { useState } from "react";
import { Plus, Package, TrendingDown, Archive, ArrowUpDown, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ModuleAccessGate } from "@/components/ModuleAccessGate";
import { useStockItems, useLowStockItems } from "@/hooks/useStockItems";
import { useStockCategories } from "@/hooks/useStockCategories";
import { useStockAlertCount } from "@/hooks/useStockAlerts";
import { StockItemsTable } from "@/components/stock/StockItemsTable";
import { StockMovementsTable } from "@/components/stock/StockMovementsTable";
import { StockCategoriesTable } from "@/components/stock/StockCategoriesTable";
import { StockItemDialog } from "@/components/stock/StockItemDialog";
import { StockMovementDialog } from "@/components/stock/StockMovementDialog";
import { StockCategoryDialog } from "@/components/stock/StockCategoryDialog";
import { StockAlertsPanel } from "@/components/stock/StockAlertsPanel";
import { OnboardingWizard } from "@/components/onboarding/OnboardingWizard";

export default function StockManagement() {
  const [showItemDialog, setShowItemDialog] = useState(false);
  const [showMovementDialog, setShowMovementDialog] = useState(false);
  const [showCategoryDialog, setShowCategoryDialog] = useState(false);

  const { data: stockItems, isLoading: itemsLoading } = useStockItems();
  const { data: lowStockItems } = useLowStockItems();
  const { data: categories, isLoading: categoriesLoading } = useStockCategories();

  const totalValue = stockItems?.reduce((sum, item) => sum + (item.current_quantity * item.unit_cost), 0) || 0;
  const totalItems = stockItems?.length || 0;

  return (
    <ModuleAccessGate moduleCode="STOCK_CONTROL">
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Stock / Inventory Control</h1>
            <p className="text-muted-foreground">Manage consumables, materials, and workshop tools</p>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => setShowCategoryDialog(true)} variant="outline">
              <Archive className="h-4 w-4 mr-2" />
              Categories
            </Button>
            <Button onClick={() => setShowMovementDialog(true)} variant="outline">
              <ArrowUpDown className="h-4 w-4 mr-2" />
              Record Movement
            </Button>
            <Button onClick={() => setShowItemDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Stock Item
            </Button>
          </div>
        </div>

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
              <CardTitle className="text-sm font-medium">Low Stock</CardTitle>
              <TrendingDown className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{lowStockItems?.length || 0}</div>
              <p className="text-xs text-muted-foreground">Items need restocking</p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="items" className="space-y-4">
          <TabsList>
            <TabsTrigger value="items">Stock Items</TabsTrigger>
            <TabsTrigger value="movements">Stock Movements</TabsTrigger>
            <TabsTrigger value="categories">Categories</TabsTrigger>
            <TabsTrigger value="alerts">
              <AlertTriangle className="h-4 w-4 mr-1" />
              Alerts
            </TabsTrigger>
          </TabsList>

          <TabsContent value="items" className="space-y-4">
            {(!stockItems || stockItems.length === 0) && (!categories || categories.length === 0) ? (
              <OnboardingWizard type="stock" />
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle>Stock Items</CardTitle>
                  <CardDescription>Manage your inventory items and track quantities</CardDescription>
                </CardHeader>
                <CardContent>
                  <StockItemsTable items={stockItems || []} loading={itemsLoading} />
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="movements" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Stock Movements</CardTitle>
                <CardDescription>Track inflow, outflow, and adjustments</CardDescription>
              </CardHeader>
              <CardContent>
                <StockMovementsTable />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="categories" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Stock Categories</CardTitle>
                <CardDescription>Organize stock items by category</CardDescription>
              </CardHeader>
              <CardContent>
                <StockCategoriesTable categories={categories || []} loading={categoriesLoading} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="alerts" className="space-y-4">
            <StockAlertsPanel />
          </TabsContent>
        </Tabs>

        <StockItemDialog open={showItemDialog} onOpenChange={setShowItemDialog} />
        <StockMovementDialog open={showMovementDialog} onOpenChange={setShowMovementDialog} />
        <StockCategoryDialog open={showCategoryDialog} onOpenChange={setShowCategoryDialog} />
      </div>
    </ModuleAccessGate>
  );
}
