import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ButtonSpinner } from "@/components/ui/loading-spinner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useRequisitionActions } from "@/hooks/useRequisitions";
import { useToast } from "@/hooks/use-toast";
import { STAGE_DECISIONS, STAGE_LABEL, type RequisitionView } from "./status";

// The stage's own decisions; negative decisions and returns need a reason, "Fund Available" needs the GL code
export function RequisitionDecisionPanel({ view }: { view: RequisitionView }) {
  const { decide } = useRequisitionActions();
  const { toast } = useToast();
  const stage = view.stages.find((s) => s.state === "current");
  const [comment, setComment] = useState("");
  const [gl, setGl] = useState("");
  if (!stage || !view.task_id) return null;
  const options = STAGE_DECISIONS[stage.stage_key] ?? [];

  const go = async (value: string, label: string) => {
    const opt = options.find((o) => o.value === value);
    if ((opt?.negative || opt?.ret) && !comment.trim()) { toast({ title: "Add a comment", description: `A comment is required to ${label.toLowerCase()}.`, variant: "destructive" }); return; }
    if (value === "fund_available" && !gl.trim()) { toast({ title: "Enter the GL code", description: "Funds can only be confirmed against a GL code.", variant: "destructive" }); return; }
    await decide.mutateAsync({ task: view.task_id as string, decision: value, comment: comment.trim(), gl: value === "fund_available" ? gl.trim() : undefined });
    toast({ title: "Decision recorded", description: label });
    setComment(""); setGl("");
  };

  return (
    <Card className="border-primary/40">
      <CardHeader>
        <CardTitle>Your decision: {STAGE_LABEL[stage.stage_key]}</CardTitle>
        <CardDescription>Your decision is recorded with your name, role and the time, and cannot be changed afterwards.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {stage.stage_key === "accountant" && (
          <div className="space-y-1">
            <Label htmlFor="gl">GL code (required for "Fund Available")</Label>
            <Input id="gl" className="max-w-xs" value={gl} onChange={(e) => setGl(e.target.value)} maxLength={40} />
          </div>
        )}
        <div className="space-y-1">
          <Label htmlFor="comment">Comments</Label>
          <Textarea id="comment" rows={3} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Required for a negative decision or a return" />
        </div>
        <div className="flex flex-wrap gap-2">
          {options.map((o) => (
            <Button key={o.value} variant={o.negative ? "destructive" : o.ret ? "outline" : "default"} disabled={decide.isPending} onClick={() => go(o.value, o.label)}>
              {decide.isPending && <ButtonSpinner />}{o.label}
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
