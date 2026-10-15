import { useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useRoleNavigation } from "@/hooks/useRoleNavigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { withRoleAccess } from "@/components/withRoleAccess";
import { TaskDecisionDialog } from "@/components/workflow/TaskDecisionDialog";
import { InstanceDialog } from "@/components/workflow/InstanceDialog";
import { DisplayStatus, displayStatus, statusBadgeVariant, statusLabel } from "@/components/workflow/status";
import { MyTask, WorkflowInstance, useMyTasks, useProcessTypes, useWorkflowInstances } from "@/hooks/useWorkflows";
import { getRoleDisplayName } from "@/lib/roleUtils";

const TABS: { key: string; label: string; match: DisplayStatus[] }[] = [
  { key: "returned", label: "Returned for correction", match: ["returned"] },
  { key: "escalated", label: "Escalated", match: ["pending_higher"] },
  { key: "approved", label: "Approved", match: ["approved", "completed"] },
  { key: "rejected", label: "Rejected", match: ["rejected"] },
];

function PendingTab() {
  const { data: tasks } = useMyTasks();
  const { data: types } = useProcessTypes();
  const [group, setGroup] = useState<"officer" | "type">("officer");
  const [selected, setSelected] = useState<MyTask | null>(null);
  const label = (c: string) => types?.find((t) => t.code === c)?.label ?? c;
  const key = (t: MyTask) => (group === "officer" ? `${t.requested_by ?? "Unknown"}${t.submitter_role ? ` (${getRoleDisplayName(t.submitter_role as never)})` : ""}` : label(t.process_type));
  const groups = [...new Set((tasks ?? []).map(key))].sort();
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Group by</span>
        <Select value={group} onValueChange={(v) => setGroup(v as "officer" | "type")}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="officer">Originating officer</SelectItem><SelectItem value="type">Workflow type</SelectItem></SelectContent>
        </Select>
      </div>
      {!tasks?.length && <p className="text-sm text-muted-foreground text-center py-6">Nothing is waiting for your approval.</p>}
      {groups.map((g) => (
        <div key={g} className="space-y-1">
          <h4 className="font-medium text-sm">{g}</h4>
          <Table>
            <TableHeader><TableRow><TableHead>Reference</TableHead><TableHead>Request</TableHead><TableHead>Type</TableHead><TableHead>Step</TableHead><TableHead>Respond by</TableHead><TableHead /></TableRow></TableHeader>
            <TableBody>
              {tasks?.filter((t) => key(t) === g).map((t) => (
                <TableRow key={t.task_id}>
                  <TableCell className="font-mono text-xs">{t.reference}</TableCell>
                  <TableCell className="font-medium">{t.title}</TableCell>
                  <TableCell>{label(t.process_type)}</TableCell>
                  <TableCell>{t.step_name}{t.escalated && <Badge variant="destructive" className="ml-2">higher level</Badge>}</TableCell>
                  <TableCell>{t.due_at ? new Date(t.due_at).toLocaleString() : "-"}</TableCell>
                  <TableCell className="text-right"><Button size="sm" onClick={() => setSelected(t)}>Review</Button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ))}
      {selected && <TaskDecisionDialog key={selected.task_id} task={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

function ListTab({ match }: { match: DisplayStatus[] }) {
  const { data } = useWorkflowInstances(false);
  const { data: types } = useProcessTypes();
  const [selected, setSelected] = useState<WorkflowInstance | null>(null);
  const rows = (data ?? []).filter((i) => match.includes(displayStatus(i)));
  return (
    <div className="space-y-3">
      <Table>
        <TableHeader><TableRow><TableHead>Reference</TableHead><TableHead>Request</TableHead><TableHead>Type</TableHead><TableHead>Submitted by</TableHead><TableHead>Status</TableHead><TableHead>Next action</TableHead><TableHead /></TableRow></TableHeader>
        <TableBody>
          {rows.map((i) => (
            <TableRow key={i.id}>
              <TableCell className="font-mono text-xs">{i.reference}</TableCell>
              <TableCell className="font-medium">{i.title}</TableCell>
              <TableCell>{types?.find((t) => t.code === i.process_type)?.label ?? i.process_type}</TableCell>
              <TableCell>{i.submitter_role ? getRoleDisplayName(i.submitter_role as never) : ""}</TableCell>
              <TableCell><Badge variant={statusBadgeVariant(i)}>{statusLabel(i)}</Badge></TableCell>
              <TableCell className="text-xs text-muted-foreground max-w-[16rem]">{i.next_action}</TableCell>
              <TableCell className="text-right"><Button size="sm" variant="outline" onClick={() => setSelected(i)}>Open</Button></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {!rows.length && <p className="text-sm text-muted-foreground text-center py-6">Nothing here.</p>}
      {selected && <InstanceDialog instance={selected} canCancel={false} onClose={() => setSelected(null)} />}
    </div>
  );
}

function FinanceApprovalCentre() {
  const { navItems, groupLabel } = useRoleNavigation();
  const { data: tasks } = useMyTasks();
  return (
    <DashboardLayout title="Approval Centre" subtitle="Review, approve, return or reject submissions" navItems={navItems} groupLabel={groupLabel}>
      <Card>
        <CardHeader><CardTitle>Submissions</CardTitle><CardDescription>Open a request to see its documents and history. Every decision is recorded with your name, the time and your comments.</CardDescription></CardHeader>
        <CardContent>
          <Tabs defaultValue="pending">
            <TabsList className="flex-wrap h-auto">
              <TabsTrigger value="pending">Pending{tasks?.length ? ` (${tasks.length})` : ""}</TabsTrigger>
              {TABS.map((t) => <TabsTrigger key={t.key} value={t.key}>{t.label}</TabsTrigger>)}
            </TabsList>
            <TabsContent value="pending"><PendingTab /></TabsContent>
            {TABS.map((t) => <TabsContent key={t.key} value={t.key}><ListTab match={t.match} /></TabsContent>)}
          </Tabs>
        </CardContent>
      </Card>
    </DashboardLayout>
  );
}

export default withRoleAccess(FinanceApprovalCentre, { requiredRoles: ["head_of_finance_admin", "centre_manager", "organization_admin", "admin"] });
