import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Vacancy, VacancyStatus, labelOf, useSaveVacancy } from "@/hooks/useHr";

const blank = { title: "", department: "", description: "", closes_on: "", status: "open" as VacancyStatus };

/** Create or edit a vacancy; `vacancy` null with `open` true means create. */
export function VacancyDialog({ open, vacancy, onClose }: { open: boolean; vacancy: Vacancy | null; onClose: () => void }) {
  const save = useSaveVacancy();
  const [form, setForm] = useState(blank);
  useEffect(() => {
    if (open) setForm(vacancy ? { title: vacancy.title, department: vacancy.department ?? "", description: vacancy.description ?? "", closes_on: vacancy.closes_on ?? "", status: vacancy.status } : blank);
  }, [open, vacancy]);

  const submit = async () => {
    try {
      await save.mutateAsync({ id: vacancy?.id, title: form.title.trim(), department: form.department.trim() || null, description: form.description.trim() || null, closes_on: form.closes_on || null, status: form.status });
      onClose();
    } catch {
      // the mutation already showed the error toast
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{vacancy ? "Edit vacancy" : "New vacancy"}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1"><Label>Title</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1"><Label>Department</Label><Input value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} /></div>
            <div className="space-y-1"><Label>Closing date</Label><Input type="date" value={form.closes_on} onChange={(e) => setForm({ ...form, closes_on: e.target.value })} /></div>
          </div>
          <div className="space-y-1"><Label>Status</Label>
            <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as VacancyStatus })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{["draft", "open", "closed", "filled"].map((s) => <SelectItem key={s} value={s}>{labelOf(s)}</SelectItem>)}</SelectContent>
            </Select></div>
          <div className="space-y-1"><Label>Description</Label><Textarea rows={4} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
        </div>
        <DialogFooter className="gap-2 sm:gap-0"><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={submit} disabled={!form.title.trim() || save.isPending}>Save vacancy</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
