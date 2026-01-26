import { useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { useQualifications, Qualification } from "@/hooks/useQualifications";
import { QualificationsTable } from "@/components/qualifications/QualificationsTable";
import { QualificationDialog } from "@/components/qualifications/QualificationDialog";
import { QualificationDetailPanel } from "@/components/qualifications/QualificationDetailPanel";
import { organizationAdminNavItems } from "@/lib/navigationConfig";
import { Skeleton } from "@/components/ui/skeleton";
import { withRoleAccess } from "@/components/withRoleAccess";

const QualificationManagementPage = () => {
  const { data: qualifications, isLoading } = useQualifications();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedQualification, setSelectedQualification] = useState<Qualification | null>(null);
  const [viewMode, setViewMode] = useState<"list" | "detail">("list");

  const handleView = (qualification: Qualification) => {
    setSelectedQualification(qualification);
    setViewMode("detail");
  };

  const handleEdit = (qualification: Qualification) => {
    setSelectedQualification(qualification);
    setDialogOpen(true);
  };

  const handleBack = () => {
    setViewMode("list");
    setSelectedQualification(null);
  };

  const handleAddNew = () => {
    setSelectedQualification(null);
    setDialogOpen(true);
  };

  return (
    <DashboardLayout
      title="Qualification Management"
      subtitle="Create and manage qualifications with unit standards"
      navItems={organizationAdminNavItems}
      groupLabel="Administration"
    >
      {viewMode === "list" ? (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-muted-foreground">
                Manage qualifications, add unit standards, and submit for approval.
              </p>
            </div>
            <Button onClick={handleAddNew}>
              <Plus className="h-4 w-4 mr-2" />
              Add Qualification
            </Button>
          </div>

          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : qualifications && qualifications.length > 0 ? (
            <QualificationsTable
              qualifications={qualifications}
              onView={handleView}
              onEdit={handleEdit}
              canManage={true}
            />
          ) : (
            <div className="border rounded-md p-12 text-center">
              <p className="text-muted-foreground mb-4">No qualifications created yet.</p>
              <Button onClick={handleAddNew}>
                <Plus className="h-4 w-4 mr-2" />
                Create Your First Qualification
              </Button>
            </div>
          )}
        </div>
      ) : selectedQualification ? (
        <QualificationDetailPanel
          qualification={selectedQualification}
          onBack={handleBack}
          onEdit={() => setDialogOpen(true)}
          canManage={true}
        />
      ) : null}

      <QualificationDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        qualification={selectedQualification}
      />
    </DashboardLayout>
  );
};

export default withRoleAccess(QualificationManagementPage, {
  requiredRoles: ["organization_admin", "super_admin"],
});
