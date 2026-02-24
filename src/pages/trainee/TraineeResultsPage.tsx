import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DashboardLayout } from "@/components/DashboardLayout";
import { traineeNavItems } from "@/lib/navigationConfig";
import { Award, Loader2, HelpCircle, Send, GraduationCap, User, BookOpen, ChevronDown, ChevronRight } from "lucide-react";
import { withRoleAccess } from "@/components/withRoleAccess";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  useTraineeUserId,
  useTraineeRecord,
  useTraineeGradebookEntries,
  useTraineeGradebookMarks,
} from "@/hooks/useTraineePortalData";
import { useMyMarkQueries, useSubmitMarkQuery } from "@/hooks/useMarkQueries";

// ─── Mark type label helper ───
const markTypeLabel = (type: string) => {
  const map: Record<string, string> = {
    test: "TM : THEORY TEST MARK",
    theory_test: "TM : THEORY TEST MARK",
    practical: "PM : PRACTICAL MARK",
    practical_test: "PT : PRACTICAL TEST MARK",
    assignment: "TA : ASSIGNMENT MARK",
    project: "PJ : PROJECT MARK",
    mock: "MK : MOCK EXAM MARK",
    exam: "EX : EXAM MARK",
  };
  return map[type] || type.replace(/_/g, " ").toUpperCase();
};

const markTypeCode = (type: string) => {
  const map: Record<string, string> = {
    test: "TM",
    theory_test: "TM",
    practical: "PM",
    practical_test: "PT",
    assignment: "TA",
    project: "PJ",
    mock: "MK",
    exam: "EX",
  };
  return map[type] || type.substring(0, 2).toUpperCase();
};

// ─── Subject card showing marks grouped by type ───
const SubjectCard = ({
  gradebook,
  traineeId,
  onRaiseQuery,
}: {
  gradebook: any;
  traineeId: string;
  onRaiseQuery: (gradebookId: string, componentId: string, componentName: string) => void;
}) => {
  const [open, setOpen] = useState(true);
  const { data, isLoading } = useTraineeGradebookMarks(gradebook.id, traineeId);

  const isFinal = gradebook.status === "finalised";

  // Group components by type
  const groupedByType = (data?.components || []).reduce((acc: Record<string, any[]>, comp: any) => {
    const type = comp.component_type || "other";
    if (!acc[type]) acc[type] = [];
    acc[type].push(comp);
    return acc;
  }, {});

  // Compute period mark (CA score or average of all marks)
  const periodMark = data?.caScore?.ca_score != null
    ? Number(data.caScore.ca_score).toFixed(0)
    : null;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card className="border border-border rounded-lg overflow-hidden">
        {/* Subject header row */}
        <CollapsibleTrigger asChild>
          <div className="bg-muted/60 px-4 py-3 cursor-pointer hover:bg-muted/80 transition-colors">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-2 flex-1 min-w-0">
                {open ? <ChevronDown className="h-4 w-4 mt-1 shrink-0 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 mt-1 shrink-0 text-muted-foreground" />}
                <div className="min-w-0">
                  <p className="font-semibold text-sm text-foreground leading-tight">
                    Subject: <span className="text-primary">{gradebook.title}</span>
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Academic Period: {gradebook.academic_year} • Level {gradebook.level}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0 text-sm">
                {periodMark && (
                  <span className="text-xs">
                    Full Period Mark: <span className="font-bold text-foreground">{periodMark}</span>
                  </span>
                )}
                <Badge variant={isFinal ? "default" : "secondary"} className="text-xs">
                  {isFinal ? "Final" : "Provisional"}
                </Badge>
              </div>
            </div>
          </div>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex justify-center py-6">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : data && Object.keys(groupedByType).length > 0 ? (
              <div className="divide-y divide-border">
                {Object.entries(groupedByType).map(([type, components]) => {
                  // Calculate mark type average
                  const marksForType = (components as any[]).map((comp: any) => {
                    const mark = data.marks.find((m: any) => m.component_id === comp.id);
                    return mark?.marks_obtained;
                  }).filter((m: any) => m != null);
                  const typeAvg = marksForType.length > 0
                    ? Math.round(marksForType.reduce((a: number, b: number) => a + b, 0) / marksForType.length)
                    : null;

                  return (
                    <div key={type} className="px-4 py-3">
                      {/* Mark type header */}
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-xs font-medium text-muted-foreground">
                          Mark Type: <span className="text-foreground">{markTypeLabel(type)}</span>
                        </p>
                        {typeAvg !== null && (
                          <p className="text-xs text-muted-foreground">
                            Mark Type Mark: <span className="font-bold text-foreground">{typeAvg}</span>
                          </p>
                        )}
                      </div>

                      {/* Individual marks grid */}
                      <div className="flex flex-wrap gap-x-6 gap-y-1 ml-2">
                        {(components as any[]).map((comp: any, idx: number) => {
                          const mark = data.marks.find((m: any) => m.component_id === comp.id);
                          const displayMark = mark?.marks_obtained != null ? mark.marks_obtained : "";
                          const groupName = (comp.group as any)?.name;
                          return (
                            <div key={comp.id} className="flex items-center gap-1 group">
                              <span className="text-xs text-muted-foreground whitespace-nowrap">
                                {idx + 1} :
                              </span>
                              <span className={`text-xs font-semibold min-w-[24px] ${displayMark === "" ? "text-muted-foreground" : "text-foreground"}`}>
                                {displayMark === "" ? " " : displayMark}
                              </span>
                              {groupName && (
                                <span className="text-[10px] text-muted-foreground">({groupName})</span>
                              )}
                              {mark && (
                                <button
                                  onClick={(e) => { e.stopPropagation(); onRaiseQuery(gradebook.id, comp.id, comp.name); }}
                                  className="opacity-0 group-hover:opacity-100 transition-opacity"
                                  title="Query this mark"
                                >
                                  <HelpCircle className="h-3 w-3 text-muted-foreground hover:text-primary" />
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="px-4 py-4 text-sm text-muted-foreground">No marks recorded yet.</div>
            )}
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
  const { data: gradebooks, isLoading: gLoading } = useTraineeGradebookEntries(trainee?.id);
  const { data: myQueries } = useMyMarkQueries(trainee?.id);
  const submitQuery = useSubmitMarkQuery();

  const [queryDialog, setQueryDialog] = useState<{ gradebookId: string; componentId: string; componentName: string } | null>(null);
  const [queryForm, setQueryForm] = useState({ query_type: "marks_query", subject: "", description: "" });

  const isLoading = tLoading || gLoading;

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
      <DashboardLayout title="Progress Report" subtitle="View your academic progress" navItems={traineeNavItems} groupLabel="Trainee iEnabler">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  // Group gradebooks by academic year + qualification
  const grouped = (gradebooks || []).reduce((acc: Record<string, any[]>, gb: any) => {
    const key = `${gb.academic_year}|${gb.qualifications?.qualification_code || ""}|${gb.qualifications?.qualification_title || ""}|${gb.level}`;
    if (!acc[key]) acc[key] = [];
    acc[key].push(gb);
    return acc;
  }, {});

  const groupKeys = Object.keys(grouped).sort((a, b) => {
    const yearA = a.split("|")[0];
    const yearB = b.split("|")[0];
    return yearB.localeCompare(yearA); // newest first
  });

  return (
    <DashboardLayout title="Progress Report" subtitle="View your academic progress" navItems={traineeNavItems} groupLabel="Trainee iEnabler">
      <div className="space-y-5 max-w-4xl">
        {/* Student info banner */}
        <Card className="border-0 shadow-md overflow-hidden">
          <div className="bg-primary px-6 py-4">
            <div className="flex items-center gap-3">
              <GraduationCap className="h-6 w-6 text-primary-foreground" />
              <h2 className="text-lg font-bold text-primary-foreground">Progress Report</h2>
            </div>
          </div>
          <CardContent className="p-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex items-center gap-3">
                <User className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Student Number</p>
                  <p className="font-semibold text-sm">{trainee?.trainee_id || "—"}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <User className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Name</p>
                  <p className="font-semibold text-sm">
                    {trainee?.first_name} {trainee?.last_name}
                  </p>
                </div>
              </div>
              {(trainee as any)?.trades?.name && (
                <div className="flex items-center gap-3">
                  <BookOpen className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Trade / Programme</p>
                    <p className="font-semibold text-sm">{(trainee as any).trades.name}</p>
                  </div>
                </div>
              )}
              {trainee?.level && (
                <div className="flex items-center gap-3">
                  <Award className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Current Level</p>
                    <p className="font-semibold text-sm">Level {trainee.level}</p>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Results grouped by Year & Qualification */}
        {groupKeys.length === 0 ? (
          <Card className="border-0 shadow-md">
            <CardContent className="py-16 text-center">
              <Award className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
              <h3 className="font-semibold text-lg">No Results Yet</h3>
              <p className="text-muted-foreground text-sm mt-1">
                Your marks will appear here as assessments are recorded by your trainers.
              </p>
            </CardContent>
          </Card>
        ) : (
          groupKeys.map((key) => {
            const [year, qualCode, qualTitle, level] = key.split("|");
            const subjects = grouped[key];
            return (
              <div key={key} className="space-y-3">
                {/* Year / Qualification header */}
                <div className="bg-primary/10 border border-primary/20 rounded-lg px-4 py-3">
                  <p className="text-sm font-bold text-primary">
                    Year: {year}
                  </p>
                  {qualCode && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {qualCode}: {qualTitle} {level ? `• Level ${level}` : ""}
                    </p>
                  )}
                </div>

                {/* Subject cards */}
                <div className="space-y-2 pl-0 sm:pl-2">
                  {subjects.map((gb: any) => (
                    <SubjectCard key={gb.id} gradebook={gb} traineeId={trainee!.id} onRaiseQuery={openQueryDialog} />
                  ))}
                </div>
              </div>
            );
          })
        )}

        {/* My Queries Section */}
        {myQueries && myQueries.length > 0 && (
          <Card className="border-0 shadow-md">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <HelpCircle className="h-4 w-4" />My Mark Queries
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
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
                Submit a query about your mark for <strong>{queryDialog?.componentName}</strong>.
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
