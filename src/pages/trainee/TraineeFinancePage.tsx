import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DashboardLayout } from "@/components/DashboardLayout";
import { traineeNavItems } from "@/lib/navigationConfig";
import { DollarSign, Download, FileText, AlertCircle, CheckCircle, Clock, ArrowRight, Loader2 } from "lucide-react";
import { withRoleAccess } from "@/components/withRoleAccess";
import { Separator } from "@/components/ui/separator";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";

interface Transaction {
  id: string;
  transaction_type: string;
  amount: number;
  balance_after: number;
  description: string | null;
  payment_method: string | null;
  processed_at: string;
  fee_types?: { name: string } | null;
}

const TraineeFinancePage = () => {
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserId(data.user?.id || null);
    });
  }, []);

  // Fetch trainee's financial account
  const { data: account, isLoading: accountLoading } = useQuery({
    queryKey: ["my-financial-account", userId],
    queryFn: async () => {
      if (!userId) return null;

      // First get the trainee record
      const { data: trainee } = await supabase
        .from("trainees")
        .select("id")
        .eq("user_id", userId)
        .single();

      if (!trainee) {
        // Try to get from application
        const { data: application } = await supabase
          .from("trainee_applications")
          .select("id")
          .eq("user_id", userId)
          .single();

        if (!application) return null;

        const { data: appAccount, error } = await supabase
          .from("trainee_financial_accounts")
          .select("*")
          .eq("application_id", application.id)
          .single();

        if (error) return null;
        return appAccount;
      }

      const { data: traineeAccount, error } = await supabase
        .from("trainee_financial_accounts")
        .select("*")
        .eq("trainee_id", trainee.id)
        .single();

      if (error) return null;
      return traineeAccount;
    },
    enabled: !!userId,
  });

  // Fetch transactions
  const { data: transactions, isLoading: transactionsLoading } = useQuery({
    queryKey: ["my-transactions", account?.id],
    queryFn: async () => {
      if (!account?.id) return [];

      const { data, error } = await supabase
        .from("financial_transactions")
        .select(`
          id,
          transaction_type,
          amount,
          balance_after,
          description,
          payment_method,
          processed_at,
          fee_types (name)
        `)
        .eq("account_id", account.id)
        .order("processed_at", { ascending: false })
        .limit(20);

      if (error) return [];
      return data as Transaction[];
    },
    enabled: !!account?.id,
  });

  const totalFees = Number(account?.total_fees || 0);
  const totalPaid = Number(account?.total_paid || 0);
  const totalBalance = Number(account?.balance || 0);

  const getStatusBadge = (type: string) => {
    switch (type) {
      case "payment":
      case "credit":
      case "waiver":
        return <Badge variant="outline" className="border-primary/50 bg-primary/10 text-primary"><CheckCircle className="h-3 w-3 mr-1" />Payment</Badge>;
      case "charge":
        return <Badge variant="outline" className="border-destructive/50 bg-destructive/10 text-destructive"><AlertCircle className="h-3 w-3 mr-1" />Charge</Badge>;
      case "refund":
        return <Badge variant="outline" className="border-muted-foreground/50 bg-muted text-muted-foreground"><Clock className="h-3 w-3 mr-1" />Refund</Badge>;
      default:
        return <Badge variant="secondary">{type}</Badge>;
    }
  };

  const isLoading = accountLoading || transactionsLoading;

  return (
    <DashboardLayout
      title="Fee Statement"
      subtitle="View your financial status and fee breakdown"
      navItems={traineeNavItems}
      groupLabel="Trainee iEnabler"
    >
      <div className="space-y-6">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : !account ? (
          <Card className="border-0 shadow-md">
            <CardContent className="p-12 text-center">
              <DollarSign className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
              <h3 className="font-semibold text-lg">No Financial Account</h3>
              <p className="text-muted-foreground">
                Your financial account will be created once your registration is complete.
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Summary Cards */}
            <div className="grid gap-4 md:grid-cols-3">
              <Card className="border-0 shadow-md bg-gradient-to-br from-primary/5 to-primary/10">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Total Fees</p>
                      <p className="text-3xl font-bold">N$ {totalFees.toLocaleString()}</p>
                    </div>
                    <div className="p-3 rounded-full bg-primary/10">
                      <DollarSign className="h-6 w-6 text-primary" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-md bg-gradient-to-br from-primary/5 to-primary/10">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Total Paid</p>
                      <p className="text-3xl font-bold text-primary">N$ {totalPaid.toLocaleString()}</p>
                    </div>
                    <div className="p-3 rounded-full bg-primary/10">
                      <CheckCircle className="h-6 w-6 text-primary" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-md bg-gradient-to-br from-destructive/5 to-destructive/10">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Balance Due</p>
                      <p className="text-3xl font-bold text-destructive">N$ {totalBalance.toLocaleString()}</p>
                    </div>
                    <div className="p-3 rounded-full bg-destructive/10">
                      <AlertCircle className="h-6 w-6 text-destructive" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Outstanding Balance Alert */}
            {totalBalance > 0 && (
              <Card className="border-0 shadow-md border-l-4 border-l-destructive">
                <CardContent className="p-6">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-start gap-4">
                      <AlertCircle className="h-6 w-6 text-destructive mt-0.5" />
                      <div>
                        <h3 className="font-semibold">Outstanding Balance</h3>
                        <p className="text-muted-foreground">
                          Please clear your outstanding balance to avoid any service interruptions.
                        </p>
                      </div>
                    </div>
                    <Button>
                      Pay Now
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Transaction History */}
            <Card className="border-0 shadow-md">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Transaction History</CardTitle>
                    <CardDescription>Recent financial transactions on your account</CardDescription>
                  </div>
                  <Button variant="outline" size="sm">
                    <Download className="h-4 w-4 mr-2" />
                    Download Statement
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {transactions?.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>No transactions yet</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {transactions?.map((tx) => (
                      <div key={tx.id} className="flex flex-col md:flex-row md:items-center justify-between p-4 rounded-lg border">
                        <div className="flex items-start gap-4 mb-4 md:mb-0">
                          <div className="p-2 rounded-lg bg-muted">
                            <FileText className="h-5 w-5 text-muted-foreground" />
                          </div>
                          <div>
                            <h4 className="font-medium">
                              {tx.description || tx.fee_types?.name || tx.transaction_type}
                            </h4>
                            <p className="text-sm text-muted-foreground">
                              {new Date(tx.processed_at).toLocaleDateString("en-ZA", {
                                year: "numeric",
                                month: "short",
                                day: "numeric",
                              })}
                            </p>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-6">
                          <div className="text-right">
                            <p className={`font-bold ${
                              tx.transaction_type === 'charge' || tx.transaction_type === 'refund'
                                ? 'text-destructive'
                                : 'text-primary'
                            }`}>
                              {tx.transaction_type === 'charge' ? '+' : '-'}N$ {Number(tx.amount).toLocaleString()}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Balance: N$ {Number(tx.balance_after).toLocaleString()}
                            </p>
                          </div>
                          {getStatusBadge(tx.transaction_type)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <Separator className="my-6" />

                <div className="flex justify-between items-center p-4 rounded-lg bg-muted">
                  <span className="font-semibold">Current Balance</span>
                  <span className="text-2xl font-bold">N$ {totalBalance.toLocaleString()}</span>
                </div>
              </CardContent>
            </Card>

            {/* Payment Instructions */}
            <Card className="border-0 shadow-md">
              <CardHeader>
                <CardTitle>Payment Methods</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="p-4 rounded-lg border">
                    <h4 className="font-semibold mb-2">Bank Transfer</h4>
                    <div className="text-sm space-y-1 text-muted-foreground">
                      <p>Bank: First National Bank</p>
                      <p>Account: VTC Training Centre</p>
                      <p>Account No: 62XXXXXXXX</p>
                      <p>Branch Code: 280172</p>
                    </div>
                  </div>
                  <div className="p-4 rounded-lg border">
                    <h4 className="font-semibold mb-2">Cash Payment</h4>
                    <p className="text-sm text-muted-foreground">
                      Visit the Finance Office (Admin Block, Room 102) during office hours:
                      Monday - Friday, 8:00 AM - 4:30 PM
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </DashboardLayout>
  );
};

export default withRoleAccess(TraineeFinancePage, {
  requiredRoles: ["trainee"],
});