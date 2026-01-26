import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, CheckCircle2, XCircle, BookOpen } from "lucide-react";
import { 
  Qualification, 
  useQualificationUnitStandards,
  useApproveQualification,
  useRejectQualification
} from "@/hooks/useQualifications";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

interface ApprovalPanelProps {
  qualification: Qualification;
  onBack: () => void;
  onComplete: () => void;
}

export const ApprovalPanel = ({ qualification, onBack, onComplete }: ApprovalPanelProps) => {
  const { data: unitStandards } = useQualificationUnitStandards(qualification.id);
  const approveMutation = useApproveQualification();
  const rejectMutation = useRejectQualification();
  
  const [comments, setComments] = useState("");
  const [approveDialogOpen, setApproveDialogOpen] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);

  const totalCredits = unitStandards?.reduce((sum, us) => sum + (us.credit_value || 0), 0) || 0;

  const handleApprove = async () => {
    await approveMutation.mutateAsync({ 
      qualificationId: qualification.id, 
      comments: comments || undefined 
    });
    setApproveDialogOpen(false);
    onComplete();
  };

  const handleReject = async () => {
    if (!comments.trim()) return;
    await rejectMutation.mutateAsync({ 
      qualificationId: qualification.id, 
      comments 
    });
    setRejectDialogOpen(false);
    onComplete();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-bold">{qualification.qualification_code}</h2>
              <Badge variant="outline" className="bg-yellow-100 text-yellow-800">
                Pending Approval
              </Badge>
            </div>
            <p className="text-muted-foreground">{qualification.qualification_title}</p>
          </div>
        </div>
      </div>

      {/* Qualification Details */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <BookOpen className="h-4 w-4" />
              Qualification Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Type</p>
                <p className="font-medium uppercase">{qualification.qualification_type}</p>
              </div>
              <div>
                <p className="text-muted-foreground">NQF Level</p>
                <p className="font-medium">Level {qualification.nqf_level}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Duration</p>
                <p className="font-medium">{qualification.duration_value} {qualification.duration_unit}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Version</p>
                <p className="font-medium">v{qualification.version_number}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Total Unit Standards</p>
                <p className="text-2xl font-bold">{unitStandards?.length || 0}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Total Credits</p>
                <p className="text-2xl font-bold">{totalCredits}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Mandatory</p>
                <p className="font-medium">{unitStandards?.filter(u => u.is_mandatory).length || 0}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Elective</p>
                <p className="font-medium">{unitStandards?.filter(u => !u.is_mandatory).length || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Unit Standards */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Unit Standards</CardTitle>
          <CardDescription>Review the unit standards linked to this qualification</CardDescription>
        </CardHeader>
        <CardContent>
          {unitStandards && unitStandards.length > 0 ? (
            <div className="border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Unit ID</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead className="text-center">Level</TableHead>
                    <TableHead className="text-center">Credits</TableHead>
                    <TableHead className="text-center">Type</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {unitStandards.map((unit) => (
                    <TableRow key={unit.id}>
                      <TableCell className="font-mono text-sm">{unit.unit_standard_id}</TableCell>
                      <TableCell>{unit.unit_standard_title}</TableCell>
                      <TableCell className="text-center">{unit.level}</TableCell>
                      <TableCell className="text-center">{unit.credit_value || "-"}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant={unit.is_mandatory ? "default" : "secondary"}>
                          {unit.is_mandatory ? "Mandatory" : "Elective"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="border rounded-md p-8 text-center text-muted-foreground">
              No unit standards have been added to this qualification.
            </div>
          )}
        </CardContent>
      </Card>

      <Separator />

      {/* Approval Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Approval Decision</CardTitle>
          <CardDescription>
            Approve or reject this qualification. Approved qualifications become visible system-wide.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="comments">Comments (required for rejection)</Label>
            <Textarea
              id="comments"
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              placeholder="Add any comments or feedback for the Organization Admin..."
              rows={3}
            />
          </div>

          <div className="flex gap-3 justify-end">
            <Button 
              variant="destructive" 
              onClick={() => setRejectDialogOpen(true)}
              disabled={!comments.trim()}
            >
              <XCircle className="h-4 w-4 mr-2" />
              Reject
            </Button>
            <Button onClick={() => setApproveDialogOpen(true)}>
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Approve
            </Button>
          </div>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={approveDialogOpen}
        onOpenChange={setApproveDialogOpen}
        title="Approve Qualification"
        description="Are you sure you want to approve this qualification? It will become visible system-wide and available for trainee registration."
        onConfirm={handleApprove}
        isLoading={approveMutation.isPending}
        confirmText="Approve"
      />

      <ConfirmDialog
        open={rejectDialogOpen}
        onOpenChange={setRejectDialogOpen}
        title="Reject Qualification"
        description="Are you sure you want to reject this qualification? It will be returned to the Organization Admin for corrections."
        onConfirm={handleReject}
        isLoading={rejectMutation.isPending}
        confirmText="Reject"
      />
    </div>
  );
};
