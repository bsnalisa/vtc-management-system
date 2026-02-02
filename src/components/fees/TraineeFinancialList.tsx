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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  Search,
  User,
  DollarSign,
  ArrowUpDown,
  Plus,
  History,
  Wallet,
  CheckCircle,
  AlertCircle,
  CreditCard,
} from "lucide-react";
import {
  useFinancialAccounts,
  useFinancialTransactions,
  useCreateTransaction,
  useAccountStats,
  FinancialAccount,
} from "@/hooks/useFinancialAccounts";
import { useFeeTypes } from "@/hooks/useFeeTypes";
import { format } from "date-fns";

export const TraineeFinancialList = () => {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortBy, setSortBy] = useState<'name' | 'balance' | 'date'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [selectedAccount, setSelectedAccount] = useState<FinancialAccount | null>(null);
  const [showTransactionDialog, setShowTransactionDialog] = useState(false);
  const [transactionForm, setTransactionForm] = useState({
    transaction_type: "payment" as const,
    amount: "",
    fee_type_id: "",
    payment_method: "cash",
    reference_number: "",
    description: "",
    notes: "",
  });

  const { data: accounts, isLoading } = useFinancialAccounts({
    search,
    status: statusFilter,
    sortBy,
    sortOrder,
  });
  const { data: stats } = useAccountStats();
  const { data: feeTypes } = useFeeTypes();
  const { data: transactions, isLoading: transactionsLoading } = useFinancialTransactions(
    selectedAccount?.id
  );
  const createTransaction = useCreateTransaction();

  const getTraineeName = (account: FinancialAccount) => {
    if (account.trainees) {
      return `${account.trainees.first_name} ${account.trainees.last_name}`;
    }
    if (account.trainee_applications) {
      return `${account.trainee_applications.first_name} ${account.trainee_applications.last_name}`;
    }
    return "Unknown";
  };

  const getTraineeNumber = (account: FinancialAccount) => {
    return account.trainees?.trainee_id || account.trainee_applications?.trainee_number || "N/A";
  };

  const getTradeName = (account: FinancialAccount) => {
    return account.trainees?.trades?.name || account.trainee_applications?.trades?.name || "N/A";
  };

  const handleAddTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAccount) return;

    await createTransaction.mutateAsync({
      account_id: selectedAccount.id,
      transaction_type: transactionForm.transaction_type,
      amount: parseFloat(transactionForm.amount),
      fee_type_id: transactionForm.fee_type_id || undefined,
      payment_method: transactionForm.payment_method || undefined,
      reference_number: transactionForm.reference_number || undefined,
      description: transactionForm.description || undefined,
      notes: transactionForm.notes || undefined,
    });

    setShowTransactionDialog(false);
    setTransactionForm({
      transaction_type: "payment",
      amount: "",
      fee_type_id: "",
      payment_method: "cash",
      reference_number: "",
      description: "",
      notes: "",
    });
  };

  const toggleSort = (column: 'name' | 'balance' | 'date') => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder('asc');
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Accounts</p>
                <p className="text-2xl font-bold">{stats?.totalAccounts || 0}</p>
              </div>
              <Wallet className="h-8 w-8 text-muted-foreground/50" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Fees</p>
                <p className="text-2xl font-bold">N$ {(stats?.totalFees || 0).toLocaleString()}</p>
              </div>
              <DollarSign className="h-8 w-8 text-primary/50" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Collected</p>
                <p className="text-2xl font-bold text-primary">
                  N$ {(stats?.totalCollected || 0).toLocaleString()}
                </p>
              </div>
              <CheckCircle className="h-8 w-8 text-primary/50" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Outstanding</p>
                <p className="text-2xl font-bold text-destructive">
                  N$ {(stats?.totalOutstanding || 0).toLocaleString()}
                </p>
              </div>
              <AlertCircle className="h-8 w-8 text-destructive/50" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main List */}
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Trainee Financial Accounts
              </CardTitle>
              <CardDescription>
                View and manage trainee financial records
              </CardDescription>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search trainees..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10 w-full sm:w-64"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-40">
                  <SelectValue placeholder="Filter" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Accounts</SelectItem>
                  <SelectItem value="pending">With Balance</SelectItem>
                  <SelectItem value="paid">Fully Paid</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {accounts?.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Wallet className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No financial accounts found</p>
              <p className="text-sm">Accounts are created when trainees are registered</p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>
                      <Button variant="ghost" size="sm" onClick={() => toggleSort('name')}>
                        Trainee
                        <ArrowUpDown className="ml-1 h-4 w-4" />
                      </Button>
                    </TableHead>
                    <TableHead>Trade</TableHead>
                    <TableHead className="text-right">Total Fees</TableHead>
                    <TableHead className="text-right">Paid</TableHead>
                    <TableHead className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => toggleSort('balance')}>
                        Balance
                        <ArrowUpDown className="ml-1 h-4 w-4" />
                      </Button>
                    </TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {accounts?.map((account) => (
                    <TableRow key={account.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{getTraineeName(account)}</p>
                          <p className="text-sm text-muted-foreground font-mono">
                            {getTraineeNumber(account)}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>{getTradeName(account)}</TableCell>
                      <TableCell className="text-right">
                        N$ {Number(account.total_fees).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right text-green-600">
                        N$ {Number(account.total_paid).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        N$ {Number(account.balance).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        {account.balance <= 0 ? (
                          <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Paid
                          </Badge>
                        ) : (
                          <Badge className="bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400">
                            <AlertCircle className="h-3 w-3 mr-1" />
                            Balance Due
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedAccount(account)}
                        >
                          View Account
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Account Detail Dialog */}
      <Dialog open={!!selectedAccount} onOpenChange={() => setSelectedAccount(null)}>
        <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Financial Account
            </DialogTitle>
            {selectedAccount && (
              <DialogDescription>
                {getTraineeName(selectedAccount)} • {getTraineeNumber(selectedAccount)}
              </DialogDescription>
            )}
          </DialogHeader>

          {selectedAccount && (
            <div className="space-y-6">
              {/* Account Summary */}
              <div className="grid grid-cols-3 gap-4 p-4 bg-muted rounded-lg">
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">Total Fees</p>
                  <p className="text-lg font-bold">
                    N$ {Number(selectedAccount.total_fees).toLocaleString()}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">Total Paid</p>
                  <p className="text-lg font-bold text-green-600">
                    N$ {Number(selectedAccount.total_paid).toLocaleString()}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">Balance</p>
                  <p className={`text-lg font-bold ${selectedAccount.balance > 0 ? 'text-orange-600' : 'text-green-600'}`}>
                    N$ {Number(selectedAccount.balance).toLocaleString()}
                  </p>
                </div>
              </div>

              <Tabs defaultValue="transactions">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="transactions">
                    <History className="h-4 w-4 mr-2" />
                    Transactions
                  </TabsTrigger>
                  <TabsTrigger value="add">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Transaction
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="transactions" className="mt-4">
                  {transactionsLoading ? (
                    <Skeleton className="h-48" />
                  ) : transactions?.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <History className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p>No transactions yet</p>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {transactions?.map((tx) => (
                        <div
                          key={tx.id}
                          className="flex items-center justify-between p-3 border rounded-lg"
                        >
                          <div>
                            <p className="font-medium capitalize">{tx.transaction_type}</p>
                            <p className="text-sm text-muted-foreground">
                              {tx.description || tx.fee_types?.name || "—"}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {format(new Date(tx.processed_at), "PPp")}
                            </p>
                          </div>
                          <div className="text-right">
                            <p
                              className={`font-bold ${
                                tx.transaction_type === 'charge' || tx.transaction_type === 'refund'
                                  ? 'text-orange-600'
                                  : 'text-green-600'
                              }`}
                            >
                              {tx.transaction_type === 'charge' || tx.transaction_type === 'refund' ? '+' : '-'}
                              N$ {Number(tx.amount).toLocaleString()}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Bal: N$ {Number(tx.balance_after).toLocaleString()}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="add" className="mt-4">
                  <form onSubmit={handleAddTransaction} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Transaction Type</Label>
                        <Select
                          value={transactionForm.transaction_type}
                          onValueChange={(v: any) =>
                            setTransactionForm({ ...transactionForm, transaction_type: v })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="charge">Charge (Add Fee)</SelectItem>
                            <SelectItem value="payment">Payment</SelectItem>
                            <SelectItem value="credit">Credit</SelectItem>
                            <SelectItem value="refund">Refund</SelectItem>
                            <SelectItem value="adjustment">Adjustment</SelectItem>
                            <SelectItem value="waiver">Waiver</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Amount (N$)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={transactionForm.amount}
                          onChange={(e) =>
                            setTransactionForm({ ...transactionForm, amount: e.target.value })
                          }
                          required
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Fee Type</Label>
                        <Select
                          value={transactionForm.fee_type_id}
                          onValueChange={(v) =>
                            setTransactionForm({ ...transactionForm, fee_type_id: v })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select fee type" />
                          </SelectTrigger>
                          <SelectContent>
                            {feeTypes?.map((ft) => (
                              <SelectItem key={ft.id} value={ft.id}>
                                {ft.name} (N$ {ft.default_amount})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Payment Method</Label>
                        <Select
                          value={transactionForm.payment_method}
                          onValueChange={(v) =>
                            setTransactionForm({ ...transactionForm, payment_method: v })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="cash">Cash</SelectItem>
                            <SelectItem value="card">Card</SelectItem>
                            <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                            <SelectItem value="training_grant">Training Grant</SelectItem>
                            <SelectItem value="mobile_money">Mobile Money</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Reference Number</Label>
                      <Input
                        value={transactionForm.reference_number}
                        onChange={(e) =>
                          setTransactionForm({ ...transactionForm, reference_number: e.target.value })
                        }
                        placeholder="Optional"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Description</Label>
                      <Input
                        value={transactionForm.description}
                        onChange={(e) =>
                          setTransactionForm({ ...transactionForm, description: e.target.value })
                        }
                        placeholder="Optional"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Notes</Label>
                      <Textarea
                        value={transactionForm.notes}
                        onChange={(e) =>
                          setTransactionForm({ ...transactionForm, notes: e.target.value })
                        }
                        placeholder="Optional notes..."
                        rows={2}
                      />
                    </div>

                    <Button
                      type="submit"
                      className="w-full"
                      disabled={createTransaction.isPending}
                    >
                      {createTransaction.isPending ? "Processing..." : "Record Transaction"}
                    </Button>
                  </form>
                </TabsContent>
              </Tabs>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
