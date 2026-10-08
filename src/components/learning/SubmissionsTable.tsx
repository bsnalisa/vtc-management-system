import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { LearningAssignment, Submission, useGradeSubmission } from "@/hooks/useLearningSpace";

export function SubmissionsTable({ assignment, submissions }: { assignment: LearningAssignment; submissions: Submission[] }) {
  const grade = useGradeSubmission();
  const [target, setTarget] = useState<Submission | null>(null);
  const [marks, setMarks] = useState("");
  const [feedback, setFeedback] = useState("");

  const open = (s: Submission) => { setTarget(s); setMarks(s.marks != null ? String(s.marks) : ""); setFeedback(s.feedback ?? ""); };
  const marksNum = Number(marks);
  const marksOk = marks.trim() !== "" && Number.isFinite(marksNum) && marksNum >= 0 && marksNum <= assignment.max_marks;

  const apply = (status: "graded" | "returned") => {
    if (!target) return;
    grade.mutate(
      { id: target.id, status, marks: status === "graded" ? marksNum : null, feedback: feedback.trim() || null },
      { onSuccess: () => setTarget(null) });
  };

  if (!submissions.length) return <p className="text-muted-foreground">No submissions yet.</p>;

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow><TableHead>Trainee</TableHead><TableHead>Submitted</TableHead><TableHead>Status</TableHead><TableHead>Marks</TableHead><TableHead /></TableRow>
        </TableHeader>
        <TableBody>
          {submissions.map((s) => (
            <TableRow key={s.id}>
              <TableCell>{s.trainees ? `${s.trainees.first_name} ${s.trainees.last_name} (${s.trainees.trainee_id})` : s.trainee_id}</TableCell>
              <TableCell>{new Date(s.submitted_at).toLocaleString()} {s.late && <Badge variant="destructive" className="ml-1">Late</Badge>}</TableCell>
              <TableCell><Badge variant="secondary">{s.status}</Badge></TableCell>
              <TableCell>{s.marks != null ? `${s.marks} / ${assignment.max_marks}` : "-"}</TableCell>
              <TableCell className="text-right"><Button size="sm" variant="outline" onClick={() => open(s)}>{s.status === "graded" ? "Review" : "Mark"}</Button></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Dialog open={!!target} onOpenChange={(o) => !o && setTarget(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Mark submission</DialogTitle>
            <DialogDescription>{assignment.title} - out of {assignment.max_marks} marks</DialogDescription>
          </DialogHeader>
          {target && (
            <div className="space-y-3 text-sm">
              {target.answer_text && <div className="border rounded-md p-2 whitespace-pre-wrap">{target.answer_text}</div>}
              {target.link_url && (
                <a href={target.link_url} target="_blank" rel="noopener noreferrer" className="text-primary underline break-all">{target.link_url}</a>
              )}
              <div className="space-y-1">
                <Label>Marks (0 to {assignment.max_marks})</Label>
                <Input type="number" min={0} max={assignment.max_marks} step="0.5" value={marks} onChange={(e) => setMarks(e.target.value)} />
              </div>
              <div className="space-y-1"><Label>Feedback</Label><Textarea rows={4} value={feedback} onChange={(e) => setFeedback(e.target.value)} /></div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" disabled={grade.isPending} onClick={() => apply("returned")}>Return for revision</Button>
            <Button disabled={!marksOk || grade.isPending} onClick={() => apply("graded")}>Save marks</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
