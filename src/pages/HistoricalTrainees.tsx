import { useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useRoleNavigation } from "@/hooks/useRoleNavigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Search, Upload, Download, Archive, Eye, FileText, Users, Calendar } from "lucide-react";
import { useHistoricalTrainees, useArchiveTrainee, useCaptureHistoricalTrainee } from "@/hooks/useHistoricalTrainees";
import { useTrades } from "@/hooks/useTrades";
import { format } from "date-fns";
import { toast } from "sonner";
import { EmptyState } from "@/components/ui/empty-state";
import { TableSkeleton } from "@/components/ui/table-skeleton";
import { StatusBadge } from "@/components/ui/status-badge";

const HistoricalTrainees = () => {
  const { navItems, groupLabel } = useRoleNavigation();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedYear, setSelectedYear] = useState<string>("all");
  const [selectedTrade, setSelectedTrade] = useState<string>("all");
  const [captureDialogOpen, setCaptureDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [selectedTrainee, setSelectedTrainee] = useState<any>(null);

  const { data: trainees, isLoading } = useHistoricalTrainees();
  const { data: trades } = useTrades();
  const archiveTrainee = useArchiveTrainee();
  const captureHistorical = useCaptureHistoricalTrainee();

  const [captureForm, setCaptureForm] = useState({
    first_name: "",
    last_name: "",
    national_id: "",
    phone: "",
    email: "",
    address: "",
    trade_id: "",
    level: 1,
    academic_year: "",
    training_mode: "fulltime" as const,
    archive_notes: "",
  });

  // Generate year options (last 10 years)
  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: 10 }, (_, i) => (currentYear - i).toString());

  // Filter trainees
  const filteredTrainees = trainees?.filter((trainee) => {
    const matchesSearch =
      trainee.first_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      trainee.last_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      trainee.trainee_id?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      trainee.national_id?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesYear = selectedYear === "all" || trainee.academic_year === selectedYear;
    const matchesTrade = selectedTrade === "all" || trainee.trade_id === selectedTrade;

    return matchesSearch && matchesYear && matchesTrade;
  });

  const handleCapture = async () => {
    if (!captureForm.first_name || !captureForm.last_name || !captureForm.national_id || !captureForm.trade_id) {
      toast.error("Please fill in all required fields");
      return;
    }

    try {
      await captureHistorical.mutateAsync(captureForm);
      setCaptureDialogOpen(false);
      setCaptureForm({
        first_name: "",
        last_name: "",
        national_id: "",
        phone: "",
        email: "",
        address: "",
        trade_id: "",
        level: 1,
        academic_year: "",
        training_mode: "fulltime",
        archive_notes: "",
      });
    } catch (error) {
      // Error handled by hook
    }
  };

  const handleExport = () => {
    if (!filteredTrainees?.length) {
      toast.error("No records to export");
      return;
    }

    const csvContent = [
      ["Trainee ID", "Name", "National ID", "Trade", "Level", "Year", "Status"].join(","),
      ...filteredTrainees.map((t) =>
        [
          t.trainee_id,
          `${t.first_name} ${t.last_name}`,
          t.national_id,
          t.trades?.name || "",
          t.level,
          t.academic_year,
          t.status,
        ].join(",")
      ),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `historical-trainees-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    toast.success("Export completed");
  };

  return (
    <DashboardLayout
      title="Historical Trainees"
      subtitle="Manage archived trainee records from previous years"
      navItems={navItems}
      groupLabel={groupLabel}
    >
      <div className="space-y-4">
        {/* Stats Overview */}
        <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
          <Card className="p-0">
            <CardHeader className="p-3 pb-1 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-xs font-medium">Total Archived</CardTitle>
              <Archive className="h-3.5 w-3.5 text-muted-foreground" />
            </CardHeader>
            <CardContent className="p-3 pt-0">
              <div className="text-xl font-bold">{trainees?.length || 0}</div>
            </CardContent>
          </Card>
          <Card className="p-0">
            <CardHeader className="p-3 pb-1 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-xs font-medium">This Year</CardTitle>
              <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
            </CardHeader>
            <CardContent className="p-3 pt-0">
              <div className="text-xl font-bold">
                {trainees?.filter((t) => t.academic_year === currentYear.toString()).length || 0}
              </div>
            </CardContent>
          </Card>
          <Card className="p-0">
            <CardHeader className="p-3 pb-1 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-xs font-medium">Last Year</CardTitle>
              <Users className="h-3.5 w-3.5 text-muted-foreground" />
            </CardHeader>
            <CardContent className="p-3 pt-0">
              <div className="text-xl font-bold">
                {trainees?.filter((t) => t.academic_year === (currentYear - 1).toString()).length || 0}
              </div>
            </CardContent>
          </Card>
          <Card className="p-0">
            <CardHeader className="p-3 pb-1 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-xs font-medium">Filtered</CardTitle>
              <FileText className="h-3.5 w-3.5 text-muted-foreground" />
            </CardHeader>
            <CardContent className="p-3 pt-0">
              <div className="text-xl font-bold">{filteredTrainees?.length || 0}</div>
            </CardContent>
          </Card>
        </div>

        {/* Filters and Actions */}
        <Card>
          <CardHeader className="p-4 pb-2">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <CardTitle className="text-base">Archived Records</CardTitle>
                <CardDescription className="text-xs">
                  Browse and manage historical trainee data
                </CardDescription>
              </div>
              <div className="flex gap-2">
                <Dialog open={captureDialogOpen} onOpenChange={setCaptureDialogOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm">
                      <Upload className="h-4 w-4 mr-1" />
                      Capture Historical
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-lg">
                    <DialogHeader>
                      <DialogTitle>Capture Historical Trainee</DialogTitle>
                      <DialogDescription>
                        Add a trainee record from previous years for record-keeping purposes.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-2">
                          <Label htmlFor="first_name">First Name *</Label>
                          <Input
                            id="first_name"
                            value={captureForm.first_name}
                            onChange={(e) => setCaptureForm({ ...captureForm, first_name: e.target.value })}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="last_name">Last Name *</Label>
                          <Input
                            id="last_name"
                            value={captureForm.last_name}
                            onChange={(e) => setCaptureForm({ ...captureForm, last_name: e.target.value })}
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="national_id">National ID *</Label>
                        <Input
                          id="national_id"
                          value={captureForm.national_id}
                          onChange={(e) => setCaptureForm({ ...captureForm, national_id: e.target.value })}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-2">
                          <Label htmlFor="phone">Phone</Label>
                          <Input
                            id="phone"
                            value={captureForm.phone}
                            onChange={(e) => setCaptureForm({ ...captureForm, phone: e.target.value })}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="email">Email</Label>
                          <Input
                            id="email"
                            type="email"
                            value={captureForm.email}
                            onChange={(e) => setCaptureForm({ ...captureForm, email: e.target.value })}
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="trade_id">Trade *</Label>
                        <Select
                          value={captureForm.trade_id}
                          onValueChange={(value) => setCaptureForm({ ...captureForm, trade_id: value })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select trade" />
                          </SelectTrigger>
                          <SelectContent>
                            {trades?.map((trade) => (
                              <SelectItem key={trade.id} value={trade.id}>
                                {trade.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-2">
                          <Label htmlFor="level">Level</Label>
                          <Select
                            value={captureForm.level.toString()}
                            onValueChange={(value) => setCaptureForm({ ...captureForm, level: parseInt(value) })}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {[1, 2, 3, 4].map((level) => (
                                <SelectItem key={level} value={level.toString()}>
                                  Level {level}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="academic_year">Academic Year *</Label>
                          <Select
                            value={captureForm.academic_year}
                            onValueChange={(value) => setCaptureForm({ ...captureForm, academic_year: value })}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select year" />
                            </SelectTrigger>
                            <SelectContent>
                              {yearOptions.map((year) => (
                                <SelectItem key={year} value={year}>
                                  {year}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="training_mode">Training Mode</Label>
                        <Select
                          value={captureForm.training_mode}
                          onValueChange={(value: any) => setCaptureForm({ ...captureForm, training_mode: value })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="fulltime">Full-Time</SelectItem>
                            <SelectItem value="bdl">BDL</SelectItem>
                            <SelectItem value="shortcourse">Short Course</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="archive_notes">Notes</Label>
                        <Textarea
                          id="archive_notes"
                          placeholder="Any additional notes about this historical record..."
                          value={captureForm.archive_notes}
                          onChange={(e) => setCaptureForm({ ...captureForm, archive_notes: e.target.value })}
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setCaptureDialogOpen(false)}>
                        Cancel
                      </Button>
                      <Button onClick={handleCapture} disabled={captureHistorical.isPending}>
                        {captureHistorical.isPending ? "Saving..." : "Save Record"}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
                <Button size="sm" variant="outline" onClick={handleExport}>
                  <Download className="h-4 w-4 mr-1" />
                  Export
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-2">
            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-3 mb-4">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name, ID, or national ID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8"
                />
              </div>
              <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger className="w-full sm:w-[140px]">
                  <SelectValue placeholder="Year" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Years</SelectItem>
                  {yearOptions.map((year) => (
                    <SelectItem key={year} value={year}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={selectedTrade} onValueChange={setSelectedTrade}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder="Trade" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Trades</SelectItem>
                  {trades?.map((trade) => (
                    <SelectItem key={trade.id} value={trade.id}>
                      {trade.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Table */}
            {isLoading ? (
              <TableSkeleton columns={6} rows={5} />
            ) : filteredTrainees?.length === 0 ? (
              <EmptyState
                icon={Archive}
                title="No archived records"
                description={searchQuery || selectedYear !== "all" || selectedTrade !== "all"
                  ? "No records match your filters"
                  : "Capture historical trainees to build your archive"}
              />
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Trainee ID</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>National ID</TableHead>
                      <TableHead>Trade</TableHead>
                      <TableHead>Level</TableHead>
                      <TableHead>Year</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-[80px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredTrainees?.map((trainee) => (
                      <TableRow key={trainee.id}>
                        <TableCell className="font-mono text-sm">{trainee.trainee_id}</TableCell>
                        <TableCell className="whitespace-nowrap">
                          {trainee.first_name} {trainee.last_name}
                        </TableCell>
                        <TableCell>{trainee.national_id}</TableCell>
                        <TableCell>{trainee.trades?.name || "-"}</TableCell>
                        <TableCell>Level {trainee.level}</TableCell>
                        <TableCell>{trainee.academic_year}</TableCell>
                        <TableCell>
                          <StatusBadge status={trainee.status} />
                        </TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setSelectedTrainee(trainee);
                              setViewDialogOpen(true);
                            }}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* View Dialog */}
        <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Trainee Details</DialogTitle>
              <DialogDescription>
                Historical record - read only
              </DialogDescription>
            </DialogHeader>
            {selectedTrainee && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Trainee ID</p>
                    <p className="font-medium">{selectedTrainee.trainee_id}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Name</p>
                    <p className="font-medium">{selectedTrainee.first_name} {selectedTrainee.last_name}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">National ID</p>
                    <p className="font-medium">{selectedTrainee.national_id}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Phone</p>
                    <p className="font-medium">{selectedTrainee.phone || "-"}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Trade</p>
                    <p className="font-medium">{selectedTrainee.trades?.name || "-"}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Level</p>
                    <p className="font-medium">Level {selectedTrainee.level}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Academic Year</p>
                    <p className="font-medium">{selectedTrainee.academic_year}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Training Mode</p>
                    <p className="font-medium capitalize">{selectedTrainee.training_mode}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Archived At</p>
                    <p className="font-medium">
                      {selectedTrainee.archived_at
                        ? format(new Date(selectedTrainee.archived_at), "PPP")
                        : "-"}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Status</p>
                    <StatusBadge status={selectedTrainee.status} />
                  </div>
                </div>
                {selectedTrainee.archive_notes && (
                  <div>
                    <p className="text-muted-foreground text-sm">Notes</p>
                    <p className="text-sm mt-1">{selectedTrainee.archive_notes}</p>
                  </div>
                )}
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setViewDialogOpen(false)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};

export default HistoricalTrainees;
