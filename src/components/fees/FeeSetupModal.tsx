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
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

interface FeeType {
  id: string;
  name: string;
  amount: number;
  type: string;
}

interface FeeSetupModalProps {
  open: boolean;
  onClose: () => void;
  feeTypes: FeeType[];
}

export const FeeSetupModal = ({ open, onClose, feeTypes }: FeeSetupModalProps) => {
  const { toast } = useToast();
  const [feeName, setFeeName] = useState("");
  const [feeAmount, setFeeAmount] = useState("");
  const [feeType, setFeeType] = useState("");
  const [description, setDescription] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!feeName || !feeAmount || !feeType) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    // TODO: Implement actual fee setup
    toast({
      title: "Fee Created",
      description: `${feeName} fee has been set up successfully`,
    });
    
    setFeeName("");
    setFeeAmount("");
    setFeeType("");
    setDescription("");
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Setup New Fee</DialogTitle>
          <DialogDescription>
            Create a new fee structure for courses or hostel
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="feeName">Fee Name</Label>
              <Input
                id="feeName"
                placeholder="Enter fee name"
                value={feeName}
                onChange={(e) => setFeeName(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="feeAmount">Amount (N$)</Label>
              <Input
                id="feeAmount"
                type="number"
                placeholder="Enter amount"
                value={feeAmount}
                onChange={(e) => setFeeAmount(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="feeType">Fee Type</Label>
              <Select value={feeType} onValueChange={setFeeType}>
                <SelectTrigger>
                  <SelectValue placeholder="Select fee type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="one-time">One-time</SelectItem>
                  <SelectItem value="recurring">Recurring (Monthly)</SelectItem>
                  <SelectItem value="annual">Annual</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="description">Description (Optional)</Label>
              <Textarea
                id="description"
                placeholder="Enter fee description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit">Create Fee</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
