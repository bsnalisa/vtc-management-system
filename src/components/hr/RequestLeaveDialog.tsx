import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LeaveBalance, countWorkingDays, useLeaveTypes, useRequestLeave } from "@/hooks/useHr";

export function RequestLeaveDialog({ open, onClose, balances }: { open: boolean; onClose: () => void; balances: LeaveBalance[] }) {
  const types = useLeaveTypes();
  const request = useRequestLeave();
  const [form, setForm] = useState({ type: "", start: "", end: "", reason: "" });
  useEffect(() => { if (open) setForm({ type: "", start: "", end: "", reason: "" }); }, [open]);

  const days = countWorkingDays(form.start, form.end);
  const balance = balances.find((b) => b.leave_type_id === form.type);
  const invalidRange = !!form.start && !!form.end && form.end < form.start;
  const overLimit = !!balance && balance.days_per_year > 0 && days > balance.remaining;

  const submit = async () => {
    try {
      await request.mutateAsync({ leave_type: form.type, start: form.start, end: form.end, reason: form.reason.trim() });
      onClose();
    } catch {
      // the mutation already showed the error toast; keep the dialog open
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Request leave</DialogTitle><DialogDescription>Only working days (Monday to Friday) count against your balance.</DialogDescription></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1"><Label>Leave type</Label>
            <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
              <SelectTrigger><SelectValue placeholder="Choose a leave type" /></SelectTrigger>
              <SelectContent>{(types.data ?? []).filter((t) => t.active).map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
            </Select></div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1"><Label>First day</Label><Input type="date" value={form.start} onChange={(e) => setForm({ ...form, start: e.target.value })} /></div>
            <div className="space-y-1"><Label>Last day</Label><Input type="date" min={form.start || undefined} value={form.end} onChange={(e) => setForm({ ...form, end: e.target.value })} /></div>
          </div>
          {form.start && form.end && (
            <p className={`text-sm ${invalidRange || days === 0 || overLimit ? "text-destructive" : "text-muted-foreground"}`} role="status">
              {invalidRange ? "The last day cannot be before the first day." : days === 0 ? "That period has no working days." : `${days} working day(s).`}
              {overLimit && ` Only ${balance?.remaining} remain for this leave type.`}
            </p>
          )}
          <div className="space-y-1"><Label>Reason (optional)</Label><Textarea rows={3} maxLength={500} value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} /></div>
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={!form.type || days <= 0 || invalidRange || overLimit || request.isPending}>Send request</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
