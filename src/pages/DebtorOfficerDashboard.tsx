import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  DollarSign,
  Plus,
  FileText,
  Bell,
  Users,
  Building,
  CreditCard,
  TrendingUp,
  Zap,
  Search,
  Filter,
  CheckCircle,
  Clock,
  BarChart3,
  Link as LinkIcon,
} from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { debtorOfficerNavItems } from "@/lib/navigationConfig";
import { useProfile } from "@/hooks/useProfile";
import { usePaymentClearances, usePendingClearanceCount, useClearanceStats } from "@/hooks/usePaymentClearances";
import { ClearanceStatsCards } from "@/components/fees/ClearanceStatsCards";
import { PendingClearanceTable } from "@/components/fees/PendingClearanceTable";
import { ApplicationsAwaitingPayment } from "@/components/fees/ApplicationsAwaitingPayment";
import { PaymentModal } from "@/components/fees/PaymentModal";
import { FeeSetupModal } from "@/components/fees/FeeSetupModal";
import { TraineeSearch } from "@/components/fees/TraineeSearch";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { Progress } from "@/components/ui/progress";

const DebtorOfficerDashboard = () => {
  const { data: profile } = useProfile();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showFeeSetupModal, setShowFeeSetupModal] = useState(false);
  const [selectedTrainee, setSelectedTrainee] = useState(null);
  const [activeTab, setActiveTab] = useState("clearance");
  const [showConnectedSystems, setShowConnectedSystems] = useState(true);

  // Fetch clearance data
  const { data: pendingClearances, isLoading: clearancesLoading } = usePaymentClearances("pending");
  const { data: allClearances } = usePaymentClearances("all");
  const { data: pendingCount } = usePendingClearanceCount();
  const { data: stats } = useClearanceStats();

  // Real-time subscription for clearances
  useEffect(() => {
    const channel = supabase
      .channel("debtor-dashboard-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "payment_clearances" }, () => {
        queryClient.invalidateQueries({ queryKey: ["payment-clearances"] });
        queryClient.invalidateQueries({ queryKey: ["pending-clearance-count"] });
        queryClient.invalidateQueries({ queryKey: ["clearance-stats"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "trainee_applications" }, () => {
        queryClient.invalidateQueries({ queryKey: ["applications-awaiting-payment"] });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const paymentMethods = [
    { id: "training_grant", label: "Training Grant", description: "Free education grant", icon: "🎓" },
    { id: "cash", label: "Cash", description: "Physical cash payment", icon: "💵" },
    { id: "card", label: "Card", description: "Debit/Credit card", icon: "💳" },
    { id: "bank_transfer", label: "Bank Transfer", description: "Electronic transfer", icon: "🏦" },
    { id: "mobile_money", label: "Mobile Money", description: "Mobile payment", icon: "📱" },
  ];

  const feeTypes = [
    { id: "hostel_registration", name: "Hostel Registration", amount: 5000, type: "one-time", frequency: "One-time" },
    { id: "hostel_monthly", name: "Hostel Monthly Fee", amount: 1500, type: "recurring", frequency: "Monthly" },
    {
      id: "tuition",
      name: "Tuition Fee",
      amount: 0,
      type: "grant",
      description: "Covered by Training Grant",
      frequency: "Grant",
    },
  ];

  const connectedSystems = [
    { name: "Registration Dashboard", status: "connected", pending: pendingCount, icon: Users, color: "blue" },
    { name: "Trainee Portal", status: "connected", icon: Building, color: "green" },
    { name: "Hostel Coordinator", status: "connected", icon: Building, color: "purple" },
  ];

  const handleGenerateInvoice = (traineeId) => {
    toast({
      title: "Invoice Generated",
      description: "Invoice has been generated and sent to trainee.",
    });
  };

  const handleSendReminder = (traineeId) => {
    toast({
      title: "Reminder Sent",
      description: "Payment reminder has been sent to trainee's portal.",
    });
  };

  const handleQuickClear = (trainee) => {
    setSelectedTrainee(trainee);
    setShowPaymentModal(true);
  };

  return (
    <DashboardLayout
      title={`Welcome, ${profile?.firstname || "User"}`}
      subtitle="Payment Clearance Center"
      navItems={debtorOfficerNavItems}
      groupLabel="Payment Operations"
      showBackButton={false}
    >
      <div className="space-y-6">
        {/* Header Section with Stats and Quick Actions */}
        <div className="grid gap-4 lg:grid-cols-3">
          {/* Left Column - Stats */}
          <div className="lg:col-span-2">
            <ClearanceStatsCards />
          </div>

          {/* Right Column - Connected Systems & Quick Actions */}
          <div className="space-y-4">
            {/* Connected Systems */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <LinkIcon className="h-4 w-4" />
                    Connected Systems
                  </CardTitle>
                  <Button variant="ghost" size="sm" onClick={() => setShowConnectedSystems(!showConnectedSystems)}>
                    {showConnectedSystems ? "Hide" : "Show"}
                  </Button>
                </div>
              </CardHeader>
              {showConnectedSystems && (
                <CardContent className="pt-0">
                  <div className="space-y-3">
                    {connectedSystems.map((system) => (
                      <div key={system.name} className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-lg bg-${system.color}-100 dark:bg-${system.color}-900/30`}>
                            <system.icon className={`h-4 w-4 text-${system.color}-600 dark:text-${system.color}-400`} />
                          </div>
                          <div>
                            <p className="text-sm font-medium">{system.name}</p>
                            <p className="text-xs text-muted-foreground capitalize">{system.status}</p>
                          </div>
                        </div>
                        {system.pending ? (
                          <Badge variant="destructive" className="h-5 px-1.5">
                            {system.pending}
                          </Badge>
                        ) : (
                          <CheckCircle className="h-4 w-4 text-green-500" />
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              )}
            </Card>

            {/* Quick Process Payment */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Quick Process</CardTitle>
              </CardHeader>
              <CardContent>
                <Button
                  onClick={() => setShowPaymentModal(true)}
                  className="w-full h-auto py-3 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
                >
                  <div className="flex items-center justify-center gap-2">
                    <Zap className="h-4 w-4" />
                    <span>Process Payment</span>
                  </div>
                </Button>
                <p className="text-xs text-muted-foreground text-center mt-2">Clear payments in one click</p>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="grid gap-4 lg:grid-cols-3">
          {/* Left Column - Search and Pending Clearances */}
          <div className="lg:col-span-2 space-y-4">
            {/* Trainee Search */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Quick Search</CardTitle>
                <CardDescription>Find trainee by ID or name</CardDescription>
              </CardHeader>
              <CardContent>
                <TraineeSearch
                  onSelectTrainee={setSelectedTrainee}
                  placeholder="Enter trainee number or name..."
                  className="w-full"
                />
                {selectedTrainee && (
                  <div className="mt-4 p-4 border rounded-lg bg-accent/50">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">{selectedTrainee.name}</p>
                        <p className="text-sm text-muted-foreground">ID: {selectedTrainee.id}</p>
                        <Badge variant="outline" className="mt-1">
                          {selectedTrainee.status}
                        </Badge>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => handleGenerateInvoice(selectedTrainee.id)}>
                          Invoice
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => handleSendReminder(selectedTrainee.id)}>
                          <Bell className="h-4 w-4 mr-1" />
                          Remind
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Main Tabs */}
            <Card>
              <CardHeader>
                <Tabs value={activeTab} onValueChange={setActiveTab}>
                  <TabsList className="grid w-full grid-cols-4">
                    <TabsTrigger value="clearance" className="relative">
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        Clearance
                        {(pendingCount || 0) > 0 && (
                          <Badge
                            variant="destructive"
                            className="ml-1 h-5 w-5 p-0 flex items-center justify-center text-xs"
                          >
                            {pendingCount}
                          </Badge>
                        )}
                      </div>
                    </TabsTrigger>
                    <TabsTrigger value="pipeline">
                      <div className="flex items-center gap-2">
                        <TrendingUp className="h-4 w-4" />
                        Pipeline
                      </div>
                    </TabsTrigger>
                    <TabsTrigger value="fees">
                      <div className="flex items-center gap-2">
                        <DollarSign className="h-4 w-4" />
                        Fees
                      </div>
                    </TabsTrigger>
                    <TabsTrigger value="history">
                      <div className="flex items-center gap-2">
                        <BarChart3 className="h-4 w-4" />
                        History
                      </div>
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              </CardHeader>
              <CardContent className="pt-4">
                <TabsContent value="clearance" className="m-0">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-semibold">Pending Payment Clearance</h3>
                        <p className="text-sm text-muted-foreground">Clear payments to unlock trainee registrations</p>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline">
                          <Filter className="h-4 w-4 mr-1" />
                          Filter
                        </Button>
                        <Button size="sm">
                          <Plus className="h-4 w-4 mr-1" />
                          Bulk Clear
                        </Button>
                      </div>
                    </div>
                    <PendingClearanceTable
                      data={pendingClearances || []}
                      isLoading={clearancesLoading}
                      onQuickClear={handleQuickClear}
                    />
                  </div>
                </TabsContent>

                <TabsContent value="pipeline" className="m-0">
                  <ApplicationsAwaitingPayment />
                </TabsContent>

                <TabsContent value="fees" className="m-0">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-semibold">Fee Structures</h3>
                        <p className="text-sm text-muted-foreground">Manage course and hostel fees</p>
                      </div>
                      <Button size="sm" onClick={() => setShowFeeSetupModal(true)}>
                        <Plus className="h-4 w-4 mr-1" />
                        Add Fee
                      </Button>
                    </div>
                    <div className="space-y-3">
                      {feeTypes.map((fee) => (
                        <div
                          key={fee.id}
                          className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent/50 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className={`p-2 rounded-lg ${
                                fee.type === "grant"
                                  ? "bg-green-100 dark:bg-green-900/30"
                                  : "bg-blue-100 dark:bg-blue-900/30"
                              }`}
                            >
                              <DollarSign
                                className={`h-4 w-4 ${
                                  fee.type === "grant"
                                    ? "text-green-600 dark:text-green-400"
                                    : "text-blue-600 dark:text-blue-400"
                                }`}
                              />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <p className="font-medium">{fee.name}</p>
                                <Badge variant={fee.type === "grant" ? "secondary" : "outline"}>{fee.frequency}</Badge>
                              </div>
                              <p className="text-sm text-muted-foreground">
                                {fee.type === "grant" ? fee.description : `N$${fee.amount.toLocaleString()}`}
                              </p>
                            </div>
                          </div>
                          <Button size="sm" variant="ghost">
                            Edit
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="history" className="m-0">
                  <div className="space-y-4">
                    <div>
                      <h3 className="font-semibold">Payment History</h3>
                      <p className="text-sm text-muted-foreground">All cleared payment transactions</p>
                    </div>
                    <PendingClearanceTable
                      data={(allClearances || []).filter((c) => c.status === "cleared")}
                      isLoading={clearancesLoading}
                    />
                  </div>
                </TabsContent>
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Side Panel */}
          <div className="space-y-4">
            {/* Payment Methods */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <CreditCard className="h-4 w-4" />
                  Payment Methods
                </CardTitle>
                <CardDescription>Select training grant for free education</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {paymentMethods.map((method) => (
                  <div
                    key={method.id}
                    className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-all ${
                      method.id === "training_grant"
                        ? "border-green-500 bg-green-50 dark:bg-green-900/20"
                        : "hover:border-primary hover:bg-accent"
                    }`}
                    onClick={() => method.id === "training_grant" && setShowPaymentModal(true)}
                  >
                    <div className={`text-lg ${method.id === "training_grant" ? "text-green-600" : ""}`}>
                      {method.icon}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <p
                          className={`font-medium ${method.id === "training_grant" ? "text-green-700 dark:text-green-400" : ""}`}
                        >
                          {method.label}
                        </p>
                        {method.id === "training_grant" && (
                          <Badge className="bg-green-100 text-green-800 text-xs">Default</Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">{method.description}</p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Recent Activity */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Recent Activity</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-start gap-3 p-2">
                  <div className="p-2 rounded-full bg-green-100 dark:bg-green-900/30">
                    <CheckCircle className="h-3 w-3 text-green-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">Payment Cleared</p>
                    <p className="text-xs text-muted-foreground">TRA2024001 • Just now</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-2">
                  <div className="p-2 rounded-full bg-blue-100 dark:bg-blue-900/30">
                    <Bell className="h-3 w-3 text-blue-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">Reminder Sent</p>
                    <p className="text-xs text-muted-foreground">TRA2024002 • 5 min ago</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-2">
                  <div className="p-2 rounded-full bg-purple-100 dark:bg-purple-900/30">
                    <FileText className="h-3 w-3 text-purple-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">Invoice Generated</p>
                    <p className="text-xs text-muted-foreground">TRA2024003 • 10 min ago</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button variant="outline" className="w-full justify-start" size="sm">
                  <FileText className="h-4 w-4 mr-2" />
                  Generate Bulk Invoices
                </Button>
                <Button variant="outline" className="w-full justify-start" size="sm">
                  <Bell className="h-4 w-4 mr-2" />
                  Send Batch Reminders
                </Button>
                <Button variant="outline" className="w-full justify-start" size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Create Fee Template
                </Button>
                <Button variant="outline" className="w-full justify-start" size="sm">
                  <TrendingUp className="h-4 w-4 mr-2" />
                  View Reports
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Modals */}
      <PaymentModal
        open={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        trainee={selectedTrainee}
        paymentMethods={paymentMethods}
      />

      <FeeSetupModal
        open={showFeeSetupModal}
        onClose={() => setShowFeeSetupModal(false)}
        feeTypes={feeTypes.filter((f) => f.type !== "grant")}
      />
    </DashboardLayout>
  );
};

export default DebtorOfficerDashboard;
