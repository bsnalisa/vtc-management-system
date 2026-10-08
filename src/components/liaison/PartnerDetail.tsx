import { useState } from "react";
import { Pencil, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ButtonSpinner } from "@/components/ui/loading-spinner";
import { INTERACTION_TYPES, InteractionType, Partner, PartnerInteraction, todayISO, useAddInteraction } from "@/hooks/useLiaison";

const fmt = (d: string | null) => (d ? new Date(`${d.slice(0, 10)}T00:00:00`).toLocaleDateString() : "-");

function InteractionForm({ partnerId, onDone }: { partnerId: string; onDone: () => void }) {
  const add = useAddInteraction();
  const [type, setType] = useState<InteractionType>("call");
  const [date, setDate] = useState(todayISO());
  const [summary, setSummary] = useState("");
  const [outcome, setOutcome] = useState("");
  const [followUp, setFollowUp] = useState("");
  const submit = async () => {
    try {
      await add.mutateAsync({ employer_id: partnerId, interaction_type: type, interaction_date: date, summary: summary.trim(), outcome: outcome.trim() || null, follow_up_date: followUp || null });
      onDone();
    } catch { /* error toast shown by the mutation */ }
  };
  return (
    <div className="space-y-3 rounded-md border p-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="space-y-1"><Label>Type</Label>
          <Select value={type} onValueChange={(v) => setType(v as InteractionType)}>
            <SelectTrigger aria-label="Contact type"><SelectValue /></SelectTrigger>
            <SelectContent>{INTERACTION_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
          </Select></div>
        <div className="space-y-1"><Label htmlFor="pi-date">Date</Label><Input id="pi-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
        <div className="space-y-1"><Label htmlFor="pi-fu">Follow-up date</Label><Input id="pi-fu" type="date" value={followUp} onChange={(e) => setFollowUp(e.target.value)} /></div>
      </div>
      <div className="space-y-1"><Label htmlFor="pi-sum">Summary</Label><Textarea id="pi-sum" rows={2} value={summary} onChange={(e) => setSummary(e.target.value)} /></div>
      <div className="space-y-1"><Label htmlFor="pi-out">Outcome</Label><Input id="pi-out" value={outcome} onChange={(e) => setOutcome(e.target.value)} /></div>
      <div className="flex gap-2">
        <Button disabled={!summary.trim() || !date || add.isPending} onClick={submit}>{add.isPending && <ButtonSpinner className="mr-2" />}Log contact</Button>
        <Button variant="outline" onClick={onDone}>Cancel</Button>
      </div>
    </div>
  );
}

/** One partner: contact details, placements count and the contact log. */
export function PartnerDetail({ partner, interactions, placements, onEdit }: { partner: Partner; interactions: PartnerInteraction[]; placements: number; onEdit: () => void }) {
  const [adding, setAdding] = useState(false);
  return (
    <div className="space-y-4 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={partner.active ? "default" : "outline"}>{partner.active ? "Active" : "Inactive"}</Badge>
        <Badge variant="secondary">{placements} placement{placements === 1 ? "" : "s"}</Badge>
        <Button size="sm" variant="outline" onClick={onEdit}><Pencil className="h-3 w-3 mr-1" />Edit</Button>
      </div>
      <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <div><dt className="text-muted-foreground">Industry</dt><dd>{partner.industry ?? "-"}</dd></div>
        <div><dt className="text-muted-foreground">Contact person</dt><dd>{partner.contact_person ?? "-"}</dd></div>
        <div><dt className="text-muted-foreground">Email</dt><dd className="break-all">{partner.contact_email ?? "-"}</dd></div>
        <div><dt className="text-muted-foreground">Phone</dt><dd>{partner.contact_phone ?? "-"}</dd></div>
        <div><dt className="text-muted-foreground">Website</dt><dd className="break-all">{partner.website ?? "-"}</dd></div>
        <div><dt className="text-muted-foreground">Address</dt><dd>{partner.address ?? "-"}</dd></div>
      </dl>
      {partner.notes && <p className="whitespace-pre-wrap text-muted-foreground">{partner.notes}</p>}
      <div className="flex items-center justify-between border-t pt-3">
        <h3 className="font-semibold">Contact log ({interactions.length})</h3>
        {!adding && <Button size="sm" onClick={() => setAdding(true)}><Plus className="h-3 w-3 mr-1" />Add contact</Button>}
      </div>
      {adding && <InteractionForm partnerId={partner.id} onDone={() => setAdding(false)} />}
      <ul className="space-y-2">
        {interactions.map((i) => (
          <li key={i.id} className="rounded-md border p-3">
            <div className="flex flex-wrap items-center gap-2"><Badge variant="outline">{i.interaction_type}</Badge><span>{fmt(i.interaction_date)}</span>
              {i.follow_up_date && <Badge variant={i.follow_up_done ? "secondary" : "default"}>{i.follow_up_done ? "Follow-up done" : `Follow up ${fmt(i.follow_up_date)}`}</Badge>}</div>
            <p className="mt-1 whitespace-pre-wrap">{i.summary}</p>
            {i.outcome && <p className="text-muted-foreground">Outcome: {i.outcome}</p>}
          </li>
        ))}
      </ul>
      {!interactions.length && !adding && <p className="text-muted-foreground text-center py-4">No contacts logged yet.</p>}
    </div>
  );
}
