import { useState } from "react";
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
import { InstanceDialog, statusVariant } from "@/components/workflow/InstanceDialog";
import {
  MyTask, WorkflowInstance, useActOnTask, useDelegations, useEndDelegation, useMyTasks, useOrgUsers, useProcessTypes,
  useProvideInfo, useSaveDelegation, useStartRequest, useWorkflowInstances,
} from "@/hooks/useWorkflows";

function TaskDialog({ task, onClose }: { task: MyTask; onClose: () => void }) {
  const act = useActOnTask();
  const [comment, setComment] = useState("");
  const go = async (action: "approve" | "reject" | "request_info") => {
    await act.mutateAsync({ task: task.task_id, action, comment: comment.trim() });
    onClose();
  };
  const needsComment = !comment.trim();
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{task.title}</DialogTitle></DialogHeader>
        <div className="space-y-4 text-sm">
          <div className="text-muted-foreground">Step {task.step_no}: {task.step_name} · requested by {task.requested_by ?? "unknown"}{task.due_at ? ` · respond by ${new Date(task.due_at).toLocaleString()}` : ""}</div>
          {task.delegated && <Badge variant="outline">You are covering for a colleague</Badge>}
          {task.escalated && <Badge variant="destructive" className="ml-2">Escalated: overdue</Badge>}
          <dl className="space-y-2">
            {Object.entries(task.summary).map(([k, v]) => (<div key={k}><dt className="text-muted-foreground">{k}</dt><dd className="whitespace-pre-wrap">{v}</dd></div>))}
          </dl>
          <div className="space-y-1"><Label>Comment (required to reject or ask for information)</Label><Textarea value={comment} onChange={(e) => setComment(e.target.value)} /></div>
          <div className="flex flex-wrap gap-2">
            <Button disabled={act.isPending} onClick={() => go("approve")}>Approve</Button>
            <Button variant="outline" disabled={act.isPending || needsComment} title={needsComment ? "Say what you need to know" : ""} onClick={() => go("request_info")}>Ask for information</Button>
            <Button variant="destructive" disabled={act.isPending || needsComment} title={needsComment ? "Give a reason" : ""} onClick={() => go("reject")}>Reject</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ToApproveTab() {
  const { data } = useMyTasks();
  const { data: types } = useProcessTypes();
  const [selected, setSelected] = useState<MyTask | null>(null);
  return (
    <div className="space-y-4">
      <Table>
        <TableHeader><TableRow><TableHead>Request</TableHead><TableHead>Type</TableHead><TableHead>Step</TableHead><TableHead>Respond by</TableHead><TableHead /></TableRow></TableHeader>
        <TableBody>
          {data?.map((t) => (
            <TableRow key={t.task_id}>
              <TableCell className="font-medium">{t.title}<div className="text-xs text-muted-foreground">from {t.requested_by ?? "unknown"}</div></TableCell>
              <TableCell>{types?.find((p) => p.code === t.process_type)?.label ?? t.process_type}</TableCell>
              <TableCell>{t.step_name}{t.delegated && <Badge variant="outline" className="ml-2">covering</Badge>}{t.escalated && <Badge variant="destructive" className="ml-2">overdue</Badge>}</TableCell>
              <TableCell>{t.due_at ? new Date(t.due_at).toLocaleString() : "-"}</TableCell>
              <TableCell className="text-right"><Button size="sm" onClick={() => setSelected(t)}>Decide</Button></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {!data?.length && <p className="text-sm text-muted-foreground text-center py-6">Nothing is waiting for your approval.</p>}
      {selected && <TaskDialog key={selected.task_id} task={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

function StartRequestDialog() {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const start = useStartRequest();
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />New request</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Request approval</DialogTitle></DialogHeader>
        <form className="space-y-3" onSubmit={async (e) => { e.preventDefault(); await start.mutateAsync({ title, description }); setTitle(""); setDescription(""); setOpen(false); }}>
          <div className="space-y-1"><Label>What do you need approved?</Label><Input required value={title} onChange={(e) => setTitle(e.target.value)} /></div>
          <div className="space-y-1"><Label>Details</Label><Textarea rows={5} value={description} onChange={(e) => setDescription(e.target.value)} /></div>
          <Button type="submit" className="w-full" disabled={start.isPending}>Send for approval</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function MyRequestsTab() {
  const { data } = useWorkflowInstances(true);
  const provide = useProvideInfo();
  const [selected, setSelected] = useState<WorkflowInstance | null>(null);
  const [reply, setReply] = useState<WorkflowInstance | null>(null);
  const [text, setText] = useState("");
  return (
    <div className="space-y-4">
      <div className="flex justify-end"><StartRequestDialog /></div>
      <Table>
        <TableHeader><TableRow><TableHead>Request</TableHead><TableHead>Started</TableHead><TableHead>Status</TableHead><TableHead /></TableRow></TableHeader>
        <TableBody>
          {data?.map((i) => (
            <TableRow key={i.id}>
              <TableCell className="font-medium">{i.title}</TableCell>
              <TableCell>{new Date(i.started_at).toLocaleDateString()}</TableCell>
              <TableCell><Badge variant={statusVariant(i.status)}>{i.status === "awaiting_info" ? "needs your reply" : i.status.replace("_", " ")}</Badge></TableCell>
              <TableCell className="text-right space-x-2">
                {i.status === "awaiting_info" && <Button size="sm" onClick={() => { setReply(i); setText(""); }}>Reply</Button>}
                <Button size="sm" variant="outline" onClick={() => setSelected(i)}>Details</Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {!data?.length && <p className="text-sm text-muted-foreground text-center py-6">You have not made any requests.</p>}
      {selected && <InstanceDialog instance={selected} canCancel onClose={() => setSelected(null)} />}
      {reply && (
        <Dialog open onOpenChange={(o) => !o && setReply(null)}>
          <DialogContent>
            <DialogHeader><DialogTitle>Reply to the approver</DialogTitle></DialogHeader>
            <p className="text-sm text-muted-foreground">{reply.title}</p>
            <Textarea rows={4} value={text} onChange={(e) => setText(e.target.value)} />
            <Button disabled={!text.trim() || provide.isPending} onClick={async () => { await provide.mutateAsync({ id: reply.id, comment: text.trim() }); setReply(null); }}>Send reply</Button>
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
  return (
    <DashboardLayout title="My Approvals" subtitle="Requests waiting for you, and requests you have made" navItems={navItems} groupLabel={groupLabel}>
      <Card>
        <CardHeader><CardTitle>Approvals</CardTitle><CardDescription>Decide requests here or from the link in the email. Going away? Delegate your approvals to a colleague for a set period.</CardDescription></CardHeader>
        <CardContent>
          <Tabs defaultValue="approve">
            <TabsList>
              <TabsTrigger value="approve">To approve{tasks?.length ? ` (${tasks.length})` : ""}</TabsTrigger>
              <TabsTrigger value="mine">My requests</TabsTrigger>
              <TabsTrigger value="delegation">Delegation</TabsTrigger>
            </TabsList>
            <TabsContent value="approve"><ToApproveTab /></TabsContent>
            <TabsContent value="mine"><MyRequestsTab /></TabsContent>
            <TabsContent value="delegation"><DelegationTab /></TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </DashboardLayout>
  );
}
