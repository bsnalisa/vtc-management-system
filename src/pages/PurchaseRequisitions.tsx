import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DashboardLayout } from "@/components/DashboardLayout";
import { procurementNavItems } from "@/lib/navigationConfig";
import PurchaseRequisitionsTable from "@/components/procurement/PurchaseRequisitionsTable";
import PurchaseRequisitionDialog from "@/components/procurement/PurchaseRequisitionDialog";
import { usePurchaseRequisitions, PurchaseRequisition } from "@/hooks/useProcurement";

const PurchaseRequisitions = () => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedRequisition, setSelectedRequisition] = useState<PurchaseRequisition | null>(null);
  const { data: requisitions, isLoading } = usePurchaseRequisitions();

  const handleEdit = (requisition: PurchaseRequisition) => {
    setSelectedRequisition(requisition);
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setSelectedRequisition(null);
  };

  const draftRequisitions = requisitions?.filter(r => r.status === 'draft') || [];
  const pendingRequisitions = requisitions?.filter(r => r.status === 'pending') || [];
  const approvedRequisitions = requisitions?.filter(r => r.status === 'approved') || [];
  const rejectedRequisitions = requisitions?.filter(r => r.status === 'rejected') || [];

  return (
    <DashboardLayout
      title="Purchase Requisitions"
      subtitle="Request items for purchase approval"
      navItems={procurementNavItems}
      groupLabel="Procurement"
    >
      <div className="space-y-6">
        <div className="flex justify-end">
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            New Requisition
          </Button>
        </div>

        <Tabs defaultValue="all" className="space-y-4">
          <TabsList>
            <TabsTrigger value="all">All ({requisitions?.length || 0})</TabsTrigger>
            <TabsTrigger value="draft">Draft ({draftRequisitions.length})</TabsTrigger>
            <TabsTrigger value="pending">Pending ({pendingRequisitions.length})</TabsTrigger>
            <TabsTrigger value="approved">Approved ({approvedRequisitions.length})</TabsTrigger>
            <TabsTrigger value="rejected">Rejected ({rejectedRequisitions.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="all">
            <Card>
              <CardHeader>
                <CardTitle>All Requisitions</CardTitle>
                <CardDescription>View all purchase requisitions</CardDescription>
              </CardHeader>
              <CardContent>
                <PurchaseRequisitionsTable
                  requisitions={requisitions || []}
                  isLoading={isLoading}
                  onEdit={handleEdit}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="draft">
            <Card>
              <CardHeader>
                <CardTitle>Draft Requisitions</CardTitle>
                <CardDescription>Requisitions that haven't been submitted</CardDescription>
              </CardHeader>
              <CardContent>
                <PurchaseRequisitionsTable
                  requisitions={draftRequisitions}
                  isLoading={isLoading}
                  onEdit={handleEdit}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="pending">
            <Card>
              <CardHeader>
                <CardTitle>Pending Requisitions</CardTitle>
                <CardDescription>Requisitions awaiting approval</CardDescription>
              </CardHeader>
              <CardContent>
                <PurchaseRequisitionsTable
                  requisitions={pendingRequisitions}
                  isLoading={isLoading}
                  onEdit={handleEdit}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="approved">
            <Card>
              <CardHeader>
                <CardTitle>Approved Requisitions</CardTitle>
                <CardDescription>Requisitions ready for purchase orders</CardDescription>
              </CardHeader>
              <CardContent>
                <PurchaseRequisitionsTable
                  requisitions={approvedRequisitions}
                  isLoading={isLoading}
                  onEdit={handleEdit}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="rejected">
            <Card>
              <CardHeader>
                <CardTitle>Rejected Requisitions</CardTitle>
                <CardDescription>Requisitions that were not approved</CardDescription>
              </CardHeader>
              <CardContent>
                <PurchaseRequisitionsTable
                  requisitions={rejectedRequisitions}
                  isLoading={isLoading}
                  onEdit={handleEdit}
                />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <PurchaseRequisitionDialog
          open={dialogOpen}
          onOpenChange={handleCloseDialog}
          requisition={selectedRequisition}
        />
      </div>
    </DashboardLayout>
  );
};

export default PurchaseRequisitions;
