import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
} from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { debtorOfficerNavItems } from "@/lib/navigationConfig";
import { 
  useFinancialQueue, 
  useClearApplicationFee, 
  FinancialQueueEntry 
} from "@/hooks/useFinancialQueue";

const PAYMENT_METHODS = [
  { id: "training_grant", label: "Training Grant", description: "Government training grant" },
  { id: "cash", label: "Cash", description: "Physical cash payment" },
  { id: "card", label: "Card", description: "Debit/Credit card" },
  { id: "bank_transfer", label: "Bank Transfer", description: "Electronic transfer" },
  { id: "mobile_money", label: "Mobile Money", description: "MTC ePay, EWallet" },
];

const ApplicationFees = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedEntry, setSelectedEntry] = useState<FinancialQueueEntry | null>(null);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("training_grant");
  const [paymentNotes, setPaymentNotes] = useState("");
  const [showClearDialog, setShowClearDialog] = useState(false);

  // Query APPLICATION fees with pending status only
  const { data: queueEntries, isLoading } = useFinancialQueue("pending", "APPLICATION");
  const clearApplicationFee = useClearApplicationFee();

  const filteredEntries = queueEntries?.filter((entry) => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    const name = entry.trainee_applications
      ? `${entry.trainee_applications.first_name} ${entry.trainee_applications.last_name}`
      : "";
    const phone = entry.trainee_applications?.phone || "";
    return (
      name.toLowerCase().includes(searchLower) ||
      phone.toLowerCase().includes(searchLower)
    );
  });

  const handleClearPayment = () => {
    if (!selectedEntry || !paymentAmount) return;

    clearApplicationFee.mutate(
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
          <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
            <Clock className="h-3 w-3 mr-1" />
            Pending
          </Badge>
        );
      case "partial":
        return (
          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
            <AlertCircle className="h-3 w-3 mr-1" />
            Partial
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const QueueEntryCard = ({ entry }: { entry: FinancialQueueEntry }) => {
    const person = entry.trainee_applications;
    const name = person ? `${person.first_name} ${person.last_name}` : "Unknown";
    const phone = person?.phone;

    return (
      <Card className="hover:shadow-md transition-shadow">
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-full bg-violet-100">
                <User className="h-5 w-5 text-violet-600" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className="font-semibold">{name}</h4>
                  {getStatusBadge(entry.status)}
                  <Badge variant="outline" className="bg-violet-50 text-violet-700 border-violet-200">
                    APPLICATION_FEE_PENDING
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  Application ID: {entry.entity_id?.slice(0, 8)}...
                </p>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span>{entry.description || entry.fee_types?.name || "Application Fee"}</span>
                  {phone && (
                    <span className="flex items-center gap-1">
                      <Phone className="h-3 w-3" />
                      {phone}
                    </span>
                  )}
                </div>
                <p className="text-xs text-emerald-600 font-medium">
                  ✓ Clearing this fee will create trainee identity (number, email, account)
                </p>
              </div>
            </div>

            <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
              <div className="text-right">
                <p className="text-sm text-muted-foreground">Balance</p>
                <p className="text-xl font-bold text-violet-600">
                  N$ {Number(entry.balance).toLocaleString()}
                </p>
                {entry.amount_paid > 0 && (
                  <p className="text-xs text-emerald-600">
                    Paid: N$ {Number(entry.amount_paid).toLocaleString()}
                  </p>
                )}
              </div>

              <Button onClick={() => openClearDialog(entry)} className="whitespace-nowrap bg-violet-600 hover:bg-violet-700">
                <Sparkles className="h-4 w-4 mr-2" />
                Clear Payment
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <DashboardLayout
      title="Application Fees"
      subtitle="Clear application fees to create trainee identities"
      navItems={debtorOfficerNavItems}
      groupLabel="Financial Operations"
    >
      <div className="space-y-6">
        {/* Header Card */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Pending Application Fees
            </CardTitle>
            <CardDescription>
              Applicants with status APPLICATION_FEE_PENDING • Clearing creates trainee number, system email, and auth account
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name or phone..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </CardContent>
        </Card>

        {/* Queue List */}
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-32 w-full" />
            ))}
          </div>
        ) : filteredEntries?.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <CheckCircle className="h-12 w-12 text-emerald-500 mx-auto mb-4" />
              <h3 className="font-semibold text-lg">All Clear!</h3>
              <p className="text-muted-foreground">
                No pending application fees to process.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {filteredEntries?.map((entry) => (
              <QueueEntryCard key={entry.id} entry={entry} />
            ))}
          </div>
        )}

        {/* Clear Payment Dialog */}
        <Dialog open={showClearDialog} onOpenChange={setShowClearDialog}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-violet-600" />
                Clear Application Fee
              </DialogTitle>
              <DialogDescription>
                {selectedEntry && (
                  <>
                    Processing payment for{" "}
                    <strong>
                      {selectedEntry.trainee_applications?.first_name}{" "}
                      {selectedEntry.trainee_applications?.last_name}
                    </strong>
                    <span className="block text-xs mt-2 text-emerald-600 font-medium">
                      ✓ This will create: Trainee Number, System Email, Auth Account
                    </span>
                    <span className="block text-xs text-emerald-600">
                      ✓ Status will change to PROVISIONALLY_ADMITTED
                    </span>
                  </>
                )}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {selectedEntry && (
                <div className="grid grid-cols-3 gap-4 p-4 bg-muted rounded-lg">
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground">Required</p>
                    <p className="font-bold">N$ {Number(selectedEntry.amount).toLocaleString()}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground">Paid</p>
                    <p className="font-bold text-emerald-600">N$ {Number(selectedEntry.amount_paid).toLocaleString()}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground">Balance</p>
                    <p className="font-bold text-violet-600">N$ {Number(selectedEntry.balance).toLocaleString()}</p>
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
                <div className="grid grid-cols-2 gap-2">
                  {PAYMENT_METHODS.map((method) => (
                    <div
                      key={method.id}
                      className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                        paymentMethod === method.id
                          ? "border-violet-500 bg-violet-50"
                          : "hover:border-violet-300"
                      }`}
                      onClick={() => setPaymentMethod(method.id)}
                    >
                      <p className="font-medium text-sm">{method.label}</p>
                      <p className="text-xs text-muted-foreground">{method.description}</p>
                    </div>
                  ))}
                </div>
              </div>

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
                disabled={clearApplicationFee.isPending || !paymentAmount}
                className="bg-violet-600 hover:bg-violet-700"
              >
                {clearApplicationFee.isPending ? "Processing..." : (
                  <>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Confirm & Create Identity
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};

export default ApplicationFees;
