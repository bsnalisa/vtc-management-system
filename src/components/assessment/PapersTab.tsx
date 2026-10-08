import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ExportMenu } from "@/components/ExportMenu";
import { useApprovePaper, useGeneratePaper, usePaperQuestions, usePapers } from "@/hooks/useAssessmentDevelopment";
import { useQualificationOptions, useUnitStandardOptions } from "@/hooks/useAssessmentRequests";

function PaperView({ id, title }: { id: string; title: string }) {
  const { data } = usePaperQuestions(id);
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">{title}</CardTitle>
        <ExportMenu size="sm" label="Export paper" title={title} filename={`paper-${title.replace(/\W+/g, "-").toLowerCase()}`} disabled={!data?.length}
          data={() => (data ?? []).map((q) => ({ no: q.position, question: q.question_text, options: q.options.join(" | "), marks: q.marks }))} />
      </CardHeader>
      <CardContent className="space-y-3">
        {data?.map((q) => (
          <div key={q.id} className="text-sm">
            <div className="font-medium">{q.position}. {q.question_text} <span className="text-muted-foreground">[{q.marks}]</span></div>
            {q.options.map((o, i) => <div key={o} className="ml-4">{String.fromCharCode(65 + i)}. {o}</div>)}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export function PapersTab() {
  const { data: papers } = usePapers();
  const { data: quals } = useQualificationOptions();
  const { data: units } = useUnitStandardOptions();
  const generate = useGeneratePaper();
  const approve = useApprovePaper();
  const [qual, setQual] = useState("");
  const [unit, setUnit] = useState("");
  const [title, setTitle] = useState("");
  const [marks, setMarks] = useState(100);
  const [duration, setDuration] = useState("");
  const [difficulty, setDifficulty] = useState("any");
  const [viewing, setViewing] = useState<{ id: string; title: string } | null>(null);

  const run = async (e: React.FormEvent) => {
    e.preventDefault();
    const id = await generate.mutateAsync({ qualification: qual, unitStandard: unit || null, title, targetMarks: marks, duration: duration ? Number(duration) : null, difficulty: difficulty === "any" ? null : difficulty });
    setViewing({ id, title });
    setTitle("");
  };

  return (
    <div className="space-y-6">
      <form onSubmit={run} className="grid gap-3 md:grid-cols-3 border rounded-md p-4">
        <div className="space-y-1 md:col-span-3"><h4 className="font-medium">Generate a paper from approved questions</h4></div>
        <div className="space-y-1"><Label>Qualification</Label>
          <Select value={qual} onValueChange={setQual}><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
            <SelectContent>{quals?.map((q) => <SelectItem key={q.id} value={q.id}>{q.qualification_title}</SelectItem>)}</SelectContent></Select></div>
        <div className="space-y-1"><Label>Unit standard (optional)</Label>
          <Select value={unit} onValueChange={setUnit}><SelectTrigger><SelectValue placeholder="Any" /></SelectTrigger>
            <SelectContent>{units?.map((u) => <SelectItem key={u.id} value={u.id}>{u.unit_no}</SelectItem>)}</SelectContent></Select></div>
        <div className="space-y-1"><Label>Paper title</Label><Input required value={title} onChange={(e) => setTitle(e.target.value)} /></div>
        <div className="space-y-1"><Label>Total marks</Label><Input type="number" min={1} value={marks} onChange={(e) => setMarks(Math.max(1, Number(e.target.value)))} /></div>
        <div className="space-y-1"><Label>Duration (minutes)</Label><Input type="number" min={1} value={duration} onChange={(e) => setDuration(e.target.value)} /></div>
        <div className="space-y-1"><Label>Difficulty</Label>
          <Select value={difficulty} onValueChange={setDifficulty}><SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{["any", "easy", "medium", "hard"].map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent></Select></div>
        <div className="md:col-span-3"><Button type="submit" disabled={generate.isPending || !qual || !title.trim()}>Generate paper</Button></div>
      </form>

      <Table>
        <TableHeader><TableRow><TableHead>Paper</TableHead><TableHead>Marks</TableHead><TableHead>Created</TableHead><TableHead>Status</TableHead><TableHead /></TableRow></TableHeader>
        <TableBody>
          {papers?.map((p) => (
            <TableRow key={p.id}>
              <TableCell><div className="font-medium">{p.title}</div><div className="text-xs text-muted-foreground">{p.qualifications?.qualification_title}</div></TableCell>
              <TableCell>{p.total_marks} / {p.target_marks}</TableCell>
              <TableCell>{new Date(p.created_at).toLocaleDateString()}</TableCell>
              <TableCell><Badge variant={p.status === "approved" ? "default" : "secondary"}>{p.status}</Badge></TableCell>
              <TableCell className="space-x-2 text-right">
                <Button size="sm" variant="outline" onClick={() => setViewing({ id: p.id, title: p.title })}>View</Button>
                {p.status === "draft" && <Button size="sm" onClick={() => approve.mutate(p.id)}>Approve</Button>}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {!papers?.length && <p className="text-sm text-muted-foreground text-center py-4">No papers generated.</p>}
      {viewing && <PaperView id={viewing.id} title={viewing.title} />}
    </div>
  );
}
