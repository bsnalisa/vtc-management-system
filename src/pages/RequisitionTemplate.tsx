import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { withRoleAccess } from "@/components/withRoleAccess";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ButtonSpinner, LoadingSpinner } from "@/components/ui/loading-spinner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useRoleNavigation } from "@/hooks/useRoleNavigation";
import { useOrganizationContext } from "@/hooks/useOrganizationContext";
import { useTemplateActions, useTemplateOverview, type TemplateVersion } from "@/hooks/useRequisitionTemplates";
import { useToast } from "@/hooks/use-toast";
import { DEFAULT_TEMPLATE, type TemplateDefinition, type TemplateDocument, type TemplateField, type TemplateFieldType } from "@/components/requisitions/status";

const day = (d: string | null) => (d ? new Date(d).toLocaleDateString() : "-");
const STATUS: Record<string, string> = { draft: "Draft", pending_confirmation: "Waiting for confirmation", published: "In use", superseded: "Replaced", rejected: "Rejected" };
const LABELS: [keyof TemplateDefinition["labels"], string][] = [["purpose", "Purpose"], ["department", "Department"], ["quantity", "Quantity column"], ["description", "Description column"], ["specifications", "Specifications column"]];
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").replace(/^[^a-z]+/, "").slice(0, 30);

// Describes what changed between two versions in a sentence a reviewer can read
const summarise = (a: TemplateDefinition, b: TemplateDefinition): string[] => {
  const out: string[] = [];
  const list = (title: string, x: { key: string; label: string; required?: boolean }[], y: { key: string; label: string; required?: boolean }[]) => {
    y.filter((n) => !x.some((o) => o.key === n.key)).forEach((n) => out.push(`${title} added: ${n.label}${n.required ? " (required)" : ""}`));
    x.filter((o) => !y.some((n) => n.key === o.key)).forEach((o) => out.push(`${title} removed: ${o.label}`));
    y.forEach((n) => { const o = x.find((p) => p.key === n.key); if (o && (o.label !== n.label || !!o.required !== !!n.required)) out.push(`${title} changed: ${o.label} → ${n.label}${n.required ? " (required)" : ""}`); });
  };
  list("Field", a.fields, b.fields); list("Item column", a.columns, b.columns); list("Document", a.documents, b.documents);
  (Object.keys(b.labels) as (keyof TemplateDefinition["labels"])[]).forEach((k) => { if (a.labels[k] !== b.labels[k]) out.push(`Label "${a.labels[k]}" → "${b.labels[k]}"`); });
  if ((a.instructions ?? "") !== (b.instructions ?? "")) out.push("Instructions changed");
  return out;
};

function FieldEditor({ title, hint, items, onChange, allowTextarea }: { title: string; hint: string; items: TemplateField[]; onChange: (v: TemplateField[]) => void; allowTextarea: boolean }) {
  const set = (i: number, p: Partial<TemplateField>) => onChange(items.map((x, n) => (n === i ? { ...x, ...p } : x)));
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">{title}</CardTitle><CardDescription>{hint}</CardDescription></CardHeader>
      <CardContent className="space-y-3">
        {items.map((f, i) => (
          <div key={i} className="space-y-3 rounded border p-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1"><Label>Label</Label><Input value={f.label} maxLength={80} onChange={(e) => set(i, { label: e.target.value })} /></div>
              <div className="space-y-1"><Label>Type</Label>
                <Select value={f.type} onValueChange={(v) => set(i, { type: v as TemplateFieldType })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="text">Short text</SelectItem>{allowTextarea && <SelectItem value="textarea">Long text</SelectItem>}
                    <SelectItem value="number">Number</SelectItem><SelectItem value="date">Date</SelectItem><SelectItem value="select">Choice list</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {f.type === "select" && (
              <div className="space-y-1"><Label>Options (one per line)</Label>
                <Textarea rows={3} value={f.options.join("\n")} onChange={(e) => set(i, { options: e.target.value.split("\n") })} /></div>
            )}
            <div className="space-y-1"><Label>Help text (optional)</Label><Input value={f.help} maxLength={200} onChange={(e) => set(i, { help: e.target.value })} /></div>
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-sm"><Checkbox checked={f.required} onCheckedChange={(c) => set(i, { required: c === true })} />Required before submitting</label>
              <Button type="button" variant="ghost" size="sm" aria-label={`Remove ${f.label || "entry"}`} onClick={() => onChange(items.filter((_, n) => n !== i))}><Trash2 className="h-4 w-4" /></Button>
            </div>
          </div>
        ))}
        <Button type="button" variant="outline" onClick={() => onChange([...items, { key: `new_${items.length + 1}_${Date.now() % 1000}`, label: "", type: "text", required: false, help: "", options: [] }])}><Plus className="mr-1 h-4 w-4" />Add</Button>
      </CardContent>
    </Card>
  );
}

function DocumentEditor({ items, onChange }: { items: TemplateDocument[]; onChange: (v: TemplateDocument[]) => void }) {
  const set = (i: number, p: Partial<TemplateDocument>) => onChange(items.map((x, n) => (n === i ? { ...x, ...p } : x)));
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Supporting documents</CardTitle><CardDescription>Documents the requester attaches. Required ones must be attached before the requisition can be submitted.</CardDescription></CardHeader>
      <CardContent className="space-y-3">
        {items.map((d, i) => (
          <div key={i} className="flex flex-wrap items-end gap-3 rounded border p-3">
            <div className="min-w-[12rem] flex-1 space-y-1"><Label>Document name</Label><Input value={d.label} maxLength={80} onChange={(e) => set(i, { label: e.target.value })} /></div>
            <label className="flex items-center gap-2 pb-2 text-sm"><Checkbox checked={d.required} onCheckedChange={(c) => set(i, { required: c === true })} />Required</label>
            <Button type="button" variant="ghost" size="sm" aria-label={`Remove ${d.label || "document"}`} onClick={() => onChange(items.filter((_, n) => n !== i))}><Trash2 className="h-4 w-4" /></Button>
          </div>
        ))}
        <Button type="button" variant="outline" onClick={() => onChange([...items, { key: `new_${items.length + 1}_${Date.now() % 1000}`, label: "", required: true }])}><Plus className="mr-1 h-4 w-4" />Add document</Button>
      </CardContent>
    </Card>
  );
}

// Strips the editing placeholders so the server receives clean keys
const prepare = (d: TemplateDefinition): TemplateDefinition => {
  const keyed = <T extends { key: string; label: string }>(xs: T[]): T[] => {
    const seen = new Set<string>();
    return xs.map((x) => {
      let k = x.key.startsWith("new_") ? slug(x.label) : x.key;
      if (!k) k = "item"; if (k.length < 2) k = `${k}_x`;
      let n = 2; const base = k; while (seen.has(k)) k = `${base.slice(0, 26)}_${n++}`;
      seen.add(k); return { ...x, key: k };
    });
  };
  return { ...d, fields: keyed(d.fields).map((f) => ({ ...f, options: f.type === "select" ? f.options.map((o) => o.trim()).filter(Boolean) : [] })),
    columns: keyed(d.columns).map((f) => ({ ...f, options: f.type === "select" ? f.options.map((o) => o.trim()).filter(Boolean) : [] })), documents: keyed(d.documents) };
};

function Preview({ d }: { d: TemplateDefinition }) {
  return (
    <div className="space-y-2 text-sm">
      {d.instructions && <p className="whitespace-pre-wrap text-muted-foreground">{d.instructions}</p>}
      <div><span className="font-medium">{d.labels.purpose}</span>, <span className="font-medium">{d.labels.department}</span> (always required)</div>
      {d.fields.length > 0 && <div><span className="font-medium">Extra fields:</span> {d.fields.map((f) => `${f.label}${f.required ? " *" : ""}`).join(", ")}</div>}
      <div><span className="font-medium">Item table:</span> {[d.labels.quantity, d.labels.description, d.labels.specifications, ...d.columns.map((c) => `${c.label}${c.required ? " *" : ""}`)].join(" | ")}</div>
      {d.documents.length > 0 && <div><span className="font-medium">Documents:</span> {d.documents.map((x) => `${x.label}${x.required ? " *" : ""}`).join(", ")}</div>}
      <p className="text-xs text-muted-foreground">* required. The approval stages (line supervisor, Accountant, Head of Finance and Administration, Centre Manager) are fixed and not part of the template.</p>
    </div>
  );
}

function RequisitionTemplate() {
  const { navItems, groupLabel } = useRoleNavigation();
  const { organizationId } = useOrganizationContext();
  const { toast } = useToast();
  const { data, isLoading, error } = useTemplateOverview(organizationId);
  const act = useTemplateActions(organizationId);
  const [def, setDef] = useState<TemplateDefinition>(DEFAULT_TEMPLATE);
  const [note, setNote] = useState("");
  const [decisionNote, setDecisionNote] = useState("");
  const [loadedKey, setLoadedKey] = useState("");

  // start from the open draft, else the form in use
  useEffect(() => {
    if (!data) return;
    const key = `${data.open?.id ?? "none"}:${data.current.version}`;
    if (key === loadedKey) return;
    const src = data.open?.definition ?? data.current.definition;
    setDef({ ...DEFAULT_TEMPLATE, ...src, labels: { ...DEFAULT_TEMPLATE.labels, ...src.labels } });
    setNote(data.open?.change_note ?? "");
    setLoadedKey(key);
  }, [data, loadedKey]);

  if (isLoading) return <DashboardLayout title="Requisition template" subtitle="The form behind every requisition" navItems={navItems} groupLabel={groupLabel}><LoadingSpinner text="Loading..." className="py-8" /></DashboardLayout>;
  if (error || !data) return <DashboardLayout title="Requisition template" subtitle="The form behind every requisition" navItems={navItems} groupLabel={groupLabel}><Alert variant="destructive"><AlertDescription>{(error as Error)?.message ?? "Could not load the template"}</AlertDescription></Alert></DashboardLayout>;

  const open = data.open;
  const pending = open?.status === "pending_confirmation";
  const editable = data.can_edit && !pending;
  const busy = act.saveDraft.isPending || act.submit.isPending;
  const set = <K extends keyof TemplateDefinition>(k: K, v: TemplateDefinition[K]) => setDef((d) => ({ ...d, [k]: v }));

  const save = async (andSend: boolean) => {
    const id = await act.saveDraft.mutateAsync({ definition: prepare(def), note });
    if (andSend) { await act.submit.mutateAsync(id); toast({ title: "Sent for confirmation", description: "The Head of Finance and Administration will review this version." }); }
    else toast({ title: "Draft saved" });
    setLoadedKey("");
  };
  const changes = open ? summarise(data.current.definition, open.definition) : [];

  return (
    <DashboardLayout title="Requisition template" subtitle="The form behind every requisition" navItems={navItems} groupLabel={groupLabel}>
      <div className="mx-auto max-w-4xl space-y-6">
        <Alert><AlertDescription>
          The template sets the fields, item columns, labels, instructions and supporting documents on the requisition form. The approval stages and decisions are fixed by the workflow and cannot be changed here.
          A new version is proposed by the Procurement Officer and takes effect once the Head of Finance and Administration confirms it. Requisitions already made keep the version they were made on.
        </AlertDescription></Alert>

        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div><CardTitle>In use now</CardTitle><CardDescription>{data.current.template_id ? `Version ${data.current.version}` : "The standard form (version 1). No custom version has been published yet."}</CardDescription></div>
              <Badge variant="secondary">Version {data.current.version}</Badge>
            </div>
          </CardHeader>
          <CardContent><Preview d={data.current.definition} /></CardContent>
        </Card>

        {pending && open && (
          <Card className="border-primary/40">
            <CardHeader>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div><CardTitle>Version {open.version} waiting for confirmation</CardTitle><CardDescription>Proposed by {open.proposed_by ?? "-"} on {day(open.proposed_at)}{open.change_note ? `: ${open.change_note}` : ""}</CardDescription></div>
                <Badge>{STATUS.pending_confirmation}</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div><div className="mb-1 text-sm font-medium">What changes</div>
                {changes.length ? <ul className="list-disc space-y-0.5 pl-5 text-sm">{changes.map((c) => <li key={c}>{c}</li>)}</ul> : <p className="text-sm text-muted-foreground">No visible differences.</p>}</div>
              <Preview d={open.definition} />
              {data.can_confirm && !open.proposed_by_me && (
                <div className="space-y-3">
                  <div className="space-y-1"><Label htmlFor="dn">Note (required to reject)</Label><Textarea id="dn" rows={2} value={decisionNote} onChange={(e) => setDecisionNote(e.target.value)} /></div>
                  <div className="flex flex-wrap gap-2">
                    <Button disabled={act.decide.isPending} onClick={async () => { await act.decide.mutateAsync({ id: open.id, approve: true, note: decisionNote }); setDecisionNote(""); toast({ title: `Version ${open.version} is now in use` }); }}>{act.decide.isPending && <ButtonSpinner />}Confirm and publish</Button>
                    <Button variant="destructive" disabled={act.decide.isPending || decisionNote.trim().length < 5} onClick={async () => { await act.decide.mutateAsync({ id: open.id, approve: false, note: decisionNote }); setDecisionNote(""); toast({ title: "Proposal rejected" }); }}>Reject</Button>
                  </div>
                </div>
              )}
              {open.proposed_by_me && data.can_edit && <Button variant="outline" disabled={act.withdraw.isPending} onClick={() => act.withdraw.mutate(open.id)}>Withdraw to edit</Button>}
              {data.can_confirm && open.proposed_by_me && <p className="text-sm text-muted-foreground">You proposed this version, so someone else must confirm it.</p>}
            </CardContent>
          </Card>
        )}

        {editable && (
          <>
            <Card>
              <CardHeader><CardTitle>{open ? `Edit draft version ${open.version}` : "Propose a new version"}</CardTitle><CardDescription>Purpose, department, quantity and description always stay on the form and are always required; you can rename them.</CardDescription></CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1"><Label htmlFor="ins">Instructions shown above the form</Label><Textarea id="ins" rows={3} maxLength={2000} value={def.instructions} onChange={(e) => set("instructions", e.target.value)} /></div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {LABELS.map(([k, name]) => (
                    <div key={k} className="space-y-1"><Label htmlFor={`l-${k}`}>{name} label</Label><Input id={`l-${k}`} maxLength={60} value={def.labels[k]} onChange={(e) => set("labels", { ...def.labels, [k]: e.target.value })} /></div>
                  ))}
                </div>
              </CardContent>
            </Card>
            <FieldEditor title="Extra fields" hint="Shown under the purpose and department, and printed on the form." items={def.fields} onChange={(v) => set("fields", v)} allowTextarea />
            <FieldEditor title="Extra item columns" hint="Added to every line of the item table (at most 6)." items={def.columns} onChange={(v) => set("columns", v)} allowTextarea={false} />
            <DocumentEditor items={def.documents} onChange={(v) => set("documents", v)} />
            <Card>
              <CardContent className="space-y-3 pt-6">
                <div className="space-y-1"><Label htmlFor="cn">What changed and why</Label><Textarea id="cn" rows={2} maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} /></div>
                <div className="flex flex-wrap gap-2">
                  <Button disabled={busy} onClick={() => save(true)}>{busy && <ButtonSpinner />}Send for confirmation</Button>
                  <Button variant="outline" disabled={busy} onClick={() => save(false)}>Save draft</Button>
                  <Button variant="ghost" disabled={busy} onClick={() => { setDef({ ...data.current.definition }); toast({ title: "Reset to the form in use" }); }}>Reset to the form in use</Button>
                </div>
              </CardContent>
            </Card>
          </>
        )}

        <Card>
          <CardHeader><CardTitle>Versions</CardTitle><CardDescription>Earlier versions are kept for the requisitions that used them.</CardDescription></CardHeader>
          <CardContent className="space-y-3">
            {!data.history.length && <p className="text-sm text-muted-foreground">No custom version has been proposed yet.</p>}
            {data.history.map((h: TemplateVersion) => (
              <div key={h.id} className="rounded border p-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2"><span className="font-medium">Version {h.version}</span><Badge variant={h.status === "published" ? "default" : "outline"}>{STATUS[h.status] ?? h.status}</Badge></div>
                <div className="text-muted-foreground">Proposed by {h.proposed_by ?? "-"} on {day(h.proposed_at)}{h.decided_by ? `; ${h.status === "rejected" ? "rejected" : "confirmed"} by ${h.decided_by} on ${day(h.decided_at)}` : ""}. Used by {h.used_by} requisition{h.used_by === 1 ? "" : "s"}.</div>
                {h.change_note && <div>Change: {h.change_note}</div>}
                {h.decision_note && <div>Decision note: {h.decision_note}</div>}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

export default withRoleAccess(RequisitionTemplate, { requiredRoles: ["procurement_officer", "head_of_finance_admin", "centre_manager"] });
