import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PerformanceReview, StaffMember, useSaveReview } from "@/hooks/useHr";

const blank = { employee: "", period: String(new Date().getFullYear()), rating: "", goals: "", comments: "" };

/** Create a review, or edit a draft. Submitting makes it visible to the employee. */
export function ReviewDialog({ open, review, staff, onClose }: { open: boolean; review: PerformanceReview | null; staff: StaffMember[]; onClose: () => void }) {
  const save = useSaveReview();
  const [form, setForm] = useState(blank);
  useEffect(() => {
    if (open) setForm(review ? { employee: review.employee_user_id, period: review.period, rating: review.rating ? String(review.rating) : "", goals: review.goals ?? "", comments: review.comments ?? "" } : blank);
  }, [open, review]);

  const rating = form.rating ? Number(form.rating) : null;
  const run = async (status: "draft" | "submitted") => {
    try {
      await save.mutateAsync({ id: review?.id, employee_user_id: form.employee, period: form.period.trim(), rating, goals: form.goals.trim(), comments: form.comments.trim(), status });
      onClose();
    } catch {
      // the mutation already showed the error toast
    }
  };
  const ready = !!form.employee && !!form.period.trim();

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{review ? "Edit review" : "New performance review"}</DialogTitle><DialogDescription>Employees only see a review once it is submitted.</DialogDescription></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1"><Label>Employee</Label>
            <Select value={form.employee} onValueChange={(v) => setForm({ ...form, employee: v })} disabled={!!review}>
              <SelectTrigger><SelectValue placeholder="Choose a staff member" /></SelectTrigger>
              <SelectContent>{staff.map((s) => <SelectItem key={s.user_id} value={s.user_id}>{s.full_name ?? s.email}</SelectItem>)}</SelectContent>
            </Select></div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1"><Label>Period (for example 2026)</Label><Input value={form.period} onChange={(e) => setForm({ ...form, period: e.target.value })} disabled={!!review} /></div>
            <div className="space-y-1"><Label>Rating (1 to 5)</Label>
              <Select value={form.rating || "none"} onValueChange={(v) => setForm({ ...form, rating: v === "none" ? "" : v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="none">Not rated</SelectItem>{[1, 2, 3, 4, 5].map((n) => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}</SelectContent>
              </Select></div>
          </div>
          <div className="space-y-1"><Label>Goals</Label><Textarea rows={3} value={form.goals} onChange={(e) => setForm({ ...form, goals: e.target.value })} /></div>
          <div className="space-y-1"><Label>Comments</Label><Textarea rows={3} value={form.comments} onChange={(e) => setForm({ ...form, comments: e.target.value })} /></div>
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button variant="secondary" disabled={!ready || save.isPending} onClick={() => run("draft")}>Save draft</Button>
          <Button disabled={!ready || !rating || save.isPending} onClick={() => run("submitted")}>Submit to employee</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
