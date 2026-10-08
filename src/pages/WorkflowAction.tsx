import { useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";
import { actByToken, fetchTaskByToken } from "@/hooks/useWorkflows";

type Action = "approve" | "reject" | "request_info";
const DONE: Record<string, string> = {
  approved: "You approved this request. It is now complete.",
  in_progress: "You approved this step. The request has moved on to the next approver.",
  rejected: "You rejected this request. The requester has been told.",
  awaiting_info: "You asked for more information. The requester has been told.",
};

/** Public page opened from the approval email. Nothing happens until a button is pressed, so link scanners cannot decide a request. */
export default function WorkflowAction() {
  const { token = "" } = useParams();
  const [params] = useSearchParams();
  const preselected = (["approve", "reject", "request_info"] as const).find((a) => a === params.get("a")) ?? null;
  const { data, isLoading, error } = useQuery({ queryKey: ["workflow-token", token], queryFn: () => fetchTaskByToken(token), retry: false });
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  const act = async (action: Action) => {
    setBusy(true);
    setProblem(null);
    try {
      setResult(await actByToken(token, action, comment.trim()));
    } catch (e) {
      setProblem(e instanceof Error ? e.message : "Could not record your decision");
    } finally {
      setBusy(false);
    }
  };

  const note = (title: string, body: string) => <Card><CardHeader><CardTitle>{title}</CardTitle><CardDescription>{body}</CardDescription></CardHeader></Card>;
  let content;
  if (isLoading) content = <Loader2 className="h-8 w-8 animate-spin mx-auto" />;
  else if (error || !data) content = note("Link not found", "This link is not valid. Open My Approvals in the system instead.");
  else if (result) content = note("Thank you", DONE[result] ?? "Your decision was recorded.");
  else if (!data.usable) content = note("This link can no longer be used", "The request has already been decided, or the link was used or has expired. Open My Approvals in the system to see its status.");
  else {
    const needsComment = !comment.trim();
    content = (
      <Card>
        <CardHeader>
          <CardTitle>{data.title}</CardTitle>
          <CardDescription>Step {data.step_no}: {data.step_name}{data.due_at ? ` · please respond by ${new Date(data.due_at).toLocaleString()}` : ""}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <dl className="space-y-2 text-sm">
            {Object.entries(data.summary).map(([k, v]) => (<div key={k}><dt className="text-muted-foreground">{k}</dt><dd className="whitespace-pre-wrap">{v}</dd></div>))}
          </dl>
          <div className="space-y-1">
            <Label htmlFor="c">Comment {preselected && preselected !== "approve" ? "(required)" : "(required to reject or ask for information)"}</Label>
            <Textarea id="c" rows={3} value={comment} onChange={(e) => setComment(e.target.value)} />
          </div>
          {problem && <p role="alert" className="text-sm text-destructive">{problem}</p>}
          <div className="flex flex-wrap gap-2">
            <Button variant={preselected === "approve" || !preselected ? "default" : "outline"} disabled={busy} onClick={() => act("approve")}>Approve</Button>
            <Button variant={preselected === "request_info" ? "default" : "outline"} disabled={busy || needsComment} onClick={() => act("request_info")}>Ask for information</Button>
            <Button variant="destructive" disabled={busy || needsComment} onClick={() => act("reject")}>Reject</Button>
          </div>
        </CardContent>
      </Card>
    );
  }
  return <div className="min-h-screen bg-muted/30 p-4"><div className="max-w-xl mx-auto py-8">{content}</div></div>;
}
