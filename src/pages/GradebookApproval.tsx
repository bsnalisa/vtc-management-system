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
  useACApproveGradebook,
  useFinaliseGradebook,
  useReturnGradebook,
} from "@/hooks/useGradebooks";
import { CheckCircle, RotateCcw, Eye, Award } from "lucide-react";
import { format } from "date-fns";

const statusColor = (s: string) => {
  switch (s) {
    case "submitted": return "secondary";
    case "hot_approved": return "default";
    case "ac_approved": return "default";
    case "finalised": return "outline";
    default: return "secondary";
  }
};

const GradebookApproval = () => {
  const navigate = useNavigate();
  const { navItems, groupLabel } = useRoleNavigation();

  const { data: hotApproved } = useOrgGradebooks("hot_approved");
  const { data: acApproved } = useOrgGradebooks("ac_approved");
  const { data: finalised } = useOrgGradebooks("finalised");
  const { data: allGradebooks } = useOrgGradebooks();

  const acApprove = useACApproveGradebook();
  const finalise = useFinaliseGradebook();
  const returnGb = useReturnGradebook();

  const [returnDialog, setReturnDialog] = useState<string | null>(null);
  const [returnReason, setReturnReason] = useState("");
  const [finaliseDialog, setFinaliseDialog] = useState<string | null>(null);

  const handleACApprove = async (id: string) => {
    await acApprove.mutateAsync(id);
  };

  const handleFinalise = async () => {
    if (!finaliseDialog) return;
    await finalise.mutateAsync(finaliseDialog);
    setFinaliseDialog(null);
  };

  const handleReturn = async () => {
    if (!returnDialog) return;
    await returnGb.mutateAsync({ gradebookId: returnDialog, returnTo: "submitted" });
    setReturnDialog(null);
    setReturnReason("");
  };

  const pendingCount = hotApproved?.length || 0;
  const awaitingFinalisation = acApproved?.length || 0;
  const finalisedCount = finalised?.length || 0;

  const GradebookTable = ({ gradebooks, mode }: { gradebooks: any[]; mode: "review" | "finalise" | "view" }) => (
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
              <TableHead>HoT Approved</TableHead>
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
                  {gb.hot_approved_at ? format(new Date(gb.hot_approved_at), "dd MMM yyyy") : "—"}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button size="sm" variant="outline" onClick={() => navigate(`/gradebooks/${gb.id}`)}>
                      <Eye className="h-3.5 w-3.5 mr-1" />View
                    </Button>
                    {mode === "review" && gb.status === "hot_approved" && (
                      <>
                        <Button size="sm" onClick={() => handleACApprove(gb.id)} disabled={acApprove.isPending}>
                          <CheckCircle className="h-3.5 w-3.5 mr-1" />Approve
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => setReturnDialog(gb.id)}>
                          <RotateCcw className="h-3.5 w-3.5 mr-1" />Return
                        </Button>
                      </>
                    )}
                    {mode === "finalise" && gb.status === "ac_approved" && (
                      <Button size="sm" onClick={() => setFinaliseDialog(gb.id)}>
                        <Award className="h-3.5 w-3.5 mr-1" />Finalise
                      </Button>
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
      title="Gradebook Approval"
      subtitle="Review HoT-approved gradebooks and finalise marks"
      navItems={navItems}
      groupLabel={groupLabel}
    >
      <div className="space-y-6 max-w-7xl mx-auto">
        {/* Summary cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Pending AC Review</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{pendingCount}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Awaiting Finalisation</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{awaitingFinalisation}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Finalised</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{finalisedCount}</div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="pending" className="space-y-4">
          <TabsList>
            <TabsTrigger value="pending">
              Pending Review {pendingCount > 0 && <Badge variant="destructive" className="ml-2 h-5 px-1.5">{pendingCount}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="finalise">
              Awaiting Finalisation {awaitingFinalisation > 0 && <Badge variant="secondary" className="ml-2 h-5 px-1.5">{awaitingFinalisation}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="finalised">Finalised</TabsTrigger>
            <TabsTrigger value="all">All</TabsTrigger>
          </TabsList>

          <TabsContent value="pending">
            <GradebookTable gradebooks={hotApproved || []} mode="review" />
          </TabsContent>

          <TabsContent value="finalise">
            <GradebookTable gradebooks={acApproved || []} mode="finalise" />
          </TabsContent>

          <TabsContent value="finalised">
            <GradebookTable gradebooks={finalised || []} mode="view" />
          </TabsContent>

          <TabsContent value="all">
            <GradebookTable gradebooks={allGradebooks || []} mode="view" />
          </TabsContent>
        </Tabs>

        {/* Return dialog */}
        <Dialog open={!!returnDialog} onOpenChange={(open) => { if (!open) setReturnDialog(null); }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Return Gradebook</DialogTitle>
              <DialogDescription>Return this gradebook to the Head of Training for further review.</DialogDescription>
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
                {returnGb.isPending ? "Returning..." : "Return to HoT"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Finalise confirmation dialog */}
        <Dialog open={!!finaliseDialog} onOpenChange={(open) => { if (!open) setFinaliseDialog(null); }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Finalise Gradebook</DialogTitle>
              <DialogDescription>
                This action is permanent. Finalised marks become the official record and are pushed to trainee portals. This cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setFinaliseDialog(null)}>Cancel</Button>
              <Button onClick={handleFinalise} disabled={finalise.isPending}>
                <Award className="h-4 w-4 mr-2" />
                {finalise.isPending ? "Finalising..." : "Confirm Finalisation"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};

export default GradebookApproval;
