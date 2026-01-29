import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useDeleteTrade } from "@/hooks/useTradesManagement";
import type { Trade } from "@/pages/TradeManagement";

interface TradesTableProps {
  trades: Trade[];
  onEdit: (trade: Trade) => void;
}

export const TradesTable = ({ trades, onEdit }: TradesTableProps) => {
  const deleteMutation = useDeleteTrade();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [tradeToDelete, setTradeToDelete] = useState<Trade | null>(null);

  const handleDelete = (trade: Trade) => {
    setTradeToDelete(trade);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (tradeToDelete) {
      await deleteMutation.mutateAsync(tradeToDelete.id);
      setDeleteDialogOpen(false);
      setTradeToDelete(null);
    }
  };

  return (
    <>
      <div className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="text-center">Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {trades.map((trade) => (
              <TableRow key={trade.id}>
                <TableCell className="font-mono font-medium">{trade.code}</TableCell>
                <TableCell>{trade.name}</TableCell>
                <TableCell className="max-w-[300px] truncate text-muted-foreground">
                  {trade.description || "-"}
                </TableCell>
                <TableCell className="text-center">
                  <Badge variant={trade.active ? "default" : "secondary"}>
                    {trade.active ? "Active" : "Inactive"}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button variant="ghost" size="icon" onClick={() => onEdit(trade)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(trade)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Delete Trade"
        description={`Are you sure you want to delete "${tradeToDelete?.name}"? This will remove the trade from all associated qualifications.`}
        onConfirm={confirmDelete}
        isLoading={deleteMutation.isPending}
      />
    </>
  );
};
