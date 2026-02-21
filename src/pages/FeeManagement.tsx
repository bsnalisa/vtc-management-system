import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DollarSign, Search, Download, Filter, Calendar, FileText } from "lucide-react";
import { useFeeRecords, useRecordPayment } from "@/hooks/useFeeRecords";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useRoleNavigation } from "@/hooks/useRoleNavigation";
import { DataTablePagination } from "@/components/ui/data-table-pagination";
import { TableSkeleton } from "@/components/ui/table-skeleton";
import { usePagination } from "@/hooks/usePagination";
import { exportToCSV, prepareDataForExport } from "@/lib/exportUtils";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { PaymentPlansTable } from "@/components/finance/PaymentPlansTable";
import { InvoicesTable } from "@/components/finance/InvoicesTable";

const FeeManagement = () => {
  const { navItems, groupLabel } = useRoleNavigation();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [paymentData, setPaymentData] = useState({
    traineeNumber: "",
    amount: "",
    paymentMethod: "cash",
    reference: "",
    notes: "",
  });

  const { data: feeRecordsData, isLoading } = useFeeRecords();
  const recordPayment = useRecordPayment();

  const filteredFeeRecords = useMemo(() => {
    if (!feeRecordsData) return [];
    
    return feeRecordsData.filter((record) => {
      const trainee = record.trainees;
      if (!trainee) return false;
      
      const matchesSearch = 
        trainee.trainee_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        `${trainee.first_name} ${trainee.last_name}`.toLowerCase().includes(searchTerm.toLowerCase());
      
      const balance = Number(record.balance) || 0;
      const status = balance === 0 ? "paid" : balance < Number(record.total_fee) ? "partial" : "owing";
      const matchesStatus = statusFilter === "all" || status === statusFilter;
      
      return matchesSearch && matchesStatus;
    });
  }, [feeRecordsData, searchTerm, statusFilter]);

  // Pagination
  const {
    paginatedData,
    currentPage,
    totalPages,
    pageSize,
    totalItems,
    setCurrentPage,
    setPageSize,
  } = usePagination({ data: filteredFeeRecords, defaultPageSize: 20 });

  // Calculate summary stats
  const summaryStats = useMemo(() => {
    if (!feeRecordsData) return { totalFees: 0, collected: 0, outstanding: 0, debtors: 0 };
    
    let totalFees = 0;
    let collected = 0;
    let debtors = 0;
    
    feeRecordsData.forEach((record) => {
      totalFees += Number(record.total_fee) || 0;
      collected += Number(record.amount_paid) || 0;
      if ((Number(record.balance) || 0) > 0) debtors++;
    });
    
    return {
      totalFees,
      collected,
      outstanding: totalFees - collected,
      debtors,
    };
  }, [feeRecordsData]);

  const handleExport = () => {
    if (!filteredFeeRecords.length) {
      toast({ title: "No data to export", variant: "destructive" });
      return;
    }
    
    const exportData = prepareDataForExport(
      filteredFeeRecords.map((record) => ({
        trainee_number: record.trainees?.trainee_id || "N/A",
        name: record.trainees ? `${record.trainees.first_name} ${record.trainees.last_name}` : "N/A",
        trade: record.trainees?.trades?.name || "N/A",
        total_fee: Number(record.total_fee),
        amount_paid: Number(record.amount_paid),
        balance: Number(record.balance) || 0,
        status: (Number(record.balance) || 0) === 0 ? "Paid" : (Number(record.balance) || 0) < Number(record.total_fee) ? "Partial" : "Owing",
        academic_year: record.academic_year,
      }))
    );
    
    exportToCSV(exportData, `fee-records-${format(new Date(), "yyyy-MM-dd")}`);
    toast({ title: "Export successful" });
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const feeRecord = feeRecordsData?.find(
      (record) => record.trainees?.trainee_id === paymentData.traineeNumber
    );

    if (!feeRecord) {
      return;
    }

    await recordPayment.mutateAsync({
      fee_record_id: feeRecord.id,
      amount: parseFloat(paymentData.amount),
      payment_method: paymentData.paymentMethod,
      reference_number: paymentData.reference || undefined,
      notes: paymentData.notes || undefined,
    });

    setOpen(false);
    setPaymentData({
      traineeNumber: "",
      amount: "",
      paymentMethod: "cash",
      reference: "",
      notes: "",
    });
  };

  return (
    <DashboardLayout
      title="Fee Management"
      subtitle="Manage trainee fees and payments"
      navItems={navItems}
      groupLabel={groupLabel}
    >
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Button variant="outline" onClick={handleExport} disabled={!filteredFeeRecords.length}>
            <Download className="mr-2 h-4 w-4" />
            Export Debtors
          </Button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <DollarSign className="mr-2 h-4 w-4" />
                Record Payment
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Record Payment</DialogTitle>
                <DialogDescription>Enter payment details for a trainee</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleRecordPayment} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="trainee-id">Trainee Number *</Label>
                  <Input 
                    id="trainee-id" 
                    placeholder="NVTC20250001"
                    value={paymentData.traineeNumber}
                    onChange={(e) => setPaymentData({ ...paymentData, traineeNumber: e.target.value })}
                    required 
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="amount">Amount (N$) *</Label>
                  <Input 
                    id="amount" 
                    type="number" 
                    step="0.01"
                    value={paymentData.amount}
                    onChange={(e) => setPaymentData({ ...paymentData, amount: e.target.value })}
                    required 
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="payment-method">Payment Method *</Label>
                  <Select 
                    value={paymentData.paymentMethod}
                    onValueChange={(value) => setPaymentData({ ...paymentData, paymentMethod: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">Cash</SelectItem>
                      <SelectItem value="bank-transfer">Bank Transfer</SelectItem>
                      <SelectItem value="eft">EFT</SelectItem>
                      <SelectItem value="cheque">Cheque</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reference">Reference Number</Label>
                  <Input 
                    id="reference" 
                    placeholder="Optional"
                    value={paymentData.reference}
                    onChange={(e) => setPaymentData({ ...paymentData, reference: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="notes">Notes</Label>
                  <Input 
                    id="notes" 
                    placeholder="Optional"
                    value={paymentData.notes}
                    onChange={(e) => setPaymentData({ ...paymentData, notes: e.target.value })}
                  />
                </div>
                <div className="flex gap-2 justify-end">
                  <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={recordPayment.isPending}>
                    {recordPayment.isPending ? "Recording..." : "Record Payment"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Fees</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">N${summaryStats.totalFees.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">All trainees</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Collected</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">N${summaryStats.collected.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">
                {summaryStats.totalFees > 0 
                  ? `${((summaryStats.collected / summaryStats.totalFees) * 100).toFixed(1)}% collected`
                  : "0% collected"}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Outstanding</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">N${summaryStats.outstanding.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">
                {summaryStats.totalFees > 0 
                  ? `${((summaryStats.outstanding / summaryStats.totalFees) * 100).toFixed(1)}% owing`
                  : "0% owing"}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Debtors</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{summaryStats.debtors}</div>
              <p className="text-xs text-muted-foreground">Trainees with balance</p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="records" className="space-y-4">
          <TabsList>
            <TabsTrigger value="records">Fee Records</TabsTrigger>
            <TabsTrigger value="plans">
              <Calendar className="h-4 w-4 mr-1" />
              Payment Plans
            </TabsTrigger>
            <TabsTrigger value="invoices">
              <FileText className="h-4 w-4 mr-1" />
              Invoices
            </TabsTrigger>
          </TabsList>

          <TabsContent value="records">
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <CardTitle>Fee Records</CardTitle>
                <CardDescription>All trainee fee records</CardDescription>
              </div>
              <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                <div className="relative flex-1 sm:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by ID or name..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-full sm:w-[150px]">
                    <Filter className="h-4 w-4 mr-2" />
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="paid">Paid</SelectItem>
                    <SelectItem value="partial">Partial</SelectItem>
                    <SelectItem value="owing">Owing</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <TableSkeleton columns={8} rows={10} />
            ) : filteredFeeRecords.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <DollarSign className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No fee records found</p>
                <p className="text-sm">Fee records will appear here</p>
              </div>
            ) : (
              <>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Trainee Number</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Trade</TableHead>
                        <TableHead className="text-right">Total Fee</TableHead>
                        <TableHead className="text-right">Paid</TableHead>
                        <TableHead className="text-right">Balance</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedData.map((record: any) => {
                        const trainee = record.trainees;
                        const balance = Number(record.balance) || 0;
                        const status = balance === 0 ? "Paid" : balance < Number(record.total_fee) ? "Partial" : "Owing";
                        
                        return (
                          <TableRow key={record.id}>
                            <TableCell className="font-medium">{trainee?.trainee_id || "N/A"}</TableCell>
                            <TableCell>{trainee ? `${trainee.first_name} ${trainee.last_name}` : "N/A"}</TableCell>
                            <TableCell>{trainee?.trades?.name || "N/A"}</TableCell>
                            <TableCell className="text-right">N$ {Number(record.total_fee).toLocaleString()}</TableCell>
                            <TableCell className="text-right">N$ {Number(record.amount_paid).toLocaleString()}</TableCell>
                            <TableCell className="text-right">N$ {balance.toLocaleString()}</TableCell>
                            <TableCell>
                              <Badge 
                                variant={status === "Paid" ? "default" : status === "Partial" ? "secondary" : "destructive"}
                              >
                                {status}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <Button variant="ghost" size="sm">View</Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>

                <DataTablePagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  pageSize={pageSize}
                  totalItems={totalItems}
                  onPageChange={setCurrentPage}
                  onPageSizeChange={setPageSize}
                />
              </>
              )}
            </CardContent>
          </Card>
          </TabsContent>

          <TabsContent value="plans">
            <Card>
              <CardHeader>
                <CardTitle>Payment Plans</CardTitle>
                <CardDescription>Manage trainee payment plans and installments</CardDescription>
              </CardHeader>
              <CardContent>
                <PaymentPlansTable />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="invoices">
            <Card>
              <CardHeader>
                <CardTitle>Invoices</CardTitle>
                <CardDescription>Generate and manage trainee invoices</CardDescription>
              </CardHeader>
              <CardContent>
                <InvoicesTable />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
        </div>
      </DashboardLayout>
  );
};

export default FeeManagement;
