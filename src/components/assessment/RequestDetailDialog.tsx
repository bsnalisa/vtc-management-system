import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileText } from "lucide-react";
import { AssessmentRequest, REQUEST_LABELS, RequestStatus, openEvidence, useUpdateAssessmentRequest } from "@/hooks/useAssessmentRequests";

const toLocalInput = (iso: string | null) => (iso ? new Date(new Date(iso).getTime() - new Date(iso).getTimezoneOffset() * 60000).toISOString().slice(0, 16) : "");

export function RequestDetailDialog({ request, onClose }: { request: AssessmentRequest | null; onClose: () => void }) {
  const update = useUpdateAssessmentRequest();
  const [notes, setNotes] = useState("");
  const [assessor, setAssessor] = useState("");
  const [venue, setVenue] = useState("");
  const [when, setWhen] = useState("");
  const [outcome, setOutcome] = useState("");

  useEffect(() => {
    if (!request) return;
    setNotes(request.decision_notes ?? "");
    setAssessor(request.assessor_name ?? "");
    setVenue(request.venue ?? "");
    setWhen(toLocalInput(request.scheduled_at));
    setOutcome(request.outcome ?? "");
  }, [request]);

  if (!request) return null;
  const closed = request.status === "approved" || request.status === "rejected";

  const act = async (status: RequestStatus, extra: Partial<AssessmentRequest> = {}) => {
    await update.mutateAsync({ id: request.id, status, decision_notes: notes || null, ...extra });
    onClose();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{REQUEST_LABELS[request.request_type]} {request.reference_number}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 text-sm">
          <div className="flex gap-2"><Badge>{request.status.replace(/_/g, " ")}</Badge>{request.outcome && <Badge variant="outline">{request.outcome.replace(/_/g, " ")}</Badge>}</div>
          <dl className="grid grid-cols-2 gap-2">
            <div><dt className="text-muted-foreground">Applicant</dt><dd>{request.applicant_name}</dd></div>
            <div><dt className="text-muted-foreground">National ID</dt><dd>{request.national_id ?? "-"}</dd></div>
            <div><dt className="text-muted-foreground">Contact</dt><dd>{request.email ?? request.phone ?? "-"}</dd></div>
            <div><dt className="text-muted-foreground">Qualification</dt><dd>{request.qualifications?.qualification_title ?? "-"}</dd></div>
            <div className="col-span-2"><dt className="text-muted-foreground">Unit standard</dt><dd>{request.unit_standards ? `${request.unit_standards.unit_no} - ${request.unit_standards.module_title}` : "-"}</dd></div>
          </dl>
          <div><div className="text-muted-foreground">Motivation</div><p className="whitespace-pre-wrap">{request.motivation}</p></div>
          <div>
            <div className="text-muted-foreground mb-1">Supporting evidence ({request.evidence.length})</div>
            {request.evidence.map((f) => (
              <Button key={f.path} variant="link" className="h-auto p-0 mr-4" onClick={() => openEvidence(f.path)}><FileText className="h-3 w-3 mr-1" />{f.name}</Button>
            ))}
            {!request.evidence.length && <span className="text-muted-foreground">None attached</span>}
          </div>

          {!closed && (
            <div className="space-y-3 border-t pt-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1"><Label>Assessor</Label><Input value={assessor} onChange={(e) => setAssessor(e.target.value)} /></div>
                <div className="space-y-1"><Label>Venue</Label><Input value={venue} onChange={(e) => setVenue(e.target.value)} /></div>
                <div className="space-y-1 col-span-2"><Label>Assessment date &amp; time</Label><Input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} /></div>
              </div>
              {request.request_type === "rpl" && (
                <div className="space-y-1"><Label>Assessment outcome</Label>
                  <Select value={outcome} onValueChange={setOutcome}>
                    <SelectTrigger><SelectValue placeholder="Not assessed yet" /></SelectTrigger>
                    <SelectContent><SelectItem value="competent">Competent</SelectItem><SelectItem value="not_yet_competent">Not yet competent</SelectItem></SelectContent>
                  </Select></div>
              )}
              <div className="space-y-1"><Label>Notes to applicant</Label><Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" disabled={update.isPending} onClick={() => act("under_review", { assessor_name: assessor || null })}>Start review</Button>
                <Button variant="outline" disabled={update.isPending || !notes} title={notes ? "" : "Say what is needed in the notes"} onClick={() => act("more_info_needed")}>Request more info</Button>
                <Button variant="outline" disabled={update.isPending || !when} title={when ? "" : "Pick a date and time"} onClick={() => act("assessment_scheduled", { assessor_name: assessor || null, venue: venue || null, scheduled_at: new Date(when).toISOString() })}>Schedule assessment</Button>
                <Button disabled={update.isPending || (request.request_type === "rpl" && !outcome)} title={request.request_type === "rpl" && !outcome ? "Record the assessment outcome first" : ""}
                  onClick={() => act("approved", { outcome: (outcome || null) as AssessmentRequest["outcome"] })}>Approve</Button>
                <Button variant="destructive" disabled={update.isPending || !notes} title={notes ? "" : "Give a reason in the notes"} onClick={() => act("rejected", { outcome: (outcome || null) as AssessmentRequest["outcome"] })}>Reject</Button>
              </div>
            </div>
          )}
          {closed && request.decision_notes && <div><div className="text-muted-foreground">Decision notes</div><p>{request.decision_notes}</p></div>}
        </div>
      </DialogContent>
    </Dialog>
  );
}
