import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

interface PaymentMethod {
  id: string;
  label: string;
  description: string;
}

interface Trainee {
  id: string;
  name: string;
}

interface PaymentModalProps {
  open: boolean;
  onClose: () => void;
  trainee: Trainee | null;
  paymentMethods: PaymentMethod[];
}

export const PaymentModal = ({ open, onClose, trainee, paymentMethods }: PaymentModalProps) => {
  const { toast } = useToast();
  const [amount, setAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [reference, setReference] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!amount || !paymentMethod) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    // TODO: Implement actual payment recording
    toast({
      title: "Payment Recorded",
      description: `Payment of N$${amount} recorded successfully`,
    });
    
    setAmount("");
    setPaymentMethod("");
    setReference("");
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Record Payment</DialogTitle>
          <DialogDescription>
            {trainee
              ? `Recording payment for ${trainee.name}`
              : "Record a new payment transaction"}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="amount">Amount (N$)</Label>
              <Input
                id="amount"
                type="number"
                placeholder="Enter amount"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="method">Payment Method</Label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger>
                  <SelectValue placeholder="Select payment method" />
                </SelectTrigger>
                <SelectContent>
                  {paymentMethods.map((method) => (
                    <SelectItem key={method.id} value={method.id}>
                      {method.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="reference">Reference Number (Optional)</Label>
              <Input
                id="reference"
                placeholder="Enter reference number"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit">Record Payment</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
