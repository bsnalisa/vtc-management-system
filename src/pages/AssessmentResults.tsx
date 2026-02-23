import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useRoleNavigation } from "@/hooks/useRoleNavigation";
import {
  useOrgGradebooks,
  useHoTApproveGradebook,
  useReturnGradebook,
} from "@/hooks/useGradebooks";
import { CheckCircle, RotateCcw, Eye, ArrowLeft, BookOpen } from "lucide-react";
import { format } from "date-fns";

const statusColor = (s: string) => {
  switch (s) {
    case "submitted": return "default";
    case "hot_approved": return "secondary";
    case "ac_approved": return "secondary";
    case "finalised": return "outline";
    default: return "secondary";
  }
};

const AssessmentResults = () => {
  const navigate = useNavigate();
  const { role, navItems, groupLabel } = useRoleNavigation();

  const { data: allGradebooks } = useOrgGradebooks();

  const approve = useHoTApproveGradebook();
  const returnGb = useReturnGradebook();

  const [selectedQualification, setSelectedQualification] = useState<string | null>(null);
  const [returnDialog, setReturnDialog] = useState<string | null>(null);
  const [returnReason, setReturnReason] = useState("");

  const isHoT = role === "head_of_training";

  // Group gradebooks by qualification
  const qualifications = useMemo(() => {
    if (!allGradebooks) return [];
    const map = new Map<string, { id: string; code: string; title: string; submitted: number; approved: number; total: number }>();
    for (const gb of allGradebooks) {
      const qId = gb.qualification_id;
      if (!qId) continue;
      if (!map.has(qId)) {
        map.set(qId, {
          id: qId,
          code: gb.qualifications?.qualification_code || "—",
          title: gb.qualifications?.qualification_title || "Unknown",
          submitted: 0,
          approved: 0,
          total: 0,
        });
      }
      const entry = map.get(qId)!;
      entry.total++;
      if (gb.status === "submitted") entry.submitted++;
      if (gb.status === "hot_approved" || gb.status === "ac_approved" || gb.status === "finalised") entry.approved++;
    }
    return Array.from(map.values()).sort((a, b) => b.submitted - a.submitted);
  }, [allGradebooks]);

  // Gradebooks for the selected qualification
  const qualificationGradebooks = useMemo(() => {
    if (!selectedQualification || !allGradebooks) return [];
    return allGradebooks.filter((gb: any) => gb.qualification_id === selectedQualification);
  }, [selectedQualification, allGradebooks]);

  const selectedQualInfo = qualifications.find(q => q.id === selectedQualification);

  const handleApprove = async (id: string) => {
    await approve.mutateAsync(id);
  };

  const handleReturn = async () => {
    if (!returnDialog) return;
    await returnGb.mutateAsync({ gradebookId: returnDialog, returnTo: "draft" });
    setReturnDialog(null);
    setReturnReason("");
  };

  const totalPending = qualifications.reduce((sum, q) => sum + q.submitted, 0);

  return (
    <DashboardLayout
      title="Assessment Review"
      subtitle="Review submitted gradebook assessments by qualification"
      navItems={navItems}
      groupLabel={groupLabel}
    >
      <div className="space-y-6 max-w-7xl mx-auto">
        {!selectedQualification ? (
          <>
            {/* Summary */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Total Qualifications</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{qualifications.length}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Pending Review</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-destructive">{totalPending}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Total Gradebooks</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{allGradebooks?.length || 0}</div>
                </CardContent>
              </Card>
            </div>

            {/* Qualifications list */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Qualifications</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Code</TableHead>
                      <TableHead>Qualification</TableHead>
                      <TableHead className="text-center">Pending Review</TableHead>
                      <TableHead className="text-center">Approved</TableHead>
                      <TableHead className="text-center">Total</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {qualifications.map((q) => (
                      <TableRow
                        key={q.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => setSelectedQualification(q.id)}
                      >
                        <TableCell className="font-mono text-sm">{q.code}</TableCell>
                        <TableCell className="font-medium">{q.title}</TableCell>
                        <TableCell className="text-center">
                          {q.submitted > 0 ? (
                            <Badge variant="destructive">{q.submitted}</Badge>
                          ) : (
                            <span className="text-muted-foreground">0</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">{q.approved}</TableCell>
                        <TableCell className="text-center">{q.total}</TableCell>
                        <TableCell className="text-right">
                          <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); setSelectedQualification(q.id); }}>
                            <BookOpen className="h-3.5 w-3.5 mr-1" /> View
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {qualifications.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                          No qualifications with gradebooks found.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </>
        ) : (
          <>
            {/* Back button + qualification header */}
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="sm" onClick={() => setSelectedQualification(null)}>
                <ArrowLeft className="h-4 w-4 mr-1" /> Back
              </Button>
              <div>
                <h2 className="text-lg font-semibold">{selectedQualInfo?.title}</h2>
                <p className="text-sm text-muted-foreground">{selectedQualInfo?.code}</p>
              </div>
            </div>

            {/* Gradebooks for this qualification */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Submitted Assessments</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Gradebook</TableHead>
                      <TableHead>Trainer</TableHead>
                      <TableHead>Level</TableHead>
                      <TableHead>Year</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Submitted</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {qualificationGradebooks.map((gb: any) => (
                      <TableRow key={gb.id}>
                        <TableCell className="font-medium">{gb.title}</TableCell>
                        <TableCell>{gb.trainers?.full_name || "—"}</TableCell>
                        <TableCell>{gb.level}</TableCell>
                        <TableCell>{gb.academic_year}</TableCell>
                        <TableCell>
                          <Badge variant={statusColor(gb.status) as any} className="capitalize">
                            {gb.status?.replace(/_/g, " ")}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {gb.submitted_at ? format(new Date(gb.submitted_at), "dd MMM yyyy") : "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button size="sm" variant="outline" onClick={() => navigate(`/gradebooks/${gb.id}`)}>
                              <Eye className="h-3.5 w-3.5 mr-1" /> View
                            </Button>
                            {isHoT && gb.status === "submitted" && (
                              <>
                                <Button size="sm" onClick={() => handleApprove(gb.id)} disabled={approve.isPending}>
                                  <CheckCircle className="h-3.5 w-3.5 mr-1" /> Approve
                                </Button>
                                <Button size="sm" variant="destructive" onClick={() => setReturnDialog(gb.id)}>
                                  <RotateCcw className="h-3.5 w-3.5 mr-1" /> Return
                                </Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {qualificationGradebooks.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                          No gradebooks for this qualification.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </>
        )}

        {/* Return dialog */}
        <Dialog open={!!returnDialog} onOpenChange={(open) => { if (!open) setReturnDialog(null); }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Return Gradebook</DialogTitle>
              <DialogDescription>Return this gradebook to the trainer for revision.</DialogDescription>
            </DialogHeader>
            <div>
              <Textarea
                placeholder="Reason for returning (optional)..."
                value={returnReason}
                onChange={(e) => setReturnReason(e.target.value)}
                rows={3}
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setReturnDialog(null)}>Cancel</Button>
              <Button variant="destructive" onClick={handleReturn} disabled={returnGb.isPending}>
                {returnGb.isPending ? "Returning..." : "Return to Trainer"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};

export default AssessmentResults;
