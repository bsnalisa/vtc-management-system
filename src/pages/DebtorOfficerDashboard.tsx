import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
  AlertCircle,
  Eye,
  Download,
  UserCheck,
  Home,
  Calendar,
} from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { debtorOfficerNavItems } from "@/lib/navigationConfig";
import { useProfile } from "@/hooks/useProfile";
import { useToast } from "@/hooks/use-toast";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const DebtorOfficerDashboard = () => {
  const { data: profile } = useProfile();
  const { toast } = useToast();
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showFeeSetupModal, setShowFeeSetupModal] = useState(false);
  const [selectedTrainee, setSelectedTrainee] = useState(null);
  const [activeTab, setActiveTab] = useState("clearance");
  const [searchQuery, setSearchQuery] = useState("");

  // Mock data
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
    hostelFees: 12500,
    monthlyRecurring: 4500,
  };

  const paymentMethods = [
    { id: "training_grant", label: "Training Grant", description: "Free education grant", icon: "🎓", color: "green" },
    { id: "cash", label: "Cash", description: "Physical cash payment", icon: "💵", color: "blue" },
    { id: "card", label: "Card", description: "Debit/Credit card", icon: "💳", color: "purple" },
    { id: "bank_transfer", label: "Bank Transfer", description: "Electronic transfer", icon: "🏦", color: "orange" },
    { id: "mobile_money", label: "Mobile Money", description: "Mobile payment", icon: "📱", color: "pink" },
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
    { name: "Registration Dashboard", status: "connected", pending: 3, icon: UserCheck, color: "blue" },
    { name: "Trainee Portal", status: "connected", icon: Users, color: "green" },
    { name: "Hostel Coordinator", status: "connected", icon: Home, color: "purple" },
  ];

  const quickActions = [
    { icon: FileText, label: "Generate Invoice", description: "Create trainee invoice" },
    { icon: Bell, label: "Send Reminders", description: "Notify pending payments" },
    { icon: Download, label: "Export Reports", description: "Download payment data" },
    { icon: Calendar, label: "Schedule Fees", description: "Set up recurring payments" },
  ];

  const StatCard = ({ title, value, icon: Icon, trend, description, color = "primary" }) => (
    <Card className="relative overflow-hidden">
      <div
        className={`absolute top-0 right-0 w-24 h-24 opacity-10 transform translate-x-8 -translate-y-8 bg-${color}`}
      />
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
          <div className={`p-2 rounded-lg bg-${color}/10`}>
            <Icon className={`h-4 w-4 text-${color}`} />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {trend && <p className="text-xs text-muted-foreground mt-1">{trend}</p>}
        {description && <p className="text-xs text-muted-foreground mt-1">{description}</p>}
      </CardContent>
    </Card>
  );

  return (
    <DashboardLayout
      title={`Welcome back, ${profile?.firstname || "User"}`}
      subtitle="Payment Clearance & Fee Management Dashboard"
      navItems={debtorOfficerNavItems}
      groupLabel="Financial Operations"
      showBackButton={false}
    >
      <div className="space-y-6">
        {/* Top Section: Stats Overview */}
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Total Collected"
            value={`N$${(stats.totalCollected / 1000000).toFixed(1)}M`}
            icon={DollarSign}
            description="This academic year"
            color="green"
          />
          <StatCard
            title="Outstanding"
            value={`N$${(stats.outstanding / 1000).toFixed(0)}K`}
            icon={AlertCircle}
            description={`${Math.round((stats.outstanding / stats.totalCollected) * 100)}% of total`}
            color="amber"
          />
          <StatCard
            title="Collection Rate"
            value={`${stats.collectionRate}%`}
            icon={TrendingUp}
            trend="+3% from last month"
            color="blue"
          />
          <StatCard
            title="Pending Clearance"
            value={stats.pendingRegistrations}
            icon={Clock}
            description="Awaiting payment"
            color="red"
          />
        </div>

        {/* Middle Section: Main Content Grid */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Left Column - Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Search and Quick Actions Card */}
            <Card>
              <CardHeader>
                <CardTitle>Trainee Management</CardTitle>
                <CardDescription>Search and manage trainee payments</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-3">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search by trainee ID, name, or phone..."
                      className="pl-9"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                  <Button variant="outline">
                    <Filter className="h-4 w-4 mr-2" />
                    Filter
                  </Button>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {quickActions.map((action, index) => (
                    <Button
                      key={index}
                      variant="outline"
                      className="h-auto py-3 flex flex-col items-center justify-center gap-2 hover:border-primary transition-colors"
                    >
                      <action.icon className="h-5 w-5" />
                      <span className="text-xs font-medium">{action.label}</span>
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Main Tabs Section */}
            <Card>
              <CardHeader className="border-b">
                <Tabs value={activeTab} onValueChange={setActiveTab}>
                  <TabsList className="grid w-full grid-cols-4">
                    <TabsTrigger value="clearance" className="relative">
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        Clearance
                        {pendingClearances.length > 0 && (
                          <Badge variant="destructive" className="ml-1 h-5 w-5 p-0">
                            {pendingClearances.length}
                          </Badge>
                        )}
                      </div>
                    </TabsTrigger>
                    <TabsTrigger value="fees">
                      <DollarSign className="h-4 w-4 mr-2" />
                      Fees
                    </TabsTrigger>
                    <TabsTrigger value="history">
                      <BarChart3 className="h-4 w-4 mr-2" />
                      History
                    </TabsTrigger>
                    <TabsTrigger value="reports">
                      <FileText className="h-4 w-4 mr-2" />
                      Reports
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              </CardHeader>
              <CardContent className="pt-6">
                <TabsContent value="clearance" className="m-0 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-semibold">Pending Payment Clearance</h3>
                      <p className="text-sm text-muted-foreground">Clear payments to unlock registrations</p>
                    </div>
                    <Button onClick={() => setShowPaymentModal(true)}>
                      <Zap className="h-4 w-4 mr-2" />
                      Process Payment
                    </Button>
                  </div>

                  <div className="border rounded-lg">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Trainee ID</TableHead>
                          <TableHead>Name</TableHead>
                          <TableHead>Fee Type</TableHead>
                          <TableHead className="text-right">Amount</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {pendingClearances.map((clearance) => (
                          <TableRow key={clearance.id}>
                            <TableCell className="font-medium">{clearance.id}</TableCell>
                            <TableCell>{clearance.name}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-xs">
                                {clearance.type}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right font-medium">
                              N${clearance.amount.toLocaleString()}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                                Pending
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-2">
                                <Button size="sm" variant="ghost">
                                  <Eye className="h-4 w-4" />
                                </Button>
                                <Button size="sm" onClick={() => setShowPaymentModal(true)}>
                                  Clear
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </TabsContent>

                <TabsContent value="fees" className="m-0 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-semibold">Fee Structures</h3>
                      <p className="text-sm text-muted-foreground">Manage all fee types and amounts</p>
                    </div>
                    <Button onClick={() => setShowFeeSetupModal(true)}>
                      <Plus className="h-4 w-4 mr-2" />
                      Add New Fee
                    </Button>
                  </div>

                  <div className="grid gap-4">
                    {feeTypes.map((fee) => (
                      <Card key={fee.id} className={fee.type === "grant" ? "border-green-200" : ""}>
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div
                                className={`p-2 rounded-lg ${fee.type === "grant" ? "bg-green-100" : "bg-blue-100"}`}
                              >
                                <DollarSign
                                  className={`h-4 w-4 ${fee.type === "grant" ? "text-green-600" : "text-blue-600"}`}
                                />
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <h4 className="font-semibold">{fee.name}</h4>
                                  <Badge variant={fee.type === "grant" ? "secondary" : "outline"}>
                                    {fee.frequency}
                                  </Badge>
                                </div>
                                <p className="text-sm text-muted-foreground">
                                  {fee.type === "grant" ? fee.description : `N$${fee.amount.toLocaleString()}`}
                                </p>
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <Button size="sm" variant="outline">
                                Edit
                              </Button>
                              {fee.type !== "grant" && (
                                <Button size="sm" variant="outline">
                                  Delete
                                </Button>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </TabsContent>

                <TabsContent value="history" className="m-0">
                  <div className="text-center py-12">
                    <BarChart3 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <h3 className="text-lg font-semibold">Payment History</h3>
                    <p className="text-sm text-muted-foreground">View all cleared payment transactions</p>
                    <Button className="mt-4" variant="outline">
                      Load History
                    </Button>
                  </div>
                </TabsContent>

                <TabsContent value="reports" className="m-0">
                  <div className="text-center py-12">
                    <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <h3 className="text-lg font-semibold">Financial Reports</h3>
                    <p className="text-sm text-muted-foreground">Generate and download detailed reports</p>
                    <Button className="mt-4">
                      <Download className="h-4 w-4 mr-2" />
                      Generate Report
                    </Button>
                  </div>
                </TabsContent>
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Sidebar */}
          <div className="space-y-6">
            {/* Connected Systems Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <LinkIcon className="h-4 w-4" />
                  Connected Systems
                </CardTitle>
                <CardDescription>Integrated dashboard status</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {connectedSystems.map((system) => (
                  <div key={system.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-blue-100">
                        <system.icon className="h-4 w-4 text-blue-600" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">{system.name}</p>
                        <p className="text-xs text-muted-foreground capitalize">{system.status}</p>
                      </div>
                    </div>
                    {system.pending ? (
                      <Badge variant="destructive">{system.pending}</Badge>
                    ) : (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    )}
                  </div>
                ))}
                <Separator />
                <Button variant="outline" className="w-full">
                  Refresh Connections
                </Button>
              </CardContent>
            </Card>

            {/* Payment Methods Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-4 w-4" />
                  Payment Methods
                </CardTitle>
                <CardDescription>Available payment options</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {paymentMethods.map((method) => (
                  <div
                    key={method.id}
                    className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                      method.id === "training_grant"
                        ? "border-green-500 bg-green-50"
                        : "hover:border-primary hover:bg-accent"
                    }`}
                  >
                    <div className={`text-xl ${method.id === "training_grant" ? "text-green-600" : ""}`}>
                      {method.icon}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <p className={`text-sm font-medium ${method.id === "training_grant" ? "text-green-700" : ""}`}>
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

            {/* Quick Stats Card */}
            <Card>
              <CardHeader>
                <CardTitle>Today's Summary</CardTitle>
                <CardDescription>Daily payment overview</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Cleared Today</p>
                    <p className="text-2xl font-bold text-green-600">{stats.clearedToday}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Hostel Fees</p>
                    <p className="text-2xl font-bold">N${stats.hostelFees.toLocaleString()}</p>
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Monthly Recurring</p>
                  <p className="text-2xl font-bold">N${stats.monthlyRecurring.toLocaleString()}</p>
                </div>
                <Button className="w-full" onClick={() => setShowPaymentModal(true)}>
                  <DollarSign className="h-4 w-4 mr-2" />
                  Record Payment
                </Button>
              </CardContent>
            </Card>

            {/* Recent Activity */}
            <Card>
              <CardHeader>
                <CardTitle>Recent Activity</CardTitle>
                <CardDescription>Latest system updates</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-full bg-green-100">
                    <CheckCircle className="h-3 w-3 text-green-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">Payment cleared for TRA2024004</p>
                    <p className="text-xs text-muted-foreground">2 minutes ago</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-full bg-blue-100">
                    <Bell className="h-3 w-3 text-blue-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">Reminder sent to 5 trainees</p>
                    <p className="text-xs text-muted-foreground">15 minutes ago</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-full bg-purple-100">
                    <FileText className="h-3 w-3 text-purple-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">Monthly report generated</p>
                    <p className="text-xs text-muted-foreground">1 hour ago</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Modals */}
      {showPaymentModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold">Process Payment</h3>
              <Button variant="ghost" size="sm" onClick={() => setShowPaymentModal(false)}>
                ✕
              </Button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Select Payment Method</label>
                <select className="w-full p-2 border rounded">
                  {paymentMethods.map((method) => (
                    <option key={method.id} value={method.id}>
                      {method.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Amount (N$)</label>
                <input className="w-full p-2 border rounded" placeholder="0.00" type="number" />
              </div>
              <div className="flex justify-end gap-3 pt-4">
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

      {showFeeSetupModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold">Create Fee Structure</h3>
              <Button variant="ghost" size="sm" onClick={() => setShowFeeSetupModal(false)}>
                ✕
              </Button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Fee Name</label>
                <input className="w-full p-2 border rounded" placeholder="e.g., Hostel Registration" />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Amount (N$)</label>
                <input className="w-full p-2 border rounded" placeholder="0.00" type="number" />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Fee Type</label>
                <select className="w-full p-2 border rounded">
                  <option value="one-time">One-time Payment</option>
                  <option value="recurring">Recurring (Monthly)</option>
                  <option value="semester">Per Semester</option>
                </select>
              </div>
              <div className="flex justify-end gap-3 pt-4">
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
