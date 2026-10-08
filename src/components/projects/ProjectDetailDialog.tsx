import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ButtonSpinner, LoadingSpinner } from "@/components/ui/loading-spinner";
import { Pencil, Plus, Trash2 } from "lucide-react";
import {
  MilestoneStatus, Project, ProjectMilestone, StaffUser, useCurrentUserId, useDeleteMilestone, usePostProjectUpdate,
  useProjectMilestones, useProjectUpdates, useSetMilestoneStatus,
} from "@/hooks/useProjects";
import { MilestoneFormDialog } from "./MilestoneFormDialog";
import { MILESTONE_STATUSES, fmtDate, fmtDateTime, label, money, statusVariant, userName } from "./projectUtils";

interface Props { project: Project | null; onClose: () => void; canManage: boolean; staff: StaffUser[] | undefined }

export const ProjectDetailDialog = ({ project, onClose, canManage, staff }: Props) => {
  const id = project?.id;
  const milestones = useProjectMilestones(id); const updates = useProjectUpdates(id, 100);
  const { data: me } = useCurrentUserId();
  const setStatus = useSetMilestoneStatus(); const del = useDeleteMilestone(); const post = usePostProjectUpdate();
  const [editing, setEditing] = useState<ProjectMilestone | null>(null); const [formOpen, setFormOpen] = useState(false);
  const [toDelete, setToDelete] = useState<ProjectMilestone | null>(null);
  const [note, setNote] = useState(""); const [pct, setPct] = useState("");
  const [noteError, setNoteError] = useState<string | null>(null);

  const latest = (updates.data ?? []).find((u) => u.progress_percent !== null)?.progress_percent ?? null;

  const submitUpdate = async () => {
    if (!project) return;
    if (!note.trim()) return setNoteError("Write a note for the update");
    const n = pct === "" ? null : Number(pct);
    if (n !== null && (Number.isNaN(n) || n < 0 || n > 100)) return setNoteError("Progress must be between 0 and 100");
    setNoteError(null);
    try { await post.mutateAsync({ project_id: project.id, note: note.trim(), progress_percent: n === null ? null : Math.round(n) }); setNote(""); setPct(""); } catch { /* toast shown */ }
  };

  return (
    <Dialog open={!!project} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{project?.title}</DialogTitle>
          <DialogDescription>{project?.project_code} - {project ? `${fmtDate(project.start_date)} to ${fmtDate(project.end_date)}` : ""}</DialogDescription>
        </DialogHeader>
        {project && (
          <div className="space-y-6 text-sm">
            <div className="flex flex-wrap gap-2"><Badge variant={statusVariant(project.status)}>{label(project.status)}</Badge><Badge variant="outline">{label(project.priority)} priority</Badge></div>
            {project.description && <p className="whitespace-pre-wrap">{project.description}</p>}
            <div className="grid gap-3 sm:grid-cols-3">
              <div><div className="text-muted-foreground">Lead</div>{userName(staff, project.lead_user_id)}</div>
              <div><div className="text-muted-foreground">Budget</div>{money(project.budget)}</div>
              <div><div className="text-muted-foreground">Spent</div>{money(project.spent)}</div>
            </div>
            <div className="space-y-1">
              <div className="flex justify-between"><span className="font-medium">Progress</span><span>{latest === null ? "No progress reported" : `${latest}%`}</span></div>
              <Progress value={latest ?? 0} />
            </div>

            <section className="space-y-2">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <h3 className="font-semibold">Milestones</h3>
                {canManage && <Button size="sm" variant="outline" onClick={() => { setEditing(null); setFormOpen(true); }}><Plus className="h-4 w-4 mr-1" />Add milestone</Button>}
              </div>
              {milestones.isLoading ? <LoadingSpinner size="sm" text="Loading milestones" /> : milestones.error ? (
                <p role="alert" className="text-destructive">Could not load milestones: {(milestones.error as Error).message}</p>
              ) : !milestones.data?.length ? <p className="text-muted-foreground">No milestones yet.</p> : (
                <Table>
                  <TableHeader><TableRow><TableHead>Milestone</TableHead><TableHead>Due</TableHead><TableHead>Owner</TableHead><TableHead>Status</TableHead>{canManage && <TableHead className="text-right">Actions</TableHead>}</TableRow></TableHeader>
                  <TableBody>
                    {milestones.data.map((m) => {
                      const canStatus = canManage || m.owner_user_id === me;
                      return (
                        <TableRow key={m.id}>
                          <TableCell className="font-medium">{m.title}</TableCell>
                          <TableCell>{fmtDate(m.due_date)}</TableCell>
                          <TableCell>{userName(staff, m.owner_user_id)}</TableCell>
                          <TableCell>
                            {canStatus ? (
                              <Select value={m.status} onValueChange={(v) => setStatus.mutate({ id: m.id, status: v as MilestoneStatus })}>
                                <SelectTrigger className="h-8 w-[140px]" aria-label={`Status of ${m.title}`}><SelectValue /></SelectTrigger>
                                <SelectContent>{MILESTONE_STATUSES.map((s) => <SelectItem key={s} value={s}>{label(s)}</SelectItem>)}</SelectContent>
                              </Select>
                            ) : <Badge variant={statusVariant(m.status)}>{label(m.status)}</Badge>}
                          </TableCell>
                          {canManage && (
                            <TableCell className="text-right space-x-1">
                              <Button size="icon" variant="ghost" aria-label="Edit milestone" onClick={() => { setEditing(m); setFormOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                              <Button size="icon" variant="ghost" aria-label="Delete milestone" onClick={() => setToDelete(m)}><Trash2 className="h-4 w-4" /></Button>
                            </TableCell>
                          )}
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </section>

            <section className="space-y-3">
              <h3 className="font-semibold">Updates</h3>
              {canManage && (
                <div className="space-y-2 rounded-md border p-3">
                  <Label htmlFor="u-note">Post an update</Label>
                  <Textarea id="u-note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
                  <div className="flex flex-wrap items-end gap-3">
                    <div className="space-y-1"><Label htmlFor="u-pct">Progress % (optional)</Label><Input id="u-pct" type="number" min="0" max="100" className="w-32" value={pct} onChange={(e) => setPct(e.target.value)} /></div>
                    <Button onClick={submitUpdate} disabled={post.isPending}>{post.isPending && <ButtonSpinner />}Post update</Button>
                  </div>
                  {noteError && <p role="alert" className="text-destructive">{noteError}</p>}
                </div>
              )}
              {updates.isLoading ? <LoadingSpinner size="sm" text="Loading updates" /> : updates.error ? (
                <p role="alert" className="text-destructive">Could not load updates: {(updates.error as Error).message}</p>
              ) : !updates.data?.length ? <p className="text-muted-foreground">No updates posted yet.</p> : (
                <ol className="space-y-3 border-l pl-4">
                  {updates.data.map((u) => (
                    <li key={u.id}>
                      <div className="text-xs text-muted-foreground">{fmtDateTime(u.created_at)} - {userName(staff, u.author_id)}{u.progress_percent !== null && ` - ${u.progress_percent}%`}</div>
                      <p className="whitespace-pre-wrap">{u.note}</p>
                    </li>
                  ))}
                </ol>
              )}
            </section>
          </div>
        )}
        {project && <MilestoneFormDialog open={formOpen} onOpenChange={setFormOpen} projectId={project.id} milestone={editing} staff={staff} />}
        <ConfirmDialog
          open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)} title="Delete milestone"
          description={`Delete "${toDelete?.title ?? ""}"? This cannot be undone.`} confirmText="Delete" isLoading={del.isPending}
          onConfirm={async () => { if (!toDelete) return; try { await del.mutateAsync(toDelete.id); setToDelete(null); } catch { /* toast shown */ } }}
        />
      </DialogContent>
    </Dialog>
  );
};
