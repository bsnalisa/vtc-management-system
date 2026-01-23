import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SuperAdminLayout } from "@/components/SuperAdminLayout";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useSystemAuditLogs } from "@/hooks/useSystemAuditLogs";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DataTablePagination } from "@/components/ui/data-table-pagination";
import { TableSkeleton } from "@/components/ui/table-skeleton";
import { usePagination } from "@/hooks/usePagination";
import { exportToCSV, prepareDataForExport } from "@/lib/exportUtils";
import { Activity, Search, Download, Filter, RefreshCw } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useUserRole } from "@/hooks/useUserRole";
import { useOrganizationContext } from "@/hooks/useOrganizationContext";
import { organizationAdminNavItems } from "@/lib/navigationConfig";
import { format } from "date-fns";

const SystemLogs = () => {
  const { role } = useUserRole();
  const { organizationId } = useOrganizationContext();
  
  const [searchTerm, setSearchTerm] = useState("");
  const [actionFilter, setActionFilter] = useState<string>("all");
  
  // Filter by organization for organization admins
  const filterOrgId = role === 'organization_admin' ? organizationId : undefined;
  const { data: logs, isLoading, refetch } = useSystemAuditLogs(500, filterOrgId);

  // Filter logs
  const filteredLogs = logs?.filter((log: any) => {
    const matchesSearch = 
      log.entity?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.action_type?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.user_id?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesAction = actionFilter === "all" || log.action_type === actionFilter;
    
    return matchesSearch && matchesAction;
  }) || [];

  // Pagination
  const {
    paginatedData,
    currentPage,
    totalPages,
    pageSize,
    totalItems,
    setCurrentPage,
    setPageSize,
  } = usePagination({ data: filteredLogs, defaultPageSize: 20 });

  // Get unique actions for filter
  const uniqueActions = [...new Set(logs?.map((log: any) => log.action_type) || [])];

  const handleExport = () => {
    if (!filteredLogs.length) return;
    
    const exportData = prepareDataForExport(
      filteredLogs.map((log: any) => ({
        timestamp: format(new Date(log.created_at), "yyyy-MM-dd HH:mm:ss"),
        action: log.action_type,
        entity: log.entity || "-",
        user_id: log.user_id,
        ip_address: log.ip_address || "-",
        details: log.details ? JSON.stringify(log.details) : "-",
      }))
    );
    
    exportToCSV(exportData, `system-logs-${format(new Date(), "yyyy-MM-dd")}`);
  };

  const getActionColor = (action: string) => {
    switch (action) {
      case 'create': return 'default';
      case 'update': return 'secondary';
      case 'delete': return 'destructive';
      case 'access': return 'outline';
      default: return 'secondary';
    }
  };

  const isOrgAdmin = role === 'organization_admin';

  const mainContent = (
    <div className="space-y-6">
      {!isOrgAdmin && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Activity className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-3xl font-bold">System Activity Logs</h1>
              <p className="text-muted-foreground">Real-time monitoring of system actions</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            <Button variant="outline" size="sm" onClick={handleExport} disabled={!filteredLogs.length}>
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          </div>
        </div>
      )}

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <CardTitle>Recent Activity</CardTitle>
              <CardDescription>
                {isOrgAdmin 
                  ? "System operations in your organization"
                  : "System operations performed by administrators"}
              </CardDescription>
            </div>
            {isOrgAdmin && (
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => refetch()}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refresh
                </Button>
                <Button variant="outline" size="sm" onClick={handleExport} disabled={!filteredLogs.length}>
                  <Download className="h-4 w-4 mr-2" />
                  Export
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by entity, action, or user..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={actionFilter} onValueChange={setActionFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Filter by action" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Actions</SelectItem>
                {uniqueActions.map((action) => (
                  <SelectItem key={action} value={action}>
                    {action}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Table */}
          {isLoading ? (
            <TableSkeleton columns={5} rows={10} />
          ) : filteredLogs.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Activity className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No activity logs found</p>
              <p className="text-sm">System activity will appear here</p>
            </div>
          ) : (
            <>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Timestamp</TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead>Entity</TableHead>
                      <TableHead>User ID</TableHead>
                      <TableHead>IP Address</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedData.map((log: any) => (
                      <TableRow key={log.id}>
                        <TableCell className="text-xs whitespace-nowrap">
                          {format(new Date(log.created_at), "MMM dd, yyyy HH:mm")}
                        </TableCell>
                        <TableCell>
                          <Badge variant={getActionColor(log.action_type)}>
                            {log.action_type}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-medium">{log.entity}</TableCell>
                        <TableCell className="text-xs font-mono">
                          {log.user_id?.substring(0, 8)}...
                        </TableCell>
                        <TableCell className="text-xs">{log.ip_address || 'N/A'}</TableCell>
                      </TableRow>
                    ))}
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
    </div>
  );

  return isOrgAdmin ? (
    <DashboardLayout
      title="System Activity Logs"
      subtitle="Organization activity monitoring"
      navItems={organizationAdminNavItems}
      groupLabel="Navigation"
    >
      {mainContent}
    </DashboardLayout>
  ) : (
    <SuperAdminLayout>{mainContent}</SuperAdminLayout>
  );
};

export default SystemLogs;
