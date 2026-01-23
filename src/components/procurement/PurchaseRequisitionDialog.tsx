import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  useCreatePurchaseRequisition,
  useUpdatePurchaseRequisition,
  PurchaseRequisition,
  useRequisitionItems,
  useCreateRequisitionItem,
  useDeleteRequisitionItem,
} from "@/hooks/useProcurement";

const requisitionSchema = z.object({
  requisition_number: z.string().min(1, "Requisition number is required"),
  department: z.string().optional(),
  justification: z.string().optional(),
  status: z.enum(["draft", "pending", "approved", "rejected"]),
});

type RequisitionFormData = z.infer<typeof requisitionSchema>;

interface PurchaseRequisitionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  requisition?: PurchaseRequisition | null;
}

const PurchaseRequisitionDialog = ({ open, onOpenChange, requisition }: PurchaseRequisitionDialogProps) => {
  const [itemDescription, setItemDescription] = useState("");
  const [itemQuantity, setItemQuantity] = useState("");
  const [itemCost, setItemCost] = useState("");

  const createRequisition = useCreatePurchaseRequisition();
  const updateRequisition = useUpdatePurchaseRequisition();
  const { data: items = [] } = useRequisitionItems(requisition?.id || null);
  const createItem = useCreateRequisitionItem();
  const deleteItem = useDeleteRequisitionItem();

  const form = useForm<RequisitionFormData>({
    resolver: zodResolver(requisitionSchema),
    defaultValues: {
      requisition_number: `REQ-${Date.now()}`,
      department: "",
      justification: "",
      status: "draft",
    },
  });

  useEffect(() => {
    if (requisition) {
      form.reset({
        requisition_number: requisition.requisition_number,
        department: requisition.department || "",
        justification: requisition.justification || "",
        status: requisition.status as "draft" | "pending" | "approved" | "rejected",
      });
    } else {
      form.reset({
        requisition_number: `REQ-${Date.now()}`,
        department: "",
        justification: "",
        status: "draft",
      });
    }
  }, [requisition, form]);

  const onSubmit = async (data: RequisitionFormData) => {
    if (requisition) {
      await updateRequisition.mutateAsync({
        id: requisition.id,
        ...data,
      });
    } else {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("User not authenticated");
        return;
      }

      await createRequisition.mutateAsync({
        requisition_number: data.requisition_number,
        requested_by: user.id,
        requested_date: new Date().toISOString().split('T')[0],
        department: data.department || null,
        justification: data.justification || null,
        status: data.status,
        approved_by: null,
        approved_date: null,
        rejected_reason: null,
      });
    }
    onOpenChange(false);
  };

  const handleAddItem = async () => {
    if (!requisition || !itemDescription || !itemQuantity || !itemCost) return;

    const quantity = parseFloat(itemQuantity);
    const cost = parseFloat(itemCost);

    await createItem.mutateAsync({
      requisition_id: requisition.id,
      stock_item_id: null,
      item_description: itemDescription,
      quantity,
      estimated_unit_cost: cost,
      total_estimated_cost: quantity * cost,
    });

    setItemDescription("");
    setItemQuantity("");
    setItemCost("");
  };

  const handleDeleteItem = async (itemId: string) => {
    await deleteItem.mutateAsync(itemId);
  };

  const canEdit = !requisition || requisition.status === 'draft';
  const totalEstimate = items.reduce((sum, item) => sum + (item.total_estimated_cost || 0), 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {requisition ? "Purchase Requisition Details" : "New Purchase Requisition"}
          </DialogTitle>
          <DialogDescription>
            {canEdit ? "Enter requisition details and add items" : "View requisition details"}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="requisition_number"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Requisition Number *</FormLabel>
                    <FormControl>
                      <Input {...field} disabled={!!requisition} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="department"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Department</FormLabel>
                    <FormControl>
                      <Input {...field} disabled={!canEdit} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="justification"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Justification</FormLabel>
                  <FormControl>
                    <Textarea {...field} rows={3} disabled={!canEdit} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {requisition && (
              <>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold">Items</h3>
                    <Badge variant="outline">
                      Total Estimate: R {totalEstimate.toFixed(2)}
                    </Badge>
                  </div>

                  {canEdit && (
                    <div className="grid grid-cols-12 gap-2 items-end">
                      <div className="col-span-4">
                        <label className="text-sm font-medium">Description</label>
                        <Input
                          value={itemDescription}
                          onChange={(e) => setItemDescription(e.target.value)}
                          placeholder="Item description"
                        />
                      </div>
                      <div className="col-span-2">
                        <label className="text-sm font-medium">Quantity</label>
                        <Input
                          type="number"
                          value={itemQuantity}
                          onChange={(e) => setItemQuantity(e.target.value)}
                          placeholder="Qty"
                        />
                      </div>
                      <div className="col-span-2">
                        <label className="text-sm font-medium">Unit Cost</label>
                        <Input
                          type="number"
                          step="0.01"
                          value={itemCost}
                          onChange={(e) => setItemCost(e.target.value)}
                          placeholder="Cost"
                        />
                      </div>
                      <div className="col-span-2">
                        <Button
                          type="button"
                          size="icon"
                          onClick={handleAddItem}
                          disabled={!itemDescription || !itemQuantity || !itemCost}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )}

                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Description</TableHead>
                        <TableHead className="text-right">Quantity</TableHead>
                        <TableHead className="text-right">Unit Cost</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                        {canEdit && <TableHead className="text-right">Actions</TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {items.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={canEdit ? 5 : 4} className="text-center text-muted-foreground">
                            No items added yet
                          </TableCell>
                        </TableRow>
                      ) : (
                        items.map((item) => (
                          <TableRow key={item.id}>
                            <TableCell>{item.item_description}</TableCell>
                            <TableCell className="text-right">{item.quantity}</TableCell>
                            <TableCell className="text-right">R {item.estimated_unit_cost.toFixed(2)}</TableCell>
                            <TableCell className="text-right">R {(item.total_estimated_cost || 0).toFixed(2)}</TableCell>
                            {canEdit && (
                              <TableCell className="text-right">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDeleteItem(item.id)}
                                >
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </TableCell>
                            )}
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>

                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status</FormLabel>
                      <FormControl>
                        <Input {...field} disabled />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </>
            )}

            <div className="flex justify-end gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                {canEdit ? "Cancel" : "Close"}
              </Button>
              {canEdit && (
                <Button
                  type="submit"
                  disabled={createRequisition.isPending || updateRequisition.isPending}
                >
                  {requisition ? "Update" : "Create"} Requisition
                </Button>
              )}
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

export default PurchaseRequisitionDialog;
