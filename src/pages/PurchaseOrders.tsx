import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useRoleNavigation } from "@/hooks/useRoleNavigation";
import PurchaseOrdersTable from "@/components/procurement/PurchaseOrdersTable";
import PurchaseOrderDialog from "@/components/procurement/PurchaseOrderDialog";
import { usePurchaseOrders, PurchaseOrder } from "@/hooks/useProcurement";

const PurchaseOrders = () => {
  const { navItems, groupLabel } = useRoleNavigation();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<PurchaseOrder | null>(null);
  const { data: orders, isLoading } = usePurchaseOrders();

  const handleEdit = (order: PurchaseOrder) => {
    setSelectedOrder(order);
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setSelectedOrder(null);
  };

  const draftOrders = orders?.filter(o => o.status === 'draft') || [];
  const sentOrders = orders?.filter(o => o.status === 'sent') || [];
  const receivedOrders = orders?.filter(o => o.status === 'received') || [];
  const completedOrders = orders?.filter(o => o.status === 'completed') || [];

  return (
    <DashboardLayout
      title="Purchase Orders"
      subtitle="Create and manage purchase orders"
      navItems={navItems}
      groupLabel={groupLabel}
    >
      <div className="space-y-6">
        <div className="flex justify-end">
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            New Purchase Order
          </Button>
        </div>

        <Tabs defaultValue="all" className="space-y-4">
          <TabsList>
            <TabsTrigger value="all">All ({orders?.length || 0})</TabsTrigger>
            <TabsTrigger value="draft">Draft ({draftOrders.length})</TabsTrigger>
            <TabsTrigger value="sent">Sent ({sentOrders.length})</TabsTrigger>
            <TabsTrigger value="received">Received ({receivedOrders.length})</TabsTrigger>
            <TabsTrigger value="completed">Completed ({completedOrders.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="all">
            <Card>
              <CardHeader>
                <CardTitle>All Purchase Orders</CardTitle>
                <CardDescription>View all purchase orders</CardDescription>
              </CardHeader>
              <CardContent>
                <PurchaseOrdersTable
                  orders={orders || []}
                  isLoading={isLoading}
                  onEdit={handleEdit}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="draft">
            <Card>
              <CardHeader>
                <CardTitle>Draft Orders</CardTitle>
                <CardDescription>Orders not yet sent to suppliers</CardDescription>
              </CardHeader>
              <CardContent>
                <PurchaseOrdersTable
                  orders={draftOrders}
                  isLoading={isLoading}
                  onEdit={handleEdit}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="sent">
            <Card>
              <CardHeader>
                <CardTitle>Sent Orders</CardTitle>
                <CardDescription>Orders awaiting delivery</CardDescription>
              </CardHeader>
              <CardContent>
                <PurchaseOrdersTable
                  orders={sentOrders}
                  isLoading={isLoading}
                  onEdit={handleEdit}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="received">
            <Card>
              <CardHeader>
                <CardTitle>Received Orders</CardTitle>
                <CardDescription>Orders being inspected</CardDescription>
              </CardHeader>
              <CardContent>
                <PurchaseOrdersTable
                  orders={receivedOrders}
                  isLoading={isLoading}
                  onEdit={handleEdit}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="completed">
            <Card>
              <CardHeader>
                <CardTitle>Completed Orders</CardTitle>
                <CardDescription>Fully received and processed</CardDescription>
              </CardHeader>
              <CardContent>
                <PurchaseOrdersTable
                  orders={completedOrders}
                  isLoading={isLoading}
                  onEdit={handleEdit}
                />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <PurchaseOrderDialog
          open={dialogOpen}
          onOpenChange={handleCloseDialog}
          order={selectedOrder}
        />
      </div>
    </DashboardLayout>
  );
};

export default PurchaseOrders;
