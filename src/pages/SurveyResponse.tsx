import { useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Loader2 } from "lucide-react";
import { fetchSurveyByToken, submitSurveyByToken, PublicSurvey } from "@/hooks/useGraduation";

type Answers = Record<string, string | number | string[]>;

function Question({ q, value, onChange }: { q: PublicSurvey["questions"][number]; value: Answers[string] | undefined; onChange: (v: Answers[string]) => void }) {
  const choices = q.type === "yes_no" ? ["Yes", "No"] : q.type === "rating" ? ["1", "2", "3", "4", "5"] : q.options;
  return (
    <fieldset className="space-y-2">
      <legend className="font-medium">{q.text}{q.required && <span className="text-destructive"> *</span>}</legend>
      {q.type === "text" && <Textarea rows={3} value={(value as string) ?? ""} onChange={(e) => onChange(e.target.value)} />}
      {(q.type === "single_choice" || q.type === "yes_no" || q.type === "rating") && (
        <RadioGroup className={q.type === "rating" ? "flex gap-4" : ""} value={value == null ? "" : String(value)} onValueChange={(v) => onChange(q.type === "rating" ? Number(v) : v)}>
          {choices.map((c) => (
            <div key={c} className="flex items-center gap-2"><RadioGroupItem id={`${q.id}-${c}`} value={c} /><Label htmlFor={`${q.id}-${c}`}>{c}</Label></div>
          ))}
        </RadioGroup>
      )}
      {q.type === "rating" && <p className="text-xs text-muted-foreground">1 = poor, 5 = excellent</p>}
      {q.type === "multiple_choice" && choices.map((c) => {
        const current = (value as string[]) ?? [];
        return (
          <div key={c} className="flex items-center gap-2">
            <Checkbox id={`${q.id}-${c}`} checked={current.includes(c)} onCheckedChange={(on) => onChange(on ? [...current, c] : current.filter((x) => x !== c))} />
            <Label htmlFor={`${q.id}-${c}`}>{c}</Label>
          </div>
        );
      })}
    </fieldset>
  );
}

export default function SurveyResponse() {
  const { token = "" } = useParams();
  const { data: survey, isLoading, error } = useQuery({ queryKey: ["public-survey", token], queryFn: () => fetchSurveyByToken(token), retry: false });
  const [answers, setAnswers] = useState<Answers>({});
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setProblem(null);
    try {
      await submitSurveyByToken(token, answers);
      setDone(true);
    } catch (err) {
      setProblem(err instanceof Error ? err.message : "Could not submit your answers");
    } finally {
      setSubmitting(false);
    }
  };

  const message = (title: string, body: string) => (
    <Card><CardHeader><CardTitle>{title}</CardTitle><CardDescription>{body}</CardDescription></CardHeader></Card>
  );

  let content;
  if (isLoading) content = <Loader2 className="h-8 w-8 animate-spin mx-auto" />;
  else if (error || !survey) content = message("Survey not found", "This link is invalid or has expired.");
  else if (done) content = message("Thank you!", "Your response has been recorded.");
  else if (survey.completed) content = message("Already completed", "You have already submitted this survey.");
  else if (survey.status === "closed") content = message("Survey closed", "This survey is no longer accepting responses.");
  else content = (
    <Card>
      <CardHeader>
        <CardTitle>{survey.title}</CardTitle>
        {survey.description && <CardDescription>{survey.description}</CardDescription>}
        {survey.anonymous && <CardDescription>Your answers are anonymous.</CardDescription>}
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-6">
          {survey.questions.map((q) => (
            <Question key={q.id} q={q} value={answers[q.id]} onChange={(v) => setAnswers((a) => ({ ...a, [q.id]: v }))} />
          ))}
          {problem && <p role="alert" className="text-sm text-destructive">{problem}</p>}
          <Button type="submit" disabled={submitting}>{submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Submit</Button>
        </form>
      </CardContent>
    </Card>
  );

  return <div className="min-h-screen bg-muted/30 p-4"><div className="max-w-2xl mx-auto py-8">{content}</div></div>;
}
