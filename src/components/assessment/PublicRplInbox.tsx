import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Copy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganizationContext } from "@/hooks/useOrganizationContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

// Newer than the generated Supabase types, so access untyped.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

interface PublicApplication {
  id: string; reference_number: string; applicant_name: string; national_id: string | null; phone: string | null; email: string | null;
  occupation: string | null; years_experience: number | null; motivation: string; status: string; staff_notes: string | null;
  converted_request_id: string | null; created_at: string; qualifications: { qualification_title: string } | null;
}

const FILTERS = ["all", "new", "contacted", "converted", "rejected"];
const EDITABLE_STATUSES = ["new", "contacted", "rejected"];

const useOrgSubdomain = (organizationId: string | null) =>
  useQuery({
    queryKey: ["org-subdomain", organizationId],
    enabled: !!organizationId,
    queryFn: async () => {
      const { data, error } = await db.from("organizations").select("subdomain").eq("id", organizationId).maybeSingle();
      if (error) throw error;
      return (data?.subdomain ?? null) as string | null;
    },
  });

function ApplicationDialog({ app, onClose }: { app: PublicApplication; onClose: () => void }) {
  const qc = useQueryClient();
  const [notes, setNotes] = useState(app.staff_notes ?? "");
  const [status, setStatus] = useState(app.status);
  const done = () => qc.invalidateQueries({ queryKey: ["public-rpl-applications"] });

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await db.from("public_rpl_applications").update({ staff_notes: notes.trim() || null, status }).eq("id", app.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Application updated"); done(); onClose(); },
    onError: (e: Error) => toast.error(e.message || "Could not update the application"),
  });
  const convert = useMutation({
    mutationFn: async () => {
      const { error } = await db.rpc("convert_public_rpl_application", { _id: app.id });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Converted to an RPL request"); done(); qc.invalidateQueries({ queryKey: ["assessment-requests"] }); onClose(); },
    onError: (e: Error) => toast.error(e.message || "Could not convert the application"),
  });
  const converted = app.status === "converted";

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{app.applicant_name} · {app.reference_number}</DialogTitle></DialogHeader>
        <div className="space-y-3 text-sm">
          <div className="grid grid-cols-2 gap-3">
            <div><div className="text-muted-foreground">Phone</div>{app.phone ?? "-"}</div>
            <div><div className="text-muted-foreground">Email</div>{app.email ?? "-"}</div>
            <div><div className="text-muted-foreground">National ID</div>{app.national_id ?? "-"}</div>
            <div><div className="text-muted-foreground">Qualification</div>{app.qualifications?.qualification_title ?? "-"}</div>
            <div><div className="text-muted-foreground">Occupation</div>{app.occupation ?? "-"}</div>
            <div><div className="text-muted-foreground">Years of experience</div>{app.years_experience ?? "-"}</div>
          </div>
          <div><div className="text-muted-foreground">Motivation</div><p className="whitespace-pre-wrap">{app.motivation}</p></div>
          {converted ? (
            <p className="text-muted-foreground">This application has been converted to an RPL request.</p>
          ) : (
            <>
              <div className="space-y-1">
                <Label>Status</Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                  <SelectContent>{EDITABLE_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1"><Label>Staff notes</Label><Textarea rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" disabled={save.isPending || convert.isPending} onClick={() => save.mutate()}>Save</Button>
                <Button disabled={save.isPending || convert.isPending} onClick={() => convert.mutate()}>Convert to RPL request</Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Staff inbox for RPL applications submitted through the centre's public application link. */
export function PublicRplInbox() {
  const { organizationId } = useOrganizationContext();
  const { data: subdomain } = useOrgSubdomain(organizationId);
  const [status, setStatus] = useState("all");
  const [selected, setSelected] = useState<PublicApplication | null>(null);

  const { data } = useQuery({
    queryKey: ["public-rpl-applications", organizationId],
    enabled: !!organizationId,
    queryFn: async () => {
      const { data, error } = await db.from("public_rpl_applications")
        .select("*, qualifications(qualification_title)").eq("organization_id", organizationId).order("created_at", { ascending: false });
      if (error) throw error;
      return data as PublicApplication[];
    },
  });
  const rows = (data ?? []).filter((r) => status === "all" || r.status === status);
  const link = subdomain ? `${window.location.origin}/rpl-application/${subdomain}` : null;

  const copyLink = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      toast.success("Link copied");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not copy the link");
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <Label htmlFor="rpl-link">Public application link</Label>
        {link ? (
          <div className="flex gap-2 max-w-xl">
            <Input id="rpl-link" readOnly value={link} onFocus={(e) => e.target.select()} />
            <Button variant="outline" onClick={copyLink}><Copy className="h-4 w-4 mr-2" />Copy</Button>
          </div>
        ) : <p className="text-sm text-muted-foreground">Your centre has no subdomain set, so a public link is not available.</p>}
      </div>
      <Select value={status} onValueChange={setStatus}>
        <SelectTrigger className="w-52"><SelectValue /></SelectTrigger>
        <SelectContent>{FILTERS.map((s) => <SelectItem key={s} value={s}>{s === "all" ? "All statuses" : s}</SelectItem>)}</SelectContent>
      </Select>
      <Table>
        <TableHeader><TableRow><TableHead>Reference</TableHead><TableHead>Name</TableHead><TableHead>Contact</TableHead><TableHead>Qualification</TableHead><TableHead>Years</TableHead><TableHead>Status</TableHead><TableHead>Date</TableHead><TableHead /></TableRow></TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.id}>
              <TableCell className="font-mono">{r.reference_number}</TableCell>
              <TableCell className="font-medium">{r.applicant_name}</TableCell>
              <TableCell>{r.phone ?? "-"}<div className="text-xs text-muted-foreground">{r.email}</div></TableCell>
              <TableCell>{r.qualifications?.qualification_title ?? "-"}</TableCell>
              <TableCell>{r.years_experience ?? "-"}</TableCell>
              <TableCell><Badge variant={r.status === "converted" ? "default" : r.status === "rejected" ? "destructive" : "secondary"}>{r.status}</Badge></TableCell>
              <TableCell>{new Date(r.created_at).toLocaleDateString()}</TableCell>
              <TableCell className="text-right"><Button size="sm" variant="outline" onClick={() => setSelected(r)}>Open</Button></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {!rows.length && <p className="text-sm text-muted-foreground text-center py-6">No public applications.</p>}
      {selected && <ApplicationDialog key={selected.id} app={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
