import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Building, Search, DollarSign, CheckCircle, AlertCircle, Clock } from "lucide-react";
import { useHostelFees, usePayHostelFee } from "@/hooks/useHostel";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";

const PAYMENT_METHODS = [
  { id: "training_grant", label: "Training Grant" },
  { id: "cash", label: "Cash" },
  { id: "card", label: "Card" },
  { id: "bank_transfer", label: "Bank Transfer" },
  { id: "mobile_money", label: "Mobile Money" },
];

export const HostelFeeManagement = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedFee, setSelectedFee] = useState<any>(null);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);

  const { data: hostelFees, isLoading } = useHostelFees();
  const payHostelFee = usePayHostelFee();

  const filteredFees = hostelFees?.filter((fee) => {
    const matchesStatus =
      statusFilter === "all" || fee.payment_status === statusFilter;

    return matchesStatus;
  });

  const handleRecordPayment = () => {
    if (!selectedFee || !paymentAmount) return;

    const amount = parseFloat(paymentAmount);

    payHostelFee.mutate(
      {
        id: selectedFee.id,
        amount: amount,
      },
      {
        onSuccess: () => {
          setShowPaymentDialog(false);
          setSelectedFee(null);
          setPaymentAmount("");
        },
      }
    );
  };

  const openPaymentDialog = (fee: any) => {
    setSelectedFee(fee);
    setPaymentAmount(String(fee.balance));
    setShowPaymentDialog(true);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "paid":
        return (
          <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
            <CheckCircle className="h-3 w-3 mr-1" />
            Paid
          </Badge>
        );
      case "partial":
        return (
          <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
            <Clock className="h-3 w-3 mr-1" />
            Partial
          </Badge>
        );
      case "pending":
        return (
          <Badge className="bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">
            <Clock className="h-3 w-3 mr-1" />
            Pending
          </Badge>
        );
      case "overdue":
        return (
          <Badge className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
            <AlertCircle className="h-3 w-3 mr-1" />
            Overdue
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building className="h-5 w-5" />
          Hostel Fee Management
        </CardTitle>
        <CardDescription>
          Manage hostel fee payments and track outstanding balances
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col md:flex-row gap-4 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by trainee ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="partial">Partial</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
              <SelectItem value="overdue">Overdue</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Trainee ID</TableHead>
                <TableHead>Month</TableHead>
                <TableHead className="text-right">Fee Amount</TableHead>
                <TableHead className="text-right">Paid</TableHead>
                <TableHead className="text-right">Balance</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Due Date</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredFees?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8">
                    <Building className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                    <p className="text-muted-foreground">No hostel fees found</p>
                  </TableCell>
                </TableRow>
              ) : (
                filteredFees?.map((fee) => (
                  <TableRow key={fee.id}>
                    <TableCell>
                      <p className="font-mono text-sm">{fee.trainee_id}</p>
                    </TableCell>
                    <TableCell>
                      {fee.fee_month
                        ? format(new Date(fee.fee_month), "MMM yyyy")
                        : "N/A"}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      N$ {Number(fee.fee_amount).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right text-green-600">
                      N$ {Number(fee.amount_paid).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right font-bold text-primary">
                      N$ {Number(fee.balance).toLocaleString()}
                    </TableCell>
                    <TableCell>{getStatusBadge(fee.payment_status)}</TableCell>
                    <TableCell>
                      {fee.due_date
                        ? format(new Date(fee.due_date), "dd MMM yyyy")
                        : "N/A"}
                    </TableCell>
                    <TableCell>
                      {fee.payment_status !== "paid" && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openPaymentDialog(fee)}
                        >
                          <DollarSign className="h-4 w-4 mr-1" />
                          Pay
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Payment Dialog */}
        <Dialog open={showPaymentDialog} onOpenChange={setShowPaymentDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Record Hostel Payment</DialogTitle>
              <DialogDescription>
                {selectedFee && (
                  <>
                    Recording payment for trainee <strong>{selectedFee.trainee_id}</strong>
                  </>
                )}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {selectedFee && (
                <div className="grid grid-cols-3 gap-4 p-4 bg-muted rounded-lg">
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground">Fee Amount</p>
                    <p className="font-bold">
                      N$ {Number(selectedFee.fee_amount).toLocaleString()}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground">Paid</p>
                    <p className="font-bold text-green-600">
                      N$ {Number(selectedFee.amount_paid).toLocaleString()}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground">Balance</p>
                    <p className="font-bold text-primary">
                      N$ {Number(selectedFee.balance).toLocaleString()}
                    </p>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="amount">Payment Amount (N$)</Label>
                <Input
                  id="amount"
                  type="number"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  placeholder="Enter amount"
                />
              </div>

              <div className="space-y-2">
                <Label>Payment Method</Label>
                <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select method" />
                  </SelectTrigger>
                  <SelectContent>
                    {PAYMENT_METHODS.map((method) => (
                      <SelectItem key={method.id} value={method.id}>
                        {method.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowPaymentDialog(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleRecordPayment}
                disabled={payHostelFee.isPending || !paymentAmount}
              >
                {payHostelFee.isPending ? "Processing..." : "Record Payment"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
};
