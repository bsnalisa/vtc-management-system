import { useState } from "react";
import { Check, X } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useRequirementChangeRequests, useReviewRequirementChange, RequirementChangeRequest } from "@/hooks/useEntryRequirements";
import { useTrades } from "@/hooks/useTrades";

const TYPE_LABEL = { create: "New requirement", update: "Change to a requirement", deactivate: "Remove a requirement" } as const;

interface Props {
  /** Approvers can approve and decline; everyone else only sees what is waiting */
  canReview: boolean;
  title?: string;
  /** Show nothing when no change is waiting (used inside pages that have other content) */
  hideWhenEmpty?: boolean;
}

// Entry-requirement changes proposed by registration officers, waiting for the Head of Trainee Support
export const RequirementChangeRequests = ({ canReview, title = "Entry requirement changes awaiting approval", hideWhenEmpty = false }: Props) => {
  const { data: requests, isLoading } = useRequirementChangeRequests("pending");
  const { data: trades } = useTrades();
  const review = useReviewRequirementChange();
  const [declining, setDeclining] = useState<string | null>(null);
  const [notes, setNotes] = useState("");

  const describe = (r: RequirementChangeRequest) => {
    const c = r.proposed_changes ?? {};
    const trade = c.trade_id ? trades?.find((t) => t.id === c.trade_id)?.name ?? "a trade" : "all trades";
    const parts = [
      c.requirement_name,
      r.request_type === "create" || c.trade_id !== undefined ? `${trade}${c.level ? `, Level ${c.level}` : ""}` : null,
      c.min_grade ? `Grade ${c.min_grade}+` : null,
      c.min_points ? `${c.min_points} points` : null,
      c.english_symbol ? `English ${c.english_symbol}` : null,
      c.maths_symbol ? `Maths ${c.maths_symbol}` : null,
      c.science_symbol ? `Science ${c.science_symbol}` : null,
    ].filter(Boolean);
    return parts.join(" · ") || "No details";
  };

  if (hideWhenEmpty && !isLoading && (requests?.length ?? 0) === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{isLoading ? "Loading…" : `${requests?.length ?? 0} waiting`}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {!isLoading && (requests?.length ?? 0) === 0 && <p className="text-sm text-muted-foreground">No changes are waiting.</p>}
        {(requests ?? []).map((r) => (
          <div key={r.id} className="space-y-2 rounded-lg border p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Badge variant="outline">{TYPE_LABEL[r.request_type]}</Badge>
              <span className="text-xs text-muted-foreground">Sent {new Date(r.requested_at).toLocaleDateString()}</span>
            </div>
            <p className="break-words text-sm">{describe(r)}</p>
            {canReview && (declining === r.id ? (
              <div className="space-y-2">
                <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Why is this declined?" rows={2} />
                <div className="flex gap-2">
                  <Button size="sm" variant="destructive" disabled={!notes.trim() || review.isPending} onClick={() => review.mutate({ id: r.id, approve: false, notes }, { onSuccess: () => { setDeclining(null); setNotes(""); } })}>Decline</Button>
                  <Button size="sm" variant="ghost" onClick={() => { setDeclining(null); setNotes(""); }}>Cancel</Button>
                </div>
              </div>
            ) : (
              <div className="flex gap-2">
                <Button size="sm" disabled={review.isPending} onClick={() => review.mutate({ id: r.id, approve: true })}><Check className="mr-1 h-4 w-4" />Approve</Button>
                <Button size="sm" variant="outline" onClick={() => setDeclining(r.id)}><X className="mr-1 h-4 w-4" />Decline</Button>
              </div>
            ))}
          </div>
        ))}
      </CardContent>
    </Card>
  );
};
