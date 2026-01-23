import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DashboardLayout } from "@/components/DashboardLayout";
import { procurementNavItems } from "@/lib/navigationConfig";
import ReceivingReportsTable from "@/components/procurement/ReceivingReportsTable";
import ReceivingReportDialog from "@/components/procurement/ReceivingReportDialog";
import { useReceivingReports } from "@/hooks/useProcurement";

const ReceivingReports = () => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedReport, setSelectedReport] = useState<any>(null);
  const { data: reports, isLoading } = useReceivingReports();

  const handleEdit = (report: any) => {
    setSelectedReport(report);
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setSelectedReport(null);
  };

  return (
    <DashboardLayout
      title="Receiving Reports"
      subtitle="Track and verify received goods"
      navItems={procurementNavItems}
      groupLabel="Procurement"
    >
      <div className="space-y-6">
        <div className="flex justify-end">
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            New Receiving Report
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>All Receiving Reports</CardTitle>
            <CardDescription>View and manage goods receiving documentation</CardDescription>
          </CardHeader>
          <CardContent>
            <ReceivingReportsTable
              reports={reports || []}
              isLoading={isLoading}
              onEdit={handleEdit}
            />
          </CardContent>
        </Card>

        <ReceivingReportDialog
          open={dialogOpen}
          onOpenChange={handleCloseDialog}
          report={selectedReport}
        />
      </div>
    </DashboardLayout>
  );
};

export default ReceivingReports;
