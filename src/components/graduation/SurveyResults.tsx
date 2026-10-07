import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Loader2 } from "lucide-react";
import { SurveyQuestion, useSurveyResults } from "@/hooks/useGraduation";
import { exportToCSV } from "@/lib/exportUtils";

const asArray = (v: unknown): string[] => (Array.isArray(v) ? v.map(String) : v == null || v === "" ? [] : [String(v)]);

function QuestionSummary({ q, answers }: { q: SurveyQuestion; answers: unknown[] }) {
  const given = answers.filter((a) => a != null && a !== "" && !(Array.isArray(a) && a.length === 0));

  if (q.question_type === "text") {
    return (
      <ul className="space-y-1 max-h-48 overflow-y-auto text-sm">
        {given.map((a, i) => <li key={i} className="border-l-2 pl-2">{String(a)}</li>)}
        {!given.length && <li className="text-muted-foreground">No answers yet.</li>}
      </ul>
    );
  }

  const labels = q.question_type === "rating" ? ["1", "2", "3", "4", "5"] : q.question_type === "yes_no" ? ["Yes", "No"] : q.options;
  const counts = new Map<string, number>(labels.map((l) => [l, 0]));
  given.flatMap(asArray).forEach((v) => counts.set(v, (counts.get(v) ?? 0) + 1));
  const total = given.length || 1;
  const nums = given.map(Number).filter((n) => !Number.isNaN(n));
  const avg = q.question_type === "rating" && nums.length ? (nums.reduce((s, n) => s + n, 0) / nums.length).toFixed(2) : null;

  return (
    <div className="space-y-2">
      {avg && <p className="text-sm">Average rating: <span className="font-semibold">{avg}</span> / 5</p>}
      {[...counts.entries()].map(([label, n]) => (
        <div key={label} className="space-y-1">
          <div className="flex justify-between text-sm"><span>{label}</span><span>{n} ({Math.round((n / total) * 100)}%)</span></div>
          <Progress value={(n / total) * 100} />
        </div>
      ))}
    </div>
  );
}

export function SurveyResults({ surveyId, title }: { surveyId: string; title: string }) {
  const { data, isLoading } = useSurveyResults(surveyId);
  if (isLoading || !data) return <Loader2 className="h-6 w-6 animate-spin mx-auto my-8" />;

  const { questions, responses, recipients } = data;
  const completed = recipients.filter((r) => r.completed_at).length;
  const rate = recipients.length ? Math.round((completed / recipients.length) * 100) : 0;

  const exportRows = responses.map((r) => ({
    submitted: r.submitted_at,
    ...Object.fromEntries(questions.map((q) => [q.question_text, asArray(r.answers[q.id]).join("; ")])),
  }));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <Card><CardContent className="p-4"><div className="text-2xl font-bold">{recipients.length}</div><div className="text-xs text-muted-foreground">Sent</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-2xl font-bold">{responses.length}</div><div className="text-xs text-muted-foreground">Responses</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-2xl font-bold">{rate}%</div><div className="text-xs text-muted-foreground">Response rate</div></CardContent></Card>
      </div>
      <div className="flex justify-end">
        <Button variant="outline" size="sm" disabled={!responses.length} onClick={() => exportToCSV(exportRows, `survey-${title.replace(/\W+/g, "-").toLowerCase()}`)}>Export responses (CSV)</Button>
      </div>
      {questions.map((q) => (
        <Card key={q.id}>
          <CardHeader className="pb-2"><CardTitle className="text-base">{q.question_text}</CardTitle></CardHeader>
          <CardContent><QuestionSummary q={q} answers={responses.map((r) => r.answers[q.id])} /></CardContent>
        </Card>
      ))}
    </div>
  );
}
