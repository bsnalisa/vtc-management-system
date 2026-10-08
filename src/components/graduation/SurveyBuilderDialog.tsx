import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";
import { QuestionType, SurveyQuestion, useCreateSurvey } from "@/hooks/useGraduation";

type DraftQuestion = Omit<SurveyQuestion, "id" | "survey_id" | "position"> & { optionsText: string };

const TYPE_LABELS: Record<QuestionType, string> = {
  text: "Free text",
  single_choice: "Single choice",
  multiple_choice: "Multiple choice",
  rating: "Rating (1-5)",
  yes_no: "Yes / No",
};

const blank = (): DraftQuestion => ({ question_text: "", question_type: "rating", options: [], optionsText: "", required: false });

// A sensible starting set for graduate tracer studies
const TEMPLATE: DraftQuestion[] = [
  { question_text: "What is your current employment status?", question_type: "single_choice", options: [], optionsText: "Employed full-time\nEmployed part-time\nSelf-employed\nFurther studies\nUnemployed, seeking work\nUnemployed, not seeking work", required: true },
  { question_text: "Is your current work related to the trade you studied?", question_type: "yes_no", options: [], optionsText: "", required: false },
  { question_text: "How well did the training prepare you for work?", question_type: "rating", options: [], optionsText: "", required: true },
  { question_text: "How would you rate the quality of trainers?", question_type: "rating", options: [], optionsText: "", required: false },
  { question_text: "How would you rate workshop equipment and facilities?", question_type: "rating", options: [], optionsText: "", required: false },
  { question_text: "What could we improve?", question_type: "text", options: [], optionsText: "", required: false },
];

export function SurveyBuilderDialog() {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [anonymous, setAnonymous] = useState(false);
  const [year, setYear] = useState("");
  const [questions, setQuestions] = useState<DraftQuestion[]>([blank()]);
  const create = useCreateSurvey();

  const patch = (i: number, p: Partial<DraftQuestion>) =>
    setQuestions((qs) => qs.map((q, idx) => (idx === i ? { ...q, ...p } : q)));

  const needsOptions = (t: QuestionType) => t === "single_choice" || t === "multiple_choice";

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = questions.filter((q) => q.question_text.trim()).map(({ optionsText, ...q }) => ({
      ...q,
      options: needsOptions(q.question_type) ? optionsText.split("\n").map((o) => o.trim()).filter(Boolean) : [],
    }));
    await create.mutateAsync({
      survey: { title, description: description || null, anonymous, target_graduation_year: year ? Number(year) : null },
      questions: cleaned,
    });
    setTitle(""); setDescription(""); setAnonymous(false); setYear(""); setQuestions([blank()]);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />New survey</Button></DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Create graduate survey</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1"><Label>Title</Label><Input required value={title} onChange={(e) => setTitle(e.target.value)} /></div>
          <div className="space-y-1"><Label>Introduction</Label><Textarea value={description} onChange={(e) => setDescription(e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-3 items-end">
            <div className="space-y-1"><Label>Graduation year (blank = all graduates)</Label><Input type="number" value={year} onChange={(e) => setYear(e.target.value)} /></div>
            <div className="flex items-center gap-2 pb-2"><Switch checked={anonymous} onCheckedChange={setAnonymous} /><Label>Anonymous responses</Label></div>
          </div>

          <div className="flex items-center justify-between">
            <h4 className="font-medium">Questions</h4>
            <Button type="button" variant="outline" size="sm" onClick={() => setQuestions(TEMPLATE.map((q) => ({ ...q })))}>Use tracer-study template</Button>
          </div>
          {questions.map((q, i) => (
            <div key={i} className="border rounded-md p-3 space-y-2">
              <div className="flex gap-2">
                <Input placeholder={`Question ${i + 1}`} value={q.question_text} onChange={(e) => patch(i, { question_text: e.target.value })} />
                <Button type="button" variant="ghost" size="icon" aria-label="Remove question" onClick={() => setQuestions((qs) => qs.filter((_, idx) => idx !== i))}><Trash2 className="h-4 w-4" /></Button>
              </div>
              <div className="flex gap-3 items-center">
                <Select value={q.question_type} onValueChange={(v) => patch(i, { question_type: v as QuestionType })}>
                  <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                  <SelectContent>{(Object.keys(TYPE_LABELS) as QuestionType[]).map((t) => <SelectItem key={t} value={t}>{TYPE_LABELS[t]}</SelectItem>)}</SelectContent>
                </Select>
                <div className="flex items-center gap-2"><Switch checked={q.required} onCheckedChange={(v) => patch(i, { required: v })} /><Label>Required</Label></div>
              </div>
              {needsOptions(q.question_type) && (
                <Textarea rows={3} placeholder="One option per line" value={q.optionsText} onChange={(e) => patch(i, { optionsText: e.target.value })} />
              )}
            </div>
          ))}
          <Button type="button" variant="outline" size="sm" onClick={() => setQuestions((qs) => [...qs, blank()])}><Plus className="h-4 w-4 mr-1" />Add question</Button>
          <Button type="submit" className="w-full" disabled={create.isPending || !questions.some((q) => q.question_text.trim())}>Save survey</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
