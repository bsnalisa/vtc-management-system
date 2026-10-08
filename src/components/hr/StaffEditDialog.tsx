import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ButtonSpinner } from "@/components/ui/loading-spinner";
import { EmploymentStatus, EmploymentType, StaffMember, StaffRecordInput, labelOf, useSaveStaffRecord, useStaffRecord } from "@/hooks/useHr";

const TYPES: EmploymentType[] = ["permanent", "contract", "part_time", "temporary"];
const STATUSES: EmploymentStatus[] = ["active", "on_leave", "suspended", "resigned", "terminated"];

const blank = (userId: string): StaffRecordInput => ({
  user_id: userId, employee_number: "", job_title: "", department: "", employment_type: "permanent", employment_status: "active",
  start_date: "", end_date: "", phone: "", emergency_contact: "", notes: "",
});

export function StaffEditDialog({ member, onClose }: { member: StaffMember | null; onClose: () => void }) {
  const { data: record, isLoading } = useStaffRecord(member?.user_id);
  const save = useSaveStaffRecord();
  const [form, setForm] = useState<StaffRecordInput | null>(null);

  useEffect(() => {
    if (!member || isLoading) return;
    setForm(record ? { ...blank(member.user_id), ...Object.fromEntries(Object.entries(record).map(([k, v]) => [k, v ?? ""])) } as StaffRecordInput : blank(member.user_id));
  }, [member, record, isLoading]);

  const set = <K extends keyof StaffRecordInput>(k: K, v: StaffRecordInput[K]) => setForm((f) => (f ? { ...f, [k]: v } : f));
  const text = (v: string | null) => (v && v.trim() ? v.trim() : null);

  const submit = async () => {
    if (!form) return;
    try {
      await save.mutateAsync({
        user_id: form.user_id, employee_number: text(form.employee_number), job_title: text(form.job_title), department: text(form.department),
        employment_type: form.employment_type, employment_status: form.employment_status, start_date: text(form.start_date), end_date: text(form.end_date),
        phone: text(form.phone), emergency_contact: text(form.emergency_contact), notes: text(form.notes),
      });
      onClose();
    } catch {
      // the mutation already showed the error toast; keep the dialog open
    }
  };

  return (
    <Dialog open={!!member} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Staff record: {member?.full_name ?? member?.email}</DialogTitle>
          <DialogDescription>{member?.email} - {labelOf(member?.roles?.split(",")[0])}</DialogDescription>
        </DialogHeader>
        {form && (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1"><Label>Employee number</Label><Input value={form.employee_number ?? ""} onChange={(e) => set("employee_number", e.target.value)} /></div>
            <div className="space-y-1"><Label>Job title</Label><Input value={form.job_title ?? ""} onChange={(e) => set("job_title", e.target.value)} /></div>
            <div className="space-y-1"><Label>Department</Label><Input value={form.department ?? ""} onChange={(e) => set("department", e.target.value)} /></div>
            <div className="space-y-1"><Label>Phone</Label><Input value={form.phone ?? ""} onChange={(e) => set("phone", e.target.value)} /></div>
            <div className="space-y-1"><Label>Employment type</Label>
              <Select value={form.employment_type} onValueChange={(v) => set("employment_type", v as EmploymentType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{TYPES.map((t) => <SelectItem key={t} value={t}>{labelOf(t)}</SelectItem>)}</SelectContent>
              </Select></div>
            <div className="space-y-1"><Label>Employment status</Label>
              <Select value={form.employment_status} onValueChange={(v) => set("employment_status", v as EmploymentStatus)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{STATUSES.map((t) => <SelectItem key={t} value={t}>{labelOf(t)}</SelectItem>)}</SelectContent>
              </Select></div>
            <div className="space-y-1"><Label>Start date</Label><Input type="date" value={form.start_date ?? ""} onChange={(e) => set("start_date", e.target.value)} /></div>
            <div className="space-y-1"><Label>End date</Label><Input type="date" value={form.end_date ?? ""} onChange={(e) => set("end_date", e.target.value)} /></div>
            <div className="space-y-1 sm:col-span-2"><Label>Emergency contact</Label><Input value={form.emergency_contact ?? ""} onChange={(e) => set("emergency_contact", e.target.value)} placeholder="Name and phone number" /></div>
            <div className="space-y-1 sm:col-span-2"><Label>Notes</Label><Textarea rows={3} value={form.notes ?? ""} onChange={(e) => set("notes", e.target.value)} /></div>
          </div>
        )}
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={!form || save.isPending}>{save.isPending && <ButtonSpinner />}Save record</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
