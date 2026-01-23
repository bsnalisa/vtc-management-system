import { useForm } from "react-hook-form";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useHostelAllocations, useCreateHostelFee } from "@/hooks/useHostel";

interface HostelFeeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function HostelFeeDialog({ open, onOpenChange }: HostelFeeDialogProps) {
  const { data: allocations = [] } = useHostelAllocations({ status: "active" });
  const createFeeMutation = useCreateHostelFee();

  const form = useForm({
    defaultValues: {
      allocation_id: "",
      trainee_id: "",
      fee_month: new Date().toISOString().substring(0, 7),
      fee_amount: 0,
      due_date: "",
      notes: "",
    },
  });

  const onSubmit = async (data: any) => {
    await createFeeMutation.mutateAsync({
      ...data,
      fee_month: data.fee_month + "-01", // Convert to full date
    });
    onOpenChange(false);
    form.reset();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create Hostel Fee Record</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="allocation_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Allocation</FormLabel>
                  <Select
                    onValueChange={(value) => {
                      field.onChange(value);
                      const allocation = allocations.find(a => a.id === value);
                      if (allocation) {
                        form.setValue("trainee_id", allocation.trainee_id);
                        form.setValue("fee_amount", allocation.monthly_fee);
                      }
                    }}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select allocation" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {allocations.map((allocation) => (
                        <SelectItem key={allocation.id} value={allocation.id}>
                          {allocation.trainee_id} - {allocation.room_id}
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
                name="fee_month"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Fee Month</FormLabel>
                    <FormControl>
                      <Input {...field} type="month" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="due_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Due Date</FormLabel>
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
              name="fee_amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Fee Amount</FormLabel>
                  <FormControl>
                    <Input {...field} type="number" step="0.01" onChange={e => field.onChange(Number(e.target.value))} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createFeeMutation.isPending}>
                Create Fee Record
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
