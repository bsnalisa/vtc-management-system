import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useScreenApplication } from "@/hooks/useTraineeApplications";
import { useApprovedQualifications } from "@/hooks/useQualifications";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle } from "lucide-react";
import { RequestInfoSection } from "./RequestInfoSection";
import { ApplicationViewDialog } from "./ApplicationViewDialog";

interface ScreeningDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  application: any;
}

/**
 * Screening shows the whole submitted application (every section and every attached document)
 * with the decision form underneath, so the officer screens against the complete file.
 */
export const ScreeningDialog = ({ open, onOpenChange, application }: ScreeningDialogProps) => {
  const [qualificationStatus, setQualificationStatus] = useState<string>("provisionally_qualified");
  const [remarks, setRemarks] = useState("");

  const screenApplication = useScreenApplication();
  const { data: approvedQualifications, isLoading: qualificationsLoading } = useApprovedQualifications();
  // Accepting an applicant whose trade has no approved qualification leaves registration stuck
  const tradeId = application?.trade_id ?? application?.trades?.id;
  const noQualificationForTrade =
    !qualificationsLoading && !!tradeId && !(approvedQualifications ?? []).some((q) => q.trade_id === tradeId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await screenApplication.mutateAsync({
      applicationId: application.id,
      qualificationStatus,
      remarks,
    });
    onOpenChange(false);
    setRemarks("");
  };

  if (!application) return null;

  return (
    <ApplicationViewDialog
      open={open}
      onOpenChange={onOpenChange}
      application={application}
      defaultTab="documents"
    >
      <div className="space-y-4 border-t pt-4">
        <h3 className="font-semibold">Screening decision</h3>
        {noQualificationForTrade && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              No approved qualification exists for {application.trades?.name ?? "this trade"}, so this applicant cannot be registered
              after screening. Ask the Head of Training to approve a qualification for the trade before qualifying them.
            </AlertDescription>
          </Alert>
        )}
        <RequestInfoSection application={application} />

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Qualification Status *</Label>
            <RadioGroup value={qualificationStatus} onValueChange={setQualificationStatus}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="provisionally_qualified" id="qualified" />
                <Label htmlFor="qualified" className="cursor-pointer">
                  Provisionally Qualified
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="does_not_qualify" id="not_qualified" />
                <Label htmlFor="not_qualified" className="cursor-pointer">
                  Does Not Qualify
                </Label>
              </div>
            </RadioGroup>
          </div>

          <div className="space-y-2">
            <Label htmlFor="remarks">Remarks / Comments</Label>
            <Textarea
              id="remarks"
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="Add any relevant comments or reasons for the decision..."
              rows={4}
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={screenApplication.isPending}>
              {screenApplication.isPending ? "Processing..." : "Submit Screening"}
            </Button>
          </div>
        </form>
      </div>
    </ApplicationViewDialog>
  );
};
