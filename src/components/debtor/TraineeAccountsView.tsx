import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Search,
  User,
  ArrowUpDown,
  Wallet,
  CheckCircle,
  AlertCircle,
  History,
} from "lucide-react";
import {
  useFinancialAccounts,
  useFinancialTransactions,
  FinancialAccount,
} from "@/hooks/useFinancialAccounts";
import { format } from "date-fns";

export const TraineeAccountsView = () => {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortBy, setSortBy] = useState<'name' | 'balance' | 'date'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [selectedAccount, setSelectedAccount] = useState<FinancialAccount | null>(null);

  const { data: accounts, isLoading } = useFinancialAccounts({
    search,
    status: statusFilter,
    sortBy,
    sortOrder,
  });
  const { data: transactions, isLoading: transactionsLoading } = useFinancialTransactions(
    selectedAccount?.id
  );

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
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-96" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Wallet className="h-5 w-5" />
                Trainee Accounts
              </CardTitle>
              <CardDescription>
                Read-only view of trainee financial profiles and transaction history
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
              <p className="text-sm">Accounts are created when trainees complete registration</p>
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
                      <TableCell className="text-right text-emerald-600">
                        N$ {Number(account.total_paid).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        N$ {Number(account.balance).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        {account.balance <= 0 ? (
                          <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400">
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
                          <History className="h-4 w-4 mr-1" />
                          History
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

      {/* Account Detail Dialog - Read Only */}
      <Dialog open={!!selectedAccount} onOpenChange={() => setSelectedAccount(null)}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Financial Profile
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
                  <p className="text-lg font-bold text-emerald-600">
                    N$ {Number(selectedAccount.total_paid).toLocaleString()}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">Balance</p>
                  <p className={`text-lg font-bold ${selectedAccount.balance > 0 ? 'text-orange-600' : 'text-emerald-600'}`}>
                    N$ {Number(selectedAccount.balance).toLocaleString()}
                  </p>
                </div>
              </div>

              {/* Transaction History */}
              <div className="space-y-2">
                <h4 className="font-medium flex items-center gap-2">
                  <History className="h-4 w-4" />
                  Transaction History
                </h4>
                
                {transactionsLoading ? (
                  <Skeleton className="h-48" />
                ) : transactions?.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground border rounded-lg">
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
                                : 'text-emerald-600'
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
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
