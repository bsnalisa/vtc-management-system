import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Pencil, Plus, Trash2 } from "lucide-react";
import {
  LearningAssignment, useDeleteAssignment, useLearningAssignments, useMyTrainee, useSaveAssignment, useSubmissions,
} from "@/hooks/useLearningSpace";
import { SubmissionsTable } from "./SubmissionsTable";
import { LearnerSubmission } from "./LearnerSubmission";

interface Draft { id?: string; title: string; instructions: string; due: string; max_marks: string; published: boolean }
const empty: Draft = { title: "", instructions: "", due: "", max_marks: "100", published: false };
const toLocalInput = (iso: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};

export function AssignmentsTab({ classId, canManage }: { classId: string; canManage: boolean }) {
  const { data: all = [], isLoading } = useLearningAssignments(classId);
  const assignments = canManage ? all : all.filter((a) => a.published);
  const { data: submissions = [] } = useSubmissions(assignments.map((a) => a.id), canManage);
  const { data: me } = useMyTrainee(!canManage);
  const save = useSaveAssignment();
  const remove = useDeleteAssignment();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [toDelete, setToDelete] = useState<LearningAssignment | null>(null);

  const submit = () => {
    if (!draft) return;
    save.mutate({
      id: draft.id, class_id: classId, title: draft.title.trim(), instructions: draft.instructions || null,
      due_at: draft.due ? new Date(draft.due).toISOString() : null, max_marks: Number(draft.max_marks), published: draft.published,
    } as Partial<LearningAssignment>, { onSuccess: () => setDraft(null) });
  };
  const valid = !!draft && draft.title.trim() !== "" && Number.isInteger(Number(draft.max_marks)) && Number(draft.max_marks) > 0;

  return (
    <Card className="border-0 shadow-md">
      <CardHeader className="flex-row items-start justify-between space-y-0">
        <div>
          <CardTitle>Assignments</CardTitle>
          <CardDescription>{canManage ? "Create work, then mark what trainees hand in." : "Hand in your work before the due date. Late work is accepted but flagged."}</CardDescription>
        </div>
        {canManage && <Button size="sm" onClick={() => setDraft(empty)}><Plus className="h-4 w-4 mr-2" />New assignment</Button>}
      </CardHeader>
      <CardContent className="space-y-4">
        {assignments.map((a) => {
          const subs = submissions.filter((s) => s.assignment_id === a.id);
          return (
            <div key={a.id} className="border rounded-md p-3 text-sm space-y-3">
              <div className="flex items-start justify-between gap-2 flex-wrap">
                <div>
                  <div className="font-medium">{a.title}</div>
                  <div className="text-muted-foreground">
                    {a.due_at ? `Due ${new Date(a.due_at).toLocaleString()}` : "No due date"} · {a.max_marks} marks
                  </div>
                </div>
                {canManage && (
                  <div className="flex items-center gap-1">
                    <Badge variant={a.published ? "default" : "outline"}>{a.published ? "Published" : "Draft"}</Badge>
                    <Button variant="ghost" size="icon" aria-label="Edit" onClick={() => setDraft({ id: a.id, title: a.title, instructions: a.instructions ?? "", due: toLocalInput(a.due_at), max_marks: String(a.max_marks), published: a.published })}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" aria-label="Delete" onClick={() => setToDelete(a)}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                )}
              </div>
              {a.instructions && <p className="whitespace-pre-wrap">{a.instructions}</p>}
              {canManage
                ? <SubmissionsTable assignment={a} submissions={subs} />
                : <LearnerSubmission assignment={a} submission={subs[0]} trainee={me ?? null} />}
            </div>
          );
        })}
        {!isLoading && !assignments.length && <p className="text-sm text-muted-foreground text-center py-8">No assignments yet.</p>}
      </CardContent>

      <Dialog open={!!draft} onOpenChange={(o) => !o && setDraft(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{draft?.id ? "Edit assignment" : "New assignment"}</DialogTitle><DialogDescription>Trainees only see published assignments.</DialogDescription></DialogHeader>
          {draft && (
            <div className="space-y-3">
              <div className="space-y-1"><Label>Title</Label><Input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} /></div>
              <div className="space-y-1"><Label>Instructions</Label><Textarea rows={5} value={draft.instructions} onChange={(e) => setDraft({ ...draft, instructions: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1"><Label>Due date</Label><Input type="datetime-local" value={draft.due} onChange={(e) => setDraft({ ...draft, due: e.target.value })} /></div>
                <div className="space-y-1"><Label>Maximum marks</Label><Input type="number" min={1} value={draft.max_marks} onChange={(e) => setDraft({ ...draft, max_marks: e.target.value })} /></div>
              </div>
              <div className="flex items-center gap-2"><Switch checked={draft.published} onCheckedChange={(v) => setDraft({ ...draft, published: v })} /><Label>Published</Label></div>
            </div>
          )}
          <DialogFooter><Button variant="outline" onClick={() => setDraft(null)}>Cancel</Button><Button disabled={!valid || save.isPending} onClick={submit}>Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)} title="Delete this assignment?"
        description="All submissions for it are deleted too." confirmText="Delete" variant="destructive"
        onConfirm={() => { if (toDelete) remove.mutate(toDelete.id); setToDelete(null); }} />
    </Card>
  );
}
