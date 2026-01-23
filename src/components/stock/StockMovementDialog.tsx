import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useStockItems } from "@/hooks/useStockItems";
import { useTrainers } from "@/hooks/useTrainers";
import { useCreateStockMovement } from "@/hooks/useStockMovements";

const formSchema = z.object({
  stock_item_id: z.string().min(1, "Stock item is required"),
  movement_type: z.enum(["inflow", "outflow", "adjustment"]),
  quantity: z.string().min(0, "Quantity must be positive"),
  unit_cost: z.string().optional(),
  reference_number: z.string().optional(),
  movement_date: z.string(),
  issued_to: z.string().optional(),
  department: z.string().optional(),
  notes: z.string().optional(),
});

interface StockMovementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const StockMovementDialog = ({ open, onOpenChange }: StockMovementDialogProps) => {
  const { data: stockItems } = useStockItems();
  const { data: trainers } = useTrainers();
  const createMovement = useCreateStockMovement();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      stock_item_id: "",
      movement_type: "inflow",
      quantity: "0",
      unit_cost: "",
      reference_number: "",
      movement_date: new Date().toISOString().split("T")[0],
      issued_to: "",
      department: "",
      notes: "",
    },
  });

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    const quantity = parseFloat(values.quantity);
    const unitCost = values.unit_cost ? parseFloat(values.unit_cost) : null;
    
    await createMovement.mutateAsync({
      stock_item_id: values.stock_item_id,
      movement_type: values.movement_type,
      quantity,
      unit_cost: unitCost,
      total_cost: unitCost ? quantity * unitCost : null,
      reference_number: values.reference_number || null,
      movement_date: values.movement_date,
      issued_to: values.issued_to || null,
      issued_by: null,
      department: values.department || null,
      notes: values.notes || null,
    });
    form.reset();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Record Stock Movement</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="stock_item_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Stock Item</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select item" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {stockItems?.map((item) => (
                        <SelectItem key={item.id} value={item.id}>
                          {item.item_name} ({item.item_code})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="movement_type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Movement Type</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="inflow">Inflow (Purchase)</SelectItem>
                        <SelectItem value="outflow">Outflow (Usage)</SelectItem>
                        <SelectItem value="adjustment">Adjustment</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="quantity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Quantity</FormLabel>
                    <FormControl>
                      <Input {...field} type="number" step="0.01" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="unit_cost"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Unit Cost (Optional)</FormLabel>
                    <FormControl>
                      <Input {...field} type="number" step="0.01" placeholder="0.00" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="movement_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date</FormLabel>
                    <FormControl>
                      <Input {...field} type="date" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="reference_number"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Reference Number</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="PO-001, INV-123" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="issued_to"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Issued To (Trainer)</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select trainer" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {trainers?.map((trainer) => (
                          <SelectItem key={trainer.id} value={trainer.id}>
                            {trainer.full_name}
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
                name="department"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Department</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Workshop A" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea {...field} placeholder="Additional notes" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createMovement.isPending}>
                {createMovement.isPending ? "Recording..." : "Record Movement"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
