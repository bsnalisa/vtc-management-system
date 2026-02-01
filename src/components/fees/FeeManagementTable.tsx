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
import { Edit, Trash2 } from "lucide-react";

interface Fee {
  id: string;
  trainee_name: string;
  fee_type: string;
  amount: number;
  status: string;
  due_date: string;
}

interface FeeManagementTableProps {
  data: Fee[];
  onEdit: (fee: Fee) => void;
  onDelete: (feeId: string) => void;
}

export const FeeManagementTable = ({ data, onEdit, onDelete }: FeeManagementTableProps) => {
  if (data.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No fee records found
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Trainee</TableHead>
          <TableHead>Fee Type</TableHead>
          <TableHead>Amount</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Due Date</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.map((fee) => (
          <TableRow key={fee.id}>
            <TableCell className="font-medium">{fee.trainee_name}</TableCell>
            <TableCell>{fee.fee_type}</TableCell>
            <TableCell>N${fee.amount.toLocaleString()}</TableCell>
            <TableCell>
              <Badge
                variant={
                  fee.status === "paid"
                    ? "default"
                    : fee.status === "overdue"
                    ? "destructive"
                    : "secondary"
                }
              >
                {fee.status}
              </Badge>
            </TableCell>
            <TableCell>{fee.due_date}</TableCell>
            <TableCell className="text-right">
              <div className="flex justify-end gap-2">
                <Button size="sm" variant="outline" onClick={() => onEdit(fee)}>
                  <Edit className="h-4 w-4" />
                </Button>
                <Button size="sm" variant="outline" onClick={() => onDelete(fee.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
};
