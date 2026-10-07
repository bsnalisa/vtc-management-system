import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { QuizAttempt } from "@/hooks/useLearningSpace";

export function QuizAttemptsTable({ attempts }: { attempts: QuizAttempt[] }) {
  const done = attempts.filter((a) => a.submitted_at);
  if (!done.length) return <p className="text-muted-foreground">No attempts yet.</p>;
  return (
    <Table>
      <TableHeader><TableRow><TableHead>Trainee</TableHead><TableHead>Score</TableHead><TableHead>Total</TableHead><TableHead>Result</TableHead><TableHead>Date</TableHead></TableRow></TableHeader>
      <TableBody>
        {done.map((a) => (
          <TableRow key={a.id}>
            <TableCell>{a.trainees ? `${a.trainees.first_name} ${a.trainees.last_name} (${a.trainees.trainee_id})` : a.trainee_id}</TableCell>
            <TableCell>{a.score}</TableCell>
            <TableCell>{a.total}</TableCell>
            <TableCell><Badge variant={a.passed ? "default" : "destructive"}>{a.passed ? "Passed" : "Not passed"}</Badge></TableCell>
            <TableCell>{new Date(a.submitted_at as string).toLocaleString()}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
