import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { LeaveType, useDeleteLeaveType, useLeaveTypes, useSaveLeaveType } from "@/hooks/useHr";

const empty = { name: "", days: "0", paid: true, active: true };

export function LeaveTypesPanel() {
  const { data, isLoading, error } = useLeaveTypes();
  const save = useSaveLeaveType();
  const del = useDeleteLeaveType();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<LeaveType | null>(null);
  const [form, setForm] = useState(empty);
  const [toDelete, setToDelete] = useState<LeaveType | null>(null);

  const start = (t: LeaveType | null) => {
    setEditing(t);
    setForm(t ? { name: t.name, days: String(t.days_per_year), paid: t.paid, active: t.active } : empty);
    setOpen(true);
  };
  const days = Number(form.days);
  const valid = form.name.trim().length > 0 && Number.isInteger(days) && days >= 0 && days <= 366;

  const submit = async () => {
    try {
      await save.mutateAsync({ id: editing?.id, name: form.name.trim(), days_per_year: days, paid: form.paid, active: form.active });
      setOpen(false);
    } catch {
      // the mutation already showed the error toast
    }
  };

  return (
    <Card className="border-0 shadow-md">
      <CardHeader className="flex-col sm:flex-row items-start justify-between space-y-0 gap-3">
        <div><CardTitle>Leave types</CardTitle><CardDescription>Days per year of 0 means no limit on that leave type.</CardDescription></div>
        <Button onClick={() => start(null)}>Add leave type</Button>
      </CardHeader>
      <CardContent>
        {isLoading && <LoadingSpinner text="Loading leave types" />}
        {error && <p role="alert" className="text-sm text-destructive">Could not load leave types: {(error as Error).message}</p>}
        {!isLoading && !error && (
          <Table>
            <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Days per year</TableHead><TableHead>Paid</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
            <TableBody>
              {(data ?? []).map((t) => (
                <TableRow key={t.id}>
                  <TableCell>{t.name}</TableCell>
                  <TableCell>{t.days_per_year === 0 ? "No limit" : t.days_per_year}</TableCell>
                  <TableCell>{t.paid ? "Paid" : "Unpaid"}</TableCell>
                  <TableCell><Badge variant={t.active ? "default" : "outline"}>{t.active ? "Active" : "Inactive"}</Badge></TableCell>
                  <TableCell className="text-right space-x-2">
                    <Button variant="outline" size="sm" onClick={() => start(t)}>Edit</Button>
                    <Button variant="outline" size="sm" onClick={() => setToDelete(t)}>Delete</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        {!isLoading && !error && !data?.length && <p className="text-sm text-muted-foreground text-center py-8">No leave types yet. Staff cannot request leave until you add one.</p>}
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Edit leave type" : "New leave type"}</DialogTitle><DialogDescription>Annual, sick, study and similar kinds of leave.</DialogDescription></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1"><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div className="space-y-1"><Label>Days per year (0 = no limit)</Label><Input type="number" min={0} max={366} value={form.days} onChange={(e) => setForm({ ...form, days: e.target.value })} /></div>
            <div className="flex items-center justify-between"><Label>Paid leave</Label><Switch checked={form.paid} onCheckedChange={(v) => setForm({ ...form, paid: v })} /></div>
            <div className="flex items-center justify-between"><Label>Active (can be requested)</Label><Switch checked={form.active} onCheckedChange={(v) => setForm({ ...form, active: v })} /></div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0"><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={submit} disabled={!valid || save.isPending}>Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>
      <ConfirmDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)} title="Delete leave type?" description={`"${toDelete?.name}" will be removed. Types that already have requests cannot be deleted; mark them inactive instead.`}
        confirmText="Delete" variant="destructive" onConfirm={() => { if (toDelete) del.mutate(toDelete.id); setToDelete(null); }} />
    </Card>
  );
}
