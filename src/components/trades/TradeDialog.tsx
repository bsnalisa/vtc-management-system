import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useCreateTrade, useUpdateTrade } from "@/hooks/useTradesManagement";
import type { Trade } from "@/pages/TradeManagement";

interface TradeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trade?: Trade | null;
}

export const TradeDialog = ({ open, onOpenChange, trade }: TradeDialogProps) => {
  const createMutation = useCreateTrade();
  const updateMutation = useUpdateTrade();

  const [formData, setFormData] = useState({
    name: "",
    code: "",
    description: "",
    active: true,
  });

  useEffect(() => {
    if (trade) {
      setFormData({
        name: trade.name,
        code: trade.code,
        description: trade.description || "",
        active: trade.active,
      });
    } else {
      setFormData({
        name: "",
        code: "",
        description: "",
        active: true,
      });
    }
  }, [trade, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (trade) {
      await updateMutation.mutateAsync({ id: trade.id, ...formData });
    } else {
      await createMutation.mutateAsync(formData);
    }

    onOpenChange(false);
  };

  const isLoading = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{trade ? "Edit Trade" : "Create New Trade"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="code">Trade Code *</Label>
              <Input
                id="code"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                placeholder="e.g., ICT"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">Trade Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Information Technology"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Brief description of the trade..."
              rows={3}
            />
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              id="active"
              checked={formData.active}
              onCheckedChange={(checked) => setFormData({ ...formData, active: checked })}
            />
            <Label htmlFor="active">Active</Label>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Saving..." : trade ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
