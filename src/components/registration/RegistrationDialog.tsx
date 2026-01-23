import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Lock, CheckCircle } from "lucide-react";
import { useUpdateRegistrationStatus } from "@/hooks/useTraineeApplications";
import { useUserRole } from "@/hooks/useUserRole";

interface RegistrationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  application: any;
}

export const RegistrationDialog = ({ open, onOpenChange, application }: RegistrationDialogProps) => {
  const updateStatus = useUpdateRegistrationStatus();
  const { role } = useUserRole();
  const isFinanceOfficer = role === "debtor_officer" || role === "admin";

  const handleSetPendingPayment = async () => {
    await updateStatus.mutateAsync({
      applicationId: application.id,
      status: "pending_payment",
    });
    onOpenChange(false);
  };

  if (!application) return null;

  const isPendingPayment = application.registration_status === "pending_payment";
  const isFullyRegistered = application.registration_status === "fully_registered";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Complete Registration</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {/* Application Details */}
          <div className="p-4 bg-muted rounded-lg space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Applicant Details</h3>
              <Badge className="bg-green-500">Provisionally Qualified</Badge>
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-muted-foreground">Name:</span>{" "}
                <span className="font-medium">
                  {application.first_name} {application.last_name}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Trainee Number:</span>{" "}
                <span className="font-mono">{application.trainee_number}</span>
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
                <span className="text-muted-foreground">Intake:</span>{" "}
                <span className="capitalize">
                  {application.intake} {application.academic_year}
                </span>
              </div>
            </div>
          </div>

          {/* Registration Status */}
          {!isPendingPayment && !isFullyRegistered && (
            <Alert>
              <AlertDescription>
                Click "Submit for Payment" to mark this registration as pending payment clearance.
                The Finance Officer will verify the payment before final registration.
              </AlertDescription>
            </Alert>
          )}

          {isPendingPayment && (
            <Alert className="border-yellow-500 bg-yellow-50">
              <Lock className="h-4 w-4" />
              <AlertDescription>
                <strong>Registration locked — awaiting finance clearance.</strong>
                <br />
                {isFinanceOfficer
                  ? "As a Finance Officer, you can verify payment and complete registration."
                  : "Only the Finance Officer or Head of Finance can record payment and approve this registration."}
              </AlertDescription>
            </Alert>
          )}

          {isFullyRegistered && (
            <Alert className="border-green-500 bg-green-50">
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
                <strong>Registration completed!</strong>
                <br />
                This trainee is fully registered. You can now generate admission letters and proof of registration.
              </AlertDescription>
            </Alert>
          )}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
            {!isPendingPayment && !isFullyRegistered && (
              <Button onClick={handleSetPendingPayment} disabled={updateStatus.isPending}>
                {updateStatus.isPending ? "Submitting..." : "Submit for Payment"}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
