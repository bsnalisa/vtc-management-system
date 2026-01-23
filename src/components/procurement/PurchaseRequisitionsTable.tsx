import { format } from "date-fns";
import { Eye, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { PurchaseRequisition } from "@/hooks/useProcurement";

interface PurchaseRequisitionsTableProps {
  requisitions: PurchaseRequisition[];
  isLoading: boolean;
  onEdit: (requisition: PurchaseRequisition) => void;
}

const statusColors = {
  draft: "secondary",
  pending: "default",
  approved: "default",
  rejected: "destructive",
} as const;

const PurchaseRequisitionsTable = ({ requisitions, isLoading, onEdit }: PurchaseRequisitionsTableProps) => {
  if (isLoading) {
    return <div className="text-center py-4">Loading requisitions...</div>;
  }

  if (!requisitions.length) {
    return <div className="text-center py-4 text-muted-foreground">No requisitions found</div>;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Requisition #</TableHead>
          <TableHead>Department</TableHead>
          <TableHead>Requested Date</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Justification</TableHead>
          <TableHead>Approved Date</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {requisitions.map((requisition) => (
          <TableRow key={requisition.id}>
            <TableCell className="font-medium">{requisition.requisition_number}</TableCell>
            <TableCell>{requisition.department || "-"}</TableCell>
            <TableCell>{format(new Date(requisition.requested_date), "MMM dd, yyyy")}</TableCell>
            <TableCell>
              <Badge variant={statusColors[requisition.status as keyof typeof statusColors]}>
                {requisition.status}
              </Badge>
            </TableCell>
            <TableCell className="max-w-xs truncate">
              {requisition.justification || "-"}
            </TableCell>
            <TableCell>
              {requisition.approved_date 
                ? format(new Date(requisition.approved_date), "MMM dd, yyyy")
                : "-"}
            </TableCell>
            <TableCell className="text-right">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onEdit(requisition)}
              >
                {requisition.status === 'draft' ? (
                  <Pencil className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
};

export default PurchaseRequisitionsTable;
