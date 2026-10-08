import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ButtonSpinner } from "@/components/ui/loading-spinner";
import { MilestoneStatus, ProjectMilestone, StaffUser, useSaveMilestone } from "@/hooks/useProjects";
import { MILESTONE_STATUSES, label } from "./projectUtils";

const NONE = "none";
interface Props { open: boolean; onOpenChange: (o: boolean) => void; projectId: string; milestone: ProjectMilestone | null; staff: StaffUser[] | undefined }

export const MilestoneFormDialog = ({ open, onOpenChange, projectId, milestone, staff }: Props) => {
  const save = useSaveMilestone();
  const [f, setF] = useState({ title: "", description: "", due_date: "", status: "pending" as MilestoneStatus, owner: NONE });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setF(milestone
      ? { title: milestone.title, description: milestone.description ?? "", due_date: milestone.due_date, status: milestone.status, owner: milestone.owner_user_id ?? NONE }
      : { title: "", description: "", due_date: "", status: "pending", owner: NONE });
  }, [open, milestone]);

  const submit = async () => {
    if (!f.title.trim()) return setError("Title is required");
    if (!f.due_date) return setError("Due date is required");
    setError(null);
    try {
      await save.mutateAsync({
        id: milestone?.id, project_id: projectId,
        values: { title: f.title.trim(), description: f.description.trim() || null, due_date: f.due_date, status: f.status, owner_user_id: f.owner === NONE ? null : f.owner },
      });
      onOpenChange(false);
    } catch { /* the mutation shows the error toast */ }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{milestone ? "Edit milestone" : "Add milestone"}</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <div className="space-y-1"><Label htmlFor="m-title">Title</Label><Input id="m-title" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></div>
          <div className="space-y-1"><Label htmlFor="m-desc">Description</Label><Textarea id="m-desc" rows={2} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1"><Label htmlFor="m-due">Due date</Label><Input id="m-due" type="date" value={f.due_date} onChange={(e) => setF({ ...f, due_date: e.target.value })} /></div>
            <div className="space-y-1"><Label>Status</Label>
              <Select value={f.status} onValueChange={(v) => setF({ ...f, status: v as MilestoneStatus })}><SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{MILESTONE_STATUSES.map((s) => <SelectItem key={s} value={s}>{label(s)}</SelectItem>)}</SelectContent></Select></div>
          </div>
          <div className="space-y-1"><Label>Owner</Label>
            <Select value={f.owner} onValueChange={(v) => setF({ ...f, owner: v })}><SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value={NONE}>No owner</SelectItem>{(staff ?? []).map((u) => <SelectItem key={u.user_id} value={u.user_id}>{u.full_name || u.email}</SelectItem>)}</SelectContent></Select></div>
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
