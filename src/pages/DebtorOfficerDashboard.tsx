// DebtorOfficerDashboard.tsx
import React, { useState } from "react";
import { Link } from "react-router-dom";
import {
  Search,
  Filter,
  Zap,
  CheckCircle,
  Clock,
  BarChart3,
  DollarSign,
  Plus,
  FileText,
  Bell,
  Users,
  Building,
  CreditCard,
  TrendingUp,
  AlertCircle,
  Eye,
  Download,
  UserCheck,
  Home,
  Calendar,
  Link as LinkIcon,
} from "lucide-react";

// ---- Layout ----
import DashboardLayout from "../components/layout/DashboardLayout";

// ---- Navigation / Profile ----
import { debtorOfficerNavItems } from "../lib/navigationConfig";
import { useProfile } from "../hooks/useProfile";

// ------------------ LOCAL UI FALLBACKS ------------------
// These replace missing shadcn/ui components to prevent build failure

type BaseProps = React.HTMLAttributes<HTMLDivElement> & { children?: React.ReactNode };

const Card = ({ children, ...props }: BaseProps) => (
  <div {...props} className={`rounded-lg border bg-white shadow-sm ${props.className || ""}`}>
    {children}
  </div>
);

const CardHeader = ({ children, ...props }: BaseProps) => (
  <div {...props} className={`px-6 py-4 border-b ${props.className || ""}`}>
    {children}
  </div>
);

const CardContent = ({ children, ...props }: BaseProps) => (
  <div {...props} className={`px-6 py-4 ${props.className || ""}`}>
    {children}
  </div>
);

const CardTitle = ({ children, className }: BaseProps) => (
  <h3 className={`font-semibold text-lg ${className || ""}`}>{children}</h3>
);

const CardDescription = ({ children }: { children: React.ReactNode }) => (
  <p className="text-sm text-gray-500 mt-1">{children}</p>
);

const Button = ({ children, className = "", ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
  <button {...props} className={`px-4 py-2 rounded-md border text-sm font-medium transition-colors ${className}`}>
    {children}
  </button>
);

const Input = (props: React.InputHTMLAttributes<HTMLInputElement>) => (
  <input {...props} className={`border rounded-md px-3 py-2 w-full ${props.className || ""}`} />
);

const Badge = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <span className={`px-2 py-1 text-xs rounded-full font-medium ${className}`}>{children}</span>
);

// Simple Table components
const Table = ({ children, className = "" }: BaseProps) => (
  <div className={`overflow-x-auto ${className}`}>
    <table className="w-full">{children}</table>
  </div>
);

const TableHeader = ({ children }: BaseProps) => <thead>{children}</thead>;
const TableBody = ({ children }: BaseProps) => <tbody>{children}</tbody>;
const TableRow = ({ children }: BaseProps) => <tr>{children}</tr>;
const TableHead = ({ children }: BaseProps) => (
  <th className="text-left py-3 px-4 font-medium text-gray-700 border-b">{children}</th>
);
const TableCell = ({ children }: BaseProps) => <td className="py-3 px-4 border-b">{children}</td>;

// Tabs components with proper structure
const Tabs = ({
  children,
  value,
  onValueChange,
}: {
  children: React.ReactNode;
  value: string;
  onValueChange: (value: string) => void;
}) => {
  return (
    <div className="tabs">
      {React.Children.map(children, (child) => {
        if (React.isValidElement(child)) {
          return React.cloneElement(child, {
            activeValue: value,
            onValueChange,
          } as any);
        }
        return child;
      })}
    </div>
  );
};

const TabsList = ({
  children,
  className = "",
  activeValue,
  onValueChange,
}: BaseProps & {
  activeValue?: string;
  onValueChange?: (value: string) => void;
}) => (
  <div className={`flex space-x-1 border-b ${className}`}>
    {React.Children.map(children, (child) => {
      if (React.isValidElement(child)) {
        return React.cloneElement(child, {
          active: child.props.value === activeValue,
          onClick: () => onValueChange?.(child.props.value),
        } as any);
      }
      return child;
    })}
  </div>
);

const TabsTrigger = ({
  children,
  value,
  active,
  onClick,
  className = "",
}: {
  children: React.ReactNode;
  value: string;
  active?: boolean;
  onClick?: () => void;
  className?: string;
}) => (
  <button
    onClick={onClick}
    className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
      active ? "border-blue-500 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"
    } ${className}`}
  >
    {children}
  </button>
);

const TabsContent = ({
  children,
  value,
  activeValue,
}: {
  children: React.ReactNode;
  value: string;
  activeValue?: string;
}) => {
  if (value !== activeValue) return null;
  return <div className="pt-4">{children}</div>;
};

// ------------------ MOCK DATA ------------------
const stats = {
  totalCollected: 12_450_000,
  outstanding: 2_350_000,
  collectionRate: 84,
  pendingRegistrations: 18,
  clearedToday: 7,
  hostelFees: 12_500,
  monthlyRecurring: 4_500,
};

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

const paymentMethods = [
  { id: "training_grant", label: "Training Grant", description: "Free education grant", icon: "🎓", color: "green" },
  { id: "cash", label: "Cash", description: "Physical cash payment", icon: "💵", color: "blue" },
  { id: "card", label: "Card", description: "Debit/Credit card", icon: "💳", color: "purple" },
  { id: "bank_transfer", label: "Bank Transfer", description: "Electronic transfer", icon: "🏦", color: "orange" },
  { id: "mobile_money", label: "Mobile Money", description: "Mobile payment", icon: "📱", color: "pink" },
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

// Stat Card Component
const StatCard = ({ title, value, icon: Icon, trend, description, color = "primary" }: any) => (
  <Card>
    <CardContent>
      <div className="flex items-center justify-between mb-2">
        <CardTitle className="text-sm font-medium text-gray-500">{title}</CardTitle>
        <div className={`p-2 rounded-lg bg-${color}-100`}>
          <Icon className={`h-4 w-4 text-${color}-600`} />
        </div>
      </div>
      <div className="text-2xl font-bold">{value}</div>
      {trend && <p className="text-xs text-gray-500 mt-1">{trend}</p>}
      {description && <p className="text-xs text-gray-500 mt-1">{description}</p>}
    </CardContent>
  </Card>
);

// ------------------ COMPONENT ------------------
export default function DebtorOfficerDashboard() {
  const { profile } = useProfile();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("clearance");
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showFeeSetupModal, setShowFeeSetupModal] = useState(false);
  const [selectedTrainee, setSelectedTrainee] = useState<any>(null);

  const handleGenerateInvoice = (traineeId: string) => {
    console.log("Generating invoice for:", traineeId);
  };

  const handleSendReminder = (traineeId: string) => {
    console.log("Sending reminder for:", traineeId);
  };

  const handleQuickClear = (trainee: any) => {
    setSelectedTrainee(trainee);
    setShowPaymentModal(true);
  };

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
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
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
                      className="h-auto py-3 flex flex-col items-center justify-center gap-2 hover:border-blue-500 transition-colors"
                    >
                      <action.icon className="h-5 w-5" />
                      <span className="text-xs font-medium">{action.label}</span>
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Tabs Navigation */}
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <div className="flex items-center justify-between mb-4">
                <TabsList activeValue={activeTab} onValueChange={setActiveTab}>
                  <TabsTrigger value="clearance">
                    <Clock className="h-4 w-4 mr-2" />
                    Clearance
                    {pendingClearances.length > 0 && (
                      <Badge className="ml-2 bg-red-100 text-red-800">{pendingClearances.length}</Badge>
                    )}
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
                <Button onClick={() => setShowPaymentModal(true)} className="bg-blue-600 text-white hover:bg-blue-700">
                  <Zap className="h-4 w-4 mr-2" />
                  Process Payment
                </Button>
              </div>

              {/* Tab Content: Clearance */}
              <TabsContent value="clearance" activeValue={activeTab}>
                <div className="space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle>Pending Payment Clearance</CardTitle>
                      <CardDescription>Clear payments to unlock registrations</CardDescription>
                    </CardHeader>
                    <CardContent>
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
                                <Badge className="bg-gray-100">{clearance.type}</Badge>
                              </TableCell>
                              <TableCell className="text-right font-medium">
                                N${clearance.amount.toLocaleString()}
                              </TableCell>
                              <TableCell>
                                <Badge className="bg-yellow-100 text-yellow-800">Pending</Badge>
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex justify-end gap-2">
                                  <Button size="sm" variant="ghost">
                                    <Eye className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    onClick={() => handleQuickClear(clearance)}
                                    className="bg-green-600 text-white hover:bg-green-700"
                                  >
                                    Clear
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              {/* Tab Content: Fees */}
              <TabsContent value="fees" activeValue={activeTab}>
                <div className="space-y-4">
                  <Card>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle>Fee Structures</CardTitle>
                          <CardDescription>Manage all fee types and amounts</CardDescription>
                        </div>
                        <Button
                          onClick={() => setShowFeeSetupModal(true)}
                          className="bg-blue-600 text-white hover:bg-blue-700"
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Add New Fee
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
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
                                      <Badge
                                        className={fee.type === "grant" ? "bg-green-100 text-green-800" : "bg-gray-100"}
                                      >
                                        {fee.frequency}
                                      </Badge>
                                    </div>
                                    <p className="text-sm text-gray-500">
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
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              {/* Tab Content: History */}
              <TabsContent value="history" activeValue={activeTab}>
                <Card>
                  <CardContent className="py-12">
                    <div className="text-center">
                      <BarChart3 className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                      <h3 className="text-lg font-semibold">Payment History</h3>
                      <p className="text-sm text-gray-500">View all cleared payment transactions</p>
                      <Button className="mt-4" variant="outline">
                        Load History
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Tab Content: Reports */}
              <TabsContent value="reports" activeValue={activeTab}>
                <Card>
                  <CardContent className="py-12">
                    <div className="text-center">
                      <FileText className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                      <h3 className="text-lg font-semibold">Financial Reports</h3>
                      <p className="text-sm text-gray-500">Generate and download detailed reports</p>
                      <Button className="mt-4 bg-blue-600 text-white hover:bg-blue-700">
                        <Download className="h-4 w-4 mr-2" />
                        Generate Report
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
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
                        <p className="text-xs text-gray-500 capitalize">{system.status}</p>
                      </div>
                    </div>
                    {system.pending ? (
                      <Badge className="bg-red-100 text-red-800">{system.pending}</Badge>
                    ) : (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    )}
                  </div>
                ))}
                <div className="pt-2">
                  <Button variant="outline" className="w-full">
                    Refresh Connections
                  </Button>
                </div>
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
                        : "hover:border-blue-500 hover:bg-gray-50"
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
                      <p className="text-xs text-gray-500">{method.description}</p>
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
                    <p className="text-sm text-gray-500">Cleared Today</p>
                    <p className="text-2xl font-bold text-green-600">{stats.clearedToday}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-gray-500">Hostel Fees</p>
                    <p className="text-2xl font-bold">N${stats.hostelFees.toLocaleString()}</p>
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-gray-500">Monthly Recurring</p>
                  <p className="text-2xl font-bold">N${stats.monthlyRecurring.toLocaleString()}</p>
                </div>
                <Button
                  className="w-full bg-blue-600 text-white hover:bg-blue-700"
                  onClick={() => setShowPaymentModal(true)}
                >
                  <DollarSign className="h-4 w-4 mr-2" />
                  Record Payment
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Modals */}
      {showPaymentModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold">Process Payment</h3>
              <button onClick={() => setShowPaymentModal(false)} className="text-gray-500 hover:text-gray-700">
                ✕
              </button>
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
                  className="bg-blue-600 text-white hover:bg-blue-700"
                  onClick={() => {
                    console.log("Payment processed");
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
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold">Create Fee Structure</h3>
              <button onClick={() => setShowFeeSetupModal(false)} className="text-gray-500 hover:text-gray-700">
                ✕
              </button>
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
                  className="bg-blue-600 text-white hover:bg-blue-700"
                  onClick={() => {
                    console.log("Fee created");
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
}

// ------------------ BASIC RUNTIME TESTS ------------------
if (process.env.NODE_ENV !== "production") {
  console.assert(Array.isArray(debtorOfficerNavItems), "navItems should be an array");
  console.assert(typeof stats.totalCollected === "number", "stats.totalCollected must be a number");
  console.assert(feeTypes.length > 0, "feeTypes should not be empty");
  console.assert(typeof DebtorOfficerDashboard === "function", "Dashboard should be a component");
  console.assert(paymentMethods.length >= 1, "At least one payment method must exist");
}
