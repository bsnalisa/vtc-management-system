import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Pencil, Send, Clock, CheckCircle2, XCircle } from "lucide-react";
import { 
  Qualification, 
  QualificationStatus,
  useQualificationApprovals,
  useSubmitForApproval
} from "@/hooks/useQualifications";
import { UnitStandardsTable } from "./UnitStandardsTable";
import { format } from "date-fns";
import { useState } from "react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

interface QualificationDetailPanelProps {
  qualification: Qualification;
  onBack: () => void;
  onEdit: () => void;
  canManage: boolean;
}

const statusConfig: Record<QualificationStatus, { icon: React.ReactNode; color: string; label: string }> = {
  draft: { icon: <Clock className="h-4 w-4" />, color: "bg-muted text-muted-foreground", label: "Draft" },
  pending_approval: { icon: <Clock className="h-4 w-4" />, color: "bg-yellow-100 text-yellow-800", label: "Pending Approval" },
  approved: { icon: <CheckCircle2 className="h-4 w-4" />, color: "bg-green-100 text-green-800", label: "Approved" },
  rejected: { icon: <XCircle className="h-4 w-4" />, color: "bg-red-100 text-red-800", label: "Rejected" },
};

export const QualificationDetailPanel = ({ 
  qualification, 
  onBack, 
  onEdit,
  canManage 
}: QualificationDetailPanelProps) => {
  const { data: approvals } = useQualificationApprovals(qualification.id);
  const submitMutation = useSubmitForApproval();
  const [submitDialogOpen, setSubmitDialogOpen] = useState(false);

  const isEditable = canManage && (qualification.status === "draft" || qualification.status === "rejected");
  const canSubmit = canManage && (qualification.status === "draft" || qualification.status === "rejected");
  const statusInfo = statusConfig[qualification.status];

  const confirmSubmit = async () => {
    try {
      await submitMutation.mutateAsync(qualification.id);
      setSubmitDialogOpen(false);
    } catch (error) {
      // Error is handled by the mutation's onError callback
      console.error("Submit failed:", error);
    }
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
              <Badge className={statusInfo.color} variant="outline">
                {statusInfo.icon}
                <span className="ml-1">{statusInfo.label}</span>
              </Badge>
            </div>
            <p className="text-muted-foreground">{qualification.qualification_title}</p>
          </div>
        </div>
        
        <div className="flex gap-2">
          {isEditable && (
            <Button variant="outline" onClick={onEdit}>
              <Pencil className="h-4 w-4 mr-2" />
              Edit
            </Button>
          )}
          {canSubmit && (
            <Button onClick={() => setSubmitDialogOpen(true)}>
              <Send className="h-4 w-4 mr-2" />
              Submit for Approval
            </Button>
          )}
        </div>
      </div>

      {/* Rejection Comments */}
      {qualification.status === "rejected" && qualification.rejection_comments && (
        <Card className="border-destructive bg-destructive/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-destructive">Rejection Feedback</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">{qualification.rejection_comments}</p>
          </CardContent>
        </Card>
      )}

      {/* Details Grid */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Qualification Details</CardTitle>
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
            <CardTitle className="text-base">Approval History</CardTitle>
          </CardHeader>
          <CardContent>
            {approvals && approvals.length > 0 ? (
              <div className="space-y-3">
                {approvals.slice(0, 5).map((approval) => (
                  <div key={approval.id} className="flex items-start gap-2 text-sm">
                    <div className="w-2 h-2 rounded-full bg-primary mt-1.5" />
                    <div className="flex-1">
                      <p className="font-medium capitalize">{approval.action.replace("_", " ")}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(approval.created_at), "MMM d, yyyy 'at' h:mm a")}
                      </p>
                      {approval.comments && (
                        <p className="text-muted-foreground mt-1">{approval.comments}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No approval history yet.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Separator />

      {/* Unit Standards */}
      <UnitStandardsTable 
        qualificationId={qualification.id} 
        isEditable={isEditable} 
      />

      <ConfirmDialog
        open={submitDialogOpen}
        onOpenChange={setSubmitDialogOpen}
        title="Submit for Approval"
        description="Are you sure you want to submit this qualification for approval? The Head of Training will review it."
        onConfirm={confirmSubmit}
        isLoading={submitMutation.isPending}
        confirmText="Submit"
      />
    </div>
  );
};
