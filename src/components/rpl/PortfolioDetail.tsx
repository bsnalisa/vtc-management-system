import { useEffect, useState } from "react";
import { FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DocumentVersions } from "@/components/documents/DocumentVersions";
import { AssessmentRequest, RequestStatus, openEvidence, useUpdateAssessmentRequest } from "@/hooks/useAssessmentRequests";
import { statusLabel, statusVariant } from "@/components/rpl/RplRequestsList";

export const toLocalInput = (iso: string | null) =>
  iso ? new Date(new Date(iso).getTime() - new Date(iso).getTimezoneOffset() * 60000).toISOString().slice(0, 16) : "";

/** One RPL portfolio: what the applicant submitted, and the staff decision controls. */
export function PortfolioDetail({ request }: { request: AssessmentRequest }) {
  const update = useUpdateAssessmentRequest();
  const [notes, setNotes] = useState("");
  const [assessor, setAssessor] = useState("");
  const [venue, setVenue] = useState("");
  const [when, setWhen] = useState("");
  const [outcome, setOutcome] = useState("");

  useEffect(() => {
    setNotes(request.decision_notes ?? "");
    setAssessor(request.assessor_name ?? "");
    setVenue(request.venue ?? "");
    setWhen(toLocalInput(request.scheduled_at));
    setOutcome(request.outcome ?? "");
  }, [request]);

  const closed = request.status === "approved" || request.status === "rejected";
  const act = async (status: RequestStatus, extra: Partial<AssessmentRequest> = {}) => {
    try {
      await update.mutateAsync({ id: request.id, status, decision_notes: notes || null, assessor_name: assessor || null, ...extra });
    } catch { /* error toast shown by the mutation */ }
  };
  const outcomeValue = (outcome || null) as AssessmentRequest["outcome"];

  return (
    <div className="space-y-4 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono">{request.reference_number}</span>
        <Badge variant={statusVariant(request.status)}>{statusLabel(request.status)}</Badge>
        {request.outcome && <Badge variant="outline">{statusLabel(request.outcome)}</Badge>}
      </div>
      <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <div><dt className="text-muted-foreground">Applicant</dt><dd>{request.applicant_name}</dd></div>
        <div><dt className="text-muted-foreground">Contact</dt><dd>{request.email ?? request.phone ?? "-"}</dd></div>
        <div><dt className="text-muted-foreground">Qualification</dt><dd>{request.qualifications?.qualification_title ?? "-"}</dd></div>
        <div><dt className="text-muted-foreground">NQF level</dt><dd>{request.nqf_level ?? "-"}</dd></div>
      </dl>
      <div><div className="text-muted-foreground">Motivation</div><p className="whitespace-pre-wrap">{request.motivation}</p></div>
      <div>
        <div className="text-muted-foreground mb-1">Attached evidence ({request.evidence.length})</div>
        <div className="flex flex-wrap gap-x-4">
          {request.evidence.map((f) => (
            <Button key={f.path} variant="link" className="h-auto p-0" onClick={() => openEvidence(f.path)}><FileText className="h-3 w-3 mr-1" />{f.name}</Button>
          ))}
        </div>
        {!request.evidence.length && <span className="text-muted-foreground">None attached</span>}
      </div>
      <DocumentVersions entityType="assessment_request" entityId={request.id} slot="evidence" label="Portfolio evidence" canUpload canRestore />

      {closed ? (
        <div className="border-t pt-3"><div className="text-muted-foreground">Decision notes</div><p>{request.decision_notes ?? "None recorded"}</p></div>
      ) : (
        <div className="space-y-3 border-t pt-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1"><Label htmlFor="pf-assessor">Assessor</Label><Input id="pf-assessor" value={assessor} onChange={(e) => setAssessor(e.target.value)} /></div>
            <div className="space-y-1"><Label htmlFor="pf-venue">Venue</Label><Input id="pf-venue" value={venue} onChange={(e) => setVenue(e.target.value)} /></div>
            <div className="space-y-1"><Label htmlFor="pf-when">Assessment date and time</Label><Input id="pf-when" type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} /></div>
            <div className="space-y-1"><Label>Assessment outcome</Label>
              <Select value={outcome} onValueChange={setOutcome}>
                <SelectTrigger aria-label="Assessment outcome"><SelectValue placeholder="Not assessed yet" /></SelectTrigger>
                <SelectContent><SelectItem value="competent">Competent</SelectItem><SelectItem value="not_yet_competent">Not yet competent</SelectItem></SelectContent>
              </Select></div>
          </div>
          <div className="space-y-1"><Label htmlFor="pf-notes">Assessor notes (the applicant sees these)</Label><Textarea id="pf-notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <Button variant="outline" disabled={update.isPending || request.status === "under_review"} onClick={() => act("under_review")}>Under review</Button>
            <Button variant="outline" disabled={update.isPending || !notes} title={notes ? "" : "Say what is needed in the notes"} onClick={() => act("more_info_needed")}>Request more info</Button>
            <Button variant="outline" disabled={update.isPending || !when} title={when ? "" : "Pick a date and time"}
              onClick={() => act("assessment_scheduled", { venue: venue || null, scheduled_at: new Date(when).toISOString() })}>Schedule assessment</Button>
            <Button disabled={update.isPending || !outcome} title={outcome ? "" : "Record the assessment outcome first"} onClick={() => act("approved", { outcome: outcomeValue })}>Approve</Button>
            <Button variant="destructive" disabled={update.isPending || !notes} title={notes ? "" : "Give a reason in the notes"} onClick={() => act("rejected", { outcome: outcomeValue })}>Reject</Button>
          </div>
        </div>
      )}
    </div>
  );
}
