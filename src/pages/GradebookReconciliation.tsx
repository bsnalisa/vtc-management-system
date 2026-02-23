import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useRoleNavigation } from "@/hooks/useRoleNavigation";
import { useGradebookAudit, GradebookAuditIssue } from "@/hooks/useGradebookAudit";
import { useNavigate } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, CheckCircle, Info, XCircle, Eye, RefreshCw, BookOpen, Send, Award, FileCheck } from "lucide-react";

const severityConfig: Record<string, { icon: typeof AlertTriangle; color: string; label: string }> = {
  error: { icon: XCircle, color: "text-destructive", label: "Error" },
  warning: { icon: AlertTriangle, color: "text-yellow-600", label: "Warning" },
  info: { icon: Info, color: "text-blue-500", label: "Info" },
};

const typeLabels: Record<string, string> = {
  missing_ca: "Missing CA Scores",
  stalled_workflow: "Stalled Workflow",
  orphaned_marks: "Orphaned Marks",
  empty_gradebook: "Empty Gradebook",
  unresolved_queries: "Open Queries",
};

const GradebookReconciliation = () => {
  const navigate = useNavigate();
  const { navItems, groupLabel } = useRoleNavigation();
  const { data, isLoading, refetch } = useGradebookAudit();

  const issues = data?.issues || [];
  const summary = data?.summary;

  const errorCount = issues.filter(i => i.severity === "error").length;
  const warningCount = issues.filter(i => i.severity === "warning").length;
  const infoCount = issues.filter(i => i.severity === "info").length;

  return (
    <DashboardLayout
      title="Gradebook Reconciliation"
      subtitle="Audit gradebook data integrity and workflow health"
      navItems={navItems}
      groupLabel={groupLabel}
    >
      <div className="space-y-6 max-w-7xl mx-auto">
        {/* Actions */}
        <div className="flex justify-end">
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" />Re-scan
          </Button>
        </div>

        {/* Workflow pipeline summary */}
        {isLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
            {[1,2,3,4,5,6].map(i => <Skeleton key={i} className="h-24" />)}
          </div>
        ) : summary ? (
          <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
            <Card>
              <CardContent className="p-4 text-center">
                <BookOpen className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
                <div className="text-2xl font-bold">{summary.total}</div>
                <p className="text-xs text-muted-foreground">Total</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold">{summary.draft}</div>
                <p className="text-xs text-muted-foreground">Draft</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <Send className="h-5 w-5 mx-auto mb-1 text-blue-500" />
                <div className="text-2xl font-bold">{summary.submitted}</div>
                <p className="text-xs text-muted-foreground">Submitted</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <FileCheck className="h-5 w-5 mx-auto mb-1 text-amber-500" />
                <div className="text-2xl font-bold">{summary.hot_approved}</div>
                <p className="text-xs text-muted-foreground">HoT Approved</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <CheckCircle className="h-5 w-5 mx-auto mb-1 text-green-500" />
                <div className="text-2xl font-bold">{summary.ac_approved}</div>
                <p className="text-xs text-muted-foreground">AC Approved</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <Award className="h-5 w-5 mx-auto mb-1 text-primary" />
                <div className="text-2xl font-bold">{summary.finalised}</div>
                <p className="text-xs text-muted-foreground">Finalised</p>
              </CardContent>
            </Card>
          </div>
        ) : null}

        {/* Health summary */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className={errorCount > 0 ? "border-destructive/50" : ""}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <XCircle className={`h-4 w-4 ${errorCount > 0 ? "text-destructive" : "text-muted-foreground"}`} />Errors
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${errorCount > 0 ? "text-destructive" : ""}`}>{errorCount}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <AlertTriangle className={`h-4 w-4 ${warningCount > 0 ? "text-yellow-600" : "text-muted-foreground"}`} />Warnings
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{warningCount}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Info className={`h-4 w-4 ${infoCount > 0 ? "text-blue-500" : "text-muted-foreground"}`} />Info
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{infoCount}</div>
            </CardContent>
          </Card>
        </div>

        {/* Issues table */}
        <Card>
          <CardHeader>
            <CardTitle>Audit Findings</CardTitle>
            <CardDescription>
              {issues.length === 0 ? "No issues detected — all gradebooks are healthy." : `${issues.length} issue(s) found across your gradebooks.`}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-8 text-center"><Skeleton className="h-40 w-full" /></div>
            ) : issues.length === 0 ? (
              <div className="py-12 text-center">
                <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-500 opacity-70" />
                <p className="text-muted-foreground">All gradebooks pass integrity checks.</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-20">Severity</TableHead>
                    <TableHead>Issue Type</TableHead>
                    <TableHead>Gradebook</TableHead>
                    <TableHead>Trainer</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Detail</TableHead>
                    <TableHead className="w-20"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {issues.map((issue, idx) => {
                    const sev = severityConfig[issue.severity];
                    const SevIcon = sev.icon;
                    return (
                      <TableRow key={idx}>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            <SevIcon className={`h-4 w-4 ${sev.color}`} />
                            <span className="text-xs capitalize">{sev.label}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">{typeLabels[issue.type] || issue.type}</Badge>
                        </TableCell>
                        <TableCell className="font-medium text-sm">{issue.gradebook_title}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{issue.trainer_name}</TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="capitalize text-xs">{issue.status.replace(/_/g, " ")}</Badge>
                        </TableCell>
                        <TableCell className="text-sm max-w-xs">{issue.detail}</TableCell>
                        <TableCell>
                          <Button size="icon" variant="ghost" onClick={() => navigate(`/gradebooks/${issue.gradebook_id}`)}>
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default GradebookReconciliation;
