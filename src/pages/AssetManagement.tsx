import { useState } from "react";
import { Plus, Package, Wrench, TrendingDown, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ModuleAccessGate } from "@/components/ModuleAccessGate";
import { useAssets } from "@/hooks/useAssets";
import { AssetsTable } from "@/components/assets/AssetsTable";
import { AssetDialog } from "@/components/assets/AssetDialog";
import { AssetCategoryDialog } from "@/components/assets/AssetCategoryDialog";
import { OnboardingWizard } from "@/components/onboarding/OnboardingWizard";

export default function AssetManagement() {
  const [showAssetDialog, setShowAssetDialog] = useState(false);
  const [showCategoryDialog, setShowCategoryDialog] = useState(false);
  
  const { data: assets, isLoading } = useAssets();
  const { data: activeAssets } = useAssets("active");
  const { data: underRepairAssets } = useAssets("under_repair");

  const totalValue = assets?.reduce((sum, asset) => sum + (asset.current_value || asset.purchase_cost), 0) || 0;
  const totalAssets = assets?.length || 0;

  return (
    <ModuleAccessGate moduleCode="ASSET_MANAGEMENT">
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Asset Management</h1>
            <p className="text-muted-foreground">Track and manage organizational assets and equipment</p>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => setShowCategoryDialog(true)} variant="outline">
              <Package className="h-4 w-4 mr-2" />
              Categories
            </Button>
            <Button onClick={() => setShowAssetDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Asset
            </Button>
          </div>
        </div>

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
              <p className="text-xs text-muted-foreground">Current asset value</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{activeAssets?.length || 0}</div>
              <p className="text-xs text-muted-foreground">Assets in use</p>
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
        </div>

        <Tabs defaultValue="all" className="space-y-4">
          <TabsList>
            <TabsTrigger value="all">All Assets</TabsTrigger>
            <TabsTrigger value="active">Active</TabsTrigger>
            <TabsTrigger value="repair">Under Repair</TabsTrigger>
            <TabsTrigger value="disposed">Disposed</TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="space-y-4">
            {(!assets || assets.length === 0) ? (
              <OnboardingWizard type="assets" />
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle>All Assets</CardTitle>
                  <CardDescription>Complete asset inventory</CardDescription>
                </CardHeader>
                <CardContent>
                  <AssetsTable assets={assets || []} loading={isLoading} />
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="active" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Active Assets</CardTitle>
                <CardDescription>Currently deployed assets</CardDescription>
              </CardHeader>
              <CardContent>
                <AssetsTable assets={activeAssets || []} loading={isLoading} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="repair" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Under Repair</CardTitle>
                <CardDescription>Assets requiring maintenance</CardDescription>
              </CardHeader>
              <CardContent>
                <AssetsTable assets={underRepairAssets || []} loading={isLoading} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="disposed" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Disposed Assets</CardTitle>
                <CardDescription>Retired or disposed assets</CardDescription>
              </CardHeader>
              <CardContent>
                <AssetsTable assets={assets?.filter(a => a.status === "disposed") || []} loading={isLoading} />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <AssetDialog open={showAssetDialog} onOpenChange={setShowAssetDialog} />
        <AssetCategoryDialog open={showCategoryDialog} onOpenChange={setShowCategoryDialog} />
      </div>
    </ModuleAccessGate>
  );
}
