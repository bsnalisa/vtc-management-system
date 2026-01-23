import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { usePurchaseRequisitions, usePurchaseOrders, useSuppliers } from "@/hooks/useProcurement";
import { Package, FileText, Users, TrendingUp } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { procurementNavItems } from "@/lib/navigationConfig";
import { useProfile } from "@/hooks/useProfile";

export default function ProcurementOfficerDashboard() {
  const navigate = useNavigate();
  const { data: requisitions = [], isLoading: loadingRequisitions } = usePurchaseRequisitions();
  const { data: orders = [], isLoading: loadingOrders } = usePurchaseOrders();
  const { data: suppliers = [], isLoading: loadingSuppliers } = useSuppliers();
  const { data: profile } = useProfile();

  const pendingRequisitions = requisitions.filter(r => r.status === 'pending_approval').length;
  const activeOrders = orders.filter(o => o.status === 'sent' || o.status === 'acknowledged').length;
  const totalSpent = orders.reduce((sum, o) => sum + Number(o.grand_total), 0);

  const stats = [
    {
      title: "Pending Requisitions",
      value: pendingRequisitions,
      icon: FileText,
      color: "text-orange-600",
      bgColor: "bg-orange-50",
    },
    {
      title: "Active Orders",
      value: activeOrders,
      icon: Package,
      color: "text-blue-600",
      bgColor: "bg-blue-50",
    },
    {
      title: "Active Suppliers",
      value: suppliers.length,
      icon: Users,
      color: "text-green-600",
      bgColor: "bg-green-50",
    },
    {
      title: "Total Spent",
      value: `$${totalSpent.toFixed(2)}`,
      icon: TrendingUp,
      color: "text-purple-600",
      bgColor: "bg-purple-50",
    },
  ];

  return (
    <DashboardLayout
      title={`Welcome back, ${profile?.firstname || 'User'}`}
      subtitle="Manage suppliers, requisitions, and purchase orders"
      navItems={procurementNavItems}
      groupLabel="Procurement"
    >
      <div className="space-y-6">

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.title}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {stat.title}
                </CardTitle>
                <div className={`p-2 rounded-lg ${stat.bgColor}`}>
                  <Icon className={`h-4 w-4 ${stat.color}`} />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="requisitions">Requisitions</TabsTrigger>
          <TabsTrigger value="orders">Purchase Orders</TabsTrigger>
          <TabsTrigger value="suppliers">Suppliers</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Recent Requisitions</CardTitle>
              </CardHeader>
              <CardContent>
                {loadingRequisitions ? (
                  <p className="text-muted-foreground">Loading...</p>
                ) : requisitions.length === 0 ? (
                  <p className="text-muted-foreground">No requisitions yet</p>
                ) : (
                  <div className="space-y-2">
                    {requisitions.slice(0, 5).map((req) => (
                      <div key={req.id} className="flex justify-between items-center p-2 border rounded">
                        <span className="font-medium">{req.requisition_number}</span>
                        <span className={`text-sm px-2 py-1 rounded ${
                          req.status === 'approved' ? 'bg-green-100 text-green-800' :
                          req.status === 'pending_approval' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {req.status.replace('_', ' ')}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Recent Orders</CardTitle>
              </CardHeader>
              <CardContent>
                {loadingOrders ? (
                  <p className="text-muted-foreground">Loading...</p>
                ) : orders.length === 0 ? (
                  <p className="text-muted-foreground">No orders yet</p>
                ) : (
                  <div className="space-y-2">
                    {orders.slice(0, 5).map((order) => (
                      <div key={order.id} className="flex justify-between items-center p-2 border rounded">
                        <div>
                          <span className="font-medium block">{order.po_number}</span>
                          <span className="text-sm text-muted-foreground">{order.suppliers?.name}</span>
                        </div>
                        <span className="font-semibold">${Number(order.grand_total).toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="requisitions">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>Purchase Requisitions</CardTitle>
                <Button onClick={() => navigate("/purchase-requisitions")}>
                  Manage Requisitions
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                View and manage all purchase requisitions from here.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="orders">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>Purchase Orders</CardTitle>
                <Button onClick={() => navigate("/purchase-orders")}>
                  Manage Orders
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Create and track purchase orders with suppliers.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="suppliers">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>Supplier Management</CardTitle>
                <Button onClick={() => navigate("/suppliers")}>
                  Manage Suppliers
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Manage supplier records and contact information.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      </div>
    </DashboardLayout>
  );
}
