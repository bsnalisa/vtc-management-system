import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useRoleNavigation } from "@/hooks/useRoleNavigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus } from "lucide-react";
import { RequirementChangeRequests } from "@/components/registration/RequirementChangeRequests";
import { useRequirementChangeRequests } from "@/hooks/useEntryRequirements";
import { InstanceDialog } from "@/components/workflow/InstanceDialog";
import { TaskDecisionDialog } from "@/components/workflow/TaskDecisionDialog";
import { SubmitRequestDialog, WorkflowAttachments } from "@/components/workflow/WorkflowAttachments";
import { statusBadgeVariant, statusLabel } from "@/components/workflow/status";
import { getRoleDisplayName } from "@/lib/roleUtils";
import {
  MyTask, useAvailableProcesses, WorkflowInstance, useActOnTask, useDelegations, useEndDelegation, useMyTasks, useOrgUsers, useProcessTypes,
  useProvideInfo, useSaveDelegation, useStartRequest, useWorkflowInstances,
} from "@/hooks/useWorkflows";

const REQUIREMENT_APPROVER_ROLES = ["head_of_trainee_support", "super_admin"];

function ToApproveTab() {
  const navigate = useNavigate();
  const { role } = useRoleNavigation();
  const canApproveRequirements = !!role && REQUIREMENT_APPROVER_ROLES.includes(role);
  const { data } = useMyTasks();
  const { data: types } = useProcessTypes();
  const [selected, setSelected] = useState<MyTask | null>(null);
  return (
    <div className="space-y-4">
      {canApproveRequirements && <RequirementChangeRequests canReview hideWhenEmpty title="Entry requirement changes to approve" />}
      <Table>
        <TableHeader><TableRow><TableHead>Reference</TableHead><TableHead>Request</TableHead><TableHead>Type</TableHead><TableHead>Step</TableHead><TableHead>Respond by</TableHead><TableHead /></TableRow></TableHeader>
        <TableBody>
          {data?.map((t) => (
            <TableRow key={t.task_id}>
              <TableCell className="font-mono text-xs">{t.reference}</TableCell>
              <TableCell className="font-medium">{t.title}<div className="text-xs text-muted-foreground">from {t.requested_by ?? "unknown"}{t.submitter_role ? ` (${getRoleDisplayName(t.submitter_role as never)})` : ""}</div></TableCell>
              <TableCell>{types?.find((p) => p.code === t.process_type)?.label ?? t.process_type}</TableCell>
              <TableCell>{t.step_name}{t.delegated && <Badge variant="outline" className="ml-2">covering</Badge>}{t.escalated && <Badge variant="destructive" className="ml-2">higher level</Badge>}</TableCell>
              <TableCell>{t.due_at ? new Date(t.due_at).toLocaleString() : "-"}</TableCell>
              <TableCell className="text-right"><Button size="sm" onClick={() => (t.process_type === "purchase_requisition" ? navigate(`/requisitions/instance/${t.instance_id}`) : setSelected(t))}>{t.process_type === "purchase_requisition" ? "Open requisition" : "Decide"}</Button></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {!data?.length && !canApproveRequirements && <p className="text-sm text-muted-foreground text-center py-6">Nothing is waiting for your approval.</p>}
      {!data?.length && canApproveRequirements && <p className="text-sm text-muted-foreground text-center py-2">No workflow requests are waiting for your approval.</p>}
      {selected && <TaskDecisionDialog key={selected.task_id} task={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

function StartRequestDialog() {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [process, setProcess] = useState("");
  const [draft, setDraft] = useState<{ id: string; title: string } | null>(null);
  const { data: types } = useAvailableProcesses();
  const start = useStartRequest();
  const needsDocs = types?.find((t) => t.code === process)?.requires_documents;
  const create = async (submit: boolean) => {
    const r = await start.mutateAsync({ title, description, process, submit });
    setOpen(false);
    if (!submit) setDraft({ id: r.id, title });
    setTitle(""); setDescription(""); setProcess("");
  };
  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />New request</Button></DialogTrigger>
        <DialogContent>
          <DialogHeader><DialogTitle>Request approval</DialogTitle></DialogHeader>
          <form className="space-y-3" onSubmit={async (e) => { e.preventDefault(); await create(!needsDocs); }}>
            <div className="space-y-1"><Label>Kind of request</Label>
              <Select value={process} onValueChange={setProcess}><SelectTrigger><SelectValue placeholder="Choose the kind of request" /></SelectTrigger>
                <SelectContent>{types?.map((t) => <SelectItem key={t.code} value={t.code}>{t.label}</SelectItem>)}</SelectContent></Select>
              <p className="text-xs text-muted-foreground">It goes to your direct supervisor.{needsDocs ? " This kind needs supporting documents, which you attach next." : ""}</p></div>
            <div className="space-y-1"><Label>What do you need approved?</Label><Input required value={title} onChange={(e) => setTitle(e.target.value)} /></div>
            <div className="space-y-1"><Label>Details</Label><Textarea rows={5} value={description} onChange={(e) => setDescription(e.target.value)} /></div>
            <div className="flex gap-2">
              <Button type="submit" className="flex-1" disabled={start.isPending || !title.trim() || !process}>{needsDocs ? "Continue: attach documents" : "Send for approval"}</Button>
              {!needsDocs && <Button type="button" variant="outline" disabled={start.isPending || !title.trim() || !process} onClick={() => create(false)}>Save as draft</Button>}
            </div>
          </form>
        </DialogContent>
      </Dialog>
      {draft && <SubmitRequestDialog instanceId={draft.id} title={draft.title} onClose={() => setDraft(null)} />}
    </>
  );
}

function MyRequestsTab() {
  const navigate = useNavigate();
  const { data } = useWorkflowInstances(true);
  const provide = useProvideInfo();
  const [attachFor, setAttachFor] = useState<WorkflowInstance | null>(null);
  const [selected, setSelected] = useState<WorkflowInstance | null>(null);
  const [reply, setReply] = useState<WorkflowInstance | null>(null);
  const [text, setText] = useState("");
  return (
    <div className="space-y-4">
      <div className="flex justify-end"><StartRequestDialog /></div>
      <Table>
        <TableHeader><TableRow><TableHead>Reference</TableHead><TableHead>Request</TableHead><TableHead>Started</TableHead><TableHead>Status</TableHead><TableHead>Next action</TableHead><TableHead /></TableRow></TableHeader>
        <TableBody>
          {data?.map((i) => (
            <TableRow key={i.id}>
              <TableCell className="font-mono text-xs">{i.reference}</TableCell>
              <TableCell className="font-medium">{i.title}</TableCell>
              <TableCell>{new Date(i.started_at).toLocaleDateString()}</TableCell>
              <TableCell><Badge variant={statusBadgeVariant(i)}>{statusLabel(i)}</Badge></TableCell>
              <TableCell className="text-xs text-muted-foreground max-w-[18rem]">{i.next_action}</TableCell>
              <TableCell className="text-right space-x-2">
                {i.status === "draft" && <Button size="sm" onClick={() => setAttachFor(i)}>Attach and submit</Button>}
                {i.status === "awaiting_info" && <Button size="sm" onClick={() => (i.process_type === "purchase_requisition" ? navigate(`/requisitions/instance/${i.id}`) : (setReply(i), setText("")))}>Correct and resubmit</Button>}
                <Button size="sm" variant="outline" onClick={() => setSelected(i)}>Details</Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {!data?.length && <p className="text-sm text-muted-foreground text-center py-6">You have not made any requests.</p>}
      {selected && <InstanceDialog instance={selected} canCancel onClose={() => setSelected(null)} />}
      {attachFor && <SubmitRequestDialog instanceId={attachFor.id} title={attachFor.title} onClose={() => setAttachFor(null)} />}
      {reply && (
        <Dialog open onOpenChange={(o) => !o && setReply(null)}>
          <DialogContent>
            <DialogHeader><DialogTitle>Correct and resubmit</DialogTitle></DialogHeader>
            <p className="text-sm text-muted-foreground">{reply.title}</p>
            <Textarea rows={4} value={text} onChange={(e) => setText(e.target.value)} />
            <WorkflowAttachments instanceId={reply.id} canEdit />
            <Button disabled={!text.trim() || provide.isPending} onClick={async () => { await provide.mutateAsync({ id: reply.id, comment: text.trim() }); setReply(null); }}>Resubmit</Button>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

const toLocalInput = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);

function DelegationTab() {
  const { data: delegations } = useDelegations();
  const { data: users } = useOrgUsers();
  const { data: types } = useProcessTypes();
  const save = useSaveDelegation();
  const end = useEndDelegation();
  const [to, setTo] = useState("");
  const [process, setProcess] = useState("all");
  const [from, setFrom] = useState(toLocalInput(new Date()));
  const [until, setUntil] = useState(toLocalInput(new Date(Date.now() + 7 * 86400000)));
  const { data: me } = useQuery({ queryKey: ["auth-user-id"], queryFn: async () => (await supabase.auth.getUser()).data.user?.id ?? null });
  const name = (id: string) => users?.find((u) => u.user_id === id)?.full_name ?? "A colleague";
  const invalid = !to || !from || !until || new Date(until) <= new Date(from);

  return (
    <div className="space-y-6">
      <form className="grid gap-3 md:grid-cols-5 items-end border rounded-md p-4" onSubmit={async (e) => {
        e.preventDefault();
        await save.mutateAsync({ to_user: to, process_type: process === "all" ? null : process, starts_at: new Date(from).toISOString(), ends_at: new Date(until).toISOString() });
        setTo("");
      }}>
        <div className="space-y-1 md:col-span-2"><Label>Delegate my approvals to</Label>
          <Select value={to} onValueChange={setTo}><SelectTrigger><SelectValue placeholder="Choose a colleague" /></SelectTrigger>
            <SelectContent>{users?.filter((u) => u.user_id !== me).map((u) => <SelectItem key={u.user_id} value={u.user_id}>{u.full_name}</SelectItem>)}</SelectContent></Select></div>
        <div className="space-y-1"><Label>From</Label><Input type="datetime-local" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
        <div className="space-y-1"><Label>Until</Label><Input type="datetime-local" value={until} onChange={(e) => setUntil(e.target.value)} /></div>
        <div className="space-y-1"><Label>For</Label>
          <Select value={process} onValueChange={setProcess}><SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="all">All approvals</SelectItem>{types?.map((t) => <SelectItem key={t.code} value={t.code}>{t.label}</SelectItem>)}</SelectContent></Select></div>
        {until && from && new Date(until) <= new Date(from) && <p className="text-xs text-destructive md:col-span-5">The end must be after the start.</p>}
        <div className="md:col-span-5"><Button type="submit" disabled={invalid || save.isPending}>Schedule delegation</Button></div>
      </form>
      <Table>
        <TableHeader><TableRow><TableHead>From</TableHead><TableHead>To</TableHead><TableHead>Covers</TableHead><TableHead>Period</TableHead><TableHead /></TableRow></TableHeader>
        <TableBody>
          {delegations?.map((d) => {
            const now = Date.now();
            const state = now < new Date(d.starts_at).getTime() ? "scheduled" : now > new Date(d.ends_at).getTime() ? "ended" : "active";
            return (
              <TableRow key={d.id}>
                <TableCell>{name(d.from_user)}</TableCell><TableCell>{name(d.to_user)}</TableCell>
                <TableCell>{d.process_type ? types?.find((t) => t.code === d.process_type)?.label : "All approvals"}</TableCell>
                <TableCell>{new Date(d.starts_at).toLocaleString()} to {new Date(d.ends_at).toLocaleString()} <Badge variant={state === "active" ? "default" : "outline"} className="ml-1">{state}</Badge></TableCell>
                <TableCell className="text-right"><Button size="sm" variant="ghost" onClick={() => end.mutate(d.id)}>Remove</Button></TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      {!delegations?.length && <p className="text-sm text-muted-foreground text-center py-4">No delegations.</p>}
    </div>
  );
}

export default function MyApprovals() {
  const { navItems, groupLabel } = useRoleNavigation();
  const { data: tasks } = useMyTasks();
  const { role } = useRoleNavigation();
  const { data: pendingRequirements } = useRequirementChangeRequests("pending");
  const approver = !!role && REQUIREMENT_APPROVER_ROLES.includes(role);
  const toApprove = (tasks?.length ?? 0) + (approver ? pendingRequirements?.length ?? 0 : 0);
  return (
    <DashboardLayout title="My Approvals" subtitle="Requests waiting for you, and requests you have made" navItems={navItems} groupLabel={groupLabel}>
      <Card>
        <CardHeader><CardTitle>Approvals</CardTitle><CardDescription>Decide requests here or from the link in the email. Going away? Delegate your approvals to a colleague for a set period.</CardDescription></CardHeader>
        <CardContent>
          <Tabs defaultValue="approve">
            <TabsList>
              <TabsTrigger value="approve">To approve{toApprove ? ` (${toApprove})` : ""}</TabsTrigger>
              <TabsTrigger value="mine">My requests</TabsTrigger>
              <TabsTrigger value="delegation">Delegation</TabsTrigger>
            </TabsList>
            <TabsContent value="approve"><ToApproveTab /></TabsContent>
            <TabsContent value="mine">
              {!approver && <div className="mb-4"><RequirementChangeRequests canReview={false} hideWhenEmpty title="Your entry requirement changes awaiting approval" /></div>}
              <MyRequestsTab />
            </TabsContent>
            <TabsContent value="delegation"><DelegationTab /></TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </DashboardLayout>
  );
}
