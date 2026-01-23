import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useScreenApplication } from "@/hooks/useTraineeApplications";

interface ScreeningDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  application: any;
}

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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Screen Application</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {/* Application Details */}
          <div className="p-4 bg-muted rounded-lg space-y-2">
            <h3 className="font-semibold">Applicant Details</h3>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-muted-foreground">Name:</span>{" "}
                <span className="font-medium">
                  {application.first_name} {application.last_name}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Application Number:</span>{" "}
                <span className="font-mono">{application.application_number}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Trade:</span>{" "}
                <span>{application.trades?.name}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Level:</span>{" "}
                <span>Level {application.preferred_level}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Training Mode:</span>{" "}
                <span className="capitalize">{application.preferred_training_mode}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Intake:</span>{" "}
                <span className="capitalize">
                  {application.intake} {application.academic_year}
                </span>
              </div>
            </div>
          </div>

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
      </DialogContent>
    </Dialog>
  );
};
