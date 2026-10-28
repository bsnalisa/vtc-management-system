import { useState } from "react";
import { Check, X } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ButtonSpinner } from "@/components/ui/loading-spinner";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

// These functions are newer than the generated Supabase types.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export type FacilityKind = "class" | "building" | "room";
export interface Approvable { id: string; approval_status?: string | null; approval_note?: string | null }

const LABEL: Record<string, string> = { pending: "Waiting for Centre Manager", approved: "Approved", rejected: "Rejected" };

// Classes, buildings/workshops and rooms are made by the Head of Training and approved by the Centre Manager
export function ApprovalBadge({ item }: { item: Approvable }) {
  const s = item.approval_status ?? "approved";
  return (
    <div className="space-y-0.5">
      <Badge variant={s === "approved" ? "default" : s === "rejected" ? "destructive" : "secondary"}>{LABEL[s] ?? s}</Badge>
      {s === "rejected" && item.approval_note && <div className="max-w-[16rem] whitespace-normal text-xs text-muted-foreground">{item.approval_note}</div>}
    </div>
  );
}

export function useFacilityDecision() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (a: { kind: FacilityKind; id: string; approve: boolean; note?: string }) => {
      const { error } = await db.rpc("facility_decide", { _kind: a.kind, _id: a.id, _approve: a.approve, _note: a.note || null });
      if (error) throw error;
    },
    onSuccess: (_d, a) => {
      for (const k of ["classes", "training_buildings", "training_rooms", "facility-summary"]) qc.invalidateQueries({ queryKey: [k] });
      toast({ title: a.approve ? "Approved" : "Rejected" });
    },
    onError: (e: Error) => toast({ title: "The decision was not recorded", description: e.message, variant: "destructive" }),
  });
}

// Approval status plus, for the Centre Manager, the Approve / Reject controls of an item that is waiting
export function ApprovalCell({ kind, item, label, canApprove }: { kind: FacilityKind; item: Approvable; label: string; canApprove: boolean }) {
  const decide = useFacilityDecision();
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState("");
  const pending = (item.approval_status ?? "approved") === "pending";
  return (
    <div className="space-y-1">
      <ApprovalBadge item={item} />
      {canApprove && pending && (
        <div className="flex flex-wrap gap-1">
          <Button size="sm" disabled={decide.isPending} aria-label={`Approve ${label}`} onClick={() => decide.mutate({ kind, id: item.id, approve: true })}>{decide.isPending ? <ButtonSpinner /> : <Check className="mr-1 h-4 w-4" />}Approve</Button>
          <Button size="sm" variant="outline" disabled={decide.isPending} aria-label={`Reject ${label}`} onClick={() => { setNote(""); setRejecting(true); }}><X className="mr-1 h-4 w-4" />Reject</Button>
        </div>
      )}
      <Dialog open={rejecting} onOpenChange={setRejecting}>
        <DialogContent>
          <DialogHeader><DialogTitle>Reject {label}</DialogTitle><DialogDescription>The Head of Training sees your reason and can correct it and send it back for approval.</DialogDescription></DialogHeader>
          <div className="space-y-1"><Label htmlFor="fnote">Reason</Label><Textarea id="fnote" rows={3} value={note} onChange={(e) => setNote(e.target.value)} /></div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejecting(false)}>Cancel</Button>
            <Button variant="destructive" disabled={note.trim().length < 5 || decide.isPending} onClick={async () => { await decide.mutateAsync({ kind, id: item.id, approve: false, note }); setRejecting(false); }}>Reject</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
