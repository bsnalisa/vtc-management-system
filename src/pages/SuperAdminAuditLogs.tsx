import { useState } from "react";
import { SuperAdminLayout } from "@/components/SuperAdminLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useSuperAdminAuditLogs, useLoginAttempts } from "@/hooks/useSuperAdminAuditLogs";
import { format } from "date-fns";
import { Search, Shield, AlertTriangle, CheckCircle, Clock, RefreshCw } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageLoader } from "@/components/ui/loading-spinner";

const SuperAdminAuditLogs = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [actionFilter, setActionFilter] = useState<string>("all");
  
  const { data: auditLogs, isLoading: logsLoading, refetch: refetchLogs } = useSuperAdminAuditLogs(200);
  const { data: loginAttempts, isLoading: attemptsLoading, refetch: refetchAttempts } = useLoginAttempts(200);

  const filteredLogs = auditLogs?.filter((log) => {
    const matchesSearch =
      searchQuery === "" ||
      log.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.affected_table?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesAction = actionFilter === "all" || log.action === actionFilter;
    
    return matchesSearch && matchesAction;
  });

  const uniqueActions = [...new Set(auditLogs?.map((log) => log.action) || [])];

  const getActionBadgeVariant = (action: string) => {
    if (action.includes("delete") || action.includes("remove")) return "destructive";
    if (action.includes("create") || action.includes("add")) return "default";
    if (action.includes("update") || action.includes("edit")) return "secondary";
    return "outline";
  };

  const filteredAttempts = loginAttempts?.filter((attempt) =>
    searchQuery === "" || attempt.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (logsLoading || attemptsLoading) {
    return (
      <SuperAdminLayout>
        <PageLoader text="Loading audit logs..." />
      </SuperAdminLayout>
    );
  }

  return (
    <SuperAdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Shield className="h-8 w-8" />
              Security & Audit Logs
            </h1>
            <p className="text-muted-foreground mt-1">
              Monitor super admin activities and login attempts
            </p>
          </div>
          <Button variant="outline" onClick={() => { refetchLogs(); refetchAttempts(); }}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>

        <Tabs defaultValue="audit" className="space-y-4">
          <TabsList>
            <TabsTrigger value="audit">Audit Logs ({auditLogs?.length || 0})</TabsTrigger>
            <TabsTrigger value="login">Login Attempts ({loginAttempts?.length || 0})</TabsTrigger>
          </TabsList>

          <div className="flex gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search logs..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={actionFilter} onValueChange={setActionFilter}>
              <SelectTrigger className="w-[200px]">
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

          <TabsContent value="audit">
            <Card>
              <CardHeader>
                <CardTitle>Super Admin Activity Log</CardTitle>
                <CardDescription>
                  All actions performed by super administrators
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Timestamp</TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead>Table</TableHead>
                      <TableHead>Record ID</TableHead>
                      <TableHead>Changes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredLogs?.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                          No audit logs found
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredLogs?.map((log) => (
                        <TableRow key={log.id}>
                          <TableCell className="whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <Clock className="h-4 w-4 text-muted-foreground" />
                              {format(new Date(log.created_at), "MMM d, yyyy HH:mm")}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant={getActionBadgeVariant(log.action)}>
                              {log.action}
                            </Badge>
                          </TableCell>
                          <TableCell>{log.affected_table || "-"}</TableCell>
                          <TableCell className="font-mono text-xs">
                            {log.affected_record_id?.substring(0, 8) || "-"}
                          </TableCell>
                          <TableCell>
                            {log.old_data || log.new_data ? (
                              <Badge variant="outline">Has Changes</Badge>
                            ) : (
                              "-"
                            )}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="login">
            <Card>
              <CardHeader>
                <CardTitle>Login Attempts</CardTitle>
                <CardDescription>
                  Track successful and failed login attempts
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Timestamp</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Failure Reason</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredAttempts?.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                          No login attempts recorded
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredAttempts?.map((attempt: any) => (
                        <TableRow key={attempt.id}>
                          <TableCell className="whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <Clock className="h-4 w-4 text-muted-foreground" />
                              {format(new Date(attempt.created_at), "MMM d, yyyy HH:mm")}
                            </div>
                          </TableCell>
                          <TableCell>{attempt.email}</TableCell>
                          <TableCell>
                            {attempt.success ? (
                              <Badge variant="default" className="bg-green-500">
                                <CheckCircle className="h-3 w-3 mr-1" />
                                Success
                              </Badge>
                            ) : (
                              <Badge variant="destructive">
                                <AlertTriangle className="h-3 w-3 mr-1" />
                                Failed
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>{attempt.failure_reason || "-"}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </SuperAdminLayout>
  );
};

export default SuperAdminAuditLogs;
