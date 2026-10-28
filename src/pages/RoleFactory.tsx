import { useEffect, useMemo, useState } from "react";
import { Sparkles, Wand2 } from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { withRoleAccess } from "@/components/withRoleAccess";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ButtonSpinner, LoadingSpinner } from "@/components/ui/loading-spinner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { AssignmentsPanel } from "@/components/rolefactory/AssignmentsPanel";
import { useRoleNavigation } from "@/hooks/useRoleNavigation";
import { type Capability, type FactoryRole, type FactoryVersion, useCatalogue, useFactoryActions, useFactoryEvents, useFactoryOverview, useOrganizations, useRoleOptionsForFactory } from "@/hooks/useRoleFactory";

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").replace(/^[^a-z]+/, "").slice(0, 40);
const METHOD: Record<string, string> = { ai: "Proposed by AI", rules: "Proposed by the built-in rules (no AI)", manual: "Chosen by hand" };
const STATUS: Record<string, string> = { draft: "Draft", pending_review: "Waiting for review", approved: "Approved", rejected: "Rejected", superseded: "Replaced", active: "Active", retired: "Retired" };
const MIN = 80;

function CapabilityPicker({ catalogue, value, onChange, proposal, disabled }: { catalogue: Capability[]; value: string[]; onChange: (v: string[]) => void; proposal: string[]; disabled?: boolean }) {
  const areas = useMemo(() => Array.from(new Set(catalogue.map((c) => c.area))), [catalogue]);
  const toggle = (code: string) => onChange(value.includes(code) ? value.filter((c) => c !== code) : [...value, code]);
  return (
    <div className="space-y-3">
      {areas.map((area) => (
        <div key={area}>
          <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{area}</div>
          <div className="space-y-1">
            {catalogue.filter((c) => c.area === area).map((c) => (
              <label key={c.code} className="flex items-start gap-2 rounded border p-2 text-sm">
                <Checkbox checked={value.includes(c.code)} disabled={disabled} onCheckedChange={() => toggle(c.code)} className="mt-0.5" />
                <span className="space-y-0.5">
                  <span className="font-medium">{c.label}</span>
                  {c.sensitive && <Badge variant="destructive" className="ml-2">Sensitive</Badge>}
                  {proposal.includes(c.code) && <Badge variant="secondary" className="ml-2">Proposed</Badge>}
                  <span className="block text-muted-foreground">{c.description}</span>
                </span>
              </label>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function VersionPanel({ role, v, catalogue }: { role: FactoryRole; v: FactoryVersion; catalogue: Capability[] }) {
  const act = useFactoryActions();
  const { data: roleOptions } = useRoleOptionsForFactory();
  const [desc, setDesc] = useState(v.job_description);
  const [reports, setReports] = useState(v.reports_to_role ?? "");
  const [caps, setCaps] = useState<string[]>(v.selected_capabilities);
  const [note, setNote] = useState("");
  const [ack, setAck] = useState(false);
  useEffect(() => { setDesc(v.job_description); setReports(v.reports_to_role ?? ""); setCaps(v.selected_capabilities); }, [v.id, v.job_description, v.reports_to_role, v.selected_capabilities]);
  const draft = v.status === "draft";
  const edited = v.proposal_method && JSON.stringify([...v.proposal_capabilities].sort()) !== JSON.stringify([...v.selected_capabilities].sort());
  const sensitiveSelected = catalogue.some((c) => c.sensitive && (draft ? caps : v.selected_capabilities).includes(c.code));
  const dirty = desc !== v.job_description || reports !== (v.reports_to_role ?? "") || JSON.stringify([...caps].sort()) !== JSON.stringify([...v.selected_capabilities].sort());
  const label = (c: string) => catalogue.find((k) => k.code === c)?.label ?? c;
  const save = () => act.save.mutateAsync({ version: v.id, description: desc, reportsTo: reports || null, capabilities: caps });

  return (
    <div className="space-y-4 rounded border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-medium">Version {v.version}</span>
        <Badge variant={v.status === "approved" ? "default" : "outline"}>{STATUS[v.status]}</Badge>
      </div>

      <div className="space-y-1">
        <Label htmlFor={`jd-${v.id}`}>Job description (required)</Label>
        <Textarea id={`jd-${v.id}`} rows={7} maxLength={8000} value={desc} disabled={!draft} onChange={(e) => setDesc(e.target.value)} />
        {draft && <p className={`text-xs ${desc.trim().length < MIN ? "text-destructive" : "text-muted-foreground"}`}>{desc.trim().length} characters (at least {MIN}). The proposal is made from this text, so save it first.</p>}
      </div>
      <div className="max-w-sm space-y-1">
        <Label>Reports to (for reference)</Label>
        <Select value={reports || "none"} onValueChange={(x) => setReports(x === "none" ? "" : x)} disabled={!draft}><SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="none">Not set</SelectItem>{roleOptions?.map((r) => <SelectItem key={r.role_code} value={r.role_code}>{r.role_name}</SelectItem>)}</SelectContent></Select>
      </div>

      {draft && (
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" disabled={act.ai.isPending || desc.trim().length < MIN || dirty} onClick={() => act.ai.mutate(v.id)}>{act.ai.isPending ? <ButtonSpinner /> : <Sparkles className="mr-1 h-4 w-4" />}Suggest with AI</Button>
          <Button variant="outline" disabled={act.rules.isPending || desc.trim().length < MIN || dirty} onClick={() => act.rules.mutate(v.id)}>{act.rules.isPending ? <ButtonSpinner /> : <Wand2 className="mr-1 h-4 w-4" />}Suggest by rules</Button>
          {dirty && <span className="self-center text-xs text-muted-foreground">Save your changes before asking for a suggestion.</span>}
        </div>
      )}

      {v.proposal_method && (
        <Alert><AlertDescription>
          <strong>{METHOD[v.proposal_method]}.</strong> {edited ? "The selection below has been edited from the proposal." : "The selection below is the proposal as made."}
          {v.proposal_note && <span className="mt-1 block whitespace-pre-wrap text-muted-foreground">{v.proposal_note}</span>}
        </AlertDescription></Alert>
      )}

      <div>
        <div className="mb-2 text-sm font-medium">Capabilities {draft ? "(nothing is granted until a Super Admin approves)" : ""}</div>
        {draft ? <CapabilityPicker catalogue={catalogue} value={caps} onChange={setCaps} proposal={v.proposal_capabilities} />
          : <div className="flex flex-wrap gap-1">{(v.approved_capabilities ?? v.selected_capabilities).map((c) => <Badge key={c} variant="secondary">{label(c)}</Badge>)}{!(v.approved_capabilities ?? v.selected_capabilities).length && <span className="text-sm text-muted-foreground">None</span>}</div>}
      </div>

      {draft && (
        <div className="flex flex-wrap gap-2">
          <Button disabled={act.save.isPending || !dirty || desc.trim().length < MIN} onClick={save}>{act.save.isPending && <ButtonSpinner />}Save draft</Button>
          <Button variant="secondary" disabled={act.submit.isPending || desc.trim().length < MIN || !caps.length} onClick={async () => { if (dirty) await save(); await act.submit.mutateAsync(v.id); }}>Send for review</Button>
        </div>
      )}

      {v.status === "pending_review" && (
        <div className="space-y-3">
          {sensitiveSelected && <Alert variant="destructive"><AlertDescription>This role includes sensitive capabilities (named records). Check they are really needed before approving.</AlertDescription></Alert>}
          <div className="space-y-1"><Label htmlFor={`n-${v.id}`}>Review note (required to reject)</Label><Textarea id={`n-${v.id}`} rows={2} value={note} onChange={(e) => setNote(e.target.value)} /></div>
          {sensitiveSelected && <label className="flex items-center gap-2 text-sm"><Checkbox checked={ack} onCheckedChange={(c) => setAck(c === true)} />I have reviewed the sensitive capabilities</label>}
          <div className="flex flex-wrap gap-2">
            <Button disabled={act.decide.isPending || (sensitiveSelected && !ack)} onClick={() => act.decide.mutate({ version: v.id, approve: true, note, ack })}>Approve and activate</Button>
            <Button variant="destructive" disabled={act.decide.isPending || note.trim().length < 5} onClick={() => act.decide.mutate({ version: v.id, approve: false, note, ack: false })}>Reject</Button>
            {v.created_by_me && <Button variant="outline" disabled={act.withdraw.isPending} onClick={() => act.withdraw.mutate(v.id)}>Take back to edit</Button>}
          </div>
          {v.created_by_me && <p className="text-xs text-muted-foreground">If there is more than one Super Admin, another Super Admin must review a role you prepared.</p>}
        </div>
      )}

      {v.reviewed_at && <div className="text-xs text-muted-foreground">{v.status === "rejected" ? "Rejected" : "Reviewed"} by {v.reviewed_by ?? "-"} on {new Date(v.reviewed_at).toLocaleDateString()}{v.review_note ? `: ${v.review_note}` : ""}</div>}
    </div>
  );
}

function RoleCard({ role, catalogue }: { role: FactoryRole; catalogue: Capability[] }) {
  const act = useFactoryActions();
  const [open, setOpen] = useState(false);
  const [retiring, setRetiring] = useState(false);
  const [why, setWhy] = useState("");
  const inProgress = role.versions.find((x) => x.status === "draft" || x.status === "pending_review");
  const shown = open ? role.versions : [inProgress ?? role.versions[0]].filter(Boolean) as FactoryVersion[];
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div><CardTitle className="text-base">{role.role_name}</CardTitle><CardDescription>{role.role_code} · {role.assigned} assigned</CardDescription></div>
          <Badge variant={role.status === "active" ? "default" : "outline"}>{STATUS[role.status]}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {shown.map((v) => <VersionPanel key={v.id} role={role} v={v} catalogue={catalogue} />)}
        <div className="flex flex-wrap gap-2">
          {role.versions.length > 1 && <Button variant="ghost" size="sm" onClick={() => setOpen(!open)}>{open ? "Show only the current version" : `Show all ${role.versions.length} versions`}</Button>}
          {role.status !== "retired" && !inProgress && <Button variant="outline" size="sm" disabled={act.newVersion.isPending} onClick={() => act.newVersion.mutate(role.id)}>Start a new version</Button>}
          {role.status !== "retired" && <Button variant="outline" size="sm" onClick={() => { setWhy(""); setRetiring(true); }}>Retire role</Button>}
        </div>
      </CardContent>
      <Dialog open={retiring} onOpenChange={setRetiring}>
        <DialogContent>
          <DialogHeader><DialogTitle>Retire {role.role_name}</DialogTitle><DialogDescription>Everyone holding it loses its capabilities immediately. The history is kept.</DialogDescription></DialogHeader>
          <div className="space-y-1"><Label htmlFor="why">Reason</Label><Textarea id="why" rows={2} value={why} onChange={(e) => setWhy(e.target.value)} /></div>
          <DialogFooter><Button variant="outline" onClick={() => setRetiring(false)}>Cancel</Button><Button variant="destructive" disabled={why.trim().length < 5 || act.retire.isPending} onClick={async () => { await act.retire.mutateAsync({ role: role.id, note: why }); setRetiring(false); }}>Retire</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function NewRoleDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const act = useFactoryActions();
  const { data: roleOptions } = useRoleOptionsForFactory();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [touched, setTouched] = useState(false);
  const [desc, setDesc] = useState("");
  const [reports, setReports] = useState("");
  const ok = name.trim().length >= 3 && /^[a-z][a-z0-9_]{2,40}$/.test(code) && desc.trim().length >= MIN;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader><DialogTitle>New role</DialogTitle><DialogDescription>Start from the job description. The role grants nothing until its capabilities are reviewed and approved.</DialogDescription></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1"><Label htmlFor="rn">Role name</Label><Input id="rn" maxLength={80} value={name} onChange={(e) => { setName(e.target.value); if (!touched) setCode(slug(e.target.value)); }} /></div>
          <div className="space-y-1"><Label htmlFor="rc">Role code</Label><Input id="rc" maxLength={41} value={code} onChange={(e) => { setTouched(true); setCode(e.target.value); }} /><p className="text-xs text-muted-foreground">Lower-case letters, digits and underscores. It cannot be changed later.</p></div>
          <div className="space-y-1"><Label htmlFor="rd">Job description (required)</Label><Textarea id="rd" rows={7} maxLength={8000} value={desc} onChange={(e) => setDesc(e.target.value)} /><p className={`text-xs ${desc.trim().length < MIN ? "text-destructive" : "text-muted-foreground"}`}>{desc.trim().length} characters (at least {MIN})</p></div>
          <div className="space-y-1"><Label>Reports to (for reference)</Label><Select value={reports || "none"} onValueChange={(x) => setReports(x === "none" ? "" : x)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Not set</SelectItem>{roleOptions?.map((r) => <SelectItem key={r.role_code} value={r.role_code}>{r.role_name}</SelectItem>)}</SelectContent></Select></div>
        </div>
        <DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button disabled={!ok || act.create.isPending} onClick={async () => { await act.create.mutateAsync({ code, name, description: desc, reportsTo: reports }); setName(""); setCode(""); setDesc(""); setReports(""); setTouched(false); onOpenChange(false); }}>{act.create.isPending && <ButtonSpinner />}Create draft</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RoleFactory() {
  const { navItems, groupLabel } = useRoleNavigation();
  const { data: roles, isLoading, error } = useFactoryOverview();
  const { data: catalogue } = useCatalogue();
  const { data: events } = useFactoryEvents();
  const { data: orgs } = useOrganizations(true);
  const [creating, setCreating] = useState(false);
  const [org, setOrg] = useState("");
  const waiting = roles?.filter((r) => r.versions.some((v) => v.status === "pending_review")).length ?? 0;
  return (
    <DashboardLayout title="Role factory" subtitle="Define new roles from a job description" navItems={navItems} groupLabel={groupLabel}>
      <div className="space-y-4">
        <Alert><AlertDescription>
          New roles sit beside the existing ones and grant only what you approve. Write the job description, ask for a proposal (AI when it is available, otherwise the built-in rules, or choose by hand), edit it, then have a Super Admin approve it. A proposal is never applied by itself.
        </AlertDescription></Alert>
        <Tabs defaultValue="roles">
          <TabsList><TabsTrigger value="roles">Roles{waiting ? ` (${waiting} to review)` : ""}</TabsTrigger><TabsTrigger value="assign">Assignments</TabsTrigger><TabsTrigger value="history">History</TabsTrigger></TabsList>
          <TabsContent value="roles" className="space-y-4 pt-4">
            <Button onClick={() => setCreating(true)}>New role</Button>
            {isLoading && <LoadingSpinner text="Loading..." className="py-6" />}
            {error && <Alert variant="destructive"><AlertDescription>{(error as Error).message}</AlertDescription></Alert>}
            {roles && !roles.length && <p className="text-sm text-muted-foreground">No roles have been defined yet.</p>}
            {catalogue && roles?.map((r) => <RoleCard key={r.id} role={r} catalogue={catalogue} />)}
          </TabsContent>
          <TabsContent value="assign" className="space-y-4 pt-4">
            <div className="max-w-sm space-y-1"><Label>Centre</Label><Select value={org} onValueChange={setOrg}><SelectTrigger><SelectValue placeholder="Choose centre" /></SelectTrigger><SelectContent>{orgs?.map((o) => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}</SelectContent></Select></div>
            <AssignmentsPanel org={org || null} />
          </TabsContent>
          <TabsContent value="history" className="pt-4">
            <Table>
              <TableHeader><TableRow><TableHead>When</TableHead><TableHead>What</TableHead><TableHead>Role</TableHead><TableHead>By</TableHead></TableRow></TableHeader>
              <TableBody>{events?.map((e, i) => <TableRow key={i}><TableCell>{new Date(e.at).toLocaleString()}</TableCell><TableCell>{e.event.replace(/_/g, " ")}</TableCell><TableCell>{e.role ?? "-"}</TableCell><TableCell>{e.by ?? "-"}</TableCell></TableRow>)}</TableBody>
            </Table>
            {!events?.length && <p className="text-sm text-muted-foreground">Nothing yet.</p>}
          </TabsContent>
        </Tabs>
      </div>
      <NewRoleDialog open={creating} onOpenChange={setCreating} />
    </DashboardLayout>
  );
}
export default withRoleAccess(RoleFactory, { requiredRoles: ["super_admin"] });
