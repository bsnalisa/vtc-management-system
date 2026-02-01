import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  DollarSign,
  TrendingUp,
  AlertCircle,
  Users,
  FileText,
  Plus,
  Edit,
  Trash2,
  Bell,
  Download,
  Filter,
  Search,
} from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { debtorOfficerNavItems } from "@/lib/navigationConfig";
import { useProfile } from "@/hooks/useProfile";
import { FeeManagementTable } from "@/components/fees/FeeManagementTable";
import { PaymentModal } from "@/components/fees/PaymentModal";
import { FeeSetupModal } from "@/components/fees/FeeSetupModal";
import { TraineeSearch } from "@/components/fees/TraineeSearch";
import { useToast } from "@/hooks/use-toast";

const DebtorOfficerDashboard = () => {
  const { data: profile } = useProfile();
  const { toast } = useToast();
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showFeeSetupModal, setShowFeeSetupModal] = useState(false);
  const [selectedTrainee, setSelectedTrainee] = useState(null);
  const [activeTab, setActiveTab] = useState("overview");

  // Sample data - replace with actual API calls
  const stats = {
    totalCollected: 2400000,
    outstanding: 425000,
    collectionRate: 85,
    pendingRegistrations: 12,
    overduePayments: 45,
  };

  const paymentMethods = [
    { id: "training_grant", label: "Training Grant", description: "Free education grant" },
    { id: "cash", label: "Cash", description: "Physical cash payment" },
    { id: "card", label: "Card", description: "Debit/Credit card" },
    { id: "bank_transfer", label: "Bank Transfer", description: "Electronic transfer" },
    { id: "mobile_money", label: "Mobile Money", description: "Mobile payment" },
  ];

  const feeTypes = [
    { id: "hostel_registration", name: "Hostel Registration", amount: 5000, type: "one-time" },
    { id: "hostel_monthly", name: "Hostel Monthly Fee", amount: 1500, type: "recurring" },
    { id: "tuition", name: "Tuition Fee", amount: 0, type: "grant", description: "Covered by Training Grant" },
  ];

  const handleRecordPayment = () => {
    setShowPaymentModal(true);
  };

  const handleFeeSetup = () => {
    setShowFeeSetupModal(true);
  };

  const handleGenerateInvoice = (traineeId) => {
    // Generate invoice logic
    toast({
      title: "Invoice Generated",
      description: "Invoice has been generated and sent to trainee.",
    });
  };

  const handleSendReminder = (traineeId) => {
    // Send reminder logic
    toast({
      title: "Reminder Sent",
      description: "Payment reminder has been sent to trainee's portal.",
    });
  };

  const handleDeleteFee = (feeId) => {
    // Delete fee logic
    toast({
      title: "Fee Deleted",
      description: "The fee has been successfully removed.",
    });
  };

  return (
    <DashboardLayout
      title={`Welcome back, ${profile?.firstname || "User"}`}
      subtitle="Manage fees, payments, and training grants"
      navItems={debtorOfficerNavItems}
      groupLabel="Fee Management"
    >
      <div className="space-y-6">
        {/* Stats Overview */}
        <div className="grid gap-4 md:grid-cols-5">
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
                {Math.round((stats.outstanding / stats.totalCollected) * 100)}% of total fees
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
              <CardTitle className="text-sm font-medium">Pending Registrations</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.pendingRegistrations}</div>
              <p className="text-xs text-muted-foreground">Awaiting payment clearance</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Overdue Payments</CardTitle>
              <Bell className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.overduePayments}</div>
              <p className="text-xs text-muted-foreground">Require follow-up</p>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions & Search */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
              <CardDescription>Fee management tasks</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <Button onClick={handleRecordPayment} className="h-auto py-4 justify-start" variant="outline">
                <div className="flex items-center gap-3">
                  <DollarSign className="h-6 w-6 text-primary" />
                  <div className="text-left">
                    <p className="font-medium">Record Payment</p>
                    <p className="text-xs text-muted-foreground">Process trainee payments</p>
                  </div>
                </div>
              </Button>

              <Button onClick={handleFeeSetup} className="h-auto py-4 justify-start" variant="outline">
                <div className="flex items-center gap-3">
                  <Plus className="h-6 w-6 text-primary" />
                  <div className="text-left">
                    <p className="font-medium">Setup Course Fees</p>
                    <p className="text-xs text-muted-foreground">Create/update fee structures</p>
                  </div>
                </div>
              </Button>

              <Button className="h-auto py-4 justify-start" variant="outline">
                <div className="flex items-center gap-3">
                  <FileText className="h-6 w-6 text-primary" />
                  <div className="text-left">
                    <p className="font-medium">Generate Invoices</p>
                    <p className="text-xs text-muted-foreground">Create invoices for trainees</p>
                  </div>
                </div>
              </Button>

              <Button className="h-auto py-4 justify-start" variant="outline">
                <div className="flex items-center gap-3">
                  <AlertCircle className="h-6 w-6 text-primary" />
                  <div className="text-left">
                    <p className="font-medium">View Outstanding</p>
                    <p className="text-xs text-muted-foreground">Check unpaid balances</p>
                  </div>
                </div>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Find Trainee</CardTitle>
              <CardDescription>Search by trainee number or name</CardDescription>
            </CardHeader>
            <CardContent>
              <TraineeSearch onSelectTrainee={setSelectedTrainee} placeholder="Enter trainee number..." />
              {selectedTrainee && (
                <div className="mt-4 p-3 border rounded-lg">
                  <p className="font-medium">{selectedTrainee.name}</p>
                  <p className="text-sm text-muted-foreground">ID: {selectedTrainee.id}</p>
                  <div className="flex gap-2 mt-2">
                    <Button size="sm" onClick={() => handleGenerateInvoice(selectedTrainee.id)}>
                      <FileText className="h-4 w-4 mr-2" />
                      Invoice
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => handleSendReminder(selectedTrainee.id)}>
                      <Bell className="h-4 w-4 mr-2" />
                      Remind
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Main Content Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="fees">Fee Management</TabsTrigger>
            <TabsTrigger value="payments">Recent Payments</TabsTrigger>
            <TabsTrigger value="pending">Pending Clearance</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Training Grant Payments</CardTitle>
                <CardDescription>Recent grant-based payments</CardDescription>
              </CardHeader>
              <CardContent>
                <FeeManagementTable
                  data={[]} // Pass actual data
                  onEdit={(fee) => {
                    /* Edit logic */
                  }}
                  onDelete={handleDeleteFee}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="fees" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle>Fee Structures</CardTitle>
                    <CardDescription>Manage course and hostel fees</CardDescription>
                  </div>
                  <Button onClick={handleFeeSetup}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Fee
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {feeTypes.map((fee) => (
                    <div key={fee.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{fee.name}</p>
                          {fee.type === "grant" && <Badge variant="secondary">Training Grant</Badge>}
                          {fee.type === "recurring" && <Badge variant="outline">Monthly</Badge>}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {fee.type === "grant" ? fee.description : `N$${fee.amount}`}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline">
                          <Edit className="h-4 w-4" />
                        </Button>
                        {fee.type !== "grant" && (
                          <Button size="sm" variant="outline" onClick={() => handleDeleteFee(fee.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="payments">
            <Card>
              <CardHeader>
                <CardTitle>Recent Payments</CardTitle>
                <CardDescription>Latest payment transactions</CardDescription>
              </CardHeader>
              <CardContent>
                {/* Payment history table component would go here */}
                <p className="text-muted-foreground">Payment history will be displayed here</p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="pending">
            <Card>
              <CardHeader>
                <CardTitle>Pending Registration Clearance</CardTitle>
                <CardDescription>Trainees awaiting payment confirmation</CardDescription>
              </CardHeader>
              <CardContent>
                {/* Pending registrations table would go here */}
                <p className="text-muted-foreground">Pending registrations will be displayed here</p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Payment Methods Section */}
        <Card>
          <CardHeader>
            <CardTitle>Available Payment Methods</CardTitle>
            <CardDescription>Select Training Grant for free education payments</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {paymentMethods.map((method) => (
                <div
                  key={method.id}
                  className={`p-4 border rounded-lg text-center cursor-pointer transition-colors ${
                    method.id === "training_grant" ? "border-primary bg-primary/5" : "hover:border-primary"
                  }`}
                >
                  <div className="font-medium">{method.label}</div>
                  <div className="text-xs text-muted-foreground mt-1">{method.description}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
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
