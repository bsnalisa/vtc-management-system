import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useScreenApplication } from "@/hooks/useTraineeApplications";
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
