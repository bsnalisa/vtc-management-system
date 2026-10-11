import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SuperAdminLayout } from "@/components/SuperAdminLayout";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useAdminAuditLog, type AdminAuditEntry } from "@/hooks/useAdminAuditLog";
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
import { useRoleNavigation } from "@/hooks/useRoleNavigation";
import { format } from "date-fns";

const formatValue = (value: unknown) => {
  if (value === null || value === undefined || value === "") return "empty";
  const text = typeof value === "object" ? JSON.stringify(value) : String(value);
  return text.length > 40 ? `${text.slice(0, 40)}…` : text;
};

// One readable line for what changed
const describeDetails = (log: AdminAuditEntry): string => {
  const d = log.details ?? {};
  if (d.reason) return `Reason: ${d.reason}`;
  if (log.action.endsWith(".update") && d.changes) {
    return Object.entries(d.changes as Record<string, { from: unknown; to: unknown }>)
      .map(([field, change]) => `${field}: ${formatValue(change.from)} → ${formatValue(change.to)}`)
      .join("; ");
  }
  if (d.from !== undefined || d.to !== undefined) return `${formatValue(d.from)} → ${formatValue(d.to)}`;
  if (d.email || d.role) return [d.email, d.role].filter(Boolean).join(" · ");
  if (d.changes) return `${Object.keys(d.changes).length} fields`;
  return "";
};

const SystemLogs = () => {
  const { role, navItems, groupLabel } = useRoleNavigation();
  const { organizationId } = useOrganizationContext();
  
  const [searchTerm, setSearchTerm] = useState("");
  const [actionFilter, setActionFilter] = useState<string>("all");
  
  // Filter by organization for organization admins
  const filterOrgId = role === 'organization_admin' ? organizationId : undefined;
  const { data: logs, isLoading, refetch } = useAdminAuditLog(500, filterOrgId);

  // Filter logs
  const needle = searchTerm.toLowerCase();
  const filteredLogs = logs?.filter((log) => {
    const matchesSearch =
      log.entity?.toLowerCase().includes(needle) ||
      log.action?.toLowerCase().includes(needle) ||
      log.summary?.toLowerCase().includes(needle) ||
      log.actor_name?.toLowerCase().includes(needle);

    const matchesAction = actionFilter === "all" || log.action === actionFilter;

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
  const uniqueActions = [...new Set(logs?.map((log) => log.action) || [])];

  const handleExport = () => {
    if (!filteredLogs.length) return;
    
    const exportData = prepareDataForExport(
      filteredLogs.map((log) => ({
        timestamp: format(new Date(log.created_at), "yyyy-MM-dd HH:mm:ss"),
        who: log.actor_name || "-",
        role: log.actor_role || "-",
        action: log.action,
        entity: log.entity || "-",
        summary: log.summary || "-",
        details: describeDetails(log),
      }))
    );
    
    exportToCSV(exportData, `system-logs-${format(new Date(), "yyyy-MM-dd")}`);
  };

  const getActionColor = (action: string) => {
    if (/delete|deactivated|password_reset/.test(action)) return 'destructive';
    if (/insert|created|reactivated/.test(action)) return 'default';
    if (/override/.test(action)) return 'outline';
    return 'secondary';
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
                  ? "What administrators changed in your centre: people and roles, fees, marks and settings"
                  : "What administrators changed, across every centre"}
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
                placeholder="Search by person, action or record..."
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
              <p>No administrator activity recorded yet</p>
              <p className="text-sm">Changes to roles, fees, marks and settings will appear here</p>
            </div>
          ) : (
            <>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>When</TableHead>
                      <TableHead>Who</TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead>What</TableHead>
                      <TableHead>Details</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedData.map((log: AdminAuditEntry) => (
                      <TableRow key={log.id}>
                        <TableCell className="text-xs whitespace-nowrap">
                          {format(new Date(log.created_at), "MMM dd, yyyy HH:mm")}
                        </TableCell>
                        <TableCell className="text-sm whitespace-nowrap">
                          {log.actor_name || "System"}
                          {log.actor_role && <span className="block text-xs text-muted-foreground">{log.actor_role.replace(/_/g, " ")}</span>}
                        </TableCell>
                        <TableCell>
                          <Badge variant={getActionColor(log.action)}>{log.action.replace(/_/g, " ")}</Badge>
                        </TableCell>
                        <TableCell className="font-medium whitespace-normal min-w-[180px]">{log.summary || log.entity}</TableCell>
                        <TableCell className="text-xs text-muted-foreground whitespace-normal min-w-[220px] break-words">{describeDetails(log)}</TableCell>
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
      navItems={navItems}
      groupLabel={groupLabel}
    >
      {mainContent}
    </DashboardLayout>
  ) : (
    <SuperAdminLayout>{mainContent}</SuperAdminLayout>
  );
};

export default SystemLogs;
