import { useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Pencil, Plus, Printer, Trash2 } from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useRoleNavigation } from "@/hooks/useRoleNavigation";
import { useOrganizationContext } from "@/hooks/useOrganizationContext";
import {
  CALENDAR_EVENT_TYPES, CalendarEvent, CalendarEventType,
  useAcademicCalendar, useDeleteCalendarEvent, useSaveCalendarEvent,
} from "@/hooks/useAcademicCalendar";
import { htmlTable, printHtml } from "@/lib/printDocument";

const MANAGER_ROLES = ["admin", "organization_admin", "head_of_training", "registration_officer", "super_admin"];
const label = (c: string) => c.charAt(0).toUpperCase() + c.slice(1);
const fmt = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
const range = (e: CalendarEvent) => (e.end_date && e.end_date !== e.start_date ? `${fmt(e.start_date)} to ${fmt(e.end_date)}` : fmt(e.start_date));
const monthKey = (d: string) => d.slice(0, 7);
const monthLabel = (k: string) => new Date(`${k}-01T00:00:00`).toLocaleDateString(undefined, { month: "long", year: "numeric" });

const typeVariant = (t: CalendarEventType): "default" | "secondary" | "destructive" | "outline" =>
  t === "exam" || t === "assessment" ? "destructive" : t === "term" || t === "graduation" ? "default" : t === "other" ? "outline" : "secondary";

const emptyForm = { title: "", event_type: "term" as CalendarEventType, academic_year: "", start_date: "", end_date: "", description: "" };

function EventDialog({ editing, open, onClose }: { editing: CalendarEvent | null; open: boolean; onClose: () => void }) {
  const [f, setF] = useState(() => editing
    ? { title: editing.title, event_type: editing.event_type, academic_year: editing.academic_year ?? "", start_date: editing.start_date, end_date: editing.end_date ?? "", description: editing.description ?? "" }
    : emptyForm);
  const save = useSaveCalendarEvent();
  const valid = f.title.trim() && f.start_date && (!f.end_date || f.end_date >= f.start_date);

  const submit = async () => {
    try {
      await save.mutateAsync({
        id: editing?.id, title: f.title.trim(), event_type: f.event_type, academic_year: f.academic_year.trim() || null,
        start_date: f.start_date, end_date: f.end_date || null, description: f.description.trim() || null,
      });
      onClose();
    } catch {
      // the mutation already showed the error toast; keep the dialog open
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>{editing ? "Edit event" : "Add event"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1"><Label>Title</Label><Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><Label>Type</Label>
              <Select value={f.event_type} onValueChange={(v) => setF({ ...f, event_type: v as CalendarEventType })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{CALENDAR_EVENT_TYPES.map((t) => <SelectItem key={t} value={t}>{label(t)}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label>Academic year</Label><Input placeholder="e.g. 2026" value={f.academic_year} onChange={(e) => setF({ ...f, academic_year: e.target.value })} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><Label>Start date</Label><Input type="date" value={f.start_date} onChange={(e) => setF({ ...f, start_date: e.target.value })} /></div>
            <div className="space-y-1"><Label>End date (optional)</Label><Input type="date" min={f.start_date} value={f.end_date} onChange={(e) => setF({ ...f, end_date: e.target.value })} /></div>
          </div>
          <div className="space-y-1"><Label>Description</Label><Textarea rows={3} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={!valid || save.isPending} onClick={submit}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const AcademicCalendar = () => {
  const { role, navItems, groupLabel } = useRoleNavigation();
  const { organizationName, settings } = useOrganizationContext();
  const { data, isLoading } = useAcademicCalendar();
  const remove = useDeleteCalendarEvent();
  const [typeFilter, setTypeFilter] = useState("all");
  const [yearFilter, setYearFilter] = useState("all");
  const [editing, setEditing] = useState<CalendarEvent | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [toDelete, setToDelete] = useState<CalendarEvent | null>(null);
  const canManage = !!role && MANAGER_ROLES.includes(role);

  const years = useMemo(() => Array.from(new Set((data ?? []).map((e) => e.academic_year).filter(Boolean) as string[])).sort().reverse(), [data]);
  const events = useMemo(() => (data ?? []).filter((e) =>
    (typeFilter === "all" || e.event_type === typeFilter) && (yearFilter === "all" || e.academic_year === yearFilter)), [data, typeFilter, yearFilter]);
  const months = useMemo(() => {
    const m = new Map<string, CalendarEvent[]>();
    events.forEach((e) => m.set(monthKey(e.start_date), [...(m.get(monthKey(e.start_date)) ?? []), e]));
    return Array.from(m.entries());
  }, [events]);

  const print = () =>
    printHtml("Academic calendar",
      htmlTable(["Dates", "Event", "Type", "Academic year"], events.map((e) => [range(e), e.title, label(e.event_type), e.academic_year ?? ""])),
      { name: organizationName, logoUrl: settings?.logo_url });

  const openDialog = (e: CalendarEvent | null) => { setEditing(e); setDialogOpen(true); };

  return (
    <DashboardLayout title="Academic Calendar" subtitle="Terms, holidays, registration, exams and graduation" navItems={navItems} groupLabel={groupLabel}>
      <Card className="border-0 shadow-md">
        <CardHeader className="flex-row items-start justify-between space-y-0 gap-2 flex-wrap">
          <div><CardTitle>Calendar</CardTitle><CardDescription>{events.length} event{events.length === 1 ? "" : "s"}</CardDescription></div>
          <div className="flex gap-2 flex-wrap">
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[150px]"><SelectValue placeholder="Type" /></SelectTrigger>
              <SelectContent><SelectItem value="all">All types</SelectItem>{CALENDAR_EVENT_TYPES.map((t) => <SelectItem key={t} value={t}>{label(t)}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={yearFilter} onValueChange={setYearFilter}>
              <SelectTrigger className="w-[150px]"><SelectValue placeholder="Academic year" /></SelectTrigger>
              <SelectContent><SelectItem value="all">All years</SelectItem>{years.map((y) => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent>
            </Select>
            <Button variant="outline" size="sm" disabled={!events.length} onClick={print}><Printer className="h-4 w-4 mr-2" />Print</Button>
            {canManage && <Button size="sm" onClick={() => openDialog(null)}><Plus className="h-4 w-4 mr-2" />Add event</Button>}
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {months.map(([key, list]) => (
            <div key={key} className="space-y-2">
              <h3 className="font-semibold">{monthLabel(key)}</h3>
              {list.map((e) => (
                <div key={e.id} className="border rounded-md p-3 text-sm">
                  <div className="flex justify-between items-center gap-2">
                    <span className="font-medium">{e.title}</span>
                    <div className="flex items-center gap-1">
                      <Badge variant={typeVariant(e.event_type)}>{label(e.event_type)}</Badge>
                      {canManage && (
                        <>
                          <Button variant="ghost" size="icon" aria-label="Edit event" onClick={() => openDialog(e)}><Pencil className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="icon" aria-label="Delete event" onClick={() => setToDelete(e)}><Trash2 className="h-4 w-4" /></Button>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="text-muted-foreground">{range(e)}{e.academic_year ? ` · ${e.academic_year}` : ""}</div>
                  {e.description && <p className="mt-1">{e.description}</p>}
                </div>
              ))}
            </div>
          ))}
          {!isLoading && !events.length && <p className="text-sm text-muted-foreground text-center py-8">No calendar events found.</p>}
        </CardContent>
      </Card>

      {dialogOpen && <EventDialog key={editing?.id ?? "new"} editing={editing} open={dialogOpen} onClose={() => setDialogOpen(false)} />}
      <ConfirmDialog
        open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)} variant="destructive"
        title="Delete event" description={`Delete "${toDelete?.title ?? ""}" from the academic calendar?`} confirmText="Delete"
        isLoading={remove.isPending}
        onConfirm={async () => {
          if (!toDelete) return;
          try { await remove.mutateAsync(toDelete.id); setToDelete(null); } catch { /* error toast shown by the mutation */ }
        }}
      />
    </DashboardLayout>
  );
};

export default AcademicCalendar;
