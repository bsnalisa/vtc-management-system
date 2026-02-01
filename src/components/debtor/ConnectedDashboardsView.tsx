import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";
import { 
  ClipboardList, 
  Building, 
  Users, 
  ArrowRight, 
  CheckCircle,
  Clock,
  AlertCircle,
} from "lucide-react";
import { usePaymentClearanceStats } from "@/hooks/usePaymentClearances";
import { useHostelFees } from "@/hooks/useHostel";
import { useApplicationStats } from "@/hooks/useTraineeApplications";

export const ConnectedDashboardsView = () => {
  const { data: clearanceStats } = usePaymentClearanceStats();
  const { data: hostelFees } = useHostelFees();
  const { data: applicationStats } = useApplicationStats();

  const hostelPending = hostelFees?.filter(
    (f) => f.payment_status === "pending" || f.payment_status === "overdue"
  ).length || 0;

  const dashboards = [
    {
      title: "Registration Queue",
      description: "Trainees awaiting payment clearance for registration",
      icon: ClipboardList,
      link: "/applications-inbox",
      stats: [
        {
          label: "Pending Payments",
          value: clearanceStats?.totalPending || 0,
          icon: Clock,
          color: "text-yellow-600",
        },
        {
          label: "Cleared Today",
          value: clearanceStats?.cleared || 0,
          icon: CheckCircle,
          color: "text-green-600",
        },
      ],
      badge: clearanceStats?.pending ? `${clearanceStats.pending} pending` : null,
      badgeVariant: "destructive" as const,
    },
    {
      title: "Hostel Fees",
      description: "Manage hostel fee collections and overdue payments",
      icon: Building,
      link: "/hostel",
      stats: [
        {
          label: "Pending Fees",
          value: hostelPending,
          icon: Clock,
          color: "text-yellow-600",
        },
        {
          label: "Overdue",
          value: hostelFees?.filter((f) => f.payment_status === "overdue").length || 0,
          icon: AlertCircle,
          color: "text-red-600",
        },
      ],
      badge: hostelPending > 0 ? `${hostelPending} pending` : null,
      badgeVariant: "outline" as const,
    },
    {
      title: "Trainee List",
      description: "View all trainees and their payment status",
      icon: Users,
      link: "/trainees",
      stats: [
        {
          label: "Total Registered",
          value: (applicationStats?.januaryRegistered || 0) + (applicationStats?.julyRegistered || 0),
          icon: Users,
          color: "text-blue-600",
        },
        {
          label: "Pending Payment",
          value: applicationStats?.pendingPayment || 0,
          icon: Clock,
          color: "text-yellow-600",
        },
      ],
      badge: null,
      badgeVariant: "secondary" as const,
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          🔗 Connected Dashboards
        </CardTitle>
        <CardDescription>
          Quick access to related systems with real-time status
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 md:grid-cols-3">
          {dashboards.map((dashboard) => (
            <Card key={dashboard.title} className="relative overflow-hidden hover:shadow-md transition-shadow">
              {dashboard.badge && (
                <Badge 
                  variant={dashboard.badgeVariant}
                  className="absolute top-4 right-4"
                >
                  {dashboard.badge}
                </Badge>
              )}
              <CardHeader className="pb-2">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <dashboard.icon className="h-5 w-5 text-primary" />
                  </div>
                  <CardTitle className="text-base">{dashboard.title}</CardTitle>
                </div>
                <CardDescription className="text-xs">
                  {dashboard.description}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-2">
                  {dashboard.stats.map((stat) => (
                    <div key={stat.label} className="text-center p-2 rounded-lg bg-muted/50">
                      <div className="flex items-center justify-center gap-1">
                        <stat.icon className={`h-3 w-3 ${stat.color}`} />
                        <span className={`font-bold ${stat.color}`}>{stat.value}</span>
                      </div>
                      <p className="text-[10px] text-muted-foreground">{stat.label}</p>
                    </div>
                  ))}
                </div>
                <Link to={dashboard.link}>
                  <Button variant="outline" size="sm" className="w-full">
                    View Dashboard
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
