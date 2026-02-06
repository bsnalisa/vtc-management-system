import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  CheckCircle, 
  Clock, 
  AlertCircle, 
  Search,
  User,
  Phone,
  FileText,
  Sparkles,
  GraduationCap,
  Building,
  CreditCard,
} from "lucide-react";
import { 
  useFinancialQueue, 
  useClearApplicationFee, 
  useClearRegistrationFee,
  FinancialQueueEntry 
} from "@/hooks/useFinancialQueue";

const PAYMENT_METHODS = [
  { id: "training_grant", label: "Training Grant", description: "Government training grant" },
  { id: "cash", label: "Cash", description: "Physical cash payment" },
  { id: "card", label: "Card", description: "Debit/Credit card" },
  { id: "bank_transfer", label: "Bank Transfer", description: "Electronic transfer" },
  { id: "mobile_money", label: "Mobile Money", description: "MTC ePay, EWallet" },
];

export const PaymentClearancePage = () => {
  const [entityFilter, setEntityFilter] = useState("APPLICATION");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedEntry, setSelectedEntry] = useState<FinancialQueueEntry | null>(null);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("training_grant");
  const [paymentNotes, setPaymentNotes] = useState("");
  const [showClearDialog, setShowClearDialog] = useState(false);

  // Always filter by pending status - this is the clearance queue
  const { data: queueEntries, isLoading } = useFinancialQueue("pending", entityFilter);
  
  const clearApplicationFee = useClearApplicationFee();
  const clearRegistrationFee = useClearRegistrationFee();

  const filteredEntries = queueEntries?.filter((entry) => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    const name = entry.trainee_applications
      ? `${entry.trainee_applications.first_name} ${entry.trainee_applications.last_name}`
      : entry.trainees
      ? `${entry.trainees.first_name} ${entry.trainees.last_name}`
      : "";
    const traineeNumber = entry.trainee_applications?.trainee_number || entry.trainees?.trainee_id || "";
    return (
      name.toLowerCase().includes(searchLower) ||
      traineeNumber.toLowerCase().includes(searchLower)
    );
  });

  const handleClearPayment = () => {
    if (!selectedEntry || !paymentAmount) return;

    const mutationFn = selectedEntry.entity_type === 'APPLICATION' 
      ? clearApplicationFee 
      : clearRegistrationFee;

    mutationFn.mutate(
      {
        queue_id: selectedEntry.id,
        amount: parseFloat(paymentAmount),
        payment_method: paymentMethod,
        notes: paymentNotes,
      },
      {
        onSuccess: () => {
          setShowClearDialog(false);
          setSelectedEntry(null);
          setPaymentAmount("");
          setPaymentMethod("training_grant");
          setPaymentNotes("");
        },
      }
    );
  };

  const openClearDialog = (entry: FinancialQueueEntry) => {
    setSelectedEntry(entry);
    setPaymentAmount(String(entry.balance));
    setShowClearDialog(true);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return (
          <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400">
            <Clock className="h-3 w-3 mr-1" />
            Pending
          </Badge>
        );
      case "partial":
        return (
          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400">
            <AlertCircle className="h-3 w-3 mr-1" />
            Partial
          </Badge>
        );
      case "cleared":
        return (
          <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400">
            <CheckCircle className="h-3 w-3 mr-1" />
            Cleared
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const QueueEntryCard = ({ entry }: { entry: FinancialQueueEntry }) => {
    const person = entry.trainee_applications || entry.trainees;
    const name = person ? `${person.first_name} ${person.last_name}` : "Unknown";
    const traineeNumber = entry.trainee_applications?.trainee_number || entry.trainees?.trainee_id || "N/A";
    const phone = person?.phone;

    return (
      <Card className="hover:shadow-md transition-shadow">
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-full bg-primary/10">
                <User className="h-5 w-5 text-primary" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className="font-semibold">{name}</h4>
                  {getStatusBadge(entry.status)}
                </div>
                <p className="text-sm text-muted-foreground font-mono">{traineeNumber}</p>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span>{entry.description || entry.fee_types?.name || "Fee"}</span>
                  {phone && (
                    <span className="flex items-center gap-1">
                      <Phone className="h-3 w-3" />
                      {phone}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
              <div className="text-right">
                <p className="text-sm text-muted-foreground">Balance</p>
                <p className="text-xl font-bold text-primary">
                  N$ {Number(entry.balance).toLocaleString()}
                </p>
                {entry.amount_paid > 0 && (
                  <p className="text-xs text-emerald-600">
                    Paid: N$ {Number(entry.amount_paid).toLocaleString()}
                  </p>
                )}
              </div>

              <Button onClick={() => openClearDialog(entry)} className="whitespace-nowrap">
                <Sparkles className="h-4 w-4 mr-2" />
                Clear Payment
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-16 w-full" />
        {[1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
    );
  }

  const isPending = clearApplicationFee.isPending || clearRegistrationFee.isPending;

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Payment Clearance Queue
          </CardTitle>
          <CardDescription>
            Clear fees to trigger automated workflows • Application fees create trainee accounts • Registration fees complete enrollment
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name or trainee number..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Fee Type Tabs */}
      <Tabs value={entityFilter} onValueChange={setEntityFilter}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="APPLICATION" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Application Fees
            {queueEntries?.filter(e => e.entity_type === 'APPLICATION').length ? (
              <Badge variant="secondary" className="ml-1">
                {queueEntries.filter(e => e.entity_type === 'APPLICATION').length}
              </Badge>
            ) : null}
          </TabsTrigger>
          <TabsTrigger value="REGISTRATION" className="flex items-center gap-2">
            <GraduationCap className="h-4 w-4" />
            Registration Fees
            {queueEntries?.filter(e => e.entity_type === 'REGISTRATION').length ? (
              <Badge variant="secondary" className="ml-1">
                {queueEntries.filter(e => e.entity_type === 'REGISTRATION').length}
              </Badge>
            ) : null}
          </TabsTrigger>
          <TabsTrigger value="HOSTEL" className="flex items-center gap-2">
            <Building className="h-4 w-4" />
            Hostel Fees
            {queueEntries?.filter(e => e.entity_type === 'HOSTEL').length ? (
              <Badge variant="secondary" className="ml-1">
                {queueEntries.filter(e => e.entity_type === 'HOSTEL').length}
              </Badge>
            ) : null}
          </TabsTrigger>
        </TabsList>

        <TabsContent value={entityFilter} className="mt-4 space-y-4">
          {filteredEntries?.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <CheckCircle className="h-12 w-12 text-emerald-500 mx-auto mb-4" />
                <h3 className="font-semibold text-lg">Queue Clear!</h3>
                <p className="text-muted-foreground">
                  No pending {entityFilter.toLowerCase()} fees to process.
                </p>
              </CardContent>
            </Card>
          ) : (
            filteredEntries?.map((entry) => (
              <QueueEntryCard key={entry.id} entry={entry} />
            ))
          )}
        </TabsContent>
      </Tabs>

      {/* Clear Payment Dialog */}
      <Dialog open={showClearDialog} onOpenChange={setShowClearDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Clear {selectedEntry?.entity_type === 'APPLICATION' ? 'Application' : 
                     selectedEntry?.entity_type === 'REGISTRATION' ? 'Registration' : 'Hostel'} Fee
            </DialogTitle>
            <DialogDescription>
              {selectedEntry && (
                <>
                  Processing payment for{" "}
                  <strong>
                    {selectedEntry.trainee_applications?.first_name ||
                      selectedEntry.trainees?.first_name}{" "}
                    {selectedEntry.trainee_applications?.last_name ||
                      selectedEntry.trainees?.last_name}
                  </strong>
                  {selectedEntry.entity_type === 'APPLICATION' && (
                    <span className="block text-xs mt-1 text-emerald-600">
                      ✓ Trainee account will be created automatically upon clearance
                    </span>
                  )}
                  {selectedEntry.entity_type === 'REGISTRATION' && (
                    <span className="block text-xs mt-1 text-sky-600">
                      ✓ Enrollment will be activated upon clearance
                    </span>
                  )}
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Amount Summary */}
            {selectedEntry && (
              <div className="grid grid-cols-3 gap-4 p-4 bg-muted rounded-lg">
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">Required</p>
                  <p className="font-bold">
                    N$ {Number(selectedEntry.amount).toLocaleString()}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">Paid</p>
                  <p className="font-bold text-emerald-600">
                    N$ {Number(selectedEntry.amount_paid).toLocaleString()}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">Balance</p>
                  <p className="font-bold text-primary">
                    N$ {Number(selectedEntry.balance).toLocaleString()}
                  </p>
                </div>
              </div>
            )}

            {/* Payment Amount */}
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
              <div className="grid grid-cols-2 gap-2">
                {PAYMENT_METHODS.map((method) => (
                  <div
                    key={method.id}
                    className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                      paymentMethod === method.id
                        ? "border-primary bg-primary/5"
                        : "hover:border-primary/50"
                    }`}
                    onClick={() => setPaymentMethod(method.id)}
                  >
                    <p className="font-medium text-sm">{method.label}</p>
                    <p className="text-xs text-muted-foreground">{method.description}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label htmlFor="notes">Notes (Optional)</Label>
              <Textarea
                id="notes"
                value={paymentNotes}
                onChange={(e) => setPaymentNotes(e.target.value)}
                placeholder="Add any additional notes..."
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowClearDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleClearPayment}
              disabled={isPending || !paymentAmount}
            >
              {isPending ? (
                "Processing..."
              ) : (
                <>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Confirm Payment
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
