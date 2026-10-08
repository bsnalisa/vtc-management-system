import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ButtonSpinner } from "@/components/ui/loading-spinner";
import { Project, ProjectInput, ProjectPriority, ProjectStatus, StaffUser, useSaveProject } from "@/hooks/useProjects";
import { PROJECT_PRIORITIES, PROJECT_STATUSES, label } from "./projectUtils";

const NONE = "none";
const blank = { title: "", description: "", status: "planned" as ProjectStatus, priority: "medium" as ProjectPriority, start_date: "", end_date: "", budget: "", spent: "0", lead: NONE };

interface Props { open: boolean; onOpenChange: (o: boolean) => void; project: Project | null; staff: StaffUser[] | undefined }

export const ProjectFormDialog = ({ open, onOpenChange, project, staff }: Props) => {
  const save = useSaveProject();
  const [f, setF] = useState(blank);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setF(project ? {
      title: project.title, description: project.description ?? "", status: project.status, priority: project.priority,
      start_date: project.start_date ?? "", end_date: project.end_date ?? "", budget: project.budget === null ? "" : String(project.budget),
      spent: String(project.spent ?? 0), lead: project.lead_user_id ?? NONE,
    } : blank);
  }, [open, project]);

  const set = <K extends keyof typeof blank>(k: K, v: (typeof blank)[K]) => setF((p) => ({ ...p, [k]: v }));

  const submit = async () => {
    if (!f.title.trim()) return setError("Title is required");
    if (f.start_date && f.end_date && f.end_date < f.start_date) return setError("End date cannot be before the start date");
    const budget = f.budget === "" ? null : Number(f.budget); const spent = Number(f.spent || 0);
    if ((budget !== null && (Number.isNaN(budget) || budget < 0)) || Number.isNaN(spent) || spent < 0) return setError("Budget and spent must be zero or more");
    setError(null);
    const values: ProjectInput = {
      title: f.title.trim(), description: f.description.trim() || null, status: f.status, priority: f.priority,
      start_date: f.start_date || null, end_date: f.end_date || null, budget, spent, lead_user_id: f.lead === NONE ? null : f.lead,
    };
    try { await save.mutateAsync({ id: project?.id, values }); onOpenChange(false); } catch { /* the mutation shows the error toast */ }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{project ? "Edit project" : "New project"}</DialogTitle>
          <DialogDescription>{project ? project.project_code : "A project code is assigned when you save."}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="space-y-1"><Label htmlFor="p-title">Title</Label><Input id="p-title" value={f.title} onChange={(e) => set("title", e.target.value)} /></div>
          <div className="space-y-1"><Label htmlFor="p-desc">Description</Label><Textarea id="p-desc" rows={3} value={f.description} onChange={(e) => set("description", e.target.value)} /></div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1"><Label>Status</Label>
              <Select value={f.status} onValueChange={(v) => set("status", v as ProjectStatus)}><SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{PROJECT_STATUSES.map((s) => <SelectItem key={s} value={s}>{label(s)}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-1"><Label>Priority</Label>
              <Select value={f.priority} onValueChange={(v) => set("priority", v as ProjectPriority)}><SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{PROJECT_PRIORITIES.map((s) => <SelectItem key={s} value={s}>{label(s)}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-1"><Label htmlFor="p-start">Start date</Label><Input id="p-start" type="date" value={f.start_date} onChange={(e) => set("start_date", e.target.value)} /></div>
            <div className="space-y-1"><Label htmlFor="p-end">End date</Label><Input id="p-end" type="date" value={f.end_date} onChange={(e) => set("end_date", e.target.value)} /></div>
            <div className="space-y-1"><Label htmlFor="p-budget">Budget</Label><Input id="p-budget" type="number" min="0" step="0.01" value={f.budget} onChange={(e) => set("budget", e.target.value)} /></div>
            <div className="space-y-1"><Label htmlFor="p-spent">Spent</Label><Input id="p-spent" type="number" min="0" step="0.01" value={f.spent} onChange={(e) => set("spent", e.target.value)} /></div>
          </div>
          <div className="space-y-1"><Label>Project lead</Label>
            <Select value={f.lead} onValueChange={(v) => set("lead", v)}><SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value={NONE}>No lead</SelectItem>{(staff ?? []).map((u) => <SelectItem key={u.user_id} value={u.user_id}>{u.full_name || u.email}</SelectItem>)}</SelectContent></Select></div>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={save.isPending}>{save.isPending && <ButtonSpinner />}Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
