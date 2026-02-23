import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DashboardLayout } from "@/components/DashboardLayout";
import { traineeNavItems } from "@/lib/navigationConfig";
import { Award, CheckCircle, XCircle, Clock, Loader2, BookOpen, MessageSquare, ChevronDown, ChevronRight, HelpCircle, Send } from "lucide-react";
import { withRoleAccess } from "@/components/withRoleAccess";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  useTraineeUserId,
  useTraineeRecord,
  useTraineeAssessmentResults,
  useTraineeGradebookEntries,
  useTraineeGradebookMarks,
} from "@/hooks/useTraineePortalData";
import { useMyMarkQueries, useSubmitMarkQuery } from "@/hooks/useMarkQueries";

const competencyBadge = (status: string | null) => {
  switch (status) {
    case "competent": return <Badge className="bg-green-100 text-green-800"><CheckCircle className="h-3 w-3 mr-1" />Competent</Badge>;
    case "not_yet_competent": return <Badge className="bg-red-100 text-red-800"><XCircle className="h-3 w-3 mr-1" />Not Yet Competent</Badge>;
    default: return <Badge className="bg-gray-100 text-gray-800"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
  }
};

const statusLabel = (status: string) => {
  if (status === "finalised") return { text: "Final", variant: "default" as const };
  return { text: "Provisional", variant: "secondary" as const };
};

// ─── Gradebook detail card for a single gradebook ───
const GradebookCard = ({ gradebook, traineeId, onRaiseQuery }: { gradebook: any; traineeId: string; onRaiseQuery: (gradebookId: string, componentId: string, componentName: string) => void }) => {
  const [open, setOpen] = useState(false);
  const { data, isLoading } = useTraineeGradebookMarks(open ? gradebook.id : null, traineeId);

  const isFinal = gradebook.status === "finalised";
  const sl = statusLabel(gradebook.status);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card className="border-0 shadow-sm">
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {open ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                <div>
                  <CardTitle className="text-base">{gradebook.title}</CardTitle>
                  <CardDescription>
                    {gradebook.qualifications?.qualification_code} • Level {gradebook.level} • {gradebook.academic_year}
                  </CardDescription>
                </div>
              </div>
              <Badge variant={sl.variant}>{sl.text}</Badge>
            </div>
          </CardHeader>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="pt-0">
            {isLoading ? (
              <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
            ) : data ? (
              <div className="space-y-4">
                {/* CA Summary */}
                {data.caScore && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 rounded-lg bg-muted/50">
                    {data.caScore.test_average != null && (
                      <div><p className="text-xs text-muted-foreground">Test Average</p><p className="text-lg font-semibold">{Number(data.caScore.test_average).toFixed(1)}%</p></div>
                    )}
                    {data.caScore.mock_average != null && (
                      <div><p className="text-xs text-muted-foreground">Mock Average</p><p className="text-lg font-semibold">{Number(data.caScore.mock_average).toFixed(1)}%</p></div>
                    )}
                    {data.caScore.ca_score != null && (
                      <div><p className="text-xs text-muted-foreground">CA Score</p><p className="text-lg font-bold text-primary">{Number(data.caScore.ca_score).toFixed(1)}%</p></div>
                    )}
                    <div><p className="text-xs text-muted-foreground">Overall</p>{competencyBadge(data.caScore.overall_competency)}</div>
                  </div>
                )}

                {/* Component-level marks */}
                <div className="space-y-3">
                  {data.components.map((comp: any) => {
                    const mark = data.marks.find((m: any) => m.component_id === comp.id);
                    const fb = data.feedback.find((f: any) => f.component_id === comp.id);
                    return (
                      <div key={comp.id} className="p-3 rounded-lg border">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{comp.name}</span>
                              <Badge variant="outline" className="capitalize text-xs">{comp.component_type}</Badge>
                              {(comp.group as any)?.name && (
                                <Badge variant="secondary" className="text-xs">{(comp.group as any).name}</Badge>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            {mark ? (
                              <>
                                {mark.marks_obtained != null && (
                                  <span className="text-lg font-bold">{mark.marks_obtained}<span className="text-sm text-muted-foreground font-normal">/{comp.max_marks}</span></span>
                                )}
                                {competencyBadge(mark.competency_status)}
                                <Badge variant={isFinal ? "default" : "secondary"} className="text-xs">
                                  {isFinal ? "Final" : "Provisional"}
                                </Badge>
                              </>
                            ) : (
                              <span className="text-sm text-muted-foreground">Not assessed</span>
                            )}
                          </div>
                        </div>
                        {/* Feedback */}
                        {fb && fb.feedback_text && (
                          <div className="mt-2 p-2 rounded bg-muted/50 text-sm flex items-start gap-2">
                            <MessageSquare className="h-3.5 w-3.5 mt-0.5 text-muted-foreground shrink-0" />
                            <div>
                              <span className="text-muted-foreground text-xs font-medium">
                                {fb.is_final ? "Final Feedback" : "Provisional Feedback"}:
                              </span>
                              <p className="mt-0.5">{fb.feedback_text}</p>
                            </div>
                          </div>
                        )}
                        {/* Query button */}
                        {mark && (
                          <div className="mt-2 flex justify-end">
                            <Button size="sm" variant="ghost" className="text-xs h-7" onClick={() => onRaiseQuery(gradebook.id, comp.id, comp.name)}>
                              <HelpCircle className="h-3 w-3 mr-1" />Query this mark
                            </Button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
};

// ─── Main Page ───
const TraineeResultsPage = () => {
  const userId = useTraineeUserId();
  const { data: trainee, isLoading: tLoading } = useTraineeRecord(userId);
  const { data: results, isLoading: rLoading } = useTraineeAssessmentResults(trainee?.id);
  const { data: gradebooks, isLoading: gLoading } = useTraineeGradebookEntries(trainee?.id);
  const { data: myQueries } = useMyMarkQueries(trainee?.id);
  const submitQuery = useSubmitMarkQuery();

  const [queryDialog, setQueryDialog] = useState<{ gradebookId: string; componentId: string; componentName: string } | null>(null);
  const [queryForm, setQueryForm] = useState({ query_type: "marks_query", subject: "", description: "" });

  const isLoading = tLoading || rLoading || gLoading;

  const handleSubmitQuery = async () => {
    if (!queryDialog || !trainee?.id || !queryForm.subject || !queryForm.description) return;
    await submitQuery.mutateAsync({
      gradebook_id: queryDialog.gradebookId,
      component_id: queryDialog.componentId,
      trainee_id: trainee.id,
      query_type: queryForm.query_type,
      subject: queryForm.subject,
      description: queryForm.description,
    });
    setQueryDialog(null);
    setQueryForm({ query_type: "marks_query", subject: "", description: "" });
  };

  const openQueryDialog = (gradebookId: string, componentId: string, componentName: string) => {
    setQueryForm({ query_type: "marks_query", subject: `Query about ${componentName}`, description: "" });
    setQueryDialog({ gradebookId, componentId, componentName });
  };

  if (isLoading) {
    return (
      <DashboardLayout title="My Results" subtitle="View your assessment results and progress" navItems={traineeNavItems} groupLabel="Trainee iEnabler">
        <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      </DashboardLayout>
    );
  }

  const totalCredits = results?.reduce((s: number, r: any) => s + Number((r.unit_standards as any)?.credit || 0), 0) || 0;
  const earnedCredits = results?.filter((r: any) => r.competency_status === "competent").reduce((s: number, r: any) => s + Number((r.unit_standards as any)?.credit || 0), 0) || 0;
  const progressPercentage = totalCredits > 0 ? Math.round((earnedCredits / totalCredits) * 100) : 0;

  const competentCount = results?.filter((r: any) => r.competency_status === "competent").length || 0;
  const notCompetentCount = results?.filter((r: any) => r.competency_status === "not_yet_competent").length || 0;
  const pendingCount = results?.filter((r: any) => !r.competency_status || r.competency_status === "pending").length || 0;

  const hasGradebooks = gradebooks && gradebooks.length > 0;

  return (
    <DashboardLayout title="My Results" subtitle="View your assessment results and progress" navItems={traineeNavItems} groupLabel="Trainee iEnabler">
      <div className="space-y-6">
        {/* Summary stats */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card className="border-0 shadow-md"><CardContent className="p-6"><div className="flex items-center gap-3"><div className="p-3 rounded-lg bg-primary/10"><Award className="h-5 w-5 text-primary" /></div><div><p className="text-sm text-muted-foreground">Credits Earned</p><p className="text-2xl font-bold">{earnedCredits}/{totalCredits}</p></div></div></CardContent></Card>
          <Card className="border-0 shadow-md"><CardContent className="p-6"><div className="flex items-center gap-3"><div className="p-3 rounded-lg bg-green-100"><CheckCircle className="h-5 w-5 text-green-600" /></div><div><p className="text-sm text-muted-foreground">Competent</p><p className="text-2xl font-bold text-green-600">{competentCount}</p></div></div></CardContent></Card>
          <Card className="border-0 shadow-md"><CardContent className="p-6"><div className="flex items-center gap-3"><div className="p-3 rounded-lg bg-red-100"><XCircle className="h-5 w-5 text-red-600" /></div><div><p className="text-sm text-muted-foreground">Not Yet Competent</p><p className="text-2xl font-bold text-red-600">{notCompetentCount}</p></div></div></CardContent></Card>
          <Card className="border-0 shadow-md"><CardContent className="p-6"><div className="flex items-center gap-3"><div className="p-3 rounded-lg bg-gray-100"><Clock className="h-5 w-5 text-gray-600" /></div><div><p className="text-sm text-muted-foreground">Pending</p><p className="text-2xl font-bold">{pendingCount}</p></div></div></CardContent></Card>
        </div>

        {/* Progress bar */}
        {totalCredits > 0 && (
          <Card className="border-0 shadow-md">
            <CardHeader><CardTitle>Overall Progress</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between text-sm"><span>Qualification Progress</span><span className="font-medium">{progressPercentage}%</span></div>
                <Progress value={progressPercentage} className="h-3" />
                <p className="text-sm text-muted-foreground">You have earned {earnedCredits} out of {totalCredits} credits.</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Tabbed content: Gradebook Marks + Unit Standard Results */}
        <Tabs defaultValue={hasGradebooks ? "gradebooks" : "unit-standards"} className="space-y-4">
          <TabsList>
            {hasGradebooks && (
              <TabsTrigger value="gradebooks">
                <BookOpen className="h-4 w-4 mr-1" />Gradebook Marks
                {gradebooks.some((g: any) => g.status !== "finalised") && (
                  <Badge variant="secondary" className="ml-2 text-xs">Live</Badge>
                )}
              </TabsTrigger>
            )}
            <TabsTrigger value="unit-standards">
              <Award className="h-4 w-4 mr-1" />Unit Standard Results
            </TabsTrigger>
          </TabsList>

          {/* Gradebook marks */}
          {hasGradebooks && (
            <TabsContent value="gradebooks" className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Marks labeled <Badge variant="secondary" className="text-xs mx-1">Provisional</Badge> may change before finalisation.
                Marks labeled <Badge variant="default" className="text-xs mx-1">Final</Badge> are the official record.
              </p>
              {gradebooks.map((gb: any) => (
                <GradebookCard key={gb.id} gradebook={gb} traineeId={trainee!.id} onRaiseQuery={openQueryDialog} />
              ))}
            </TabsContent>
          )}

          {/* Legacy unit standard results */}
          <TabsContent value="unit-standards">
            <Card className="border-0 shadow-md">
              <CardHeader>
                <CardTitle>Unit Standard Results</CardTitle>
                <CardDescription>Finalised results for each unit standard</CardDescription>
              </CardHeader>
              <CardContent>
                {!results || results.length === 0 ? (
                  <div className="text-center py-12">
                    <Award className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
                    <h3 className="font-semibold">No Results Yet</h3>
                    <p className="text-muted-foreground">Your assessment results will appear here once finalised.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {results.map((result: any) => (
                      <div key={result.id} className="flex flex-col md:flex-row md:items-center justify-between p-4 rounded-lg border">
                        <div className="flex-1 mb-4 md:mb-0">
                          <h4 className="font-medium">{result.unit_standards?.title || "Unit Standard"}</h4>
                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <span className="font-mono">{result.unit_standards?.unit_standard_id || ""}</span>
                            <span>{result.unit_standards?.credit || 0} credits</span>
                            {result.assessment_date && <span>Assessed: {new Date(result.assessment_date).toLocaleDateString("en-ZA", { year: "numeric", month: "short", day: "numeric" })}</span>}
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          {result.marks_obtained !== null && result.marks_obtained !== undefined && (
                            <div className="text-right"><p className="text-2xl font-bold">{result.marks_obtained}%</p></div>
                          )}
                          {competencyBadge(result.competency_status)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
        {/* My Queries Section */}
        {myQueries && myQueries.length > 0 && (
          <Card className="border-0 shadow-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><HelpCircle className="h-5 w-5" />My Mark Queries</CardTitle>
              <CardDescription>Track the status of your submitted queries</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {myQueries.map((q: any) => (
                <div key={q.id} className="p-3 rounded-lg border space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm">{q.subject}</span>
                    <Badge variant={q.status === "open" ? "secondary" : q.status === "resolved" ? "default" : "outline"} className="capitalize text-xs">
                      {q.status.replace(/_/g, " ")}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{q.gradebooks?.title} • {q.gradebook_components?.name}</p>
                  <p className="text-sm">{q.description}</p>
                  {q.resolution_notes && (
                    <div className="mt-1 p-2 bg-muted rounded text-sm">
                      <span className="text-xs font-medium text-muted-foreground">Response: </span>
                      {q.resolution_notes}
                    </div>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Query Dialog */}
        <Dialog open={!!queryDialog} onOpenChange={(open) => { if (!open) setQueryDialog(null); }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Raise a Mark Query</DialogTitle>
              <DialogDescription>
                Submit a query about your mark for <strong>{queryDialog?.componentName}</strong>. Your trainer will be notified.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Query Type</Label>
                <Select value={queryForm.query_type} onValueChange={v => setQueryForm(p => ({ ...p, query_type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="marks_query">Marks Query</SelectItem>
                    <SelectItem value="competency_query">Competency Status Query</SelectItem>
                    <SelectItem value="feedback_query">Feedback Query</SelectItem>
                    <SelectItem value="general">General</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Subject</Label>
                <Input value={queryForm.subject} onChange={e => setQueryForm(p => ({ ...p, subject: e.target.value }))} />
              </div>
              <div>
                <Label>Description</Label>
                <Textarea placeholder="Describe your query in detail..." value={queryForm.description} onChange={e => setQueryForm(p => ({ ...p, description: e.target.value }))} rows={4} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setQueryDialog(null)}>Cancel</Button>
              <Button onClick={handleSubmitQuery} disabled={submitQuery.isPending || !queryForm.subject.trim() || !queryForm.description.trim()}>
                <Send className="h-4 w-4 mr-2" />{submitQuery.isPending ? "Submitting..." : "Submit Query"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};

export default withRoleAccess(TraineeResultsPage, { requiredRoles: ["trainee"] });
