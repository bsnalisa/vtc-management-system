import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Copy, Link2, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

// Newer than the generated Supabase types, so access untyped.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

interface SupervisorLink {
  token: string; supervisor_name: string | null; supervisor_email: string | null;
  expires_at: string; revoked: boolean; last_used_at: string | null;
}

const linkUrl = (token: string) => `${window.location.origin}/logbook/sign/${token}`;

const copy = async (text: string) => {
  try {
    await navigator.clipboard.writeText(text);
    toast.success("Link copied");
  } catch (e) {
    toast.error(e instanceof Error ? e.message : "Could not copy the link");
  }
};

/** Lets the trainee or a reviewer create, copy and revoke the private sign-off links for a placement's workplace supervisor. */
export function SupervisorLinkDialog({ placementId, defaultName }: { placementId: string; defaultName?: string | null }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(defaultName ?? "");
  const [email, setEmail] = useState("");
  const [created, setCreated] = useState<{ token: string; emailed: boolean } | null>(null);

  const { data: links } = useQuery({
    queryKey: ["supervisor-links", placementId],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await db.from("logbook_supervisor_links")
        .select("token, supervisor_name, supervisor_email, expires_at, revoked, last_used_at")
        .eq("placement_id", placementId).order("created_at", { ascending: false });
      if (error) throw error;
      return data as SupervisorLink[];
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      const { data, error } = await db.rpc("create_supervisor_link", {
        _placement: placementId, _name: name.trim(), _email: email.trim(), _base_url: window.location.origin,
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: (token) => {
      setCreated({ token, emailed: !!email.trim() });
      qc.invalidateQueries({ queryKey: ["supervisor-links", placementId] });
    },
    onError: (e: Error) => toast.error(e.message || "Could not create the link"),
  });

  const revoke = useMutation({
    mutationFn: async (token: string) => {
      const { error } = await db.from("logbook_supervisor_links").update({ revoked: true }).eq("token", token);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Link revoked");
      qc.invalidateQueries({ queryKey: ["supervisor-links", placementId] });
    },
    onError: (e: Error) => toast.error(e.message || "Could not revoke the link"),
  });

  const isActive = (l: SupervisorLink) => !l.revoked && new Date(l.expires_at) > new Date();

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setCreated(null); }}>
      <DialogTrigger asChild><Button variant="outline"><Link2 className="h-4 w-4 mr-2" />Supervisor sign-off link</Button></DialogTrigger>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Supervisor sign-off link</DialogTitle>
          <DialogDescription>Give the workplace supervisor a private link so they can sign your submitted entries without an account. Links are valid for 45 days.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><Label htmlFor="sl-name">Supervisor name</Label><Input id="sl-name" value={name} onChange={(e) => setName(e.target.value)} /></div>
            <div className="space-y-1"><Label htmlFor="sl-email">Supervisor email (optional)</Label><Input id="sl-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
          </div>
          <Button disabled={create.isPending} onClick={() => create.mutate()}>
            {create.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Create link
          </Button>
          {created && (
            <div className="border rounded-md p-3 space-y-2 text-sm" role="status">
              <div className="flex gap-2">
                <Input readOnly value={linkUrl(created.token)} onFocus={(e) => e.target.select()} />
                <Button variant="outline" onClick={() => copy(linkUrl(created.token))}><Copy className="h-4 w-4 mr-2" />Copy</Button>
              </div>
              {created.emailed && <p className="text-muted-foreground">An email with this link has been queued for the supervisor.</p>}
            </div>
          )}
          <div className="space-y-2 border-t pt-3">
            <h4 className="font-medium text-sm">Existing links</h4>
            {links?.map((l) => (
              <div key={l.token} className="flex items-center justify-between gap-2 border rounded-md p-2 text-sm">
                <div className="min-w-0">
                  <div className="truncate">{l.supervisor_name || "Supervisor"}{l.supervisor_email ? ` · ${l.supervisor_email}` : ""}</div>
                  <div className="text-xs text-muted-foreground">
                    Expires {new Date(l.expires_at).toLocaleDateString()} · {l.last_used_at ? `last used ${new Date(l.last_used_at).toLocaleDateString()}` : "never used"}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {isActive(l) ? (
                    <>
                      <Button size="sm" variant="outline" onClick={() => copy(linkUrl(l.token))}>Copy</Button>
                      <Button size="sm" variant="destructive" disabled={revoke.isPending} onClick={() => revoke.mutate(l.token)}>Revoke</Button>
                    </>
                  ) : <Badge variant="secondary">{l.revoked ? "Revoked" : "Expired"}</Badge>}
                </div>
              </div>
            ))}
            {links && !links.length && <p className="text-sm text-muted-foreground">No links yet.</p>}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
