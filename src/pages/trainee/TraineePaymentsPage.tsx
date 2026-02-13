import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DashboardLayout } from "@/components/DashboardLayout";
import { traineeNavItems } from "@/lib/navigationConfig";
import { CreditCard, Download, Receipt, CheckCircle, Calendar, Loader2 } from "lucide-react";
import { withRoleAccess } from "@/components/withRoleAccess";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";

const TraineePaymentsPage = () => {
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserId(data.user?.id || null);
    });
  }, []);

  // Get trainee's financial account
  const { data: account } = useQuery({
    queryKey: ["my-financial-account-for-payments", userId],
    queryFn: async () => {
      if (!userId) return null;
      const { data: trainee } = await supabase
        .from("trainees")
        .select("id")
        .eq("user_id", userId)
        .single();

      if (!trainee) return null;

      const { data: acc } = await supabase
        .from("trainee_financial_accounts")
        .select("*")
        .eq("trainee_id", trainee.id)
        .maybeSingle();

      return acc;
    },
    enabled: !!userId,
  });

  // Fetch real transactions
  const { data: transactions, isLoading } = useQuery({
    queryKey: ["my-payment-transactions", account?.id],
    queryFn: async () => {
      if (!account?.id) return [];
      const { data, error } = await supabase
        .from("financial_transactions")
        .select(`
          id, transaction_type, amount, balance_after, description,
          payment_method, processed_at, fee_types (name)
        `)
        .eq("account_id", account.id)
        .eq("transaction_type", "payment")
        .order("processed_at", { ascending: false });

      if (error) return [];
      return data || [];
    },
    enabled: !!account?.id,
  });

  const totalPayments = transactions?.reduce((sum, p) => sum + Number(p.amount), 0) || 0;

  return (
    <DashboardLayout
      title="Payment History"
      subtitle="View your payment transactions"
      navItems={traineeNavItems}
      groupLabel="Trainee iEnabler"
    >
      <div className="space-y-6">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {/* Payment Summary */}
            <div className="grid gap-4 md:grid-cols-2">
              <Card className="border-0 shadow-md">
                <CardContent className="p-6">
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-lg bg-primary/10">
                      <CheckCircle className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Total Payments Made</p>
                      <p className="text-2xl font-bold text-primary">N$ {totalPayments.toLocaleString()}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-md">
                <CardContent className="p-6">
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-lg bg-muted">
                      <Receipt className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Transactions</p>
                      <p className="text-2xl font-bold">{transactions?.length || 0}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Payment History */}
            <Card className="border-0 shadow-md">
              <CardHeader>
                <CardTitle>Transaction History</CardTitle>
                <CardDescription>All your payment transactions</CardDescription>
              </CardHeader>
              <CardContent>
                {!transactions || transactions.length === 0 ? (
                  <div className="text-center py-12">
                    <Receipt className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="font-semibold">No Payments Yet</h3>
                    <p className="text-muted-foreground">Your payment history will appear here</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {transactions.map((tx) => (
                      <div
                        key={tx.id}
                        className="flex flex-col md:flex-row md:items-center justify-between p-4 rounded-lg border hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-start gap-4 mb-4 md:mb-0">
                          <div className="p-2 rounded-lg bg-primary/10">
                            <CheckCircle className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <h4 className="font-medium">
                              {tx.description || tx.fee_types?.name || "Payment"}
                            </h4>
                            <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
                              <span className="capitalize">{tx.payment_method?.replace(/_/g, ' ') || 'N/A'}</span>
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-6">
                          <div className="text-right">
                            <p className="font-bold text-lg">N$ {Number(tx.amount).toLocaleString()}</p>
                            <div className="flex items-center gap-1 text-sm text-muted-foreground">
                              <Calendar className="h-3 w-3" />
                              <span>
                                {new Date(tx.processed_at).toLocaleDateString("en-ZA", {
                                  year: "numeric", month: "short", day: "numeric",
                                })}
                              </span>
                            </div>
                          </div>
                          <Badge className="bg-primary/10 text-primary border-primary/20">Completed</Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Payment Methods Info */}
            <Card className="border-0 shadow-md">
              <CardHeader>
                <CardTitle>Accepted Payment Methods</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="p-4 rounded-lg border text-center">
                    <CreditCard className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                    <h4 className="font-medium">Bank Transfer</h4>
                    <p className="text-sm text-muted-foreground">Direct bank deposit or EFT</p>
                  </div>
                  <div className="p-4 rounded-lg border text-center">
                    <Receipt className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                    <h4 className="font-medium">Cash</h4>
                    <p className="text-sm text-muted-foreground">Pay at Finance Office</p>
                  </div>
                  <div className="p-4 rounded-lg border text-center">
                    <CreditCard className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                    <h4 className="font-medium">Training Grant</h4>
                    <p className="text-sm text-muted-foreground">Government training grants</p>
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

export default withRoleAccess(TraineePaymentsPage, {
  requiredRoles: ["trainee"],
});
