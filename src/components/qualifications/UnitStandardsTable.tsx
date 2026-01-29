import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, Upload } from "lucide-react";
import { 
  QualificationUnitStandard, 
  useQualificationUnitStandards, 
  useDeleteUnitStandard 
} from "@/hooks/useQualifications";
import { UnitStandardDialog } from "./UnitStandardDialog";
import { BulkUnitStandardImportDialog } from "./BulkUnitStandardImportDialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Skeleton } from "@/components/ui/skeleton";

interface UnitStandardsTableProps {
  qualificationId: string;
  isEditable: boolean;
}

export const UnitStandardsTable = ({ qualificationId, isEditable }: UnitStandardsTableProps) => {
  const { data: unitStandards, isLoading } = useQualificationUnitStandards(qualificationId);
  const deleteMutation = useDeleteUnitStandard();
  
  const [dialogOpen, setDialogOpen] = useState(false);
  const [bulkImportOpen, setBulkImportOpen] = useState(false);
  const [selectedUnitStandard, setSelectedUnitStandard] = useState<QualificationUnitStandard | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [unitToDelete, setUnitToDelete] = useState<QualificationUnitStandard | null>(null);

  const handleEdit = (unit: QualificationUnitStandard) => {
    setSelectedUnitStandard(unit);
    setDialogOpen(true);
  };

  const handleDelete = (unit: QualificationUnitStandard) => {
    setUnitToDelete(unit);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (unitToDelete) {
      await deleteMutation.mutateAsync({ 
        id: unitToDelete.id, 
        qualificationId: unitToDelete.qualification_id 
      });
      setDeleteDialogOpen(false);
      setUnitToDelete(null);
    }
  };

  const handleAddNew = () => {
    setSelectedUnitStandard(null);
    setDialogOpen(true);
  };

  const totalCredits = unitStandards?.reduce((sum, us) => sum + (us.credit_value || 0), 0) || 0;

  if (isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h3 className="text-lg font-medium">Unit Standards</h3>
          <Badge variant="outline">
            {unitStandards?.length || 0} units • {totalCredits} credits
          </Badge>
        </div>
        {isEditable && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setBulkImportOpen(true)} size="sm">
              <Upload className="h-4 w-4 mr-2" />
              Bulk Import
            </Button>
            <Button onClick={handleAddNew} size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Add Unit Standard
            </Button>
          </div>
        )}
      </div>

      {unitStandards && unitStandards.length > 0 ? (
        <div className="border rounded-md">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Unit ID</TableHead>
                <TableHead>Title</TableHead>
                <TableHead className="text-center">Level</TableHead>
                <TableHead className="text-center">Credits</TableHead>
                <TableHead className="text-center">Type</TableHead>
                {isEditable && <TableHead className="text-right">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {unitStandards.map((unit) => (
                <TableRow key={unit.id}>
                  <TableCell className="font-mono text-sm">{unit.unit_standard_id}</TableCell>
                  <TableCell>{unit.unit_standard_title}</TableCell>
                  <TableCell className="text-center">{unit.level}</TableCell>
                  <TableCell className="text-center">{unit.credit_value || "-"}</TableCell>
                  <TableCell className="text-center">
                    <Badge variant={unit.is_mandatory ? "default" : "secondary"}>
                      {unit.is_mandatory ? "Mandatory" : "Elective"}
                    </Badge>
                  </TableCell>
                  {isEditable && (
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="icon" onClick={() => handleEdit(unit)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => handleDelete(unit)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="border rounded-md p-8 text-center text-muted-foreground">
          No unit standards added yet.
          {isEditable && " Click 'Add Unit Standard' to begin."}
        </div>
      )}

      <UnitStandardDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        qualificationId={qualificationId}
        unitStandard={selectedUnitStandard}
      />

      <BulkUnitStandardImportDialog
        open={bulkImportOpen}
        onOpenChange={setBulkImportOpen}
        qualificationId={qualificationId}
      />

      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Delete Unit Standard"
        description={`Are you sure you want to remove "${unitToDelete?.unit_standard_title}"? This action cannot be undone.`}
        onConfirm={confirmDelete}
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
};
