import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Plus, Pencil, Trash2, Eye } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { DashboardLayout } from "@/components/DashboardLayout";
import { ProjectFormDialog } from "@/components/projects/ProjectFormDialog";
import { ProjectDetailDialog } from "@/components/projects/ProjectDetailDialog";
import { PROJECT_PRIORITIES, PROJECT_STATUSES, fmtDate, label, money, priorityVariant, statusVariant, userName } from "@/components/projects/projectUtils";
import { useRoleNavigation } from "@/hooks/useRoleNavigation";
import { useUserRole } from "@/hooks/useUserRole";
import { Project, latestProgressByProject, useDeleteProject, useProjectStaff, useProjectUpdates, useProjects } from "@/hooks/useProjects";

const MANAGERS = ["admin", "organization_admin", "projects_coordinator"];

const ProjectsRegister = () => {
  const { navItems, groupLabel } = useRoleNavigation();
  const { role } = useUserRole();
  const canManage = !!role && MANAGERS.includes(role);
  const [params, setParams] = useSearchParams();
  const projects = useProjects(); const updates = useProjectUpdates(); const staff = useProjectStaff();
  const del = useDeleteProject();
  const [status, setStatus] = useState("all"); const [priority, setPriority] = useState("all"); const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false); const [editing, setEditing] = useState<Project | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null); const [toDelete, setToDelete] = useState<Project | null>(null);

  useEffect(() => { const p = params.get("project"); if (p) setDetailId(p); }, [params]);

  const progress = useMemo(() => latestProgressByProject(updates.data), [updates.data]);
  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (projects.data ?? []).filter((p) =>
      (status === "all" || p.status === status) && (priority === "all" || p.priority === priority) &&
      (!q || p.title.toLowerCase().includes(q) || p.project_code.toLowerCase().includes(q)));
  }, [projects.data, status, priority, search]);
  const detail = (projects.data ?? []).find((p) => p.id === detailId) ?? null;
  const closeDetail = () => { setDetailId(null); if (params.has("project")) setParams({}, { replace: true }); };

  return (
    <DashboardLayout title="Projects" subtitle="Centre projects, milestones and progress" navItems={navItems} groupLabel={groupLabel}>
      <Card className="border-0 shadow-md">
        <CardHeader className="flex flex-col gap-3 space-y-0 sm:flex-row sm:items-start sm:justify-between">
          <div><CardTitle>Project register</CardTitle><CardDescription>{rows.length} shown</CardDescription></div>
          {canManage && <Button onClick={() => { setEditing(null); setFormOpen(true); }}><Plus className="h-4 w-4 mr-1" />New project</Button>}
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input placeholder="Search title or code" aria-label="Search projects" value={search} onChange={(e) => setSearch(e.target.value)} className="sm:max-w-xs" />
            <Select value={status} onValueChange={setStatus}><SelectTrigger className="sm:w-[160px]" aria-label="Filter by status"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="all">All statuses</SelectItem>{PROJECT_STATUSES.map((s) => <SelectItem key={s} value={s}>{label(s)}</SelectItem>)}</SelectContent></Select>
            <Select value={priority} onValueChange={setPriority}><SelectTrigger className="sm:w-[160px]" aria-label="Filter by priority"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="all">All priorities</SelectItem>{PROJECT_PRIORITIES.map((s) => <SelectItem key={s} value={s}>{label(s)}</SelectItem>)}</SelectContent></Select>
          </div>
          {projects.isLoading ? <LoadingSpinner text="Loading projects" /> : projects.error ? (
            <p role="alert" className="text-sm text-destructive">Could not load projects: {(projects.error as Error).message}</p>
          ) : (
            <Table>
              <TableHeader><TableRow>
                <TableHead>Code</TableHead><TableHead>Project</TableHead><TableHead>Status</TableHead><TableHead>Priority</TableHead>
                <TableHead>Lead</TableHead><TableHead>Dates</TableHead><TableHead>Progress</TableHead><TableHead>Budget / spent</TableHead><TableHead className="text-right">Actions</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {rows.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>{p.project_code}</TableCell>
                    <TableCell className="font-medium">{p.title}</TableCell>
                    <TableCell><Badge variant={statusVariant(p.status)}>{label(p.status)}</Badge></TableCell>
                    <TableCell><Badge variant={priorityVariant(p.priority)}>{label(p.priority)}</Badge></TableCell>
                    <TableCell>{userName(staff.data, p.lead_user_id)}</TableCell>
                    <TableCell>{fmtDate(p.start_date)} - {fmtDate(p.end_date)}</TableCell>
                    <TableCell className="min-w-[120px]">{progress.has(p.id) ? <div className="flex items-center gap-2"><Progress value={progress.get(p.id)} className="h-2" /><span className="text-xs">{progress.get(p.id)}%</span></div> : <span className="text-muted-foreground">None</span>}</TableCell>
                    <TableCell>{money(p.budget)} / {money(p.spent)}</TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button size="sm" variant="outline" onClick={() => setDetailId(p.id)}><Eye className="h-4 w-4 mr-1" />Open</Button>
                      {canManage && <>
                        <Button size="icon" variant="ghost" aria-label="Edit project" onClick={() => { setEditing(p); setFormOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                        <Button size="icon" variant="ghost" aria-label="Delete project" onClick={() => setToDelete(p)}><Trash2 className="h-4 w-4" /></Button>
                      </>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          {!projects.isLoading && !projects.error && !rows.length && (
            <p className="text-sm text-muted-foreground text-center py-8">{projects.data?.length ? "No projects match the filters." : "No projects have been created yet."}</p>
          )}
        </CardContent>
      </Card>

      <ProjectFormDialog open={formOpen} onOpenChange={setFormOpen} project={editing} staff={staff.data} />
      <ProjectDetailDialog project={detail} onClose={closeDetail} canManage={canManage} staff={staff.data} />
      <ConfirmDialog
        open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)} title="Delete project" variant="destructive"
        description={`Delete "${toDelete?.title ?? ""}" with all its milestones and updates? This cannot be undone.`} confirmText="Delete" isLoading={del.isPending}
        onConfirm={async () => { if (!toDelete) return; try { await del.mutateAsync(toDelete.id); setToDelete(null); } catch { /* toast shown */ } }}
      />
    </DashboardLayout>
  );
};

export default ProjectsRegister;
