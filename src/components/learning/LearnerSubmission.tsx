import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { LearningAssignment, Submission, useSubmitWork } from "@/hooks/useLearningSpace";

interface Props {
  assignment: LearningAssignment;
  submission?: Submission;
  trainee: { id: string; organization_id: string } | null;
}

export function LearnerSubmission({ assignment, submission, trainee }: Props) {
  const submit = useSubmitWork();
  const [text, setText] = useState(submission?.answer_text ?? "");
  const [link, setLink] = useState(submission?.link_url ?? "");
  const [editing, setEditing] = useState(false);

  const graded = submission?.status === "graded";
  const canEdit = !submission || submission.status === "returned" || (submission.status === "submitted" && editing);
  const linkOk = link.trim() === "" || /^https?:\/\//i.test(link.trim());
  const ready = (text.trim() !== "" || link.trim() !== "") && linkOk && !!trainee;
  const overdue = !!assignment.due_at && new Date(assignment.due_at).getTime() < Date.now();

  const send = () => {
    if (!trainee) return;
    submit.mutate({
      existingId: submission?.id, assignment_id: assignment.id, trainee_id: trainee.id, organization_id: trainee.organization_id,
      answer_text: text.trim() || null, link_url: link.trim() || null,
    }, { onSuccess: () => setEditing(false) });
  };

  return (
    <div className="border-t pt-3 space-y-2">
      {submission && (
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant={graded ? "default" : "secondary"}>{submission.status}</Badge>
          {submission.late && <Badge variant="destructive">Late</Badge>}
          <span className="text-muted-foreground">Submitted {new Date(submission.submitted_at).toLocaleString()}</span>
        </div>
      )}
      {graded && <p className="font-medium">Marks: {submission?.marks} / {assignment.max_marks}</p>}
      {submission?.feedback && <p className="whitespace-pre-wrap"><span className="font-medium">Feedback: </span>{submission.feedback}</p>}
      {submission?.status === "returned" && <p className="text-muted-foreground">Your trainer returned this for revision. Update it and submit again.</p>}

      {canEdit ? (
        <div className="space-y-2">
          {!submission && overdue && <p className="text-destructive">The due date has passed. You can still submit, but it will be marked late.</p>}
          <div className="space-y-1"><Label>Your answer</Label><Textarea rows={4} value={text} onChange={(e) => setText(e.target.value)} /></div>
          <div className="space-y-1">
            <Label>Link to your work (optional)</Label>
            <Input placeholder="https://" value={link} onChange={(e) => setLink(e.target.value)} />
            {!linkOk && <p className="text-destructive text-xs">The link must start with http:// or https://</p>}
          </div>
          <div className="flex gap-2">
            <Button size="sm" disabled={!ready || submit.isPending} onClick={send}>{submission ? "Submit again" : "Submit"}</Button>
            {editing && <Button size="sm" variant="outline" onClick={() => setEditing(false)}>Cancel</Button>}
          </div>
        </div>
      ) : (
        <>
          {submission?.answer_text && <div className="border rounded-md p-2 whitespace-pre-wrap">{submission.answer_text}</div>}
          {submission?.link_url && <a href={submission.link_url} target="_blank" rel="noopener noreferrer" className="text-primary underline break-all">{submission.link_url}</a>}
          {submission?.status === "submitted" && <div><Button size="sm" variant="outline" onClick={() => { setText(submission.answer_text ?? ""); setLink(submission.link_url ?? ""); setEditing(true); }}>Edit submission</Button></div>}
        </>
      )}
    </div>
  );
}
