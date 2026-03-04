import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useRoleNavigation } from "@/hooks/useRoleNavigation";
import { useAssessmentCycles, useLockCycle } from "@/hooks/useAssessmentCycles";
import { useAssessmentAuditLogs } from "@/hooks/useAssessmentAudit";
import { useAssessmentTemplates } from "@/hooks/useAssessmentTemplates";
import { useOrganizationContext } from "@/hooks/useOrganizationContext";
import { Lock, Unlock, History, Shield, AlertTriangle } from "lucide-react";

const AssessmentGovernance = () => {
  const { navItems, groupLabel } = useRoleNavigation();
  const { organizationId } = useOrganizationContext();
  const [academicYear, setAcademicYear] = useState(new Date().getFullYear().toString());
  const [lockDialogOpen, setLockDialogOpen] = useState(false);
  const [lockTarget, setLockTarget] = useState<{ qualificationId: string; name: string } | null>(null);
  const [lockReason, setLockReason] = useState("");
  const [auditFilter, setAuditFilter] = useState<string>("");

  const { data: cycles, isLoading: cyclesLoading } = useAssessmentCycles(academicYear);
  const { data: templates } = useAssessmentTemplates("approved");
  const { data: auditLogs, isLoading: auditLoading } = useAssessmentAuditLogs(auditFilter || undefined, 200);
  const lockCycle = useLockCycle();

  const handleLock = async () => {
    if (!lockTarget || !organizationId) return;
    await lockCycle.mutateAsync({
      orgId: organizationId,
      qualificationId: lockTarget.qualificationId,
      academicYear,
      reason: lockReason,
    });
    setLockDialogOpen(false);
    setLockTarget(null);
    setLockReason("");
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "open": return <Badge className="bg-green-600">Open</Badge>;
      case "locked": return <Badge variant="secondary"><Lock className="h-3 w-3 mr-1" />Locked</Badge>;
      case "archived": return <Badge variant="outline">Archived</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getActionBadge = (action: string) => {
    const colors: Record<string, string> = {
      template_created: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300",
      template_approved: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300",
      template_rejected: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
      sa_mark_recorded: "bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300",
      sa_mark_updated: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
      result_approved: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300",
    };
    return <Badge className={colors[action] || ""}>{action.replace(/_/g, " ")}</Badge>;
  };

  return (
    <DashboardLayout
      title="Assessment Governance"
      subtitle="Manage assessment cycles, audit trails, and system integrity"
      navItems={navItems}
      groupLabel={groupLabel}
    >
      <div className="space-y-6 max-w-7xl mx-auto">
        <Tabs defaultValue="cycles">
          <TabsList>
            <TabsTrigger value="cycles"><Lock className="h-4 w-4 mr-1" />Cycle Management</TabsTrigger>
            <TabsTrigger value="audit"><History className="h-4 w-4 mr-1" />Audit Trail</TabsTrigger>
          </TabsList>

          {/* Cycle Management */}
          <TabsContent value="cycles" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Assessment Cycles</CardTitle>
                    <CardDescription>Lock completed assessment cycles to prevent modifications</CardDescription>
                  </div>
                  <div className="w-[120px]">
                    <Input value={academicYear} onChange={e => setAcademicYear(e.target.value)} placeholder="Year" />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {/* Show approved templates with their cycle status */}
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Qualification</TableHead>
                      <TableHead>Academic Year</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Locked At</TableHead>
                      <TableHead>Reason</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {templates?.map((t: any) => {
                      const cycle = cycles?.find(c => c.qualification_id === t.qualification_id);
                      const isLocked = cycle?.status === "locked" || cycle?.status === "archived";

                      return (
                        <TableRow key={t.id}>
                          <TableCell>
                            <div className="font-medium">{t.qualifications?.qualification_code}</div>
                            <div className="text-xs text-muted-foreground">{t.qualifications?.qualification_title}</div>
                          </TableCell>
                          <TableCell>{academicYear}</TableCell>
                          <TableCell>{cycle ? getStatusBadge(cycle.status) : <Badge className="bg-green-600">Open</Badge>}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {cycle?.locked_at ? new Date(cycle.locked_at).toLocaleDateString("en-ZA") : "—"}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                            {cycle?.lock_reason || "—"}
                          </TableCell>
                          <TableCell className="text-right">
                            {!isLocked ? (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setLockTarget({
                                    qualificationId: t.qualification_id,
                                    name: `${t.qualifications?.qualification_code} – ${t.qualifications?.qualification_title}`,
                                  });
                                  setLockDialogOpen(true);
                                }}
                              >
                                <Lock className="h-3 w-3 mr-1" />Lock Cycle
                              </Button>
                            ) : (
                              <span className="text-xs text-muted-foreground flex items-center justify-end gap-1">
                                <Shield className="h-3 w-3" />Secured
                              </span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {(!templates || templates.length === 0) && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                          No approved templates found. Create and approve templates first.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Audit Trail */}
          <TabsContent value="audit" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Assessment Audit Trail</CardTitle>
                    <CardDescription>Complete history of template changes, SA entries, and result approvals</CardDescription>
                  </div>
                  <Select value={auditFilter} onValueChange={setAuditFilter}>
                    <SelectTrigger className="w-[200px]">
                      <SelectValue placeholder="All events" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Events</SelectItem>
                      <SelectItem value="template">Templates</SelectItem>
                      <SelectItem value="summative_result">SA Entries</SelectItem>
                      <SelectItem value="qualification_result">Result Approvals</SelectItem>
                      <SelectItem value="component">Components</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="max-h-[600px] overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Action</TableHead>
                        <TableHead>Entity Type</TableHead>
                        <TableHead>Performed By</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {auditLogs?.map((log: any) => (
                        <TableRow key={log.id}>
                          <TableCell className="text-sm whitespace-nowrap">
                            {new Date(log.created_at).toLocaleString("en-ZA", { dateStyle: "short", timeStyle: "short" })}
                          </TableCell>
                          <TableCell>{getActionBadge(log.action)}</TableCell>
                          <TableCell className="text-sm capitalize">{log.entity_type?.replace(/_/g, " ")}</TableCell>
                          <TableCell className="text-xs font-mono text-muted-foreground">
                            {log.performed_by?.substring(0, 8)}…
                          </TableCell>
                        </TableRow>
                      ))}
                      {(!auditLogs || auditLogs.length === 0) && (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                            No audit events found.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Lock Confirmation Dialog */}
      <Dialog open={lockDialogOpen} onOpenChange={setLockDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Lock Assessment Cycle
            </DialogTitle>
            <DialogDescription>
              This will permanently prevent any modifications to SA marks and results for{" "}
              <strong>{lockTarget?.name}</strong> ({academicYear}). This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Label>Reason (optional)</Label>
            <Textarea
              value={lockReason}
              onChange={e => setLockReason(e.target.value)}
              placeholder="e.g., End of academic year, results published"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLockDialogOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleLock} disabled={lockCycle.isPending}>
              <Lock className="h-4 w-4 mr-2" />
              {lockCycle.isPending ? "Locking..." : "Lock Cycle"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default AssessmentGovernance;
