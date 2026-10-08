import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ExternalLink } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { DashboardLayout } from "@/components/DashboardLayout";
import { MILESTONE_STATUSES, fmtDate, label, statusVariant, userName } from "@/components/projects/projectUtils";
import { useRoleNavigation } from "@/hooks/useRoleNavigation";
import { useUserRole } from "@/hooks/useUserRole";
import { MilestoneStatus, ProjectMilestone, todayIso, useCurrentUserId, useProjectMilestones, useProjectStaff, useProjects, useSetMilestoneStatus } from "@/hooks/useProjects";

const MANAGERS = ["admin", "organization_admin", "projects_coordinator"];
const GROUPS = ["Overdue", "Due soon", "Upcoming", "Done"] as const;

const ProjectMilestones = () => {
  const { navItems, groupLabel } = useRoleNavigation();
  const { role } = useUserRole(); const canManage = !!role && MANAGERS.includes(role);
  const { data: me } = useCurrentUserId();
  const milestones = useProjectMilestones(); const projects = useProjects(); const staff = useProjectStaff();
  const setStatus = useSetMilestoneStatus();
  const [projectId, setProjectId] = useState("all"); const [status, setStatus2] = useState("all");

  const grouped = useMemo(() => {
    const today = todayIso(); const d = new Date(); d.setDate(d.getDate() + 14);
    const soon = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const g: Record<(typeof GROUPS)[number], ProjectMilestone[]> = { Overdue: [], "Due soon": [], Upcoming: [], Done: [] };
    (milestones.data ?? [])
      .filter((m) => (projectId === "all" || m.project_id === projectId) && (status === "all" || m.status === status))
      .forEach((m) => {
        if (m.status === "done") g.Done.push(m);
        else if (m.due_date < today) g.Overdue.push(m);
        else if (m.due_date <= soon) g["Due soon"].push(m);
        else g.Upcoming.push(m);
      });
    return g;
  }, [milestones.data, projectId, status]);

  const total = GROUPS.reduce((n, k) => n + grouped[k].length, 0);

  return (
    <DashboardLayout title="Project Milestones" subtitle="Every milestone across the centre's projects" navItems={navItems} groupLabel={groupLabel}>
      <div className="space-y-6">
        <div className="flex flex-col gap-2 sm:flex-row">
          <Select value={projectId} onValueChange={setProjectId}><SelectTrigger className="sm:w-[260px]" aria-label="Filter by project"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="all">All projects</SelectItem>{(projects.data ?? []).map((p) => <SelectItem key={p.id} value={p.id}>{p.project_code} {p.title}</SelectItem>)}</SelectContent></Select>
          <Select value={status} onValueChange={setStatus2}><SelectTrigger className="sm:w-[180px]" aria-label="Filter by status"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="all">All statuses</SelectItem>{MILESTONE_STATUSES.map((s) => <SelectItem key={s} value={s}>{label(s)}</SelectItem>)}</SelectContent></Select>
        </div>
        {milestones.isLoading ? <LoadingSpinner text="Loading milestones" /> : milestones.error ? (
          <p role="alert" className="text-sm text-destructive">Could not load milestones: {(milestones.error as Error).message}</p>
        ) : !total ? (
          <p className="text-sm text-muted-foreground text-center py-8">{milestones.data?.length ? "No milestones match the filters." : "No milestones have been added yet."}</p>
        ) : GROUPS.filter((k) => grouped[k].length).map((k) => (
          <Card key={k} className="border-0 shadow-md">
            <CardHeader><CardTitle className={k === "Overdue" ? "text-destructive" : undefined}>{k}</CardTitle><CardDescription>{grouped[k].length} milestone{grouped[k].length === 1 ? "" : "s"}</CardDescription></CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow><TableHead>Milestone</TableHead><TableHead>Project</TableHead><TableHead>Due</TableHead><TableHead>Owner</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Update status</TableHead></TableRow></TableHeader>
                <TableBody>
                  {grouped[k].map((m) => {
                    const canAct = canManage || (!!me && m.owner_user_id === me);
                    return (
                      <TableRow key={m.id}>
                        <TableCell className="font-medium">{m.title}</TableCell>
                        <TableCell><Link className="inline-flex items-center gap-1 text-primary hover:underline" to={`/projects?project=${m.project_id}`}>{m.projects?.project_code} {m.projects?.title}<ExternalLink className="h-3 w-3" /></Link></TableCell>
                        <TableCell>{fmtDate(m.due_date)}</TableCell>
                        <TableCell>{userName(staff.data, m.owner_user_id)}</TableCell>
                        <TableCell><Badge variant={statusVariant(m.status)}>{label(m.status)}</Badge></TableCell>
                        <TableCell className="text-right space-x-1">
                          {canAct && MILESTONE_STATUSES.filter((s) => s !== m.status).map((s) => (
                            <Button key={s} size="sm" variant="outline" disabled={setStatus.isPending} onClick={() => setStatus.mutate({ id: m.id, status: s as MilestoneStatus })}>{label(s)}</Button>
                          ))}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        ))}
      </div>
    </DashboardLayout>
  );
};

export default ProjectMilestones;
