import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useRoleNavigation } from "@/hooks/useRoleNavigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus } from "lucide-react";
import { WorkflowEditor } from "@/components/workflow/WorkflowEditor";
import { InstanceDialog, statusVariant } from "@/components/workflow/InstanceDialog";
import {
  ALERT_EVENTS, WorkflowDefinition, WorkflowInstance, useDeleteDefinition, useOrgUsers, useProcessTypes, useRoleOptions,
  useRunEscalation, useSaveWorkflowSettings, useSetDefinitionActive, useWorkflowDefinitions, useWorkflowInstances, useWorkflowSettings,
} from "@/hooks/useWorkflows";

function DefinitionsTab() {
  const { data: defs } = useWorkflowDefinitions();
  const { data: types } = useProcessTypes();
  const { data: roles } = useRoleOptions();
  const { data: users } = useOrgUsers();
  const setActive = useSetDefinitionActive();
  const del = useDeleteDefinition();
  const [editing, setEditing] = useState<WorkflowDefinition | null | "new">(null);
  const typeLabel = (c: string) => types?.find((t) => t.code === c)?.label ?? c;
  const who = (role: string | null, user: string | null) =>
    user ? users?.find((u) => u.user_id === user)?.full_name ?? "A person" : roles?.find((r) => r.role_code === role)?.role_name ?? role ?? "";

  return (
    <div className="space-y-4">
      <div className="flex justify-between gap-3 items-start">
        <p className="text-sm text-muted-foreground max-w-2xl">A process only goes through a workflow once you activate one for it. Until then it keeps working exactly as before. Only one workflow can be active per process.</p>
        <Button className="shrink-0" onClick={() => setEditing("new")}><Plus className="h-4 w-4 mr-2" />New workflow</Button>
      </div>
      {defs?.map((d) => (
        <Card key={d.id}>
          <CardHeader className="flex-row items-start justify-between space-y-0">
            <div><CardTitle className="text-base">{d.name}</CardTitle><CardDescription>{typeLabel(d.process_type)}</CardDescription></div>
            <div className="flex items-center gap-3">
              <Label className="flex items-center gap-2">{d.active ? <Badge>Active</Badge> : <Badge variant="outline">Inactive</Badge>}
                <Switch checked={d.active} disabled={setActive.isPending} onCheckedChange={(active) => setActive.mutate({ id: d.id, active })} /></Label>
              <Button size="sm" variant="outline" onClick={() => setEditing(d)}>Edit</Button>
              <Button size="sm" variant="ghost" disabled={del.isPending} onClick={() => { if (window.confirm(`Delete "${d.name}"?`)) del.mutate(d.id); }}>Delete</Button>
            </div>
          </CardHeader>
          <CardContent>
            <ol className="space-y-1 text-sm">
              {d.workflow_steps.map((s) => (
                <li key={s.step_no}>
                  <span className="font-medium">{s.step_no}. {s.name}</span> · {who(s.approver_role, s.approver_user)}
                  {s.sla_hours ? ` · within ${s.sla_hours}h` : ""}
                  {s.escalate_to_role || s.escalate_to_user ? ` · then ${who(s.escalate_to_role, s.escalate_to_user)}` : ""}
                </li>
              ))}
              {!d.workflow_steps.length && <li className="text-muted-foreground">No steps yet.</li>}
            </ol>
          </CardContent>
        </Card>
      ))}
      {!defs?.length && <p className="text-sm text-muted-foreground text-center py-6">No workflows defined yet.</p>}
      {editing && types && <WorkflowEditor key={editing === "new" ? "new" : editing.id} definition={editing === "new" ? null : editing} processTypes={types} onClose={() => setEditing(null)} />}
    </div>
  );
}

function ActivityTab() {
  const { data } = useWorkflowInstances(false);
  const { data: types } = useProcessTypes();
  const [status, setStatus] = useState("all");
  const [selected, setSelected] = useState<WorkflowInstance | null>(null);
  const rows = (data ?? []).filter((i) => status === "all" || i.status === status);
  return (
    <div className="space-y-4">
      <Select value={status} onValueChange={setStatus}>
        <SelectTrigger className="w-52"><SelectValue /></SelectTrigger>
        <SelectContent>{["all", "in_progress", "awaiting_info", "approved", "rejected", "cancelled"].map((s) => <SelectItem key={s} value={s}>{s === "all" ? "All statuses" : s.replace("_", " ")}</SelectItem>)}</SelectContent>
      </Select>
      <Table>
        <TableHeader><TableRow><TableHead>Request</TableHead><TableHead>Process</TableHead><TableHead>Started</TableHead><TableHead>Step</TableHead><TableHead>Status</TableHead><TableHead /></TableRow></TableHeader>
        <TableBody>
          {rows.map((i) => (
            <TableRow key={i.id}>
              <TableCell className="font-medium">{i.title}</TableCell>
              <TableCell>{types?.find((t) => t.code === i.process_type)?.label ?? i.process_type}</TableCell>
              <TableCell>{new Date(i.started_at).toLocaleDateString()}</TableCell>
              <TableCell>{i.current_step}</TableCell>
              <TableCell><Badge variant={statusVariant(i.status)}>{i.status.replace("_", " ")}</Badge></TableCell>
              <TableCell className="text-right"><Button size="sm" variant="outline" onClick={() => setSelected(i)}>Open</Button></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {!rows.length && <p className="text-sm text-muted-foreground text-center py-6">No requests.</p>}
      {selected && <InstanceDialog instance={selected} canCancel onClose={() => setSelected(null)} />}
    </div>
  );
}

function SettingsTab() {
  const { data } = useWorkflowSettings();
  const save = useSaveWorkflowSettings();
  const escalate = useRunEscalation();
  const [url, setUrl] = useState("");
  const [alerts, setAlerts] = useState<Record<string, { in_app: boolean; email: boolean }>>({});

  useEffect(() => {
    if (!data) return;
    setUrl(data.app_base_url || window.location.origin);
    setAlerts(Object.fromEntries(ALERT_EVENTS.map(({ event }) => {
      const a = data.alerts.find((x) => x.event === event);
      return [event, { in_app: a?.in_app ?? true, email: a?.email ?? true }];
    })));
  }, [data]);

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="space-y-2">
        <Label>Website address used in emails</Label>
        <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://your-vtc.example" />
        <p className="text-xs text-muted-foreground">Approve, reject and "ask for information" links in emails are built from this address. Leave it empty to send emails without action links.</p>
      </div>
      <div className="space-y-3">
        <h4 className="font-medium">Alerts</h4>
        {ALERT_EVENTS.map(({ event, label }) => (
          <div key={event} className="flex items-center justify-between gap-4 border rounded-md p-3">
            <span className="text-sm">{label}</span>
            <div className="flex gap-4">
              <Label className="flex items-center gap-2 text-sm"><Switch checked={alerts[event]?.in_app ?? true} onCheckedChange={(v) => setAlerts({ ...alerts, [event]: { ...alerts[event], in_app: v } })} />In the system</Label>
              <Label className="flex items-center gap-2 text-sm"><Switch checked={alerts[event]?.email ?? true} onCheckedChange={(v) => setAlerts({ ...alerts, [event]: { ...alerts[event], email: v } })} />Email</Label>
            </div>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button disabled={save.isPending} onClick={() => save.mutate({ app_base_url: url, alerts: ALERT_EVENTS.map(({ event }) => ({ event, ...alerts[event] })) })}>Save settings</Button>
        <Button variant="outline" disabled={escalate.isPending} onClick={() => escalate.mutate()}>Check for overdue approvals now</Button>
      </div>
      <p className="text-xs text-muted-foreground">Overdue approvals are escalated when this check runs. To run it automatically, schedule <code>workflow_escalate_overdue</code> (see docs/workflows.md).</p>
    </div>
  );
}

export default function Workflows() {
  const { navItems, groupLabel } = useRoleNavigation();
  return (
    <DashboardLayout title="Workflows" subtitle="Approval steps, escalation and alerts" navItems={navItems} groupLabel={groupLabel}>
      <Card>
        <CardHeader><CardTitle>Workflow designer</CardTitle><CardDescription>Define who approves what, how quickly, and what happens when they do not.</CardDescription></CardHeader>
        <CardContent>
          <Tabs defaultValue="definitions">
            <TabsList><TabsTrigger value="definitions">Workflows</TabsTrigger><TabsTrigger value="activity">Activity</TabsTrigger><TabsTrigger value="settings">Alerts &amp; settings</TabsTrigger></TabsList>
            <TabsContent value="definitions"><DefinitionsTab /></TabsContent>
            <TabsContent value="activity"><ActivityTab /></TabsContent>
            <TabsContent value="settings"><SettingsTab /></TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </DashboardLayout>
  );
}
