import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Lock, CheckCircle } from "lucide-react";
import { useRegisterTrainee } from "@/hooks/useFinancialQueue";
import { useQualifications } from "@/hooks/useQualifications";

interface RegistrationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  application: any;
}

export const RegistrationDialog = ({ open, onOpenChange, application }: RegistrationDialogProps) => {
  const registerTrainee = useRegisterTrainee();
  const { data: qualifications } = useQualifications();
  const [selectedQualification, setSelectedQualification] = useState<string>("");

  // STRICT: Only show approved qualifications that match the trainee's applied trade
  const availableQualifications = qualifications?.filter(
    (q) => q.status === "approved" && q.active && 
      q.trade_id != null && application?.trade_id != null && q.trade_id === application.trade_id
  ) || [];

  const handleRegister = async () => {
    if (!selectedQualification) return;
    
    await registerTrainee.mutateAsync({
      application_id: application.id,
      qualification_id: selectedQualification,
      academic_year: application.academic_year,
    });
    onOpenChange(false);
  };

  if (!application) return null;

  const isRegistrationFeePending = application.registration_status === "registration_fee_pending";
  const isRegistered = application.registration_status === "registered" || application.registration_status === "fully_registered";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Register Trainee</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {/* Application Details */}
          <div className="p-4 bg-muted rounded-lg space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Applicant Details</h3>
              <Badge className="bg-green-500">Provisionally Admitted</Badge>
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

          {/* Qualification Selection */}
          {!isRegistrationFeePending && !isRegistered && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Select Qualification</label>
              <Select value={selectedQualification} onValueChange={setSelectedQualification}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a qualification..." />
                </SelectTrigger>
                <SelectContent>
                  {availableQualifications.map((q) => (
                    <SelectItem key={q.id} value={q.id}>
                      {q.qualification_code} - {q.qualification_title} (NQF {q.nqf_level})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {availableQualifications.length === 0 && (
                <p className="text-sm text-destructive">
                  No approved qualifications found for the trade "{application?.trades?.name || 'Unknown'}". 
                  Please go to Qualification Management, assign a trade to the relevant qualification, and ensure it is approved.
                </p>
              )}
            </div>
          )}

          {/* Registration Status */}
          {!isRegistrationFeePending && !isRegistered && (
            <Alert>
              <AlertDescription>
                Select a qualification and click "Register" to create a registration record.
                A registration fee will be added to the financial queue for the Debtor Officer to process.
              </AlertDescription>
            </Alert>
          )}

          {isRegistrationFeePending && (
            <Alert className="border-yellow-500 bg-yellow-50">
              <Lock className="h-4 w-4" />
              <AlertDescription>
                <strong>Registration fee pending — awaiting finance clearance.</strong>
                <br />
                The Debtor Officer will process the registration fee payment.
              </AlertDescription>
            </Alert>
          )}

          {isRegistered && (
            <Alert className="border-green-500 bg-green-50">
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
                <strong>Registration completed!</strong>
                <br />
                This trainee is fully registered.
              </AlertDescription>
            </Alert>
          )}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
            {!isRegistrationFeePending && !isRegistered && (
              <Button 
                onClick={handleRegister} 
                disabled={registerTrainee.isPending || !selectedQualification}
              >
                {registerTrainee.isPending ? "Registering..." : "Register"}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
