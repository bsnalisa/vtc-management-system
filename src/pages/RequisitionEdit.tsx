import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { FileText, Plus, Trash2, Upload } from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ButtonSpinner, LoadingSpinner } from "@/components/ui/loading-spinner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useRoleNavigation } from "@/hooks/useRoleNavigation";
import { useOrganizationContext } from "@/hooks/useOrganizationContext";
import { useRequisition, useRequisitionActions } from "@/hooks/useRequisitions";
import { useRequisitionSupervisor } from "@/hooks/useRequisitionSupervisor";
import { useToast } from "@/hooks/use-toast";
import { useRequisitionTemplate } from "@/hooks/useRequisitionTemplates";
import { supabase } from "@/integrations/supabase/client";
import { DEFAULT_TEMPLATE, type TemplateField } from "@/components/requisitions/status";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Row { description: string; quantity: string; specifications: string; extra: Record<string, string> }
const blank = (): Row => ({ description: "", quantity: "1", specifications: "", extra: {} });

// One template-defined input: short text, long text, number, date or a choice list
function FieldInput({ field, id, value, onChange }: { field: TemplateField; id: string; value: string; onChange: (v: string) => void }) {
  if (field.type === "textarea") return <Textarea id={id} rows={3} maxLength={2000} value={value} onChange={(e) => onChange(e.target.value)} />;
  if (field.type === "select") {
    return (
      <Select value={value || undefined} onValueChange={onChange}>
        <SelectTrigger id={id}><SelectValue placeholder="Choose" /></SelectTrigger>
        <SelectContent>{field.options.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
      </Select>
    );
  }
  return <Input id={id} type={field.type === "number" ? "number" : field.type === "date" ? "date" : "text"} maxLength={200} value={value} onChange={(e) => onChange(e.target.value)} />;
}

// New requisition or a correction: purpose, department and the item table (No., Quantity, Description, Specifications)
export default function RequisitionEdit() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { navItems, groupLabel } = useRoleNavigation();
  const { organizationId } = useOrganizationContext();
  const existing = useRequisition(id);
  const { saveDraft, submit } = useRequisitionActions();
  const orgId = existing.data?.organization_id ?? organizationId;
  const supervisor = useRequisitionSupervisor(orgId);
  const [purpose, setPurpose] = useState("");
  const [department, setDepartment] = useState("");
  const [rows, setRows] = useState<Row[]>([blank()]);
  const [loaded, setLoaded] = useState(!id);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [uploading, setUploading] = useState<string | null>(null);
  // an existing requisition keeps the form it was made on; a new one uses the form in use now
  const tplQuery = useRequisitionTemplate(orgId, id);
  const tpl = { ...DEFAULT_TEMPLATE, ...(tplQuery.data?.definition ?? {}), labels: { ...DEFAULT_TEMPLATE.labels, ...(tplQuery.data?.definition?.labels ?? {}) } };

  useEffect(() => {
    const v = existing.data;
    if (!id || !v || loaded) return;
    setPurpose(v.purpose ?? ""); setDepartment(v.department ?? ""); setFields(v.fields ?? {});
    setRows(v.items.length ? v.items.map((i) => ({ description: i.description, quantity: String(i.quantity), specifications: i.specifications ?? "", extra: i.extra ?? {} })) : [blank()]);
    setLoaded(true);
  }, [existing.data, id, loaded]);

  const update = (i: number, patch: Partial<Row>) => setRows((r) => r.map((x, n) => (n === i ? { ...x, ...patch } : x)));
  const busy = saveDraft.isPending || submit.isPending;
  const sup = supervisor.data;

  const problem = (): string | null => {
    if (!purpose.trim()) return "State the purpose of the requisition.";
    if (!department.trim()) return "Enter your department.";
    if (rows.some((r) => !r.description.trim())) return "Every item needs a description.";
    if (rows.some((r) => !/^[0-9]+$/.test(r.quantity.trim()) || Number(r.quantity) < 1)) return "Quantities must be whole numbers of at least 1.";
    const missingField = tpl.fields.find((f) => f.required && !(fields[f.key] ?? "").trim());
    if (missingField) return `Complete "${missingField.label}".`;
    for (const c of tpl.columns) if (c.required && rows.some((r) => !(r.extra[c.key] ?? "").trim())) return `Every item needs "${c.label}".`;
    const attached = new Set((existing.data?.request_documents ?? []).map((d) => d.doc_key));
    const missingDoc = tpl.documents.find((d) => d.required && !attached.has(d.key));
    if (missingDoc) return `Attach the required document "${missingDoc.label}" (save the draft first, then upload it).`;
    return null;
  };

  // Documents are stored against a saved requisition, so a new form is saved as a draft first
  const attach = async (docKey: string, file: File) => {
    if (file.size > 10 * 1024 * 1024) { toast({ title: "Files can be at most 10 MB", variant: "destructive" }); return; }
    setUploading(docKey);
    try {
      const reqId = id ?? (await saveDraft.mutateAsync({ id: null, organizationId: orgId ?? null, purpose, department, items: rows, fields }));
      const path = `${orgId}/requisitions/${reqId}/${Date.now()}-${file.name.replace(/[^A-Za-z0-9._-]+/g, "_")}`;
      const up = await supabase.storage.from("documents").upload(path, file, { upsert: false });
      if (up.error) throw up.error;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any).rpc("requisition_attach_request_document", { _id: reqId, _doc_key: docKey, _path: path, _name: file.name });
      if (error) throw error;
      toast({ title: "Document attached" });
      if (!id) navigate(`/requisitions/${reqId}/edit`, { replace: true }); else existing.refetch();
    } catch (e) { toast({ title: "Upload failed", description: (e as Error).message, variant: "destructive" }); } finally { setUploading(null); }
  };
  const removeDoc = async (docId: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).rpc("requisition_remove_request_document", { _doc: docId });
    if (error) toast({ title: "Could not remove the document", description: error.message, variant: "destructive" }); else existing.refetch();
  };

  const save = async (andSubmit: boolean) => {
    if (andSubmit) { const p = problem(); if (p) { toast({ title: "Complete the form", description: p, variant: "destructive" }); return; } }
    const reqId = await saveDraft.mutateAsync({ id: id ?? null, organizationId: orgId ?? null, purpose, department, items: rows, fields });
    if (!andSubmit) { toast({ title: "Draft saved" }); navigate(`/requisitions/${reqId}`); return; }
    const r = await submit.mutateAsync(reqId);
    toast({ title: `Submitted as ${r.requisition_number}`, description: `Sent to ${r.supervisor} for recommendation.` });
    navigate(`/requisitions/${reqId}`);
  };

  if (id && (existing.isLoading || !loaded)) return <DashboardLayout title="Requisition" subtitle="Internal Quotation Request Form" navItems={navItems} groupLabel={groupLabel}><LoadingSpinner text="Loading..." className="py-8" /></DashboardLayout>;
  if (id && existing.data && !existing.data.can_edit) {
    return <DashboardLayout title="Requisition" subtitle="Internal Quotation Request Form" navItems={navItems} groupLabel={groupLabel}><Alert><AlertDescription>This requisition can no longer be edited.</AlertDescription></Alert></DashboardLayout>;
  }

  return (
    <DashboardLayout title={id ? "Correct requisition" : "New requisition"} subtitle="Internal Quotation Request Form" navItems={navItems} groupLabel={groupLabel}>
      <div className="mx-auto max-w-4xl space-y-6">
        {sup && !sup.valid && (
          <Alert variant="destructive"><AlertDescription>You do not have a line supervisor configured, so a requisition cannot enter the approval process yet. You can save a draft; ask your Organisational Admin to set your reporting line before submitting.</AlertDescription></Alert>
        )}
        {sup?.valid && <Alert><AlertDescription>When you submit, this goes first to your line supervisor: <strong>{sup.supervisors.map((s) => `${s.name}${s.role ? ` (${s.role.replace(/_/g, " ")})` : ""}`).join(", ")}</strong>. It then follows the Accountant, the Head of Finance and Administration and the Centre Manager, in that order.</AlertDescription></Alert>}

        <Card>
          <CardHeader><CardTitle>Request</CardTitle><CardDescription>{tpl.instructions || "Explain what is needed and why. This text appears at the top of the printed form."}</CardDescription></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="purpose">{tpl.labels.purpose}</Label>
              <Textarea id="purpose" rows={4} value={purpose} onChange={(e) => setPurpose(e.target.value)} maxLength={4000} placeholder="Request to procure the following items for use on ..." />
            </div>
            <div className="space-y-1">
              <Label htmlFor="department">{tpl.labels.department}</Label>
              <Input id="department" className="max-w-sm" value={department} onChange={(e) => setDepartment(e.target.value)} maxLength={120} />
            </div>
            {tpl.fields.map((f) => (
              <div key={f.key} className="space-y-1">
                <Label htmlFor={`f-${f.key}`}>{f.label}{f.required && <span aria-hidden="true"> *</span>}</Label>
                <FieldInput field={f} id={`f-${f.key}`} value={fields[f.key] ?? ""} onChange={(v) => setFields((x) => ({ ...x, [f.key]: v }))} />
                {f.help && <p className="text-xs text-muted-foreground">{f.help}</p>}
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Items</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {rows.map((r, i) => (
              <div key={i} className="rounded border p-3">
                <div className="mb-2 flex items-center justify-between text-sm font-medium">Item {i + 1}
                  <Button type="button" variant="ghost" size="sm" aria-label={`Remove item ${i + 1}`} disabled={rows.length === 1} onClick={() => setRows((x) => x.filter((_, n) => n !== i))}><Trash2 className="h-4 w-4" /></Button>
                </div>
                <div className="grid gap-3 sm:grid-cols-[8rem_1fr]">
                  <div className="space-y-1"><Label htmlFor={`q${i}`}>{tpl.labels.quantity}</Label><Input id={`q${i}`} inputMode="numeric" value={r.quantity} onChange={(e) => update(i, { quantity: e.target.value })} /></div>
                  <div className="space-y-1"><Label htmlFor={`d${i}`}>{tpl.labels.description}</Label><Input id={`d${i}`} value={r.description} onChange={(e) => update(i, { description: e.target.value })} maxLength={500} /></div>
                </div>
                <div className="mt-3 space-y-1"><Label htmlFor={`s${i}`}>{tpl.labels.specifications}</Label><Textarea id={`s${i}`} rows={2} value={r.specifications} onChange={(e) => update(i, { specifications: e.target.value })} maxLength={2000} /></div>
                {tpl.columns.length > 0 && (
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    {tpl.columns.map((c) => (
                      <div key={c.key} className="space-y-1">
                        <Label htmlFor={`x${i}-${c.key}`}>{c.label}{c.required && <span aria-hidden="true"> *</span>}</Label>
                        <FieldInput field={c} id={`x${i}-${c.key}`} value={r.extra[c.key] ?? ""} onChange={(v) => update(i, { extra: { ...r.extra, [c.key]: v } })} />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
            <Button type="button" variant="outline" disabled={rows.length >= 100} onClick={() => setRows((x) => [...x, blank()])}><Plus className="mr-1 h-4 w-4" />Add item</Button>
          </CardContent>
        </Card>

        {tpl.documents.length > 0 && (
          <Card>
            <CardHeader><CardTitle>Supporting documents</CardTitle><CardDescription>Documents marked * must be attached before you submit. Files can be at most 10 MB.</CardDescription></CardHeader>
            <CardContent className="space-y-4">
              {tpl.documents.map((d) => {
                const have = (existing.data?.request_documents ?? []).filter((x) => x.doc_key === d.key);
                return (
                  <div key={d.key} className="space-y-2 rounded border p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-sm font-medium">{d.label}{d.required && <span aria-hidden="true"> *</span>}</span>
                      <label className="inline-flex cursor-pointer items-center gap-1 text-sm text-primary">
                        {uploading === d.key ? <ButtonSpinner /> : <Upload className="h-4 w-4" />}Attach file
                        <input type="file" className="sr-only" disabled={uploading !== null} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) attach(d.key, f); }} />
                      </label>
                    </div>
                    {have.map((x) => (
                      <div key={x.id} className="flex items-center justify-between gap-2 text-sm"><span className="flex items-center gap-1 break-all"><FileText className="h-4 w-4 shrink-0" />{x.file_name}</span>
                        <Button type="button" variant="ghost" size="sm" aria-label={`Remove ${x.file_name}`} onClick={() => removeDoc(x.id)}><Trash2 className="h-4 w-4" /></Button></div>
                    ))}
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}

        <div className="flex flex-wrap gap-2">
          <Button disabled={busy || (sup ? !sup.valid : false)} onClick={() => save(true)}>{busy && <ButtonSpinner />}{id ? "Resubmit" : "Submit for approval"}</Button>
          <Button variant="outline" disabled={busy} onClick={() => save(false)}>Save draft</Button>
          <Button variant="ghost" disabled={busy} onClick={() => navigate(id ? `/requisitions/${id}` : "/requisitions")}>Cancel</Button>
        </div>
      </div>
    </DashboardLayout>
  );
}
