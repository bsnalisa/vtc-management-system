import { useForm } from "react-hook-form";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { usePayHostelFee } from "@/hooks/useHostel";

interface PaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fee: any;
}

export function PaymentDialog({ open, onOpenChange, fee }: PaymentDialogProps) {
  const payFeeMutation = usePayHostelFee();

  const form = useForm({
    defaultValues: {
      amount: fee?.balance || 0,
    },
  });

  const onSubmit = async (data: any) => {
    if (!fee) return;
    await payFeeMutation.mutateAsync({
      id: fee.id,
      amount: data.amount,
    });
    onOpenChange(false);
    form.reset();
  };

  if (!fee) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record Payment</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Trainee ID</p>
              <p className="font-medium">{fee.trainee_id}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Fee Amount</p>
              <p className="font-medium">R {fee.fee_amount}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Amount Paid</p>
              <p className="font-medium">R {fee.amount_paid}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Balance</p>
              <p className="font-medium text-destructive">R {fee.balance}</p>
            </div>
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Payment Amount</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="number"
                        step="0.01"
                        max={fee.balance}
                        onChange={e => field.onChange(Number(e.target.value))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={payFeeMutation.isPending}>
                  Record Payment
                </Button>
              </div>
            </form>
          </Form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
