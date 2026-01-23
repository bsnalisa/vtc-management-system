import { useStockMovements } from "@/hooks/useStockMovements";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

export const StockMovementsTable = () => {
  const { data: movements, isLoading } = useStockMovements();

  if (isLoading) {
    return <div className="text-center py-8 text-muted-foreground">Loading movements...</div>;
  }

  if (!movements?.length) {
    return <div className="text-center py-8 text-muted-foreground">No stock movements found</div>;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Date</TableHead>
          <TableHead>Item</TableHead>
          <TableHead>Type</TableHead>
          <TableHead>Quantity</TableHead>
          <TableHead>Reference</TableHead>
          <TableHead>Issued To</TableHead>
          <TableHead>Department</TableHead>
          <TableHead>Notes</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {movements.map((movement) => (
          <TableRow key={movement.id}>
            <TableCell>{format(new Date(movement.movement_date), "dd MMM yyyy")}</TableCell>
            <TableCell>
              <div>
                <div className="font-medium">{movement.stock_items?.item_name}</div>
                <div className="text-sm text-muted-foreground">{movement.stock_items?.item_code}</div>
              </div>
            </TableCell>
            <TableCell>
              <Badge
                variant={
                  movement.movement_type === "inflow"
                    ? "default"
                    : movement.movement_type === "outflow"
                    ? "destructive"
                    : "secondary"
                }
              >
                {movement.movement_type}
              </Badge>
            </TableCell>
            <TableCell>
              {movement.quantity} {movement.stock_items?.unit_of_measure}
            </TableCell>
            <TableCell>{movement.reference_number || "-"}</TableCell>
            <TableCell>{movement.trainers?.full_name || "-"}</TableCell>
            <TableCell>{movement.department || "-"}</TableCell>
            <TableCell className="max-w-xs truncate">{movement.notes || "-"}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
};
