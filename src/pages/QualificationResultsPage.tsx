import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useRoleNavigation } from "@/hooks/useRoleNavigation";
import { useAssessmentTemplates, useTemplateComponents } from "@/hooks/useAssessmentTemplates";
import { useQualificationResults, useApproveQualificationResults } from "@/hooks/useQualificationResults";
import { CheckCircle, Lock, Shield, BarChart3 } from "lucide-react";

const QualificationResultsPage = () => {
  const { navItems, groupLabel, role } = useRoleNavigation();
  const isHoT = role === "head_of_training";

  const { data: templates } = useAssessmentTemplates("approved");
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [academicYear, setAcademicYear] = useState(new Date().getFullYear().toString());
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const selectedTemplate = templates?.find(t => t.id === selectedTemplateId);
  const qualificationId = selectedTemplate?.qualification_id;

  const { data: templateComponents } = useTemplateComponents(selectedTemplateId || undefined);
  const { data: results } = useQualificationResults(qualificationId, academicYear);
  const approveResults = useApproveQualificationResults();

  // Group results by trainee
  const traineeMap = new Map<string, { trainee: any; results: any[] }>();
  results?.forEach((r: any) => {
    const tid = r.trainee_id;
    if (!traineeMap.has(tid)) {
      traineeMap.set(tid, { trainee: r.trainees, results: [] });
    }
    traineeMap.get(tid)!.results.push(r);
  });

  const trainees = Array.from(traineeMap.entries());

  const unapprovedIds = results?.filter((r: any) => !r.approved_by && r.result_status !== "pending_sa").map((r: any) => r.id) || [];

  const handleApproveSelected = async () => {
    if (selectedIds.length === 0) return;
    await approveResults.mutateAsync(selectedIds);
    setSelectedIds([]);
  };

  const handleSelectAll = () => {
    if (selectedIds.length === unapprovedIds.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(unapprovedIds);
    }
  };

  const getResultStatusBadge = (status: string) => {
    switch (status) {
      case "pass": return <Badge className="bg-green-600">Pass</Badge>;
      case "fail": return <Badge variant="destructive">Fail</Badge>;
      case "pending_sa": return <Badge variant="secondary">Pending SA</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  // Stats
  const totalResults = results?.length || 0;
  const passCount = results?.filter((r: any) => r.result_status === "pass").length || 0;
  const failCount = results?.filter((r: any) => r.result_status === "fail").length || 0;
  const pendingCount = results?.filter((r: any) => r.result_status === "pending_sa").length || 0;
  const approvedCount = results?.filter((r: any) => r.approved_by).length || 0;

  return (
    <DashboardLayout
      title="Qualification Results"
      subtitle="View final CA + SA results with pass/fail status"
      navItems={navItems}
      groupLabel={groupLabel}
    >
      <div className="space-y-6 max-w-7xl mx-auto">
        {/* Filters */}
        <Card>
          <CardContent className="py-4">
            <div className="flex flex-wrap gap-4 items-end">
              <div className="min-w-[250px]">
                <Label>Qualification</Label>
                <Select value={selectedTemplateId} onValueChange={v => { setSelectedTemplateId(v); setSelectedIds([]); }}>
                  <SelectTrigger><SelectValue placeholder="Select qualification" /></SelectTrigger>
                  <SelectContent>
                    {templates?.map(t => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.qualifications?.qualification_code} – {t.qualifications?.qualification_title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="w-[120px]">
                <Label>Year</Label>
                <Input value={academicYear} onChange={e => setAcademicYear(e.target.value)} />
              </div>
              {isHoT && unapprovedIds.length > 0 && (
                <Button onClick={handleApproveSelected} disabled={selectedIds.length === 0 || approveResults.isPending}>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  {approveResults.isPending ? "Approving..." : `Approve (${selectedIds.length})`}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Stats */}
        {selectedTemplateId && totalResults > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
            <Card><CardContent className="py-3 text-center">
              <div className="text-2xl font-bold">{totalResults}</div>
              <p className="text-xs text-muted-foreground">Total</p>
            </CardContent></Card>
            <Card><CardContent className="py-3 text-center">
              <div className="text-2xl font-bold text-green-600">{passCount}</div>
              <p className="text-xs text-muted-foreground">Pass</p>
            </CardContent></Card>
            <Card><CardContent className="py-3 text-center">
              <div className="text-2xl font-bold text-destructive">{failCount}</div>
              <p className="text-xs text-muted-foreground">Fail</p>
            </CardContent></Card>
            <Card><CardContent className="py-3 text-center">
              <div className="text-2xl font-bold">{pendingCount}</div>
              <p className="text-xs text-muted-foreground">Pending SA</p>
            </CardContent></Card>
            <Card><CardContent className="py-3 text-center">
              <div className="text-2xl font-bold">{approvedCount}</div>
              <p className="text-xs text-muted-foreground">Approved</p>
            </CardContent></Card>
          </div>
        )}

        {/* Results Table */}
        {selectedTemplateId && templateComponents && templateComponents.length > 0 && (
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {isHoT && <TableHead className="w-10">
                        <Checkbox
                          checked={selectedIds.length === unapprovedIds.length && unapprovedIds.length > 0}
                          onCheckedChange={handleSelectAll}
                        />
                      </TableHead>}
                      <TableHead className="sticky left-0 bg-background z-10 min-w-[160px]">Trainee</TableHead>
                      {templateComponents.map((tc: any) => (
                        <TableHead key={tc.id} className="text-center min-w-[180px]" colSpan={3}>
                          <div className="text-xs font-semibold">{tc.component_name}</div>
                          <div className="text-[10px] text-muted-foreground capitalize">{tc.component_type}</div>
                          <div className="flex text-[10px] text-muted-foreground justify-around mt-1">
                            <span>CA</span><span>SA</span><span>Result</span>
                          </div>
                        </TableHead>
                      ))}
                      <TableHead className="text-center min-w-[80px]">Approved</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {trainees.map(([tid, { trainee, results: traineeResults }]) => {
                      const allApproved = traineeResults.every(r => r.approved_by);
                      const anyUnapproved = traineeResults.some(r => !r.approved_by && r.result_status !== "pending_sa");
                      const resultIds = traineeResults.filter(r => !r.approved_by && r.result_status !== "pending_sa").map(r => r.id);

                      return (
                        <TableRow key={tid}>
                          {isHoT && <TableCell>
                            {anyUnapproved && (
                              <Checkbox
                                checked={resultIds.every(id => selectedIds.includes(id))}
                                onCheckedChange={() => {
                                  const allSelected = resultIds.every(id => selectedIds.includes(id));
                                  if (allSelected) {
                                    setSelectedIds(prev => prev.filter(id => !resultIds.includes(id)));
                                  } else {
                                    setSelectedIds(prev => [...new Set([...prev, ...resultIds])]);
                                  }
                                }}
                              />
                            )}
                          </TableCell>}
                          <TableCell className="sticky left-0 bg-background z-10">
                            <div className="font-medium text-sm">{trainee?.first_name} {trainee?.last_name}</div>
                            <div className="text-xs text-muted-foreground font-mono">{trainee?.trainee_id}</div>
                          </TableCell>
                          {templateComponents.map((tc: any) => {
                            const r = traineeResults.find(r => r.template_component_id === tc.id);
                            return [
                              <TableCell key={`${tc.id}-ca`} className="text-center text-sm">
                                {r?.ca_mark != null ? `${r.ca_mark.toFixed(1)}%` : "—"}
                              </TableCell>,
                              <TableCell key={`${tc.id}-sa`} className="text-center text-sm">
                                {r?.sa_mark != null ? `${r.sa_mark.toFixed(1)}%` : "—"}
                              </TableCell>,
                              <TableCell key={`${tc.id}-result`} className="text-center">
                                {r ? getResultStatusBadge(r.result_status) : <Badge variant="secondary">—</Badge>}
                              </TableCell>,
                            ];
                          })}
                          <TableCell className="text-center">
                            {allApproved ? (
                              <Shield className="h-4 w-4 mx-auto text-green-600" />
                            ) : (
                              <span className="text-xs text-muted-foreground">Pending</span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {trainees.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={100} className="text-center py-8 text-muted-foreground">
                          No results found. SA marks must be recorded first.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}

        {!selectedTemplateId && (
          <Card className="border-dashed">
            <CardContent className="py-12 text-center">
              <BarChart3 className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
              <h3 className="font-semibold text-lg mb-2">Select a Qualification</h3>
              <p className="text-muted-foreground">Choose a qualification to view CA + SA results and pass/fail status.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
};

export default QualificationResultsPage;
