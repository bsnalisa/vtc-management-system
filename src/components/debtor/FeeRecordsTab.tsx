import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
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
import { Textarea } from "@/components/ui/textarea";
import { Search, Plus, DollarSign, Receipt } from "lucide-react";
import { useFeeRecords, useRecordPayment } from "@/hooks/useFeeRecords";
import { format } from "date-fns";

interface FeeRecord {
  id: string;
  trainee_id: string;
  total_fee: number;
  amount_paid: number;
  balance: number;
  academic_year: string;
  created_at: string;
  organization_id: string;
  trainees?: {
    id: string;
    trainee_id: string;
    first_name: string;
    last_name: string;
    trades?: {
      name: string;
    } | null;
  } | null;
}

const PAYMENT_METHODS = [
  { id: "cash", label: "Cash" },
  { id: "card", label: "Card" },
  { id: "bank_transfer", label: "Bank Transfer" },
  { id: "mobile_money", label: "Mobile Money" },
  { id: "training_grant", label: "Training Grant" },
];

export const FeeRecordsTab = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedRecord, setSelectedRecord] = useState<FeeRecord | null>(null);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [notes, setNotes] = useState("");

  const { data: feeRecords, isLoading } = useFeeRecords();
  const recordPayment = useRecordPayment();

  const filteredRecords = (feeRecords as FeeRecord[] | undefined)?.filter((record) => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    const traineeName = record.trainees
      ? `${record.trainees.first_name} ${record.trainees.last_name}`
      : "";
    return (
      traineeName.toLowerCase().includes(searchLower) ||
      record.trainees?.trainee_id?.toLowerCase().includes(searchLower) ||
      record.academic_year.toLowerCase().includes(searchLower)
    );
  });

  const handleRecordPayment = () => {
    if (!selectedRecord || !paymentAmount) return;

    recordPayment.mutate(
      {
        fee_record_id: selectedRecord.id,
        amount: parseFloat(paymentAmount),
        payment_method: paymentMethod,
        reference_number: referenceNumber || undefined,
        notes: notes || undefined,
      },
      {
        onSuccess: () => {
          setShowPaymentDialog(false);
          setSelectedRecord(null);
          setPaymentAmount("");
          setPaymentMethod("cash");
          setReferenceNumber("");
          setNotes("");
        },
      }
    );
  };

  const openPaymentDialog = (record: FeeRecord) => {
    setSelectedRecord(record);
    setPaymentAmount(String(record.balance));
    setShowPaymentDialog(true);
  };

  const getStatusBadge = (balance: number, totalFee: number) => {
    if (balance <= 0) {
      return <Badge variant="outline" className="border-primary/20 text-primary">Paid</Badge>;
    }
    if (balance < totalFee) {
      return <Badge variant="secondary">Partial</Badge>;
    }
    return <Badge variant="destructive">Pending</Badge>;
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
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Receipt className="h-5 w-5" />
                Fee Records
              </CardTitle>
              <CardDescription>
                View and manage all trainee fee records
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by trainee name or ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Table */}
          {!filteredRecords || filteredRecords.length === 0 ? (
            <div className="text-center py-12">
              <DollarSign className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="font-semibold text-lg">No Fee Records</h3>
              <p className="text-muted-foreground">
                {searchTerm ? "No records match your search." : "No fee records found."}
              </p>
            </div>
          ) : (
            <div className="rounded-md border overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Trainee</TableHead>
                    <TableHead>Trade</TableHead>
                    <TableHead>Academic Year</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Paid</TableHead>
                    <TableHead className="text-right">Balance</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRecords.map((record) => (
                    <TableRow key={record.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">
                            {record.trainees
                              ? `${record.trainees.first_name} ${record.trainees.last_name}`
                              : "Unknown"}
                          </p>
                          <p className="text-sm text-muted-foreground font-mono">
                            {record.trainees?.trainee_id || "N/A"}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>{record.trainees?.trades?.name || "-"}</TableCell>
                      <TableCell>{record.academic_year}</TableCell>
                      <TableCell className="text-right">N$ {Number(record.total_fee).toLocaleString()}</TableCell>
                      <TableCell className="text-right text-primary">
                        N$ {Number(record.amount_paid).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        N$ {Number(record.balance).toLocaleString()}
                      </TableCell>
                      <TableCell>{getStatusBadge(record.balance, record.total_fee)}</TableCell>
                      <TableCell>
                        {format(new Date(record.created_at), "dd MMM yyyy")}
                      </TableCell>
                      <TableCell className="text-right">
                        {record.balance > 0 && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openPaymentDialog(record)}
                          >
                            <Plus className="h-4 w-4 mr-1" />
                            Pay
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Payment Dialog */}
      <Dialog open={showPaymentDialog} onOpenChange={setShowPaymentDialog}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-primary" />
              Record Payment
            </DialogTitle>
            <DialogDescription>
              {selectedRecord?.trainees && (
                <>
                  Recording payment for{" "}
                  <strong>
                    {selectedRecord.trainees.first_name} {selectedRecord.trainees.last_name}
                  </strong>
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Balance Summary */}
            {selectedRecord && (
              <div className="grid grid-cols-2 gap-4 p-4 bg-muted rounded-lg">
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">Total Fee</p>
                  <p className="font-bold">N$ {Number(selectedRecord.total_fee).toLocaleString()}</p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">Balance</p>
                  <p className="font-bold text-primary">N$ {Number(selectedRecord.balance).toLocaleString()}</p>
                </div>
              </div>
            )}

            {/* Amount */}
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

            {/* Payment Method */}
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

            {/* Reference Number */}
            <div className="space-y-2">
              <Label htmlFor="reference">Reference Number (Optional)</Label>
              <Input
                id="reference"
                value={referenceNumber}
                onChange={(e) => setReferenceNumber(e.target.value)}
                placeholder="e.g., Receipt number"
              />
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label htmlFor="notes">Notes (Optional)</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add any additional notes..."
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPaymentDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleRecordPayment}
              disabled={recordPayment.isPending || !paymentAmount}
            >
              {recordPayment.isPending ? "Processing..." : "Record Payment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
