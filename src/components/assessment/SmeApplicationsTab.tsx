import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SmeApplication, useReviewSme, useSmeApplications } from "@/hooks/useAssessmentDevelopment";
import { useOrganizationContext } from "@/hooks/useOrganizationContext";
import { toast } from "sonner";

export function SmeApplicationsTab() {
  const { data } = useSmeApplications();
  const review = useReviewSme();
  const [selected, setSelected] = useState<SmeApplication | null>(null);
  const [notes, setNotes] = useState("");
  const { organizationId } = useOrganizationContext();

  const close = () => { setSelected(null); setNotes(""); };
  const act = async (approve: boolean) => {
    if (!selected) return;
    await review.mutateAsync({ id: selected.id, approve, notes });
    close();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
        <span>Experts register at the public link below. Approving grants the Subject Matter Expert role when they already have an account.</span>
        <Button variant="outline" size="sm" onClick={async () => {
          // the registration page is keyed by the centre's link name (subdomain)
          const { supabase } = await import("@/integrations/supabase/client");
          const { data: org } = await supabase.from("organizations").select("subdomain").eq("id", organizationId!).single();
          if (!org?.subdomain) return toast.error("Set a link name for this centre in organisation settings first");
          await navigator.clipboard.writeText(`${window.location.origin}/sme-registration/${org.subdomain}`);
          toast.success("Registration link copied");
        }}>Copy registration link</Button>
      </div>
      <Table>
        <TableHeader><TableRow><TableHead>Applicant</TableHead><TableHead>Expertise</TableHead><TableHead>Applied</TableHead><TableHead>Status</TableHead><TableHead /></TableRow></TableHeader>
        <TableBody>
          {data?.map((a) => (
            <TableRow key={a.id}>
              <TableCell><div className="font-medium">{a.full_name}</div><div className="text-xs text-muted-foreground">{a.email}</div></TableCell>
              <TableCell>{a.expertise}</TableCell>
              <TableCell>{new Date(a.created_at).toLocaleDateString()}</TableCell>
              <TableCell><Badge variant={a.status === "approved" ? "default" : a.status === "rejected" ? "destructive" : "secondary"}>{a.status}</Badge></TableCell>
              <TableCell className="text-right"><Button size="sm" variant="outline" onClick={() => { setSelected(a); setNotes(a.review_notes ?? ""); }}>{a.status === "pending" ? "Review" : "View"}</Button></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {!data?.length && <p className="text-sm text-muted-foreground text-center py-6">No applications yet.</p>}
      {selected && (
        <Dialog open onOpenChange={(o) => !o && close()}>
          <DialogContent>
            <DialogHeader><DialogTitle>{selected.full_name}</DialogTitle></DialogHeader>
            <div className="space-y-3 text-sm">
              <div>{selected.email}{selected.phone ? ` · ${selected.phone}` : ""}{selected.national_id ? ` · ID ${selected.national_id}` : ""}</div>
              <div><div className="text-muted-foreground">Area of expertise</div>{selected.expertise}</div>
              <div><div className="text-muted-foreground">Experience</div><p className="whitespace-pre-wrap">{selected.experience}</p></div>
              {selected.status === "pending" ? (
                <>
                  <Textarea placeholder="Notes (required when rejecting)" value={notes} onChange={(e) => setNotes(e.target.value)} />
                  <div className="flex gap-2">
                    <Button disabled={review.isPending} onClick={() => act(true)}>Approve</Button>
                    <Button variant="destructive" disabled={review.isPending || !notes.trim()} onClick={() => act(false)}>Reject</Button>
                  </div>
                </>
              ) : selected.review_notes && <div><div className="text-muted-foreground">Review notes</div>{selected.review_notes}</div>}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
