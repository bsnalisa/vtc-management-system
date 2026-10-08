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
import { ListChecks, Pencil, Plus, Trash2 } from "lucide-react";
import {
  LearningQuiz, QuizAttempt, StartedAttempt, useDeleteQuiz, useLearningQuizzes, useQuizAttempts, useSaveQuiz, useStartQuizAttempt,
} from "@/hooks/useLearningSpace";
import { QuizQuestionsDialog } from "./QuizQuestionsDialog";
import { QuizAttemptsTable } from "./QuizAttemptsTable";
import { QuizRunner } from "./QuizRunner";

interface Draft { id?: string; title: string; instructions: string; time_limit: string; pass_percent: string; attempts_allowed: string; show_answers: boolean; published: boolean }
const empty: Draft = { title: "", instructions: "", time_limit: "", pass_percent: "50", attempts_allowed: "1", show_answers: false, published: false };

export function QuizzesTab({ classId, canManage }: { classId: string; canManage: boolean }) {
  const { data: all = [], isLoading } = useLearningQuizzes(classId);
  const quizzes = canManage ? all : all.filter((q) => q.published);
  const { data: attempts = [] } = useQuizAttempts(quizzes.map((q) => q.id), canManage);
  const save = useSaveQuiz();
  const remove = useDeleteQuiz();
  const start = useStartQuizAttempt();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [toDelete, setToDelete] = useState<LearningQuiz | null>(null);
  const [editQuestions, setEditQuestions] = useState<LearningQuiz | null>(null);
  const [running, setRunning] = useState<StartedAttempt | null>(null);

  if (running) return <QuizRunner attempt={running} onClose={() => setRunning(null)} />;

  const num = (s: string) => Number(s);
  const valid = !!draft && draft.title.trim() !== ""
    && (draft.time_limit === "" || (num(draft.time_limit) >= 1 && num(draft.time_limit) <= 600))
    && num(draft.pass_percent) >= 0 && num(draft.pass_percent) <= 100
    && num(draft.attempts_allowed) >= 1 && num(draft.attempts_allowed) <= 20;

  const submit = () => {
    if (!draft) return;
    save.mutate({
      id: draft.id, class_id: classId, title: draft.title.trim(), instructions: draft.instructions || null,
      time_limit_minutes: draft.time_limit === "" ? null : num(draft.time_limit), pass_percent: num(draft.pass_percent),
      attempts_allowed: num(draft.attempts_allowed), show_answers: draft.show_answers, published: draft.published,
    } as Partial<LearningQuiz>, { onSuccess: () => setDraft(null) });
  };

  return (
    <Card className="border-0 shadow-md">
      <CardHeader className="flex-row items-start justify-between space-y-0">
        <div>
          <CardTitle>Quizzes</CardTitle>
          <CardDescription>{canManage ? "Auto-marked single choice and true or false quizzes." : "Quizzes are marked automatically when you submit."}</CardDescription>
        </div>
        {canManage && <Button size="sm" onClick={() => setDraft(empty)}><Plus className="h-4 w-4 mr-2" />New quiz</Button>}
      </CardHeader>
      <CardContent className="space-y-4">
        {quizzes.map((q) => {
          const mine = attempts.filter((a) => a.quiz_id === q.id);
          const done = mine.filter((a) => a.submitted_at);
          return (
            <div key={q.id} className="border rounded-md p-3 text-sm space-y-3">
              <div className="flex items-start justify-between gap-2 flex-wrap">
                <div>
                  <div className="font-medium">{q.title}</div>
                  <div className="text-muted-foreground">
                    {q.time_limit_minutes ? `${q.time_limit_minutes} min` : "No time limit"} · pass mark {q.pass_percent}% · {q.attempts_allowed} attempt(s)
                  </div>
                </div>
                {canManage ? (
                  <div className="flex items-center gap-1">
                    <Badge variant={q.published ? "default" : "outline"}>{q.published ? "Published" : "Draft"}</Badge>
                    <Button variant="outline" size="sm" onClick={() => setEditQuestions(q)}><ListChecks className="h-4 w-4 mr-1" />Questions</Button>
                    <Button variant="ghost" size="icon" aria-label="Edit" onClick={() => setDraft({ id: q.id, title: q.title, instructions: q.instructions ?? "", time_limit: q.time_limit_minutes ? String(q.time_limit_minutes) : "", pass_percent: String(q.pass_percent), attempts_allowed: String(q.attempts_allowed), show_answers: q.show_answers, published: q.published })}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" aria-label="Delete" onClick={() => setToDelete(q)}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                ) : (
                  <Button size="sm" disabled={start.isPending} onClick={() => start.mutate(q.id, { onSuccess: setRunning })}>
                    {mine.some((a) => !a.submitted_at) ? "Resume" : "Start"}
                  </Button>
                )}
              </div>
              {q.instructions && <p className="whitespace-pre-wrap">{q.instructions}</p>}
              {canManage
                ? <QuizAttemptsTable attempts={mine} />
                : (
                  <div className="text-muted-foreground">
                    {done.length} of {q.attempts_allowed} attempt(s) used
                    {done.map((a: QuizAttempt, i) => (
                      <div key={a.id}>Attempt {done.length - i}: {a.score}/{a.total} {a.passed ? "- passed" : "- not passed"} ({new Date(a.submitted_at as string).toLocaleDateString()})</div>
                    ))}
                  </div>
                )}
            </div>
          );
        })}
        {!isLoading && !quizzes.length && <p className="text-sm text-muted-foreground text-center py-8">No quizzes yet.</p>}
      </CardContent>

      <Dialog open={!!draft} onOpenChange={(o) => !o && setDraft(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{draft?.id ? "Edit quiz" : "New quiz"}</DialogTitle><DialogDescription>Add questions after saving, using the Questions button.</DialogDescription></DialogHeader>
          {draft && (
            <div className="space-y-3">
              <div className="space-y-1"><Label>Title</Label><Input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} /></div>
              <div className="space-y-1"><Label>Instructions</Label><Textarea rows={3} value={draft.instructions} onChange={(e) => setDraft({ ...draft, instructions: e.target.value })} /></div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1"><Label>Time limit (min)</Label><Input type="number" min={1} max={600} placeholder="None" value={draft.time_limit} onChange={(e) => setDraft({ ...draft, time_limit: e.target.value })} /></div>
                <div className="space-y-1"><Label>Pass %</Label><Input type="number" min={0} max={100} value={draft.pass_percent} onChange={(e) => setDraft({ ...draft, pass_percent: e.target.value })} /></div>
                <div className="space-y-1"><Label>Attempts</Label><Input type="number" min={1} max={20} value={draft.attempts_allowed} onChange={(e) => setDraft({ ...draft, attempts_allowed: e.target.value })} /></div>
              </div>
              <div className="flex items-center gap-2"><Switch checked={draft.show_answers} onCheckedChange={(v) => setDraft({ ...draft, show_answers: v })} /><Label>Show correct answers after submitting</Label></div>
              <div className="flex items-center gap-2"><Switch checked={draft.published} onCheckedChange={(v) => setDraft({ ...draft, published: v })} /><Label>Published</Label></div>
            </div>
          )}
          <DialogFooter><Button variant="outline" onClick={() => setDraft(null)}>Cancel</Button><Button disabled={!valid || save.isPending} onClick={submit}>Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <QuizQuestionsDialog quiz={editQuestions} onClose={() => setEditQuestions(null)} />

      <ConfirmDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)} title="Delete this quiz?"
        description="Its questions and all attempts are deleted too." confirmText="Delete" variant="destructive"
        onConfirm={() => { if (toDelete) remove.mutate(toDelete.id); setToDelete(null); }} />
    </Card>
  );
}
