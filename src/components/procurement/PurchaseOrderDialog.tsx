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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  useCreatePurchaseOrder,
  useUpdatePurchaseOrder,
  PurchaseOrder,
  useSuppliers,
  usePurchaseRequisitions,
  usePurchaseOrderItems,
  useCreatePurchaseOrderItem,
  useDeletePurchaseOrderItem,
} from "@/hooks/useProcurement";

const orderSchema = z.object({
  po_number: z.string().min(1, "PO number is required"),
  supplier_id: z.string().min(1, "Supplier is required"),
  requisition_id: z.string().optional(),
  order_date: z.string(),
  expected_delivery_date: z.string().optional(),
  status: z.enum(["draft", "sent", "received", "completed", "cancelled"]),
  notes: z.string().optional(),
});

type OrderFormData = z.infer<typeof orderSchema>;

interface PurchaseOrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order?: PurchaseOrder | null;
}

const PurchaseOrderDialog = ({ open, onOpenChange, order }: PurchaseOrderDialogProps) => {
  const [itemDescription, setItemDescription] = useState("");
  const [itemQuantity, setItemQuantity] = useState("");
  const [itemCost, setItemCost] = useState("");

  const createOrder = useCreatePurchaseOrder();
  const updateOrder = useUpdatePurchaseOrder();
  const { data: suppliers = [] } = useSuppliers();
  const { data: requisitions = [] } = usePurchaseRequisitions();
  const { data: items = [] } = usePurchaseOrderItems(order?.id || null);
  const createItem = useCreatePurchaseOrderItem();
  const deleteItem = useDeletePurchaseOrderItem();

  const approvedRequisitions = requisitions.filter(r => r.status === 'approved');

  const form = useForm<OrderFormData>({
    resolver: zodResolver(orderSchema),
    defaultValues: {
      po_number: `PO-${Date.now()}`,
      supplier_id: "",
      requisition_id: "",
      order_date: new Date().toISOString().split('T')[0],
      expected_delivery_date: "",
      status: "draft",
      notes: "",
    },
  });

  useEffect(() => {
    if (order) {
      form.reset({
        po_number: order.po_number,
        supplier_id: order.supplier_id,
        requisition_id: order.requisition_id || "",
        order_date: order.order_date,
        expected_delivery_date: order.expected_delivery_date || "",
        status: order.status as "draft" | "sent" | "received" | "completed" | "cancelled",
        notes: order.notes || "",
      });
    } else {
      form.reset({
        po_number: `PO-${Date.now()}`,
        supplier_id: "",
        requisition_id: "",
        order_date: new Date().toISOString().split('T')[0],
        expected_delivery_date: "",
        status: "draft",
        notes: "",
      });
    }
  }, [order, form]);

  const subtotal = items.reduce((sum, item) => sum + (item.total_cost || 0), 0);
  const taxAmount = subtotal * 0.15; // 15% tax
  const grandTotal = subtotal + taxAmount;

  const onSubmit = async (data: OrderFormData) => {
    if (order) {
      await updateOrder.mutateAsync({
        id: order.id,
        ...data,
        requisition_id: data.requisition_id || null,
        expected_delivery_date: data.expected_delivery_date || null,
        subtotal,
        tax_amount: taxAmount,
        grand_total: grandTotal,
      });
    } else {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("User not authenticated");
        return;
      }

      await createOrder.mutateAsync({
        po_number: data.po_number,
        supplier_id: data.supplier_id,
        requisition_id: data.requisition_id || null,
        order_date: data.order_date,
        expected_delivery_date: data.expected_delivery_date || null,
        status: data.status,
        subtotal,
        tax_amount: taxAmount,
        grand_total: grandTotal,
        notes: data.notes || null,
        created_by: user.id,
      });
    }
    onOpenChange(false);
  };

  const handleAddItem = async () => {
    if (!order || !itemDescription || !itemQuantity || !itemCost) return;

    const quantity = parseFloat(itemQuantity);
    const cost = parseFloat(itemCost);

    await createItem.mutateAsync({
      purchase_order_id: order.id,
      stock_item_id: null,
      item_description: itemDescription,
      quantity_ordered: quantity,
      unit_cost: cost,
      total_cost: quantity * cost,
      notes: null,
    });

    setItemDescription("");
    setItemQuantity("");
    setItemCost("");
  };

  const handleDeleteItem = async (itemId: string) => {
    await deleteItem.mutateAsync(itemId);
  };

  const canEdit = !order || order.status === 'draft';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {order ? "Purchase Order Details" : "New Purchase Order"}
          </DialogTitle>
          <DialogDescription>
            {canEdit ? "Enter order details and add items" : "View order details"}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="po_number"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>PO Number *</FormLabel>
                    <FormControl>
                      <Input {...field} disabled={!!order} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="supplier_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Supplier *</FormLabel>
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                      disabled={!canEdit}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select supplier" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {suppliers.map((supplier) => (
                          <SelectItem key={supplier.id} value={supplier.id}>
                            {supplier.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="requisition_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Requisition (Optional)</FormLabel>
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                      disabled={!canEdit}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select requisition" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {approvedRequisitions.map((req) => (
                          <SelectItem key={req.id} value={req.id}>
                            {req.requisition_number}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="order_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Order Date *</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} disabled={!canEdit} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="expected_delivery_date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Expected Delivery Date</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} disabled={!canEdit} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {order && (
              <>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold">Items</h3>
                    <div className="text-right space-y-1">
                      <div>Subtotal: <span className="font-semibold">R {subtotal.toFixed(2)}</span></div>
                      <div>Tax (15%): <span className="font-semibold">R {taxAmount.toFixed(2)}</span></div>
                      <div className="text-lg">Grand Total: <span className="font-bold">R {grandTotal.toFixed(2)}</span></div>
                    </div>
                  </div>

                  {canEdit && (
                    <div className="grid grid-cols-12 gap-2 items-end">
                      <div className="col-span-5">
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
                        <label className="text-sm font-medium">Total</label>
                        <Input
                          value={itemQuantity && itemCost ? (parseFloat(itemQuantity) * parseFloat(itemCost)).toFixed(2) : "0.00"}
                          disabled
                        />
                      </div>
                      <div className="col-span-1">
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
                        <TableHead className="text-right">Qty Ordered</TableHead>
                        <TableHead className="text-right">Unit Cost</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                        <TableHead className="text-right">Qty Received</TableHead>
                        {canEdit && <TableHead className="text-right">Actions</TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {items.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={canEdit ? 6 : 5} className="text-center text-muted-foreground">
                            No items added yet
                          </TableCell>
                        </TableRow>
                      ) : (
                        items.map((item) => (
                          <TableRow key={item.id}>
                            <TableCell>{item.item_description}</TableCell>
                            <TableCell className="text-right">{item.quantity_ordered}</TableCell>
                            <TableCell className="text-right">R {item.unit_cost.toFixed(2)}</TableCell>
                            <TableCell className="text-right">R {(item.total_cost || 0).toFixed(2)}</TableCell>
                            <TableCell className="text-right">
                              <Badge variant={item.quantity_received > 0 ? "default" : "secondary"}>
                                {item.quantity_received}
                              </Badge>
                            </TableCell>
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
              </>
            )}

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea {...field} rows={3} disabled={!canEdit} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

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
                  disabled={createOrder.isPending || updateOrder.isPending}
                >
                  {order ? "Update" : "Create"} Order
                </Button>
              )}
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

export default PurchaseOrderDialog;
