import { useMemo, useState } from "react";
import { AlertTriangle, ShieldCheck } from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { withRoleAccess } from "@/components/withRoleAccess";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ButtonSpinner, LoadingSpinner } from "@/components/ui/loading-spinner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { ChangeRequestsList } from "@/components/workflow/ChangeRequestsList";
import { useRoleNavigation } from "@/hooks/useRoleNavigation";
import { useRoleOptions } from "@/hooks/useWorkflows";
import { type ChartPerson, useChangeRequests, useOrgChart, usePreview, useReportingActions, useReportingEvents, useReportingGaps } from "@/hooks/useReportingStructure";

const pretty = (r: string) => r.replace(/_/g, " ");
const day = (d: string | null) => (d ? new Date(d).toLocaleDateString() : "-");
const today = () => new Date().toISOString().slice(0, 10);

function PersonNode({ p, byBoss, depth, seen }: { p: ChartPerson; byBoss: Map<string, ChartPerson[]>; depth: number; seen: Set<string> }) {
  const kids = (byBoss.get(p.user_id) ?? []).filter((k) => !seen.has(k.user_id));
  const next = new Set(seen); next.add(p.user_id);
  return (
    <li>
      <div className="flex flex-wrap items-center gap-2 py-1 text-sm">
        <span className="font-medium">{p.name}</span>
        <span className="text-muted-foreground">{p.roles.map(pretty).join(", ")}</span>
        {p.protected && <Badge variant="outline"><ShieldCheck className="mr-1 h-3 w-3" />Super Admin confirms changes</Badge>}
        {!p.active && <Badge variant="destructive">Account not active</Badge>}
        {p.source === "named" && <Badge variant="secondary">Named supervisor{p.named_until ? ` until ${day(p.named_until)}` : ""}</Badge>}
        {p.scheduled.map((s, i) => <Badge key={i} variant="outline">From {day(s.from)}: {s.supervisor}</Badge>)}
      </div>
      {kids.length > 0 && depth < 8 && <ul className="ml-5 border-l pl-3">{kids.map((k) => <PersonNode key={k.user_id} p={k} byBoss={byBoss} depth={depth + 1} seen={next} />)}</ul>}
    </li>
  );
}

function ChartTab() {
  const { data, isLoading, error } = useOrgChart();
  if (isLoading) return <LoadingSpinner text="Loading..." className="py-6" />;
  if (error || !data) return <Alert variant="destructive"><AlertDescription>{(error as Error)?.message ?? "Could not load the chart"}</AlertDescription></Alert>;
  const byBoss = new Map<string, ChartPerson[]>();
  data.people.forEach((p) => p.supervisors.forEach((s) => byBoss.set(s.user_id, [...(byBoss.get(s.user_id) ?? []), p])));
  const roots = data.people.filter((p) => !p.supervisors.length);
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground max-w-3xl">Each person sits under the people their approvals go to. People at the top have no supervisor; the Centre Manager decides for them when a request needs a supervisor.</p>
      <ul className="space-y-1">{roots.map((p) => <PersonNode key={p.user_id} p={p} byBoss={byBoss} depth={0} seen={new Set()} />)}</ul>
    </div>
  );
}

function GapsTab() {
  const { data, isLoading } = useReportingGaps();
  if (isLoading) return <LoadingSpinner text="Loading..." className="py-6" />;
  if (!data?.length) return <Alert><AlertDescription>No gaps: everyone has an active supervisor and every reporting line points at someone in post.</AlertDescription></Alert>;
  return (
    <ul className="space-y-2">
      {data.map((g, i) => <li key={i} className="flex items-start gap-2 rounded border p-3 text-sm"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />{g.message}</li>)}
    </ul>
  );
}

function ChangeTab({ canManage }: { canManage: boolean }) {
  const { data: chart } = useOrgChart();
  const act = useReportingActions();
  const [user, setUser] = useState("");
  const [sup, setSup] = useState("");
  const [from, setFrom] = useState(today());
  const [to, setTo] = useState("");
  const [note, setNote] = useState("");
  const [moveFrom, setMoveFrom] = useState("");
  const [moveTo, setMoveTo] = useState("");
  const [reason, setReason] = useState("");
  const preview = usePreview(user, sup, from, to);
  const people = chart?.people ?? [];
  const me = people.find((p) => p.user_id === user);
  const pv = preview.data;
  const approvers = useMemo(() => Array.from(new Map((pv?.pending_approvals ?? []).flatMap((a) => a.approvers).map((a) => [a.user_id, a])).values()), [pv]);
  if (!canManage) return <Alert><AlertDescription>Only the Organisation Admin changes reporting lines. You can see the chart, gaps and history.</AlertDescription></Alert>;
  return (
    <div className="space-y-6">
      <div className="grid max-w-3xl gap-3 sm:grid-cols-2">
        <div className="space-y-1"><Label>Person</Label>
          <Select value={user} onValueChange={(v) => { setUser(v); setSup(""); }}><SelectTrigger><SelectValue placeholder="Choose person" /></SelectTrigger>
            <SelectContent>{people.map((p) => <SelectItem key={p.user_id} value={p.user_id}>{p.name} ({p.roles.map(pretty).join(", ")})</SelectItem>)}</SelectContent></Select></div>
        <div className="space-y-1"><Label>New supervisor</Label>
          <Select value={sup} onValueChange={setSup} disabled={!user}><SelectTrigger><SelectValue placeholder="Choose supervisor" /></SelectTrigger>
            <SelectContent>{people.filter((p) => p.user_id !== user).map((p) => <SelectItem key={p.user_id} value={p.user_id} disabled={!p.active}>{p.name}{p.active ? "" : " (not active)"}</SelectItem>)}</SelectContent></Select></div>
        <div className="space-y-1"><Label>Starts</Label><Input type="date" min={today()} value={from} onChange={(e) => setFrom(e.target.value)} /></div>
        <div className="space-y-1"><Label>Ends (optional)</Label><Input type="date" min={from} value={to} onChange={(e) => setTo(e.target.value)} /></div>
        <div className="space-y-1 sm:col-span-2"><Label>Reason</Label><Textarea rows={2} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} /></div>
      </div>

      {user && (
        <Card>
          <CardHeader><CardTitle className="text-base">What this changes</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            {preview.isLoading && <LoadingSpinner text="Checking..." />}
            {pv && (
              <>
                <div>Today {me?.name ?? "this person"} reports to: <strong>{pv.current.length ? pv.current.map((c) => c.name).join(", ") : "nobody (the Centre Manager decides)"}</strong>.</div>
                {pv.problem && <Alert variant="destructive"><AlertDescription>{pv.problem}</AlertDescription></Alert>}
                {pv.needs_super_admin && !pv.problem && <Alert><AlertDescription>This person holds a role whose reporting line the Super Admin must confirm. Your change is sent as a request and nothing changes until it is confirmed.</AlertDescription></Alert>}
                {pv.direct_reports.length > 0 && <div>People who report to {me?.name}: {pv.direct_reports.join(", ")}.</div>}
                <div>
                  <div className="mb-1 font-medium">Approvals waiting for {me?.name}'s supervisor</div>
                  {pv.pending_approvals.length ? (
                    <Table>
                      <TableHeader><TableRow><TableHead>Reference</TableHead><TableHead>Request</TableHead><TableHead>Step</TableHead><TableHead>Waiting for</TableHead></TableRow></TableHeader>
                      <TableBody>{pv.pending_approvals.map((a) => <TableRow key={a.task_id}><TableCell>{a.reference}</TableCell><TableCell className="whitespace-normal">{a.title}</TableCell><TableCell>{a.step}</TableCell><TableCell>{a.approvers.map((x) => x.name).join(", ")}</TableCell></TableRow>)}</TableBody>
                    </Table>
                  ) : <p className="text-muted-foreground">None. These keep going to the people they are already waiting for until you move them below; decisions already taken never change.</p>}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      <div className="flex flex-wrap gap-2">
        <Button disabled={!user || !sup || !!pv?.problem || act.setSupervisor.isPending} onClick={async () => { await act.setSupervisor.mutateAsync({ user, supervisor: sup, from, to, note }); setNote(""); }}>{act.setSupervisor.isPending && <ButtonSpinner />}{pv?.needs_super_admin ? "Request change" : "Save change"}</Button>
        <Button variant="outline" disabled={!user || me?.source !== "named" || act.removeSupervisor.isPending} onClick={() => act.removeSupervisor.mutate({ user, from })}>Remove named supervisor</Button>
      </div>

      {user && !!pv?.pending_approvals.length && (
        <Card>
          <CardHeader><CardTitle className="text-base">Move waiting approvals</CardTitle><CardDescription>Moves the approvals above from one person to another. Each move is recorded on the request and in the log.</CardDescription></CardHeader>
          <CardContent className="grid max-w-3xl gap-3 sm:grid-cols-2">
            <div className="space-y-1"><Label>From</Label>
              <Select value={moveFrom} onValueChange={setMoveFrom}><SelectTrigger><SelectValue placeholder="Current approver" /></SelectTrigger><SelectContent>{approvers.map((a) => <SelectItem key={a.user_id} value={a.user_id}>{a.name}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-1"><Label>To</Label>
              <Select value={moveTo} onValueChange={setMoveTo}><SelectTrigger><SelectValue placeholder="New approver" /></SelectTrigger><SelectContent>{people.filter((p) => p.active && p.user_id !== user).map((p) => <SelectItem key={p.user_id} value={p.user_id}>{p.name}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-1 sm:col-span-2"><Label>Reason (required)</Label><Input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} /></div>
            <div className="sm:col-span-2"><Button disabled={!moveFrom || !moveTo || reason.trim().length < 5 || act.reassign.isPending} onClick={async () => { await act.reassign.mutateAsync({ submitter: user, from: moveFrom, to: moveTo, reason }); setReason(""); }}>{act.reassign.isPending && <ButtonSpinner />}Move approvals</Button></div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function LinesTab({ canManage }: { canManage: boolean }) {
  const { data: chart } = useOrgChart();
  const { data: roles } = useRoleOptions();
  const act = useReportingActions();
  const [role, setRole] = useState("");
  const [sup, setSup] = useState("");
  const name = (c: string) => roles?.find((r) => r.role_code === c)?.role_name ?? pretty(c);
  const protectedRoles = chart?.protected_roles ?? [];
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground max-w-3xl">A role line sends approvals to everyone holding the supervisor role at the centre. Lines for the Accountant, Head of Finance and Administration and Centre Manager need the Super Admin to confirm any change.</p>
      <Table>
        <TableHeader><TableRow><TableHead>Role</TableHead><TableHead>Reports to</TableHead>{canManage && <TableHead />}</TableRow></TableHeader>
        <TableBody>{chart?.lines.map((l) => (
          <TableRow key={l.role}><TableCell className="font-medium">{name(l.role)}{protectedRoles.includes(l.role) && <ShieldCheck className="ml-2 inline h-4 w-4 text-muted-foreground" aria-label="Super Admin confirms changes" />}</TableCell><TableCell>{name(l.supervisor_role)}</TableCell>
            {canManage && <TableCell className="text-right"><Button size="sm" variant="ghost" disabled={act.removeLine.isPending} onClick={() => act.removeLine.mutate(l.role)}>Remove</Button></TableCell>}</TableRow>
        ))}</TableBody>
      </Table>
      {canManage && (
        <form className="grid items-end gap-3 rounded-md border p-4 md:grid-cols-3" onSubmit={async (e) => { e.preventDefault(); await act.setLine.mutateAsync({ role, supervisorRole: sup }); setRole(""); setSup(""); }}>
          <div className="space-y-1"><Label>Role</Label><Select value={role} onValueChange={setRole}><SelectTrigger><SelectValue placeholder="Choose role" /></SelectTrigger><SelectContent>{roles?.map((r) => <SelectItem key={r.role_code} value={r.role_code}>{r.role_name}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-1"><Label>Reports to</Label><Select value={sup} onValueChange={setSup}><SelectTrigger><SelectValue placeholder="Choose supervisor role" /></SelectTrigger><SelectContent>{roles?.filter((r) => r.role_code !== role).map((r) => <SelectItem key={r.role_code} value={r.role_code}>{r.role_name}</SelectItem>)}</SelectContent></Select></div>
          <Button type="submit" disabled={!role || !sup || act.setLine.isPending}>Add or change line</Button>
        </form>
      )}
    </div>
  );
}

function RequestsTab({ canManage }: { canManage: boolean }) {
  const { data, isLoading } = useChangeRequests(false, canManage);
  if (!canManage) return <Alert><AlertDescription>Change requests are visible to the Organisation Admin and the Super Admin.</AlertDescription></Alert>;
  if (isLoading) return <LoadingSpinner text="Loading..." className="py-6" />;
  return <ChangeRequestsList rows={data ?? []} canDecide={false} canWithdraw={canManage} />;
}

function HistoryTab() {
  const { data, isLoading } = useReportingEvents();
  if (isLoading) return <LoadingSpinner text="Loading..." className="py-6" />;
  if (!data?.length) return <p className="text-sm text-muted-foreground">Nothing has been changed yet.</p>;
  return (
    <Table>
      <TableHeader><TableRow><TableHead>When</TableHead><TableHead>What</TableHead><TableHead>Who it affects</TableHead><TableHead>By</TableHead></TableRow></TableHeader>
      <TableBody>{data.map((e, i) => <TableRow key={i}><TableCell>{new Date(e.at).toLocaleString()}</TableCell><TableCell>{pretty(e.event)}</TableCell><TableCell>{e.subject ?? "-"}</TableCell><TableCell>{e.by ?? "-"}</TableCell></TableRow>)}</TableBody>
    </Table>
  );
}

function ReportingStructure() {
  const { navItems, groupLabel, role } = useRoleNavigation();
  const canManage = role === "organization_admin" || role === "admin";
  const { data: gaps } = useReportingGaps();
  const { data: reqs } = useChangeRequests(false, canManage);
  const open = (reqs ?? []).filter((r) => r.status === "pending").length;
  return (
    <DashboardLayout title="Reporting structure" subtitle="Who supervises whom, and so who approves what" navItems={navItems} groupLabel={groupLabel}>
      <Card>
        <CardContent className="pt-6">
          <Tabs defaultValue="chart">
            <TabsList className="h-auto flex-wrap justify-start">
              <TabsTrigger value="chart">Organisation chart</TabsTrigger>
              <TabsTrigger value="gaps">Gaps{gaps?.length ? ` (${gaps.length})` : ""}</TabsTrigger>
              <TabsTrigger value="change">Change a supervisor</TabsTrigger>
              <TabsTrigger value="lines">Role lines</TabsTrigger>
              <TabsTrigger value="requests">Requests{open ? ` (${open})` : ""}</TabsTrigger>
              <TabsTrigger value="history">History</TabsTrigger>
            </TabsList>
            <TabsContent value="chart" className="pt-4"><ChartTab /></TabsContent>
            <TabsContent value="gaps" className="pt-4"><GapsTab /></TabsContent>
            <TabsContent value="change" className="pt-4"><ChangeTab canManage={canManage} /></TabsContent>
            <TabsContent value="lines" className="pt-4"><LinesTab canManage={canManage} /></TabsContent>
            <TabsContent value="requests" className="pt-4"><RequestsTab canManage={canManage} /></TabsContent>
            <TabsContent value="history" className="pt-4"><HistoryTab /></TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </DashboardLayout>
  );
}
export default withRoleAccess(ReportingStructure, { requiredRoles: ["organization_admin", "admin", "centre_manager", "hr_officer", "pa_to_centre_manager", "head_of_finance_admin"] });
