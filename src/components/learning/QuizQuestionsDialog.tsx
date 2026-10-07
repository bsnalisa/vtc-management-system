import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Pencil, Plus, Trash2, X } from "lucide-react";
import { LearningQuiz, QuizQuestion, useDeleteQuestion, useQuizQuestions, useSaveQuestion } from "@/hooks/useLearningSpace";

interface Draft { id?: string; text: string; type: QuizQuestion["question_type"]; options: string[]; correct: string; marks: string }
const blank = (): Draft => ({ text: "", type: "single_choice", options: ["", ""], correct: "", marks: "1" });

export function QuizQuestionsDialog({ quiz, onClose }: { quiz: LearningQuiz | null; onClose: () => void }) {
  const { data: questions = [] } = useQuizQuestions(quiz?.id);
  const save = useSaveQuestion();
  const remove = useDeleteQuestion();
  const [draft, setDraft] = useState<Draft | null>(null);

  const options = draft ? (draft.type === "true_false" ? ["True", "False"] : draft.options.map((o) => o.trim()).filter(Boolean)) : [];
  const valid = !!draft && draft.text.trim() !== "" && Number(draft.marks) >= 1 && Number.isInteger(Number(draft.marks))
    && options.length >= 2 && new Set(options).size === options.length && options.includes(draft.correct);

  const submit = () => {
    if (!draft || !quiz) return;
    save.mutate({
      id: draft.id, quiz_id: quiz.id, question_text: draft.text.trim(), question_type: draft.type, options,
      correct_answer: draft.correct, marks: Number(draft.marks),
      ...(draft.id ? {} : { position: questions.length }),
    } as Partial<QuizQuestion>, { onSuccess: () => setDraft(null) });
  };

  const setOption = (i: number, v: string) => {
    if (!draft) return;
    const was = draft.options[i].trim();
    const options = draft.options.map((o, idx) => (idx === i ? v : o));
    setDraft({ ...draft, options, correct: draft.correct === was && was !== "" ? v.trim() : draft.correct });
  };

  return (
    <Dialog open={!!quiz} onOpenChange={(o) => { if (!o) { setDraft(null); onClose(); } }}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Questions: {quiz?.title}</DialogTitle>
          <DialogDescription>Only you and other managers can see the correct answers.</DialogDescription>
        </DialogHeader>

        {!draft && (
          <div className="space-y-2">
            {questions.map((q, i) => (
              <div key={q.id} className="border rounded-md p-2 text-sm flex items-start justify-between gap-2">
                <div>
                  <div className="font-medium">{i + 1}. {q.question_text} <Badge variant="secondary">{q.marks} mark(s)</Badge></div>
                  <ul className="list-disc ml-5">{q.options.map((o) => <li key={o} className={o === q.correct_answer ? "font-semibold" : ""}>{o}{o === q.correct_answer ? " (correct)" : ""}</li>)}</ul>
                </div>
                <div className="flex shrink-0">
                  <Button variant="ghost" size="icon" aria-label="Edit question" onClick={() => setDraft({ id: q.id, text: q.question_text, type: q.question_type, options: q.question_type === "true_false" ? ["", ""] : [...q.options], correct: q.correct_answer, marks: String(q.marks) })}><Pencil className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" aria-label="Delete question" disabled={remove.isPending} onClick={() => remove.mutate(q.id)}><Trash2 className="h-4 w-4" /></Button>
                </div>
              </div>
            ))}
            {!questions.length && <p className="text-sm text-muted-foreground text-center py-4">No questions yet.</p>}
            <Button size="sm" onClick={() => setDraft(blank())}><Plus className="h-4 w-4 mr-2" />Add question</Button>
          </div>
        )}

        {draft && (
          <div className="space-y-3">
            <div className="space-y-1"><Label>Question</Label><Textarea rows={2} value={draft.text} onChange={(e) => setDraft({ ...draft, text: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Type</Label>
                <Select value={draft.type} onValueChange={(v) => setDraft({ ...draft, type: v as Draft["type"], correct: "" })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="single_choice">Single choice</SelectItem><SelectItem value="true_false">True or false</SelectItem></SelectContent>
                </Select>
              </div>
              <div className="space-y-1"><Label>Marks</Label><Input type="number" min={1} value={draft.marks} onChange={(e) => setDraft({ ...draft, marks: e.target.value })} /></div>
            </div>
            <div className="space-y-1">
              <Label>{draft.type === "true_false" ? "Correct answer" : "Options (select the correct one)"}</Label>
              {draft.type === "true_false" ? (
                <RadioGroup value={draft.correct} onValueChange={(v) => setDraft({ ...draft, correct: v })}>
                  {["True", "False"].map((o) => <div key={o} className="flex items-center gap-2"><RadioGroupItem value={o} id={`tf-${o}`} /><Label htmlFor={`tf-${o}`}>{o}</Label></div>)}
                </RadioGroup>
              ) : (
                <RadioGroup value={draft.correct} onValueChange={(v) => setDraft({ ...draft, correct: v })}>
                  {draft.options.map((o, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <RadioGroupItem value={o.trim()} id={`opt-${i}`} disabled={o.trim() === ""} aria-label={`Option ${i + 1} is correct`} />
                      <Input value={o} placeholder={`Option ${i + 1}`} onChange={(e) => setOption(i, e.target.value)} />
                      <Button type="button" variant="ghost" size="icon" aria-label="Remove option" disabled={draft.options.length <= 2}
                        onClick={() => setDraft({ ...draft, options: draft.options.filter((_, idx) => idx !== i), correct: draft.correct === o.trim() ? "" : draft.correct })}><X className="h-4 w-4" /></Button>
                    </div>
                  ))}
                  <Button type="button" variant="outline" size="sm" onClick={() => setDraft({ ...draft, options: [...draft.options, ""] })}>Add option</Button>
                </RadioGroup>
              )}
              {!valid && <p className="text-xs text-muted-foreground">Needs question text, at least two different options and one marked correct.</p>}
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setDraft(null)}>Cancel</Button>
              <Button disabled={!valid || save.isPending} onClick={submit}>Save question</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
