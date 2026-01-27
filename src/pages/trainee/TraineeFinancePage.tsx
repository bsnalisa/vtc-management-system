import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DashboardLayout } from "@/components/DashboardLayout";
import { traineeNavItems } from "@/lib/navigationConfig";
import { DollarSign, Download, FileText, AlertCircle, CheckCircle, Clock, ArrowRight } from "lucide-react";
import { withRoleAccess } from "@/components/withRoleAccess";
import { Separator } from "@/components/ui/separator";

interface FeeItem {
  id: string;
  description: string;
  amount: number;
  dueDate: string;
  status: "paid" | "partial" | "pending" | "overdue";
  amountPaid: number;
}

const TraineeFinancePage = () => {
  // Mock fee data - in production, fetch from fee_records / invoices
  const feeItems: FeeItem[] = [
    { id: "1", description: "Tuition Fee - Semester 1", amount: 8000, dueDate: "Jan 31, 2025", status: "paid", amountPaid: 8000 },
    { id: "2", description: "Registration Fee", amount: 500, dueDate: "Jan 15, 2025", status: "paid", amountPaid: 500 },
    { id: "3", description: "Workshop Materials", amount: 1500, dueDate: "Feb 15, 2025", status: "partial", amountPaid: 750 },
    { id: "4", description: "Examination Fee", amount: 350, dueDate: "Mar 01, 2025", status: "pending", amountPaid: 0 },
  ];

  const totalFees = feeItems.reduce((sum, item) => sum + item.amount, 0);
  const totalPaid = feeItems.reduce((sum, item) => sum + item.amountPaid, 0);
  const totalBalance = totalFees - totalPaid;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "paid":
        return <Badge className="bg-green-100 text-green-800"><CheckCircle className="h-3 w-3 mr-1" />Paid</Badge>;
      case "partial":
        return <Badge className="bg-yellow-100 text-yellow-800"><Clock className="h-3 w-3 mr-1" />Partial</Badge>;
      case "pending":
        return <Badge className="bg-blue-100 text-blue-800"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
      case "overdue":
        return <Badge className="bg-red-100 text-red-800"><AlertCircle className="h-3 w-3 mr-1" />Overdue</Badge>;
      default:
        return null;
    }
  };

  return (
    <DashboardLayout
      title="Fee Statement"
      subtitle="View your financial status and fee breakdown"
      navItems={traineeNavItems}
      groupLabel="Trainee iEnabler"
    >
      <div className="space-y-6">
        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="border-0 shadow-md bg-gradient-to-br from-blue-50 to-blue-100/50 dark:from-blue-950/30 dark:to-blue-900/20">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Fees</p>
                  <p className="text-3xl font-bold">N$ {totalFees.toLocaleString()}</p>
                </div>
                <div className="p-3 rounded-full bg-blue-100">
                  <DollarSign className="h-6 w-6 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-md bg-gradient-to-br from-green-50 to-green-100/50 dark:from-green-950/30 dark:to-green-900/20">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Paid</p>
                  <p className="text-3xl font-bold text-green-600">N$ {totalPaid.toLocaleString()}</p>
                </div>
                <div className="p-3 rounded-full bg-green-100">
                  <CheckCircle className="h-6 w-6 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-md bg-gradient-to-br from-orange-50 to-orange-100/50 dark:from-orange-950/30 dark:to-orange-900/20">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Balance Due</p>
                  <p className="text-3xl font-bold text-orange-600">N$ {totalBalance.toLocaleString()}</p>
                </div>
                <div className="p-3 rounded-full bg-orange-100">
                  <AlertCircle className="h-6 w-6 text-orange-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Outstanding Balance Alert */}
        {totalBalance > 0 && (
          <Card className="border-0 shadow-md border-l-4 border-l-orange-500">
            <CardContent className="p-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-start gap-4">
                  <AlertCircle className="h-6 w-6 text-orange-500 mt-0.5" />
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

        {/* Fee Breakdown */}
        <Card className="border-0 shadow-md">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Fee Breakdown</CardTitle>
                <CardDescription>Detailed list of all fee items</CardDescription>
              </div>
              <Button variant="outline" size="sm">
                <Download className="h-4 w-4 mr-2" />
                Download Statement
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {feeItems.map((item) => (
                <div key={item.id} className="flex flex-col md:flex-row md:items-center justify-between p-4 rounded-lg border">
                  <div className="flex items-start gap-4 mb-4 md:mb-0">
                    <div className="p-2 rounded-lg bg-muted">
                      <FileText className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div>
                      <h4 className="font-medium">{item.description}</h4>
                      <p className="text-sm text-muted-foreground">Due: {item.dueDate}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <p className="font-bold">N$ {item.amount.toLocaleString()}</p>
                      {item.status === "partial" && (
                        <p className="text-sm text-muted-foreground">
                          Paid: N$ {item.amountPaid.toLocaleString()}
                        </p>
                      )}
                    </div>
                    {getStatusBadge(item.status)}
                  </div>
                </div>
              ))}
            </div>

            <Separator className="my-6" />

            <div className="flex justify-between items-center p-4 rounded-lg bg-muted">
              <span className="font-semibold">Total Balance</span>
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
      </div>
    </DashboardLayout>
  );
};

export default withRoleAccess(TraineeFinancePage, {
  requiredRoles: ["trainee"],
});
