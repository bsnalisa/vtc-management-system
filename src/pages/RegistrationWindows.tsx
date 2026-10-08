import { useState } from "react";
import { Plus, Pencil, Trash2, CalendarClock } from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useRoleNavigation } from "@/hooks/useRoleNavigation";
import { withRoleAccess } from "@/components/withRoleAccess";
import { LoadingIndicator } from "@/components/ui/loading-spinner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { toast } from "sonner";
import {
  RegistrationWindow, WindowType, windowStatus, useRegistrationWindows,
  useSaveRegistrationWindow, useDeleteRegistrationWindow,
} from "@/hooks/useRegistrationWindows";

const TYPE_LABEL: Record<WindowType, string> = { application: "Application", registration: "Returning-trainee registration" };

const StatusBadge = ({ w }: { w: RegistrationWindow }) => {
  const s = windowStatus(w);
  if (s === "open") return <Badge className="bg-green-100 text-green-800">Open now</Badge>;
  if (s === "upcoming") return <Badge variant="secondary">Upcoming</Badge>;
  return <Badge variant="outline">Closed</Badge>;
};

const emptyForm = { window_type: "registration" as WindowType, academic_year: String(new Date().getFullYear()), opens_on: "", closes_on: "" };

const RegistrationWindows = () => {
  const { navItems, groupLabel } = useRoleNavigation();
  const { data: windows, isLoading, error } = useRegistrationWindows();
  const save = useSaveRegistrationWindow();
  const remove = useDeleteRegistrationWindow();
  const [editing, setEditing] = useState<RegistrationWindow | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [toDelete, setToDelete] = useState<RegistrationWindow | null>(null);

  const openNew = () => { setEditing(null); setForm(emptyForm); setOpen(true); };
  const openEdit = (w: RegistrationWindow) => {
    setEditing(w);
    setForm({ window_type: w.window_type, academic_year: w.academic_year, opens_on: w.opens_on, closes_on: w.closes_on });
    setOpen(true);
  };

  const submit = () => {
    if (!form.academic_year.trim() || !form.opens_on || !form.closes_on) { toast.error("Fill in the academic year and both dates"); return; }
    if (form.closes_on < form.opens_on) { toast.error("The closing date cannot be before the opening date"); return; }
    save.mutate({ ...(editing ? { id: editing.id } : {}), ...form, academic_year: form.academic_year.trim() }, { onSuccess: () => setOpen(false) });
  };

  return (
    <DashboardLayout title="Application & Registration Windows" subtitle="Set when applications and returning-trainee registrations are open" navItems={navItems} groupLabel={groupLabel}>
      <div className="space-y-6">
        <Alert>
          <CalendarClock className="h-4 w-4" />
          <AlertDescription className="space-y-1">
            <p><strong>Application windows:</strong> a centre with no application window is not restricted, so applications are always accepted. Once you add one, online applications are only accepted between its dates.</p>
            <p><strong>Registration windows:</strong> returning trainees can only register themselves for a year inside a registration window for that academic year.</p>
          </AlertDescription>
        </Alert>

        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
            <div>
              <CardTitle>Windows</CardTitle>
              <CardDescription>Dates are inclusive.</CardDescription>
            </div>
            <Button onClick={openNew}><Plus className="mr-2 h-4 w-4" />Add window</Button>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-8"><LoadingIndicator className="h-6 w-6 text-primary" /></div>
            ) : error ? (
              <p className="text-sm text-destructive">Could not load windows: {(error as Error).message}</p>
            ) : !windows?.length ? (
              <p className="py-6 text-center text-sm text-muted-foreground">No windows set. Applications are not restricted and returning trainees cannot self-register.</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Type</TableHead><TableHead>Academic year</TableHead><TableHead>Opens</TableHead>
                      <TableHead>Closes</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {windows.map((w) => (
                      <TableRow key={w.id}>
                        <TableCell>{TYPE_LABEL[w.window_type]}</TableCell>
                        <TableCell>{w.academic_year}</TableCell>
                        <TableCell>{w.opens_on}</TableCell>
                        <TableCell>{w.closes_on}</TableCell>
                        <TableCell><StatusBadge w={w} /></TableCell>
                        <TableCell className="text-right">
                          <Button size="icon" variant="ghost" aria-label="Edit window" onClick={() => openEdit(w)}><Pencil className="h-4 w-4" /></Button>
                          <Button size="icon" variant="ghost" aria-label="Delete window" onClick={() => setToDelete(w)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit window" : "Add window"}</DialogTitle>
            <DialogDescription>Choose what the window controls and the dates it is open.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={form.window_type} onValueChange={(v) => setForm({ ...form, window_type: v as WindowType })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="application">Application</SelectItem>
                  <SelectItem value="registration">Returning-trainee registration</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="rw-year">Academic year</Label>
              <Input id="rw-year" value={form.academic_year} onChange={(e) => setForm({ ...form, academic_year: e.target.value })} placeholder="e.g. 2027" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="rw-open">Opens on</Label>
                <Input id="rw-open" type="date" value={form.opens_on} onChange={(e) => setForm({ ...form, opens_on: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="rw-close">Closes on</Label>
                <Input id="rw-close" type="date" value={form.closes_on} onChange={(e) => setForm({ ...form, closes_on: e.target.value })} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={submit} disabled={save.isPending}>{save.isPending ? "Saving..." : "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={(o) => { if (!o) setToDelete(null); }}
        title="Delete window?"
        description={toDelete ? `Delete the ${TYPE_LABEL[toDelete.window_type].toLowerCase()} window for ${toDelete.academic_year}? Deleting the last application window removes the application restriction.` : ""}
        confirmText="Delete"
        variant="destructive"
        isLoading={remove.isPending}
        onConfirm={() => { if (toDelete) remove.mutate(toDelete.id, { onSettled: () => setToDelete(null) }); }}
      />
    </DashboardLayout>
  );
};

export default withRoleAccess(RegistrationWindows, {
  requiredRoles: ["admin", "organization_admin", "registration_officer", "head_of_training"],
});
