import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Download, Filter, UserPlus, Loader2 } from "lucide-react";
import { useTrainees } from "@/hooks/useTrainees";
import { useTrades } from "@/hooks/useTrades";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useRoleNavigation } from "@/hooks/useRoleNavigation";
import { usePagination } from "@/hooks/usePagination";
import { DataTablePagination } from "@/components/ui/data-table-pagination";
import { exportToCSV } from "@/lib/exportUtils";

const TraineeList = () => {
  const navigate = useNavigate();
  const { role, navItems, groupLabel } = useRoleNavigation();
  const [searchTerm, setSearchTerm] = useState("");
  const [filterTrade, setFilterTrade] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");

  const { data: traineesData, isLoading, error } = useTrainees();
  const { data: trades } = useTrades();

  const filteredTrainees = useMemo(() => {
    if (!traineesData) return [];
    
    return traineesData.filter((trainee) => {
      const matchesSearch = 
        trainee.trainee_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        `${trainee.first_name} ${trainee.last_name}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
        trainee.national_id?.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesTrade = filterTrade === "all" || trainee.trade_id === filterTrade;
      const matchesStatus = filterStatus === "all" || trainee.status === filterStatus;
      
      return matchesSearch && matchesTrade && matchesStatus;
    });
  }, [traineesData, searchTerm, filterTrade, filterStatus]);

  const {
    paginatedData,
    currentPage,
    totalPages,
    pageSize,
    totalItems,
    setCurrentPage,
    setPageSize,
  } = usePagination({ data: filteredTrainees, defaultPageSize: 20 });

  const handleExport = () => {
    if (!filteredTrainees.length) return;
    
    const exportData = filteredTrainees.map(trainee => ({
      "Trainee ID": trainee.trainee_id,
      "First Name": trainee.first_name,
      "Last Name": trainee.last_name,
      "National ID": trainee.national_id || "",
      "Gender": trainee.gender,
      "Trade": trainee.trades?.name || "",
      "Level": trainee.level,
      "Training Mode": trainee.training_mode,
      "Status": trainee.status,
      "Phone": trainee.phone || "",
      "Email": trainee.email || "",
    }));
    
    exportToCSV(exportData, `trainees-export-${new Date().toISOString().split('T')[0]}`);
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case "active": return "default";
      case "graduated": return "secondary";
      case "suspended": return "destructive";
      case "withdrawn": return "outline";
      default: return "secondary";
    }
  };

  if (error) {
    return (
      <DashboardLayout
        title="Trainee List"
        subtitle="View and manage all registered trainees"
        navItems={navItems}
        groupLabel={groupLabel}
      >
        <Card>
          <CardContent className="py-8">
            <div className="text-center text-destructive">
              <p>Error loading trainees: {error.message}</p>
              <Button variant="outline" className="mt-4" onClick={() => window.location.reload()}>
                Try Again
              </Button>
            </div>
          </CardContent>
        </Card>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      title="Trainee List"
      subtitle="View and manage all registered trainees"
      navItems={navItems}
      groupLabel={groupLabel}
    >
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
          <Button onClick={() => navigate("/trainees/register")} className="w-full sm:w-auto">
            <UserPlus className="mr-2 h-4 w-4" />
            Add New Trainee
          </Button>
        </div>

        {/* Filters and Search */}
        <Card>
          <CardHeader>
            <CardTitle>Filters</CardTitle>
            <CardDescription>Search and filter trainees</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name, ID or National ID..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={filterTrade} onValueChange={setFilterTrade}>
                <SelectTrigger className="w-full md:w-[200px]">
                  <Filter className="mr-2 h-4 w-4" />
                  <SelectValue placeholder="Filter by trade" />
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
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-full md:w-[150px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="graduated">Graduated</SelectItem>
                  <SelectItem value="suspended">Suspended</SelectItem>
                  <SelectItem value="withdrawn">Withdrawn</SelectItem>
                </SelectContent>
              </Select>
              <Button 
                variant="outline" 
                className="w-full md:w-auto"
                onClick={handleExport}
                disabled={!filteredTrainees.length}
              >
                <Download className="mr-2 h-4 w-4" />
                Export
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Trainees Table */}
        <Card>
          <CardHeader>
            <CardTitle>Registered Trainees</CardTitle>
            <CardDescription>
              {searchTerm || filterTrade !== "all" || filterStatus !== "all"
                ? `Showing ${totalItems} filtered results`
                : `Total: ${totalItems} trainees`
              }
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
                <p className="text-sm text-muted-foreground">Loading trainees...</p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Trainee Number</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Gender</TableHead>
                        <TableHead>Trade</TableHead>
                        <TableHead>Level</TableHead>
                        <TableHead>Mode</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right min-w-[100px]">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedData.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={8} className="text-center py-12">
                            <div className="text-muted-foreground">
                              {searchTerm || filterTrade !== "all" || filterStatus !== "all"
                                ? "No trainees match your search criteria"
                                : "No trainees registered yet"
                              }
                            </div>
                            {!searchTerm && filterTrade === "all" && filterStatus === "all" && (
                              <Button 
                                variant="outline" 
                                className="mt-4"
                                onClick={() => navigate("/trainees/register")}
                              >
                                <UserPlus className="mr-2 h-4 w-4" />
                                Register First Trainee
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ) : (
                        paginatedData.map((trainee) => (
                          <TableRow key={trainee.id} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/trainees/${trainee.id}`)}>
                            <TableCell className="font-medium">{trainee.trainee_id}</TableCell>
                            <TableCell className="whitespace-nowrap">{trainee.first_name} {trainee.last_name}</TableCell>
                            <TableCell className="capitalize">{trainee.gender}</TableCell>
                            <TableCell>{trainee.trades?.name || "N/A"}</TableCell>
                            <TableCell>Level {trainee.level}</TableCell>
                            <TableCell className="capitalize whitespace-nowrap">{trainee.training_mode.replace("_", " ")}</TableCell>
                            <TableCell>
                              <Badge variant={getStatusBadgeVariant(trainee.status)}>
                                {trainee.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigate(`/trainees/${trainee.id}`);
                                }}
                              >
                                View
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
                {totalItems > 0 && (
                  <DataTablePagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    pageSize={pageSize}
                    totalItems={totalItems}
                    onPageChange={setCurrentPage}
                    onPageSizeChange={setPageSize}
                  />
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default TraineeList;
