import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PartnerInteraction, useCompleteFollowUp } from "@/hooks/useLiaison";

const fmt = (d: string) => new Date(`${d.slice(0, 10)}T00:00:00`).toLocaleDateString();

/** Follow-ups that are due; each can be marked done. */
export function FollowUpsList({ items, onOpenPartner }: { items: PartnerInteraction[]; onOpenPartner?: (employerId: string) => void }) {
  const done = useCompleteFollowUp();
  if (!items.length) return <p className="text-sm text-muted-foreground text-center py-6">No follow-ups are due.</p>;
  return (
    <ul className="space-y-2">
      {items.map((i) => (
        <li key={i.id} className="flex flex-col gap-2 rounded-md border p-3 text-sm sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="font-medium">{i.employers?.name ?? "Partner"} <span className="font-normal text-muted-foreground">due {fmt(i.follow_up_date!)}</span></div>
            <div className="text-muted-foreground">{i.interaction_type} on {fmt(i.interaction_date)}: {i.summary}</div>
          </div>
          <div className="flex gap-2">
            {onOpenPartner && <Button size="sm" variant="outline" onClick={() => onOpenPartner(i.employer_id)}>Open</Button>}
            <Button size="sm" disabled={done.isPending} onClick={() => done.mutate(i.id)}><Check className="h-3 w-3 mr-1" />Mark done</Button>
          </div>
        </li>
      ))}
    </ul>
  );
}
