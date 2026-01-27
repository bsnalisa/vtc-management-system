import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DashboardLayout } from "@/components/DashboardLayout";
import { traineeNavItems } from "@/lib/navigationConfig";
import { CreditCard, Download, Receipt, CheckCircle, ArrowRight, Calendar } from "lucide-react";
import { withRoleAccess } from "@/components/withRoleAccess";

interface Payment {
  id: string;
  reference: string;
  description: string;
  amount: number;
  date: string;
  method: string;
  status: "completed" | "pending" | "failed";
}

const TraineePaymentsPage = () => {
  // Mock payment history - in production, fetch from payments table
  const payments: Payment[] = [
    { id: "1", reference: "PAY-2025-00123", description: "Tuition Fee - Semester 1", amount: 8000, date: "Jan 15, 2025", method: "Bank Transfer", status: "completed" },
    { id: "2", reference: "PAY-2025-00124", description: "Registration Fee", amount: 500, date: "Jan 15, 2025", method: "Cash", status: "completed" },
    { id: "3", reference: "PAY-2025-00156", description: "Workshop Materials (Partial)", amount: 750, date: "Feb 10, 2025", method: "Mobile Payment", status: "completed" },
  ];

  const totalPayments = payments
    .filter(p => p.status === "completed")
    .reduce((sum, p) => sum + p.amount, 0);

  return (
    <DashboardLayout
      title="Payment History"
      subtitle="View your payment transactions"
      navItems={traineeNavItems}
      groupLabel="Trainee iEnabler"
    >
      <div className="space-y-6">
        {/* Make a Payment Card */}
        <Card className="border-0 shadow-md bg-gradient-to-r from-primary/5 to-primary/10">
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="p-4 rounded-full bg-primary/10">
                  <CreditCard className="h-8 w-8 text-primary" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold">Make a Payment</h3>
                  <p className="text-muted-foreground">Pay your fees online securely</p>
                </div>
              </div>
              <Button size="lg">
                Pay Now
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Payment Summary */}
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="border-0 shadow-md">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-green-100">
                  <CheckCircle className="h-6 w-6 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Payments Made</p>
                  <p className="text-2xl font-bold text-green-600">N$ {totalPayments.toLocaleString()}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-md">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-blue-100">
                  <Receipt className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Transactions</p>
                  <p className="text-2xl font-bold">{payments.length}</p>
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
            {payments.length > 0 ? (
              <div className="space-y-4">
                {payments.map((payment) => (
                  <div
                    key={payment.id}
                    className="flex flex-col md:flex-row md:items-center justify-between p-4 rounded-lg border hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-start gap-4 mb-4 md:mb-0">
                      <div className="p-2 rounded-lg bg-green-100">
                        <CheckCircle className="h-5 w-5 text-green-600" />
                      </div>
                      <div>
                        <h4 className="font-medium">{payment.description}</h4>
                        <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
                          <span className="font-mono">{payment.reference}</span>
                          <span>•</span>
                          <span>{payment.method}</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-6">
                      <div className="text-right">
                        <p className="font-bold text-lg">N$ {payment.amount.toLocaleString()}</p>
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          <span>{payment.date}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className="bg-green-100 text-green-800">Completed</Badge>
                        <Button variant="ghost" size="icon">
                          <Download className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <Receipt className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="font-semibold">No Payments Yet</h3>
                <p className="text-muted-foreground">Your payment history will appear here</p>
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
                <h4 className="font-medium">Mobile Payment</h4>
                <p className="text-sm text-muted-foreground">MTC ePay, EWallet</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default withRoleAccess(TraineePaymentsPage, {
  requiredRoles: ["trainee"],
});
