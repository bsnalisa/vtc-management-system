import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Eye, Pencil, Send, MoreHorizontal } from "lucide-react";
import { 
  Qualification, 
  QualificationStatus,
  useSubmitForApproval 
} from "@/hooks/useQualifications";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { format } from "date-fns";

interface QualificationsTableProps {
  qualifications: Qualification[];
  onView: (qualification: Qualification) => void;
  onEdit: (qualification: Qualification) => void;
  canManage: boolean;
}

const statusColors: Record<QualificationStatus, string> = {
  draft: "bg-muted text-muted-foreground",
  pending_approval: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  approved: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  rejected: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
};

const statusLabels: Record<QualificationStatus, string> = {
  draft: "Draft",
  pending_approval: "Pending Approval",
  approved: "Approved",
  rejected: "Rejected",
};

export const QualificationsTable = ({ 
  qualifications, 
  onView, 
  onEdit, 
  canManage 
}: QualificationsTableProps) => {
  const submitMutation = useSubmitForApproval();
  const [submitDialogOpen, setSubmitDialogOpen] = useState(false);
  const [qualificationToSubmit, setQualificationToSubmit] = useState<Qualification | null>(null);

  const handleSubmitClick = (qualification: Qualification) => {
    setQualificationToSubmit(qualification);
    setSubmitDialogOpen(true);
  };

  const confirmSubmit = async () => {
    if (qualificationToSubmit) {
      await submitMutation.mutateAsync(qualificationToSubmit.id);
      setSubmitDialogOpen(false);
      setQualificationToSubmit(null);
    }
  };

  return (
    <>
      <div className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Title</TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="text-center">NQF Level</TableHead>
              <TableHead className="text-center">Duration</TableHead>
              <TableHead className="text-center">Status</TableHead>
              <TableHead>Last Updated</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {qualifications.map((qualification) => (
              <TableRow key={qualification.id}>
                <TableCell className="font-mono font-medium">
                  {qualification.qualification_code}
                </TableCell>
                <TableCell className="max-w-[300px] truncate">
                  {qualification.qualification_title}
                </TableCell>
                <TableCell className="uppercase text-xs">
                  {qualification.qualification_type}
                </TableCell>
                <TableCell className="text-center">
                  Level {qualification.nqf_level}
                </TableCell>
                <TableCell className="text-center">
                  {qualification.duration_value} {qualification.duration_unit}
                </TableCell>
                <TableCell className="text-center">
                  <Badge className={statusColors[qualification.status]} variant="outline">
                    {statusLabels[qualification.status]}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {format(new Date(qualification.updated_at), "MMM d, yyyy")}
                </TableCell>
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => onView(qualification)}>
                        <Eye className="h-4 w-4 mr-2" />
                        View Details
                      </DropdownMenuItem>
                      {canManage && (qualification.status === "draft" || qualification.status === "rejected") && (
                        <>
                          <DropdownMenuItem onClick={() => onEdit(qualification)}>
                            <Pencil className="h-4 w-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleSubmitClick(qualification)}>
                            <Send className="h-4 w-4 mr-2" />
                            Submit for Approval
                          </DropdownMenuItem>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <ConfirmDialog
        open={submitDialogOpen}
        onOpenChange={setSubmitDialogOpen}
        title="Submit for Approval"
        description={`Are you sure you want to submit "${qualificationToSubmit?.qualification_title}" for approval? The Head of Training will review this qualification.`}
        onConfirm={confirmSubmit}
        isLoading={submitMutation.isPending}
        confirmText="Submit"
      />
    </>
  );
};
