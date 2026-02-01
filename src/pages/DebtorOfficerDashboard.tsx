import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
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
  AlertCircle,
  Eye,
  Download,
  MoreVertical,
} from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { debtorOfficerNavItems } from "@/lib/navigationConfig";
import { useProfile } from "@/hooks/useProfile";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const DebtorOfficerDashboard = () => {
  const { data: profile } = useProfile();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showFeeSetupModal, setShowFeeSetupModal] = useState(false);
  const [selectedTrainee, setSelectedTrainee] = useState(null);
  const [activeTab, setActiveTab] = useState("clearance");
  const [showConnectedSystems, setShowConnectedSystems] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  // Mock data - replace with actual API calls
  const pendingClearances = [
    { id: "TRA2024001", name: "John Doe", amount: 1500, status: "pending", date: "2024-01-15", type: "Hostel Monthly" },
    {
      id: "TRA2024002",
      name: "Jane Smith",
      amount: 5000,
      status: "pending",
      date: "2024-01-14",
      type: "Hostel Registration",
    },
    {
      id: "TRA2024003",
      name: "Bob Johnson",
      amount: 1500,
      status: "pending",
      date: "2024-01-14",
      type: "Hostel Monthly",
    },
  ];

  const stats = {
    totalCollected: 2450000,
    outstanding: 425000,
    collectionRate: 85,
    pendingRegistrations: 3,
    clearedToday: 12,
  };

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
    { name: "Registration Dashboard", status: "connected", pending: 3, icon: Users, color: "blue" },
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

  // Clearance Stats Cards Component (Inlined)
  const ClearanceStatsCards = () => (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Collected</CardTitle>
          <DollarSign className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">N${(stats.totalCollected / 1000000).toFixed(1)}M</div>
          <p className="text-xs text-muted-foreground">This academic year</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Outstanding</CardTitle>
          <AlertCircle className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">N${(stats.outstanding / 1000).toFixed(0)}K</div>
          <p className="text-xs text-muted-foreground">
            {Math.round((stats.outstanding / stats.totalCollected) * 100)}% of total
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Collection Rate</CardTitle>
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.collectionRate}%</div>
          <p className="text-xs text-muted-foreground">+3% from last month</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Pending Clearance</CardTitle>
          <Clock className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.pendingRegistrations}</div>
          <p className="text-xs text-muted-foreground">Awaiting payment</p>
        </CardContent>
      </Card>
    </div>
  );

  // Pending Clearance Table Component (Inlined)
  const PendingClearanceTable = ({ data, onQuickClear }) => (
    <div className="border rounded-lg">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Trainee ID</TableHead>
            <TableHead>Name</TableHead>
            <TableHead>Fee Type</TableHead>
            <TableHead>Amount</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((clearance) => (
            <TableRow key={clearance.id}>
              <TableCell className="font-medium">{clearance.id}</TableCell>
              <TableCell>{clearance.name}</TableCell>
              <TableCell>{clearance.type}</TableCell>
              <TableCell>N${clearance.amount.toLocaleString()}</TableCell>
              <TableCell>
                <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
                  Pending
                </Badge>
              </TableCell>
              <TableCell>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => onQuickClear?.(clearance)}>
                    Clear
                  </Button>
                  <Button size="sm" variant="outline">
                    <Eye className="h-4 w-4" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );

  // Applications Awaiting Payment Component (Inlined)
  const ApplicationsAwaitingPayment = () => (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">Registration Pipeline</CardTitle>
        <CardDescription>Applications waiting for payment clearance</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <div className="text-sm font-medium">Total Applications</div>
              <div className="text-2xl font-bold">47</div>
            </div>
            <div className="space-y-2">
              <div className="text-sm font-medium">Awaiting Payment</div>
              <div className="text-2xl font-bold text-yellow-600">12</div>
            </div>
            <div className="space-y-2">
              <div className="text-sm font-medium">Cleared Today</div>
              <div className="text-2xl font-bold text-green-600">8</div>
            </div>
          </div>
          <div className="text-sm text-muted-foreground">
            Clear payments here to allow registration officers to proceed with these applications.
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <DashboardLayout
      title={`Welcome, ${profile?.firstname || "User"}`}
      subtitle="Payment Clearance Center"
      navItems={debtorOfficerNavItems}
      groupLabel="Payment Operations"
      showBackButton={false}
    >
      <div className="space-y-6">
        {/* Header Section with Stats */}
        <ClearanceStatsCards />

        {/* Main Content Area */}
        <div className="grid gap-4 lg:grid-cols-3">
          {/* Left Column - Main Content */}
          <div className="lg:col-span-2 space-y-4">
            {/* Trainee Search */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Quick Search</CardTitle>
                <CardDescription>Find trainee by ID or name</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Enter trainee number or name..."
                      className="pl-9"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                  <Button>
                    <Search className="h-4 w-4 mr-2" />
                    Search
                  </Button>
                </div>
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
              <CardHeader className="pb-3">
                <Tabs value={activeTab} onValueChange={setActiveTab}>
                  <TabsList className="grid w-full grid-cols-4">
                    <TabsTrigger value="clearance" className="relative">
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        Clearance
                        {pendingClearances.length > 0 && (
                          <Badge
                            variant="destructive"
                            className="ml-1 h-5 w-5 p-0 flex items-center justify-center text-xs"
                          >
                            {pendingClearances.length}
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
                        <Button size="sm" onClick={() => setShowPaymentModal(true)}>
                          <Plus className="h-4 w-4 mr-1" />
                          Process Payment
                        </Button>
                      </div>
                    </div>
                    <PendingClearanceTable data={pendingClearances} onQuickClear={handleQuickClear} />
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
                      <p className="text-sm text-muted-foreground">Recent cleared payment transactions</p>
                    </div>
                    <div className="border rounded-lg">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Date</TableHead>
                            <TableHead>Trainee ID</TableHead>
                            <TableHead>Amount</TableHead>
                            <TableHead>Method</TableHead>
                            <TableHead>Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          <TableRow>
                            <TableCell>2024-01-15</TableCell>
                            <TableCell className="font-medium">TRA2024004</TableCell>
                            <TableCell>N$1,500</TableCell>
                            <TableCell>Training Grant</TableCell>
                            <TableCell>
                              <Badge className="bg-green-100 text-green-800">Cleared</Badge>
                            </TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell>2024-01-14</TableCell>
                            <TableCell className="font-medium">TRA2024005</TableCell>
                            <TableCell>N$5,000</TableCell>
                            <TableCell>Bank Transfer</TableCell>
                            <TableCell>
                              <Badge className="bg-green-100 text-green-800">Cleared</Badge>
                            </TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                </TabsContent>
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Side Panel */}
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
                <CardTitle className="text-sm font-medium">Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button
                  onClick={() => setShowPaymentModal(true)}
                  className="w-full h-auto py-3 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
                >
                  <div className="flex items-center justify-center gap-2">
                    <Zap className="h-4 w-4" />
                    <span>Process Payment</span>
                  </div>
                </Button>

                <div className="grid grid-cols-2 gap-2">
                  <Button variant="outline" className="w-full justify-start" size="sm">
                    <FileText className="h-4 w-4 mr-2" />
                    Invoices
                  </Button>
                  <Button variant="outline" className="w-full justify-start" size="sm">
                    <Bell className="h-4 w-4 mr-2" />
                    Reminders
                  </Button>
                  <Button variant="outline" className="w-full justify-start" size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Fee
                  </Button>
                  <Button variant="outline" className="w-full justify-start" size="sm">
                    <TrendingUp className="h-4 w-4 mr-2" />
                    Reports
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Payment Methods */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <CreditCard className="h-4 w-4" />
                  Payment Methods
                </CardTitle>
                <CardDescription>Training grant is default</CardDescription>
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
          </div>
        </div>
      </div>

      {/* Simple Payment Modal (Placeholder) */}
      {showPaymentModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">Process Payment</h3>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-1 block">Payment Method</label>
                <select className="w-full p-2 border rounded">
                  {paymentMethods.map((method) => (
                    <option key={method.id} value={method.id}>
                      {method.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Amount</label>
                <input className="w-full p-2 border rounded" placeholder="Enter amount" />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowPaymentModal(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={() => {
                    toast({
                      title: "Payment Processed",
                      description: "Payment has been cleared successfully.",
                    });
                    setShowPaymentModal(false);
                  }}
                >
                  Process Payment
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Simple Fee Setup Modal (Placeholder) */}
      {showFeeSetupModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">Create Fee Structure</h3>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-1 block">Fee Name</label>
                <input className="w-full p-2 border rounded" placeholder="e.g., Hostel Registration" />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Amount</label>
                <input className="w-full p-2 border rounded" placeholder="0.00" type="number" />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Fee Type</label>
                <select className="w-full p-2 border rounded">
                  <option value="one-time">One-time</option>
                  <option value="recurring">Recurring (Monthly)</option>
                </select>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowFeeSetupModal(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={() => {
                    toast({
                      title: "Fee Created",
                      description: "New fee structure has been created.",
                    });
                    setShowFeeSetupModal(false);
                  }}
                >
                  Create Fee
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
};

export default DebtorOfficerDashboard;
