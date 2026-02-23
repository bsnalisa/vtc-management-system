import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useRoleNavigation } from "@/hooks/useRoleNavigation";
import {
  useOrgGradebooks,
  useGradebookComponents,
  useGradebookTrainees,
  useGradebookMarks,
  useGradebookCAScores,
  useGradebookFeedbackList,
  useHoTApproveGradebook,
  useReturnGradebook,
} from "@/hooks/useGradebooks";
import { CheckCircle, RotateCcw, Eye, BookOpen, Users, Calculator } from "lucide-react";
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

const GradebookReview = () => {
  const navigate = useNavigate();
  const { navItems, groupLabel } = useRoleNavigation();

  const { data: submitted } = useOrgGradebooks("submitted");
  const { data: approved } = useOrgGradebooks("hot_approved");
  const { data: allGradebooks } = useOrgGradebooks();

  const approve = useHoTApproveGradebook();
  const returnGb = useReturnGradebook();

  const [selectedGb, setSelectedGb] = useState<any>(null);
  const [returnDialog, setReturnDialog] = useState<string | null>(null);
  const [returnReason, setReturnReason] = useState("");

  const handleApprove = async (id: string) => {
    await approve.mutateAsync(id);
  };

  const handleReturn = async () => {
    if (!returnDialog) return;
    await returnGb.mutateAsync({ gradebookId: returnDialog, returnTo: "draft" });
    setReturnDialog(null);
    setReturnReason("");
  };

  const pendingCount = submitted?.length || 0;
  const approvedCount = approved?.length || 0;

  const GradebookTable = ({ gradebooks, showActions }: { gradebooks: any[]; showActions: boolean }) => (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Gradebook</TableHead>
              <TableHead>Qualification</TableHead>
              <TableHead>Trainer</TableHead>
              <TableHead>Level</TableHead>
              <TableHead>Year</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Submitted</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {gradebooks.map((gb: any) => (
              <TableRow key={gb.id}>
                <TableCell className="font-medium">{gb.title}</TableCell>
                <TableCell>
                  <div className="text-sm">{gb.qualifications?.qualification_code}</div>
                  <div className="text-xs text-muted-foreground">{gb.qualifications?.qualification_title}</div>
                </TableCell>
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
                      <Eye className="h-3.5 w-3.5 mr-1" />View
                    </Button>
                    {showActions && gb.status === "submitted" && (
                      <>
                        <Button size="sm" onClick={() => handleApprove(gb.id)} disabled={approve.isPending}>
                          <CheckCircle className="h-3.5 w-3.5 mr-1" />Approve
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => setReturnDialog(gb.id)}>
                          <RotateCcw className="h-3.5 w-3.5 mr-1" />Return
                        </Button>
                      </>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {gradebooks.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                  No gradebooks in this category.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );

  return (
    <DashboardLayout
      title="Gradebook Review"
      subtitle="Review and approve submitted gradebooks from trainers"
      navItems={navItems}
      groupLabel={groupLabel}
    >
      <div className="space-y-6 max-w-7xl mx-auto">
        {/* Summary cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Pending Review</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{pendingCount}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Approved by HoT</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{approvedCount}</div>
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

        <Tabs defaultValue="pending" className="space-y-4">
          <TabsList>
            <TabsTrigger value="pending">
              Pending Review {pendingCount > 0 && <Badge variant="destructive" className="ml-2 h-5 px-1.5">{pendingCount}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="approved">Approved</TabsTrigger>
            <TabsTrigger value="all">All Gradebooks</TabsTrigger>
          </TabsList>

          <TabsContent value="pending">
            <GradebookTable gradebooks={submitted || []} showActions={true} />
          </TabsContent>

          <TabsContent value="approved">
            <GradebookTable gradebooks={approved || []} showActions={false} />
          </TabsContent>

          <TabsContent value="all">
            <GradebookTable gradebooks={allGradebooks || []} showActions={false} />
          </TabsContent>
        </Tabs>

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

export default GradebookReview;
