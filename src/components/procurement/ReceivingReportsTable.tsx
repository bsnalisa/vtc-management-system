import { format } from "date-fns";
import { Eye } from "lucide-react";
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

interface ReceivingReportsTableProps {
  reports: any[];
  isLoading: boolean;
  onEdit: (report: any) => void;
}

const statusColors = {
  pending: "secondary",
  approved: "default",
  rejected: "destructive",
} as const;

const ReceivingReportsTable = ({ reports, isLoading, onEdit }: ReceivingReportsTableProps) => {
  if (isLoading) {
    return <div className="text-center py-4">Loading receiving reports...</div>;
  }

  if (!reports.length) {
    return <div className="text-center py-4 text-muted-foreground">No receiving reports found</div>;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Receipt #</TableHead>
          <TableHead>PO Number</TableHead>
          <TableHead>Supplier</TableHead>
          <TableHead>Received Date</TableHead>
          <TableHead>Inspection Status</TableHead>
          <TableHead>Inspector Notes</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {reports.map((report) => (
          <TableRow key={report.id}>
            <TableCell className="font-medium">{report.receipt_number}</TableCell>
            <TableCell>{report.purchase_orders?.po_number || "-"}</TableCell>
            <TableCell>{report.purchase_orders?.suppliers?.name || "-"}</TableCell>
            <TableCell>{format(new Date(report.received_date), "MMM dd, yyyy")}</TableCell>
            <TableCell>
              <Badge variant={statusColors[report.inspection_status as keyof typeof statusColors] || "secondary"}>
                {report.inspection_status}
              </Badge>
            </TableCell>
            <TableCell className="max-w-xs truncate">
              {report.inspector_notes || "-"}
            </TableCell>
            <TableCell className="text-right">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onEdit(report)}
              >
                <Eye className="h-4 w-4" />
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
};

export default ReceivingReportsTable;
