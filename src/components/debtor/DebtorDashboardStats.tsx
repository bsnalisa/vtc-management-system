import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  DollarSign, 
  Clock, 
  CheckCircle, 
  TrendingUp, 
  FileText, 
  GraduationCap,
  Building 
} from "lucide-react";
import { useFinancialQueueStats } from "@/hooks/useFinancialQueue";

export const DebtorDashboardStats = () => {
  const { data: stats, isLoading } = useFinancialQueueStats();

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-4" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-16 mb-1" />
              <Skeleton className="h-3 w-32" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const pendingApplicationFees = stats?.applicationFeesPending || 0;
  const pendingRegistrationFees = stats?.registrationFeesPending || 0;
  const pendingHostelFees = stats?.hostelFeesPending || 0;
  const totalOutstanding = stats?.totalOutstanding || 0;
  const clearedToday = stats?.clearedToday || 0;
  const collectedToday = stats?.collectedTodayAmount || 0;
  const collectionRate = stats?.totalAmount && stats.totalAmount > 0
    ? Math.round((stats.totalCollected / stats.totalAmount) * 100)
    : 0;

  return (
    <div className="space-y-4">
      {/* Primary Stats Row */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending App Fees</CardTitle>
            <FileText className="h-4 w-4 text-violet-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-violet-600">
              {pendingApplicationFees}
            </div>
            <p className="text-xs text-muted-foreground">
              Awaiting clearance for identity creation
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Reg Fees</CardTitle>
            <GraduationCap className="h-4 w-4 text-sky-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-sky-600">
              {pendingRegistrationFees}
            </div>
            <p className="text-xs text-muted-foreground">
              Awaiting clearance for enrollment
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Hostel Fees</CardTitle>
            <Building className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">
              {pendingHostelFees}
            </div>
            <p className="text-xs text-muted-foreground">
              Awaiting hostel fee payments
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Outstanding</CardTitle>
            <DollarSign className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              N$ {(totalOutstanding / 1000).toFixed(1)}K
            </div>
            <p className="text-xs text-muted-foreground">
              All pending balances
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Secondary Stats Row */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cleared Today</CardTitle>
            <CheckCircle className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">
              {clearedToday}
            </div>
            <p className="text-xs text-muted-foreground">
              N$ {collectedToday.toLocaleString()} collected
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
            <p className="text-xs text-muted-foreground">
              N$ {(stats?.totalCollected || 0).toLocaleString()} of N$ {(stats?.totalAmount || 0).toLocaleString()}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Queue Total</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats?.pending || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              {stats?.partial || 0} partial payments in progress
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
