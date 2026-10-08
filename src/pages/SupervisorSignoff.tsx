import { useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";

// Newer than the generated Supabase types, so access untyped.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

interface SignoffEntry {
  id: string; entry_date: string; hours: number; activities: string; skills_learned: string | null; challenges: string | null;
  status: string; supervisor_signed_by: string | null; supervisor_signed_on: string | null; reviewer_comment: string | null;
}
interface SignoffLogbook {
  supervisor_name: string | null; expires_at: string; trainee_name: string; trainee_number: string | null;
  placement_number: string | null; start_date: string; end_date: string | null; employer: string | null; entries: SignoffEntry[];
}

/** Public page: a workplace supervisor signs (or sends back) a trainee's logbook entries using a private link. */
export default function SupervisorSignoff() {
  const { token = "" } = useParams();
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["supervisor-logbook", token],
    retry: false,
    queryFn: async () => {
      const { data, error } = await db.rpc("get_logbook_for_supervisor", { _token: token });
      if (error) throw error;
      return data as SignoffLogbook | null;
    },
  });
  const [picked, setPicked] = useState<string[]>([]);
  const [signer, setSigner] = useState("");
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);

  const waiting = data?.entries.filter((e) => e.status === "submitted") ?? [];
  const allPicked = waiting.length > 0 && waiting.every((e) => picked.includes(e.id));
  const toggle = (id: string, on: boolean) => setPicked((p) => (on ? [...p, id] : p.filter((x) => x !== id)));

  const act = async (sendBack: boolean) => {
    setBusy(true);
    setProblem(null);
    setResult(null);
    try {
      const { data: n, error: err } = await db.rpc("supervisor_sign_entries", {
        _token: token, _entry_ids: picked, _signer: signer.trim(), _return: sendBack, _comment: comment.trim() || null,
      });
      if (err) throw err;
      setResult(`${n} ${n === 1 ? "entry" : "entries"} ${sendBack ? "sent back for correction" : "signed"}. Thank you.`);
      setPicked([]);
      setComment("");
      await refetch();
    } catch (err) {
      setProblem(err instanceof Error ? err.message : "Could not save your decision");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-muted/30 p-4">
      <div className="max-w-3xl mx-auto py-8 space-y-4">
        {isLoading ? <Loader2 className="h-8 w-8 animate-spin mx-auto" /> : error ? (
          <Card><CardHeader><CardTitle>Could not load the logbook</CardTitle><CardDescription role="alert">{error instanceof Error ? error.message : "Please try again later."}</CardDescription></CardHeader></Card>
        ) : !data ? (
          <Card><CardHeader><CardTitle>Link not valid</CardTitle><CardDescription>This link is not valid or has expired.</CardDescription></CardHeader></Card>
        ) : (
          <>
            <Card>
              <CardHeader>
                <CardTitle>Logbook sign-off: {data.trainee_name}</CardTitle>
                <CardDescription>
                  Trainee number {data.trainee_number ?? "-"} · {data.employer ?? "Employer"} · Placement {data.placement_number ?? "-"} · {data.start_date} to {data.end_date ?? "open"}
                </CardDescription>
              </CardHeader>
            </Card>

            {result && <p role="status" className="rounded-md border bg-background p-3 text-sm font-medium">{result}</p>}

            <Card>
              <CardHeader>
                <CardTitle>Entries</CardTitle>
                <CardDescription>{waiting.length ? `${waiting.length} waiting for your signature.` : "Nothing is waiting for your signature."}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {waiting.length > 0 && (
                  <div className="flex items-center gap-2">
                    <Checkbox id="all" checked={allPicked} onCheckedChange={(c) => setPicked(c === true ? waiting.map((e) => e.id) : [])} />
                    <Label htmlFor="all">Select all waiting</Label>
                  </div>
                )}
                {data.entries.map((e) => (
                  <div key={e.id} className="border rounded-md p-3 text-sm space-y-1 bg-background">
                    <div className="flex justify-between items-center gap-2">
                      <div className="flex items-center gap-2">
                        {e.status === "submitted" && (
                          <Checkbox id={`e-${e.id}`} aria-label={`Select entry of ${e.entry_date}`} checked={picked.includes(e.id)} onCheckedChange={(c) => toggle(e.id, c === true)} />
                        )}
                        <span className="font-medium">{e.entry_date} · {e.hours} h</span>
                      </div>
                      <Badge variant={e.status === "approved" || e.status === "supervisor_signed" ? "default" : e.status === "returned" ? "destructive" : "secondary"}>{e.status.replace(/_/g, " ")}</Badge>
                    </div>
                    <p className="whitespace-pre-wrap">{e.activities}</p>
                    {e.skills_learned && <p><span className="text-muted-foreground">Skills learned: </span>{e.skills_learned}</p>}
                    {e.challenges && <p><span className="text-muted-foreground">Challenges: </span>{e.challenges}</p>}
                    {e.supervisor_signed_by && <p className="text-muted-foreground">Signed by {e.supervisor_signed_by} on {e.supervisor_signed_on}</p>}
                    {e.reviewer_comment && <p className="text-muted-foreground">Comment: {e.reviewer_comment}</p>}
                  </div>
                ))}
                {!data.entries.length && <p className="text-sm text-muted-foreground text-center py-4">The trainee has not submitted any entries yet.</p>}
              </CardContent>
            </Card>

            {waiting.length > 0 && (
              <Card>
                <CardHeader><CardTitle>Your sign-off</CardTitle><CardDescription>{picked.length} selected. Typing your name acts as your signature.</CardDescription></CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-1"><Label htmlFor="signer">Your full name</Label><Input id="signer" required value={signer} onChange={(e) => setSigner(e.target.value)} placeholder={data.supervisor_name ?? ""} /></div>
                  <div className="space-y-1"><Label htmlFor="comment">Comment (required when sending back)</Label><Textarea id="comment" rows={3} value={comment} onChange={(e) => setComment(e.target.value)} /></div>
                  {problem && <p role="alert" className="text-sm text-destructive">{problem}</p>}
                  <div className="flex flex-wrap gap-2">
                    <Button disabled={busy || !picked.length || !signer.trim()} onClick={() => act(false)}>
                      {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Sign selected entries
                    </Button>
                    <Button variant="outline" disabled={busy || !picked.length || !signer.trim() || !comment.trim()} onClick={() => act(true)}>Send back for correction</Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </div>
  );
}
