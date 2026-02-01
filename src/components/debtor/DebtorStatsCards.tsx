import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, Clock, CheckCircle, TrendingUp, Users, Building } from "lucide-react";
import { usePaymentClearanceStats } from "@/hooks/usePaymentClearances";
import { useHostelFees } from "@/hooks/useHostel";
import { useFeeRecords } from "@/hooks/useFeeRecords";

export const DebtorStatsCards = () => {
  const { data: clearanceStats } = usePaymentClearanceStats();
  const { data: hostelFees } = useHostelFees();
  const { data: feeRecords } = useFeeRecords();

  // Calculate hostel fee stats
  const hostelPending = hostelFees?.filter(
    (f) => f.payment_status === "pending" || f.payment_status === "partial"
  ).length || 0;
  const hostelTotalPending = hostelFees?.reduce(
    (sum, f) => sum + (Number(f.balance) || 0),
    0
  ) || 0;

  // Calculate total fee stats
  const totalCollected = feeRecords?.reduce(
    (sum, r) => sum + (Number(r.amount_paid) || 0),
    0
  ) || 0;
  const totalOutstanding = feeRecords?.reduce(
    (sum, r) => sum + (Number(r.balance) || 0),
    0
  ) || 0;

  const collectionRate = totalCollected + totalOutstanding > 0
    ? Math.round((totalCollected / (totalCollected + totalOutstanding)) * 100)
    : 0;

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Pending Clearances</CardTitle>
          <Clock className="h-4 w-4 text-yellow-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-yellow-600">
            {clearanceStats?.pending || 0}
          </div>
          <p className="text-xs text-muted-foreground">
            N$ {(clearanceStats?.pendingAmount || 0).toLocaleString()} pending
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Partial Payments</CardTitle>
          <DollarSign className="h-4 w-4 text-blue-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-blue-600">
            {clearanceStats?.partial || 0}
          </div>
          <p className="text-xs text-muted-foreground">In progress</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Cleared Today</CardTitle>
          <CheckCircle className="h-4 w-4 text-green-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-green-600">
            {clearanceStats?.cleared || 0}
          </div>
          <p className="text-xs text-muted-foreground">
            N$ {(clearanceStats?.clearedAmount || 0).toLocaleString()} cleared
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Collection Rate</CardTitle>
          <TrendingUp className="h-4 w-4 text-primary" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{collectionRate}%</div>
          <p className="text-xs text-muted-foreground">Overall collection</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Hostel Fees Pending</CardTitle>
          <Building className="h-4 w-4 text-purple-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-purple-600">{hostelPending}</div>
          <p className="text-xs text-muted-foreground">
            N$ {hostelTotalPending.toLocaleString()}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Outstanding</CardTitle>
          <Users className="h-4 w-4 text-orange-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-orange-600">
            N$ {(totalOutstanding / 1000).toFixed(0)}K
          </div>
          <p className="text-xs text-muted-foreground">All fee balances</p>
        </CardContent>
      </Card>
    </div>
  );
};
