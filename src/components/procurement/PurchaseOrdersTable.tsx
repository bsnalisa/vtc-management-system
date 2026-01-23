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
import { PurchaseOrder } from "@/hooks/useProcurement";

interface PurchaseOrdersTableProps {
  orders: PurchaseOrder[];
  isLoading: boolean;
  onEdit: (order: PurchaseOrder) => void;
}

const statusColors = {
  draft: "secondary",
  sent: "default",
  received: "default",
  completed: "default",
  cancelled: "destructive",
} as const;

const PurchaseOrdersTable = ({ orders, isLoading, onEdit }: PurchaseOrdersTableProps) => {
  if (isLoading) {
    return <div className="text-center py-4">Loading purchase orders...</div>;
  }

  if (!orders.length) {
    return <div className="text-center py-4 text-muted-foreground">No purchase orders found</div>;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>PO Number</TableHead>
          <TableHead>Supplier</TableHead>
          <TableHead>Order Date</TableHead>
          <TableHead>Expected Delivery</TableHead>
          <TableHead className="text-right">Subtotal</TableHead>
          <TableHead className="text-right">Tax</TableHead>
          <TableHead className="text-right">Total</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {orders.map((order) => (
          <TableRow key={order.id}>
            <TableCell className="font-medium">{order.po_number}</TableCell>
            <TableCell>{order.suppliers?.name || "-"}</TableCell>
            <TableCell>{format(new Date(order.order_date), "MMM dd, yyyy")}</TableCell>
            <TableCell>
              {order.expected_delivery_date 
                ? format(new Date(order.expected_delivery_date), "MMM dd, yyyy")
                : "-"}
            </TableCell>
            <TableCell className="text-right">R {Number(order.subtotal).toFixed(2)}</TableCell>
            <TableCell className="text-right">R {Number(order.tax_amount).toFixed(2)}</TableCell>
            <TableCell className="text-right font-semibold">R {Number(order.grand_total).toFixed(2)}</TableCell>
            <TableCell>
              <Badge variant={statusColors[order.status as keyof typeof statusColors]}>
                {order.status}
              </Badge>
            </TableCell>
            <TableCell className="text-right">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onEdit(order)}
              >
                {order.status === 'draft' ? (
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

export default PurchaseOrdersTable;
