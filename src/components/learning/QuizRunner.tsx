import { useCallback, useEffect, useRef, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { StartedAttempt, QuizResult, useSubmitQuizAttempt } from "@/hooks/useLearningSpace";

const clock = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

export function QuizRunner({ attempt, onClose }: { attempt: StartedAttempt; onClose: () => void }) {
  const { mutate, isPending } = useSubmitQuizAttempt();
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<QuizResult | null>(null);
  const deadline = attempt.time_limit_minutes ? new Date(attempt.started_at).getTime() + attempt.time_limit_minutes * 60000 : null;
  const [remaining, setRemaining] = useState<number | null>(deadline ? deadline - Date.now() : null);
  const sent = useRef(false);
  const answersRef = useRef(answers);
  answersRef.current = answers;

  const autoTried = useRef(false);
  const send = useCallback(() => {
    if (sent.current) return;
    sent.current = true;
    mutate({ attemptId: attempt.attempt_id, answers: answersRef.current }, {
      onSuccess: setResult,
      onError: () => { sent.current = false; },
    });
  }, [attempt.attempt_id, mutate]);

  useEffect(() => {
    if (deadline === null || result) return;
    const tick = () => {
      const left = deadline - Date.now();
      setRemaining(left);
      if (left <= 0 && !autoTried.current) { autoTried.current = true; send(); }
    };
    tick();
    const t = setInterval(tick, 500);
    return () => clearInterval(t);
  }, [deadline, result, send]);

  if (result) {
    return (
      <Card className="border-0 shadow-md">
        <CardHeader><CardTitle>{attempt.title}: result</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p className="text-2xl font-semibold">{result.score} / {result.total}</p>
          <Badge variant={result.passed ? "default" : "destructive"}>{result.passed ? "Passed" : "Not passed"}</Badge>
          {result.too_late && <p className="text-destructive">Your answers arrived after the time limit, so this attempt scored 0.</p>}
          {result.review && (
            <div className="space-y-2">
              <h4 className="font-medium">Review</h4>
              {result.review.map((r, i) => {
                const right = (r.your_answer ?? "").trim().toLowerCase() === r.correct_answer.trim().toLowerCase();
                return (
                  <div key={r.id} className="border rounded-md p-2">
                    <div className="font-medium">{i + 1}. {r.text}</div>
                    <div>Your answer: {r.your_answer || "No answer"} {!result.too_late && <Badge variant={right ? "default" : "destructive"} className="ml-1">{right ? "Correct" : "Wrong"}</Badge>}</div>
                    {!right && <div>Correct answer: {r.correct_answer}</div>}
                  </div>
                );
              })}
            </div>
          )}
          <Button onClick={onClose}>Back to quizzes</Button>
        </CardContent>
      </Card>
    );
  }

  const unanswered = attempt.questions.filter((q) => !answers[q.id]).length;
  return (
    <Card className="border-0 shadow-md">
      <CardHeader className="flex-row items-start justify-between space-y-0">
        <div>
          <CardTitle>{attempt.title}</CardTitle>
          {attempt.instructions && <CardDescription className="whitespace-pre-wrap">{attempt.instructions}</CardDescription>}
        </div>
        {remaining !== null && (
          <Badge variant={remaining < 60000 ? "destructive" : "secondary"} className="text-base tabular-nums" role="timer" aria-label="Time remaining">
            {clock(remaining)}
          </Badge>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {attempt.questions.map((q, i) => (
          <div key={q.id} className="border rounded-md p-3 space-y-2">
            <div className="font-medium text-sm">{i + 1}. {q.text} <span className="text-muted-foreground font-normal">({q.marks} mark{q.marks === 1 ? "" : "s"})</span></div>
            <RadioGroup value={answers[q.id] ?? ""} onValueChange={(v) => setAnswers((a) => ({ ...a, [q.id]: v }))}>
              {q.options.map((o, oi) => (
                <div key={o} className="flex items-center gap-2">
                  <RadioGroupItem value={o} id={`${q.id}-${oi}`} /><Label htmlFor={`${q.id}-${oi}`} className="font-normal">{o}</Label>
                </div>
              ))}
            </RadioGroup>
          </div>
        ))}
        {!attempt.questions.length && <p className="text-sm text-muted-foreground">This quiz has no questions yet.</p>}
        <div className="flex items-center gap-3">
          <Button disabled={isPending} onClick={send}>{isPending ? "Submitting..." : "Submit answers"}</Button>
          {unanswered > 0 && <span className="text-sm text-muted-foreground">{unanswered} unanswered</span>}
        </div>
      </CardContent>
    </Card>
  );
}
