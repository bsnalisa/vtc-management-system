import { StockItem } from "@/hooks/useStockItems";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { AlertCircle } from "lucide-react";

interface StockItemsTableProps {
  items: StockItem[];
  loading: boolean;
}

export const StockItemsTable = ({ items, loading }: StockItemsTableProps) => {
  if (loading) {
    return <div className="text-center py-8 text-muted-foreground">Loading stock items...</div>;
  }

  if (!items.length) {
    return <div className="text-center py-8 text-muted-foreground">No stock items found</div>;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Item Code</TableHead>
          <TableHead>Item Name</TableHead>
          <TableHead>Category</TableHead>
          <TableHead>Quantity</TableHead>
          <TableHead>Unit Cost</TableHead>
          <TableHead>Total Value</TableHead>
          <TableHead>Location</TableHead>
          <TableHead>Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((item) => {
          const isLowStock = item.current_quantity <= item.reorder_level;
          const totalValue = item.current_quantity * item.unit_cost;

          return (
            <TableRow key={item.id}>
              <TableCell className="font-medium">{item.item_code}</TableCell>
              <TableCell>{item.item_name}</TableCell>
              <TableCell>{item.stock_categories?.name}</TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  {item.current_quantity} {item.unit_of_measure}
                  {isLowStock && <AlertCircle className="h-4 w-4 text-destructive" />}
                </div>
              </TableCell>
              <TableCell>R {item.unit_cost.toFixed(2)}</TableCell>
              <TableCell>R {totalValue.toFixed(2)}</TableCell>
              <TableCell>{item.location || "-"}</TableCell>
              <TableCell>
                {isLowStock ? (
                  <Badge variant="destructive">Low Stock</Badge>
                ) : (
                  <Badge variant="default">In Stock</Badge>
                )}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
};
