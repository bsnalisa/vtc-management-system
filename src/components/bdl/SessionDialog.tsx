import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BdlClass, VirtualSession, useSaveVirtualSession } from "@/hooks/useBdl";

interface Draft { id?: string; class_id: string; title: string; starts: string; ends: string; url: string; host: string; notes: string }

const toLocal = (iso: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};

export function SessionDialog({ open, onClose, classes, session, defaultClass }: {
  open: boolean; onClose: () => void; classes: BdlClass[]; session: VirtualSession | null; defaultClass: string;
}) {
  const save = useSaveVirtualSession();
  const [d, setD] = useState<Draft>({ class_id: "", title: "", starts: "", ends: "", url: "", host: "", notes: "" });
  useEffect(() => {
    if (!open) return;
    setD(session
      ? { id: session.id, class_id: session.class_id, title: session.title, starts: toLocal(session.starts_at), ends: toLocal(session.ends_at), url: session.meeting_url, host: session.host_name ?? "", notes: session.notes ?? "" }
      : { class_id: defaultClass, title: "", starts: "", ends: "", url: "", host: "", notes: "" });
  }, [open, session, defaultClass]);

  const timesOk = !d.ends || !d.starts || new Date(d.ends) > new Date(d.starts);
  const valid = d.class_id && d.title.trim() && d.starts && timesOk && /^https?:\/\//i.test(d.url.trim());

  const submit = () => save.mutate({
    ...(d.id ? { id: d.id } : {}), class_id: d.class_id, title: d.title.trim(), starts_at: new Date(d.starts).toISOString(),
    ends_at: d.ends ? new Date(d.ends).toISOString() : null, meeting_url: d.url.trim(), host_name: d.host.trim() || null, notes: d.notes.trim() || null,
  }, { onSuccess: onClose });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{d.id ? "Edit session" : "Schedule session"}</DialogTitle>
          <DialogDescription>Trainees of the class are notified when a session is created, moved or cancelled.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Class</Label>
            <Select value={d.class_id} onValueChange={(v) => setD({ ...d, class_id: v })} disabled={!!d.id}>
              <SelectTrigger><SelectValue placeholder="Choose a class" /></SelectTrigger>
              <SelectContent>{classes.map((c) => <SelectItem key={c.id} value={c.id}>{c.class_name} ({c.class_code})</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1"><Label>Title</Label><Input value={d.title} onChange={(e) => setD({ ...d, title: e.target.value })} /></div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1"><Label>Starts</Label><Input type="datetime-local" value={d.starts} onChange={(e) => setD({ ...d, starts: e.target.value })} /></div>
            <div className="space-y-1"><Label>Ends (optional)</Label><Input type="datetime-local" value={d.ends} onChange={(e) => setD({ ...d, ends: e.target.value })} /></div>
          </div>
          {!timesOk && <p className="text-sm text-destructive">The end must be after the start.</p>}
          <div className="space-y-1"><Label>Meeting link</Label><Input placeholder="https://" value={d.url} onChange={(e) => setD({ ...d, url: e.target.value })} /></div>
          <div className="space-y-1"><Label>Host</Label><Input value={d.host} onChange={(e) => setD({ ...d, host: e.target.value })} /></div>
          <div className="space-y-1"><Label>Notes</Label><Textarea rows={3} value={d.notes} onChange={(e) => setD({ ...d, notes: e.target.value })} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={!valid || save.isPending} onClick={submit}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
