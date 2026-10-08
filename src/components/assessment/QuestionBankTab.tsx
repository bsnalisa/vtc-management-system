import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus } from "lucide-react";
import { BankQuestion, QuestionType, useQuestions, useReviewQuestion, useSaveQuestion } from "@/hooks/useAssessmentDevelopment";
import { useQualificationOptions, useUnitStandardOptions } from "@/hooks/useAssessmentRequests";

const TYPE_LABEL: Record<QuestionType, string> = { multiple_choice: "Multiple choice", true_false: "True / False", short_answer: "Short answer", practical_task: "Practical task" };

function QuestionDialog() {
  const [open, setOpen] = useState(false);
  const empty = { qualification_id: "", unit_standard_id: "", question_type: "multiple_choice" as QuestionType, question_text: "", optionsText: "", correct_answer: "", marks: 1, difficulty: "medium" as BankQuestion["difficulty"] };
  const [f, setF] = useState(empty);
  const { data: quals } = useQualificationOptions();
  const { data: units } = useUnitStandardOptions();
  const save = useSaveQuestion();

  const options = f.optionsText.split("\n").map((o) => o.trim()).filter(Boolean);
  const answerOk = f.question_type === "practical_task" || f.question_type === "short_answer" || !!f.correct_answer.trim();
  const optionsOk = f.question_type !== "multiple_choice" || (options.length >= 2 && options.includes(f.correct_answer.trim()));

  const submit = async (status: "draft" | "submitted") => {
    await save.mutateAsync({
      qualification_id: f.qualification_id, unit_standard_id: f.unit_standard_id || null, question_type: f.question_type,
      question_text: f.question_text, options: f.question_type === "multiple_choice" ? options : [],
      correct_answer: f.question_type === "true_false" ? f.correct_answer : f.correct_answer.trim() || null,
      marks: f.marks, difficulty: f.difficulty, status,
    });
    setF(empty);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />Add question</Button></DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>New question</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1"><Label>Qualification</Label>
            <Select value={f.qualification_id} onValueChange={(v) => setF({ ...f, qualification_id: v })}>
              <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>{quals?.map((q) => <SelectItem key={q.id} value={q.id}>{q.qualification_title}</SelectItem>)}</SelectContent>
            </Select></div>
          <div className="space-y-1"><Label>Unit standard (optional)</Label>
            <Select value={f.unit_standard_id} onValueChange={(v) => setF({ ...f, unit_standard_id: v })}>
              <SelectTrigger><SelectValue placeholder="Any" /></SelectTrigger>
              <SelectContent>{units?.map((u) => <SelectItem key={u.id} value={u.id}>{u.unit_no} - {u.module_title}</SelectItem>)}</SelectContent>
            </Select></div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1"><Label>Type</Label>
              <Select value={f.question_type} onValueChange={(v) => setF({ ...f, question_type: v as QuestionType, correct_answer: "" })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{(Object.keys(TYPE_LABEL) as QuestionType[]).map((t) => <SelectItem key={t} value={t}>{TYPE_LABEL[t]}</SelectItem>)}</SelectContent>
              </Select></div>
            <div className="space-y-1"><Label>Marks</Label><Input type="number" min={1} value={f.marks} onChange={(e) => setF({ ...f, marks: Math.max(1, Number(e.target.value)) })} /></div>
            <div className="space-y-1"><Label>Difficulty</Label>
              <Select value={f.difficulty} onValueChange={(v) => setF({ ...f, difficulty: v as BankQuestion["difficulty"] })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{["easy", "medium", "hard"].map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
              </Select></div>
          </div>
          <div className="space-y-1"><Label>Question</Label><Textarea required rows={3} value={f.question_text} onChange={(e) => setF({ ...f, question_text: e.target.value })} /></div>
          {f.question_type === "multiple_choice" && <div className="space-y-1"><Label>Options (one per line)</Label><Textarea rows={4} value={f.optionsText} onChange={(e) => setF({ ...f, optionsText: e.target.value })} /></div>}
          {f.question_type === "true_false" ? (
            <div className="space-y-1"><Label>Correct answer</Label>
              <Select value={f.correct_answer} onValueChange={(v) => setF({ ...f, correct_answer: v })}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent><SelectItem value="True">True</SelectItem><SelectItem value="False">False</SelectItem></SelectContent>
              </Select></div>
          ) : (
            <div className="space-y-1"><Label>{f.question_type === "multiple_choice" ? "Correct option (type it exactly as listed)" : "Model answer / marking guide"}</Label>
              <Textarea rows={2} value={f.correct_answer} onChange={(e) => setF({ ...f, correct_answer: e.target.value })} /></div>
          )}
          {!optionsOk && f.question_type === "multiple_choice" && <p className="text-xs text-destructive">Give at least two options, and the correct option must match one of them exactly.</p>}
          <div className="flex gap-2">
            <Button variant="outline" disabled={save.isPending || !f.qualification_id || !f.question_text.trim()} onClick={() => submit("draft")}>Save draft</Button>
            <Button disabled={save.isPending || !f.qualification_id || !f.question_text.trim() || !answerOk || !optionsOk} onClick={() => submit("submitted")}>Submit for approval</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function QuestionBankTab({ isStaff }: { isStaff: boolean }) {
  const { data } = useQuestions();
  const review = useReviewQuestion();
  const save = useSaveQuestion();
  const [filter, setFilter] = useState("all");
  const rows = (data ?? []).filter((q) => filter === "all" || q.status === filter);

  return (
    <div className="space-y-4">
      <div className="flex justify-between gap-3">
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>{["all", "draft", "submitted", "approved", "rejected"].map((s) => <SelectItem key={s} value={s}>{s === "all" ? "All statuses" : s}</SelectItem>)}</SelectContent>
        </Select>
        <QuestionDialog />
      </div>
      <Table>
        <TableHeader><TableRow><TableHead>Question</TableHead><TableHead>Type</TableHead><TableHead>Marks</TableHead><TableHead>Status</TableHead><TableHead /></TableRow></TableHeader>
        <TableBody>
          {rows.map((q) => (
            <TableRow key={q.id}>
              <TableCell className="max-w-md"><div className="line-clamp-2">{q.question_text}</div><div className="text-xs text-muted-foreground">{q.qualifications?.qualification_title} · {q.difficulty}</div>{q.review_notes && <div className="text-xs text-destructive">{q.review_notes}</div>}</TableCell>
              <TableCell>{TYPE_LABEL[q.question_type]}</TableCell>
              <TableCell>{q.marks}</TableCell>
              <TableCell><Badge variant={q.status === "approved" ? "default" : q.status === "rejected" ? "destructive" : "secondary"}>{q.status}</Badge></TableCell>
              <TableCell className="space-x-2 text-right">
                {isStaff && q.status === "submitted" && (
                  <>
                    <Button size="sm" onClick={() => review.mutate({ id: q.id, status: "approved" })}>Approve</Button>
                    <Button size="sm" variant="destructive" onClick={() => {
                      const notes = window.prompt("Reason for rejecting (the author will see this):");
                      if (notes?.trim()) review.mutate({ id: q.id, status: "rejected", review_notes: notes.trim() });
                    }}>Reject</Button>
                  </>
                )}
                {!isStaff && q.status === "draft" && <Button size="sm" onClick={() => save.mutate({ id: q.id, status: "submitted" })}>Submit</Button>}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {!rows.length && <p className="text-sm text-muted-foreground text-center py-6">No questions.</p>}
    </div>
  );
}
