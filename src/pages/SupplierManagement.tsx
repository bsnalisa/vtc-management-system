import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DashboardLayout } from "@/components/DashboardLayout";
import { procurementNavItems } from "@/lib/navigationConfig";
import SuppliersTable from "@/components/procurement/SuppliersTable";
import SupplierDialog from "@/components/procurement/SupplierDialog";
import { useSuppliers, Supplier } from "@/hooks/useProcurement";

const SupplierManagement = () => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const { data: suppliers, isLoading } = useSuppliers();

  const handleEdit = (supplier: Supplier) => {
    setSelectedSupplier(supplier);
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setSelectedSupplier(null);
  };

  return (
    <DashboardLayout
      title="Supplier Management"
      subtitle="Manage suppliers and their contact information"
      navItems={procurementNavItems}
      groupLabel="Procurement"
    >
      <div className="space-y-6">
        <div className="flex justify-end">
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Supplier
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Suppliers</CardTitle>
            <CardDescription>View and manage all registered suppliers</CardDescription>
          </CardHeader>
          <CardContent>
            <SuppliersTable
              suppliers={suppliers || []}
              isLoading={isLoading}
              onEdit={handleEdit}
            />
          </CardContent>
        </Card>

        <SupplierDialog
          open={dialogOpen}
          onOpenChange={handleCloseDialog}
          supplier={selectedSupplier}
        />
      </div>
    </DashboardLayout>
  );
};

export default SupplierManagement;
