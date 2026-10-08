import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ButtonSpinner } from "@/components/ui/loading-spinner";
import { Partner, PartnerInput, useSavePartner } from "@/hooks/useLiaison";

const EMPTY: PartnerInput = { name: "", industry: "", contact_person: "", contact_email: "", contact_phone: "", address: "", website: "", notes: "", active: true };
const clean = (v: string | null) => (v && v.trim() ? v.trim() : null);

/** Add (partner null) or edit an employer / partner. */
export function PartnerDialog({ open, partner, onClose }: { open: boolean; partner: Partner | null; onClose: () => void }) {
  const save = useSavePartner();
  const [form, setForm] = useState<PartnerInput>(EMPTY);
  useEffect(() => { if (open) setForm(partner ? { ...EMPTY, ...partner } : EMPTY); }, [open, partner]);
  const set = (k: keyof PartnerInput, v: string | boolean) => setForm((f) => ({ ...f, [k]: v }));
  const text = (k: keyof PartnerInput, label: string, type = "text") => (
    <div className="space-y-1"><Label htmlFor={`pd-${k}`}>{label}</Label><Input id={`pd-${k}`} type={type} value={(form[k] as string | null) ?? ""} onChange={(e) => set(k, e.target.value)} /></div>
  );
  const submit = async () => {
    try {
      await save.mutateAsync({ ...form, name: form.name.trim(), industry: clean(form.industry), contact_person: clean(form.contact_person), contact_email: clean(form.contact_email),
        contact_phone: clean(form.contact_phone), address: clean(form.address), website: clean(form.website), notes: clean(form.notes), id: partner?.id });
      onClose();
    } catch { /* error toast shown by the mutation */ }
  };
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{partner ? "Edit partner" : "Add partner"}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">{text("name", "Name")}</div>
          {text("industry", "Industry")}{text("contact_person", "Contact person")}
          {text("contact_email", "Email", "email")}{text("contact_phone", "Phone")}
          {text("website", "Website")}{text("address", "Address")}
          <div className="space-y-1 sm:col-span-2"><Label htmlFor="pd-notes">Notes</Label><Textarea id="pd-notes" rows={3} value={form.notes ?? ""} onChange={(e) => set("notes", e.target.value)} /></div>
          <div className="flex items-center gap-2"><Switch id="pd-active" checked={form.active} onCheckedChange={(v) => set("active", v)} /><Label htmlFor="pd-active">Active partner</Label></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={!form.name.trim() || save.isPending} onClick={submit}>{save.isPending && <ButtonSpinner className="mr-2" />}Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
