import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, DollarSign } from "lucide-react";
import { useHostelFees, usePayHostelFee } from "@/hooks/useHostel";
import { HostelFeeDialog } from "./HostelFeeDialog";
import { PaymentDialog } from "./PaymentDialog";
import { FeeGenerationButton } from "./FeeGenerationButton";
import { OverdueFeeChecker } from "./OverdueFeeChecker";
import { format } from "date-fns";

export function HostelFeesTable() {
  const { data: fees = [], isLoading } = useHostelFees();
  const [feeDialogOpen, setFeeDialogOpen] = useState(false);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [selectedFee, setSelectedFee] = useState<any>(null);

  const handlePayment = (fee: any) => {
    setSelectedFee(fee);
    setPaymentDialogOpen(true);
  };

  if (isLoading) {
    return <div className="text-center py-4">Loading fees...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end gap-2">
        <OverdueFeeChecker />
        <FeeGenerationButton />
        <Button onClick={() => setFeeDialogOpen(true)} size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Create Fee Record
        </Button>
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Trainee ID</TableHead>
              <TableHead>Fee Month</TableHead>
              <TableHead>Fee Amount</TableHead>
              <TableHead>Amount Paid</TableHead>
              <TableHead>Balance</TableHead>
              <TableHead>Due Date</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {fees.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                  <DollarSign className="h-12 w-12 mx-auto mb-2 opacity-20" />
                  <p>No fee records found.</p>
                </TableCell>
              </TableRow>
            ) : (
              fees.map((fee) => (
                <TableRow key={fee.id}>
                  <TableCell className="font-medium">{fee.trainee_id}</TableCell>
                  <TableCell>{format(new Date(fee.fee_month), "MMMM yyyy")}</TableCell>
                  <TableCell>R {fee.fee_amount}</TableCell>
                  <TableCell>R {fee.amount_paid}</TableCell>
                  <TableCell>
                    <span className={fee.balance > 0 ? "text-destructive font-medium" : "text-muted-foreground"}>
                      R {fee.balance}
                    </span>
                  </TableCell>
                  <TableCell>{format(new Date(fee.due_date), "PP")}</TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        fee.payment_status === "paid"
                          ? "default"
                          : fee.payment_status === "partial"
                          ? "secondary"
                          : "destructive"
                      }
                      className="capitalize"
                    >
                      {fee.payment_status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {fee.payment_status !== "paid" && (
                      <Button variant="ghost" size="sm" onClick={() => handlePayment(fee)}>
                        <DollarSign className="h-4 w-4 mr-2" />
                        Record Payment
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <HostelFeeDialog open={feeDialogOpen} onOpenChange={setFeeDialogOpen} />
      <PaymentDialog
        open={paymentDialogOpen}
        onOpenChange={setPaymentDialogOpen}
        fee={selectedFee}
      />
    </div>
  );
}
