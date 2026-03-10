import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FileCheck, Lock, CheckCircle, Loader2, GraduationCap, ClipboardList, Shield, Award, ChevronRight, BarChart3, BookOpen, FileSpreadsheet, Calendar } from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { assessmentCoordinatorNavItems } from "@/lib/navigationConfig";
import { useProfile } from "@/hooks/useProfile";
import { useOrganizationContext } from "@/hooks/useOrganizationContext";
import { useAssessmentResultsByStatus, useFinaliseAssessments } from "@/hooks/useAssessmentResults";
import { useAssessmentTemplates } from "@/hooks/useAssessmentTemplates";
import { useQualifications } from "@/hooks/useQualifications";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";

const AssessmentCoordinatorDashboard = () => {
  const navigate = useNavigate();
  const { data: profile } = useProfile();
  const { organizationId } = useOrganizationContext();
  const { data: approvedResults, isLoading } = useAssessmentResultsByStatus(["approved_by_hot"], organizationId);
  const { data: finalisedResults } = useAssessmentResultsByStatus(["finalised"], organizationId);
  const { data: templates } = useAssessmentTemplates();
  const { data: qualifications } = useQualifications();
  const finalise = useFinaliseAssessments();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const selectAll = () => {
    if (!approvedResults) return;
    setSelectedIds(prev => prev.length === approvedResults.length ? [] : approvedResults.map((r: any) => r.id));
  };

  const handleFinalise = async () => {
    if (selectedIds.length === 0) return;
    await finalise.mutateAsync(selectedIds);
    setSelectedIds([]);
  };

  const pendingCount = approvedResults?.length || 0;
  const finalisedCount = finalisedResults?.length || 0;
  const pendingTemplates = templates?.filter(t => t.status === "pending_approval").length || 0;
  const approvedTemplates = templates?.filter(t => t.status === "approved").length || 0;
  const totalQualifications = qualifications?.length || 0;
  const finalisationRate = pendingCount + finalisedCount > 0
    ? Math.round((finalisedCount / (pendingCount + finalisedCount)) * 100)
    : 0;

  const greeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  };

  return (
    <DashboardLayout
      title=""
      subtitle=""
      navItems={assessmentCoordinatorNavItems}
      groupLabel="Assessment Management"
    >
      <div className="space-y-8">
        {/* Hero Greeting */}
        <div className="rounded-xl bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border p-6">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/15 text-primary">
              <Shield className="h-7 w-7" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">
                {greeting()}, {profile?.firstname || "User"}
              </h1>
              <p className="text-muted-foreground mt-0.5">
                Assessment Command Center — governance, templates & finalisation
              </p>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="relative overflow-hidden cursor-pointer hover:border-primary/30 transition-colors" onClick={() => navigate("/qualifications")}>
            <div className="absolute top-0 right-0 h-20 w-20 translate-x-4 -translate-y-4 rounded-full bg-primary/10" />
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Qualifications</CardTitle>
              <GraduationCap className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              {isLoading ? <Skeleton className="h-8 w-16" /> : (
                <div className="text-3xl font-bold">{totalQualifications}</div>
              )}
              <p className="text-xs text-muted-foreground mt-1">Total qualifications</p>
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden cursor-pointer hover:border-primary/30 transition-colors" onClick={() => navigate("/assessment-templates")}>
            <div className="absolute top-0 right-0 h-20 w-20 translate-x-4 -translate-y-4 rounded-full bg-secondary/20" />
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Templates</CardTitle>
              <ClipboardList className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {isLoading ? <Skeleton className="h-8 w-16" /> : (
                <div className="text-3xl font-bold">{approvedTemplates}</div>
              )}
              <p className="text-xs text-muted-foreground mt-1">
                {pendingTemplates > 0 ? `${pendingTemplates} pending approval` : "Active templates"}
              </p>
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden">
            <div className="absolute top-0 right-0 h-20 w-20 translate-x-4 -translate-y-4 rounded-full bg-accent/30" />
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Awaiting Finalisation</CardTitle>
              <FileCheck className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{pendingCount}</div>
              <p className="text-xs text-muted-foreground mt-1">Approved by HoT</p>
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden">
            <div className="absolute top-0 right-0 h-20 w-20 translate-x-4 -translate-y-4 rounded-full bg-destructive/10" />
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Finalised</CardTitle>
              <Lock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{finalisedCount}</div>
              <p className="text-xs text-muted-foreground mt-1">Locked & visible to trainees</p>
            </CardContent>
          </Card>
        </div>

        {/* Secondary Stats */}
        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Pending Templates</CardTitle>
              <ClipboardList className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{pendingTemplates}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Approved Templates</CardTitle>
              <Award className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{approvedTemplates}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Finalisation Rate</CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{finalisationRate}%</div>
              <Progress value={finalisationRate} className="h-1.5 mt-2" />
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <div>
          <h2 className="text-lg font-semibold mb-3">Quick Actions</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {[
              { icon: GraduationCap, label: "Qualifications", desc: "Manage qualifications", url: "/qualifications" },
              { icon: ClipboardList, label: "Templates", desc: "Assessment templates", url: "/assessment-templates" },
              { icon: FileSpreadsheet, label: "SA Entry", desc: "Summative assessments", url: "/summative-assessment" },
              { icon: Calendar, label: "Governance", desc: "Cycles & locking", url: "/assessment-governance" },
              { icon: BookOpen, label: "Results", desc: "Results & gradebooks", url: "/qualification-results" },
            ].map(({ icon: Icon, label, desc, url }) => (
              <button
                key={url}
                onClick={() => navigate(url)}
                className="flex items-center gap-3 rounded-lg border bg-card p-4 text-left transition-all hover:bg-accent hover:shadow-sm active:scale-[0.98]"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="font-medium text-sm">{label}</p>
                  <p className="text-xs text-muted-foreground">{desc}</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Tabbed Content */}
        <Tabs defaultValue="finalisation" className="space-y-4">
          <TabsList>
            <TabsTrigger value="finalisation">
              Finalisation Queue
              {pendingCount > 0 && <Badge variant="destructive" className="ml-2 h-5 px-1.5">{pendingCount}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="templates">
              Template Approvals
              {pendingTemplates > 0 && <Badge variant="secondary" className="ml-2 h-5 px-1.5">{pendingTemplates}</Badge>}
            </TabsTrigger>
          </TabsList>

          {/* Finalisation Queue Tab */}
          <TabsContent value="finalisation" className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <FileCheck className="h-5 w-5 text-primary" /> Assessments Awaiting Finalisation
                    </CardTitle>
                    <CardDescription>Approved by HoT. Finalise to make visible to trainees.</CardDescription>
                  </div>
                  <Button size="sm" onClick={handleFinalise} disabled={selectedIds.length === 0 || finalise.isPending}>
                    <Lock className="h-4 w-4 mr-2" />
                    {finalise.isPending ? "Finalising..." : `Finalise (${selectedIds.length})`}
                  </Button>
                </div>
              </CardHeader>
              <Separator />
              <CardContent className="pt-4">
                {isLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : !approvedResults || approvedResults.length === 0 ? (
                  <div className="py-10 text-center">
                    <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                      <CheckCircle className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <h3 className="text-lg font-medium mb-1">All Caught Up</h3>
                    <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                      No assessments awaiting finalisation. All approved results have been processed.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-10">
                            <Checkbox
                              checked={selectedIds.length === approvedResults.length && approvedResults.length > 0}
                              onCheckedChange={selectAll}
                            />
                          </TableHead>
                          <TableHead>Trainee</TableHead>
                          <TableHead>Course</TableHead>
                          <TableHead>Unit Standard</TableHead>
                          <TableHead>Marks</TableHead>
                          <TableHead>Competency</TableHead>
                          <TableHead>Approved At</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {approvedResults.map((result: any) => (
                          <TableRow key={result.id}>
                            <TableCell>
                              <Checkbox
                                checked={selectedIds.includes(result.id)}
                                onCheckedChange={() => toggleSelect(result.id)}
                              />
                            </TableCell>
                            <TableCell>
                              <div>
                                <p className="font-medium">{result.trainees?.first_name} {result.trainees?.last_name}</p>
                                <p className="text-xs text-muted-foreground font-mono">{result.trainees?.trainee_id}</p>
                              </div>
                            </TableCell>
                            <TableCell>
                              <p className="text-sm">{result.trainee_enrollments?.courses?.name}</p>
                              <p className="text-xs text-muted-foreground">Level {result.trainee_enrollments?.courses?.level}</p>
                            </TableCell>
                            <TableCell>
                              <p className="text-sm">{result.unit_standards?.module_title}</p>
                              <p className="text-xs text-muted-foreground">{result.unit_standards?.unit_no}</p>
                            </TableCell>
                            <TableCell className="font-medium">{result.marks_obtained ?? "-"}</TableCell>
                            <TableCell>
                              <Badge variant={result.competency_status === "competent" ? "default" : result.competency_status === "not_yet_competent" ? "destructive" : "secondary"}>
                                {result.competency_status?.replace(/_/g, " ") || "Pending"}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {result.hot_approved_at ? new Date(result.hot_approved_at).toLocaleDateString("en-ZA") : "-"}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Template Approvals Tab */}
          <TabsContent value="templates" className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <ClipboardList className="h-5 w-5 text-primary" /> Pending Template Approvals
                    </CardTitle>
                    <CardDescription>{pendingTemplates} template(s) awaiting review</CardDescription>
                  </div>
                  {pendingTemplates > 0 && (
                    <Button variant="outline" size="sm" onClick={() => navigate("/assessment-template-approvals")}>
                      View All <ChevronRight className="h-3.5 w-3.5 ml-1" />
                    </Button>
                  )}
                </div>
              </CardHeader>
              <Separator />
              <CardContent className="pt-4">
                {pendingTemplates === 0 ? (
                  <div className="py-10 text-center">
                    <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                      <CheckCircle className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <h3 className="text-lg font-medium mb-1">No Pending Templates</h3>
                    <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                      All assessment templates have been reviewed.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {templates?.filter(t => t.status === "pending_approval").slice(0, 5).map((template: any) => (
                      <div
                        key={template.id}
                        className="group flex items-center justify-between rounded-lg border p-4 transition-all hover:border-primary/30 hover:bg-accent/50 cursor-pointer"
                        onClick={() => navigate("/assessment-template-approvals")}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                            <ClipboardList className="h-5 w-5" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-sm truncate">
                              {template.qualifications?.qualification_title || "Qualification Template"}
                            </p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <Badge variant="outline" className="text-xs font-mono">v{template.version_number}</Badge>
                              <span className="text-xs text-muted-foreground">
                                Theory: {template.theory_pass_mark}% | Practical: {template.practical_pass_mark}%
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <Badge variant="secondary" className="bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400">Pending</Badge>
                          <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default AssessmentCoordinatorDashboard;
