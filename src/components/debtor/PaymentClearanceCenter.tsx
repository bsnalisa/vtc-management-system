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
  DollarSign, 
  Search,
  User,
  Phone,
  Briefcase,
  Sparkles,
} from "lucide-react";
import { usePaymentClearances, useClearPayment, PaymentClearance } from "@/hooks/usePaymentClearances";

const PAYMENT_METHODS = [
  { id: "training_grant", label: "Training Grant", description: "Government training grant" },
  { id: "cash", label: "Cash", description: "Physical cash payment" },
  { id: "card", label: "Card", description: "Debit/Credit card" },
  { id: "bank_transfer", label: "Bank Transfer", description: "Electronic transfer" },
  { id: "mobile_money", label: "Mobile Money", description: "MTC ePay, EWallet" },
];

export const PaymentClearanceCenter = () => {
  const [activeTab, setActiveTab] = useState("pending");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedClearance, setSelectedClearance] = useState<PaymentClearance | null>(null);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("training_grant");
  const [paymentNotes, setPaymentNotes] = useState("");
  const [showClearDialog, setShowClearDialog] = useState(false);

  const { data: clearances, isLoading } = usePaymentClearances(
    activeTab === "all" ? undefined : activeTab
  );
  const clearPayment = useClearPayment();

  const filteredClearances = clearances?.filter((c) => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    const name = c.trainee_applications
      ? `${c.trainee_applications.first_name} ${c.trainee_applications.last_name}`
      : c.trainees
      ? `${c.trainees.first_name} ${c.trainees.last_name}`
      : "";
    const traineeNumber = c.trainee_applications?.trainee_number || c.trainees?.trainee_id || "";
    return (
      name.toLowerCase().includes(searchLower) ||
      traineeNumber.toLowerCase().includes(searchLower)
    );
  });

  const handleClearPayment = () => {
    if (!selectedClearance || !paymentAmount) return;

    clearPayment.mutate(
      {
        clearance_id: selectedClearance.id,
        amount: parseFloat(paymentAmount),
        payment_method: paymentMethod,
        notes: paymentNotes,
      },
      {
        onSuccess: () => {
          setShowClearDialog(false);
          setSelectedClearance(null);
          setPaymentAmount("");
          setPaymentMethod("training_grant");
          setPaymentNotes("");
        },
      }
    );
  };

  const openClearDialog = (clearance: PaymentClearance) => {
    setSelectedClearance(clearance);
    setPaymentAmount(String(clearance.balance));
    setShowClearDialog(true);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return (
          <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400">
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
          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400">
            <CheckCircle className="h-3 w-3 mr-1" />
            Cleared
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getSourceBadge = (source: string | null) => {
    switch (source) {
      case "registration":
        return <Badge variant="secondary">Registration</Badge>;
      case "hostel":
        return <Badge variant="secondary" className="bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">Hostel</Badge>;
      default:
        return null;
    }
  };

  const ClearanceCard = ({ clearance }: { clearance: PaymentClearance }) => {
    const applicant = clearance.trainee_applications || clearance.trainees;
    const name = applicant
      ? `${applicant.first_name} ${applicant.last_name}`
      : "Unknown";
    const traineeNumber = clearance.trainee_applications?.trainee_number || clearance.trainees?.trainee_id || "N/A";

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
                  {getStatusBadge(clearance.status)}
                  {getSourceBadge(clearance.source_dashboard)}
                </div>
                <p className="text-sm text-muted-foreground font-mono">{traineeNumber}</p>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Briefcase className="h-3 w-3" />
                    {clearance.clearance_type || "Registration"}
                  </span>
                  {applicant?.phone && (
                    <span className="flex items-center gap-1">
                      <Phone className="h-3 w-3" />
                      {applicant.phone}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
              <div className="text-right">
                <p className="text-sm text-muted-foreground">Balance</p>
                <p className="text-xl font-bold text-primary">
                  N$ {Number(clearance.balance).toLocaleString()}
                </p>
                {clearance.amount_paid > 0 && (
                  <p className="text-xs text-green-600">
                    Paid: N$ {Number(clearance.amount_paid).toLocaleString()}
                  </p>
                )}
              </div>

              {clearance.status !== "cleared" && (
                <Button onClick={() => openClearDialog(clearance)} className="whitespace-nowrap">
                  <Sparkles className="h-4 w-4 mr-2" />
                  Clear Payment
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    );
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
              <Skeleton key={i} className="h-24 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Search and Filter */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Payment Clearance Center
          </CardTitle>
          <CardDescription>
            Process payments and unlock trainee registrations
          </CardDescription>
        </CardHeader>
        <CardContent>
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

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="pending" className="relative">
            Pending
            {clearances?.filter((c) => c.status === "pending").length ? (
              <Badge className="ml-2 h-5 px-1.5" variant="destructive">
                {clearances.filter((c) => c.status === "pending").length}
              </Badge>
            ) : null}
          </TabsTrigger>
          <TabsTrigger value="partial">Partial</TabsTrigger>
          <TabsTrigger value="cleared">Cleared</TabsTrigger>
          <TabsTrigger value="all">All</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-4 space-y-4">
          {filteredClearances?.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
                <h3 className="font-semibold text-lg">All Caught Up!</h3>
                <p className="text-muted-foreground">
                  No {activeTab === "all" ? "" : activeTab} payment clearances at the moment.
                </p>
              </CardContent>
            </Card>
          ) : (
            filteredClearances?.map((clearance) => (
              <ClearanceCard key={clearance.id} clearance={clearance} />
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
              Clear Payment
            </DialogTitle>
            <DialogDescription>
              {selectedClearance && (
                <>
                  Processing payment for{" "}
                  <strong>
                    {selectedClearance.trainee_applications?.first_name ||
                      selectedClearance.trainees?.first_name}{" "}
                    {selectedClearance.trainee_applications?.last_name ||
                      selectedClearance.trainees?.last_name}
                  </strong>
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Amount Summary */}
            {selectedClearance && (
              <div className="grid grid-cols-3 gap-4 p-4 bg-muted rounded-lg">
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">Required</p>
                  <p className="font-bold">
                    N$ {Number(selectedClearance.amount_required).toLocaleString()}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">Paid</p>
                  <p className="font-bold text-green-600">
                    N$ {Number(selectedClearance.amount_paid).toLocaleString()}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">Balance</p>
                  <p className="font-bold text-primary">
                    N$ {Number(selectedClearance.balance).toLocaleString()}
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
              disabled={clearPayment.isPending || !paymentAmount}
            >
              {clearPayment.isPending ? (
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
