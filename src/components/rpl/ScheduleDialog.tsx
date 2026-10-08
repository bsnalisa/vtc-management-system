import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ButtonSpinner } from "@/components/ui/loading-spinner";
import { AssessmentRequest, useUpdateAssessmentRequest } from "@/hooks/useAssessmentRequests";
import { toLocalInput } from "@/components/rpl/PortfolioDetail";

/** Sets the date, venue and assessor; the status change notifies the applicant. */
export function ScheduleDialog({ request, onClose }: { request: AssessmentRequest | null; onClose: () => void }) {
  const update = useUpdateAssessmentRequest();
  const [when, setWhen] = useState("");
  const [venue, setVenue] = useState("");
  const [assessor, setAssessor] = useState("");

  useEffect(() => {
    if (!request) return;
    setWhen(toLocalInput(request.scheduled_at)); setVenue(request.venue ?? ""); setAssessor(request.assessor_name ?? "");
  }, [request]);

  if (!request) return null;
  const save = async () => {
    try {
      await update.mutateAsync({ id: request.id, status: "assessment_scheduled", scheduled_at: new Date(when).toISOString(), venue: venue.trim() || null, assessor_name: assessor.trim() || null });
      onClose();
    } catch { /* error toast shown by the mutation */ }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Schedule assessment</DialogTitle>
          <DialogDescription>{request.applicant_name} ({request.reference_number}) will be notified of the date.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1"><Label htmlFor="sc-when">Date and time</Label><Input id="sc-when" type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} /></div>
          <div className="space-y-1"><Label htmlFor="sc-venue">Venue</Label><Input id="sc-venue" value={venue} onChange={(e) => setVenue(e.target.value)} /></div>
          <div className="space-y-1"><Label htmlFor="sc-assessor">Assessor name</Label><Input id="sc-assessor" value={assessor} onChange={(e) => setAssessor(e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={!when || update.isPending} onClick={save}>{update.isPending && <ButtonSpinner className="mr-2" />}Schedule</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
