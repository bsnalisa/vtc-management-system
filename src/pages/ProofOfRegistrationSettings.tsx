import { ReactNode, useEffect, useMemo, useState } from "react";
import { FileCheck, ImageUp, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useRoleNavigation } from "@/hooks/useRoleNavigation";
import { useOrganizationContext } from "@/hooks/useOrganizationContext";
import { ProofCentre, useCopyProofSettings, useProofCentres, useProofSettings, useSaveProofSettings } from "@/hooks/useProofOfRegistration";
import { supabase } from "@/integrations/supabase/client";
import { DEFAULT_PROOF_SETTINGS, ProofSettings, proofDocumentHtml, sampleProofData } from "@/lib/proofOfRegistration";
import { ProofFrame } from "@/components/registration/ProofOfRegistration";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { ButtonSpinner } from "@/components/ui/loading-spinner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { withRoleAccess } from "@/components/withRoleAccess";

type Form = Record<keyof ProofSettings, string>;
const EMPTY: Form = Object.fromEntries(Object.entries(DEFAULT_PROOF_SETTINGS).map(([k, v]) => [k, v ?? ""])) as Form;
const REQUIRED: (keyof Form)[] = ["centre_name", "physical_address", "telephone", "email", "signatory_name"];
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const PHONE = /^[0-9+()/ .-]{5,25}$/;

const Field = ({ label, error, hint, children }: { label: string; error?: string; hint?: string; children: ReactNode }) => (
  <div className="space-y-1.5"><Label>{label}</Label>{children}{hint && !error && <p className="text-xs text-muted-foreground">{hint}</p>}{error && <p role="alert" className="text-xs text-destructive">{error}</p>}</div>
);

function ImageField({ org, kind, value, onChange, hint }: { org: string; kind: "logo" | "signature"; value: string; onChange: (url: string) => void; hint: string }) {
  const [busy, setBusy] = useState(false);
  const upload = async (file: File | undefined) => {
    if (!file) return;
    if (!/^image\/(png|jpe?g|svg\+xml)$/.test(file.type)) { toast.error("Upload a PNG, JPG or SVG image"); return; }
    if (file.size > 2 * 1024 * 1024) { toast.error("The image must be 2 MB or smaller"); return; }
    setBusy(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "png";
      const path = `${org}/proof-${kind}-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("organization-logos").upload(path, file, { upsert: true, cacheControl: "3600", contentType: file.type });
      if (error) throw error;
      onChange(supabase.storage.from("organization-logos").getPublicUrl(path).data.publicUrl);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Upload failed"); } finally { setBusy(false); }
  };
  return (
    <div className="space-y-2">
      <div className="flex min-h-20 items-center justify-center rounded-md border bg-muted/30 p-2">
        {value ? <img src={value} alt={`${kind} preview`} className="max-h-20 max-w-full object-contain" /> : <span className="text-sm text-muted-foreground">No {kind} uploaded</span>}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button asChild variant="outline" size="sm" disabled={busy}><label className="cursor-pointer">{busy ? <ButtonSpinner /> : <ImageUp className="mr-2 h-4 w-4" />}{value ? "Replace" : "Upload"}
          <input type="file" accept="image/png,image/jpeg,image/svg+xml" className="sr-only" onChange={(e) => { void upload(e.target.files?.[0]); e.target.value = ""; }} /></label></Button>
        {value && <Button variant="ghost" size="sm" onClick={() => onChange("")}><Trash2 className="mr-2 h-4 w-4" />Remove</Button>}
      </div>
      <p className="text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

function ProofOfRegistrationSettings() {
  const { navItems, groupLabel } = useRoleNavigation();
  const { organizationId } = useOrganizationContext();
  const { data: centres, isLoading: loadingCentres } = useProofCentres();
  const [org, setOrg] = useState<string | null>(null);
  const { data: loaded, isLoading, error } = useProofSettings(org);
  const save = useSaveProofSettings();
  const copy = useCopyProofSettings();
  const [form, setForm] = useState<Form>(EMPTY);
  const [touched, setTouched] = useState(false);
  const [copyFrom, setCopyFrom] = useState("");

  useEffect(() => { if (!org && centres?.length) setOrg(centres.find((c) => c.organization_id === organizationId)?.organization_id ?? centres[0].organization_id); }, [centres, org, organizationId]);
  useEffect(() => {
    if (!loaded) return;
    const s = loaded.settings as Partial<Record<keyof Form, string | null>> | null;
    const next = { ...EMPTY };
    (Object.keys(EMPTY) as (keyof Form)[]).forEach((k) => { const v = s?.[k]; if (v !== undefined && v !== null) next[k] = v; });
    if (!s) next.centre_name = loaded.centre_name ?? "";
    setForm(next);
    setTouched(false);
  }, [loaded]);

  const set = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => { setForm({ ...form, [k]: e.target.value }); setTouched(true); };
  const errors = useMemo(() => {
    const e: Partial<Record<keyof Form, string>> = {};
    REQUIRED.forEach((k) => { if (!form[k].trim()) e[k] = "Required"; });
    if (form.email && !EMAIL.test(form.email)) e.email = "Enter a valid email address";
    if (form.clerk_email && !EMAIL.test(form.clerk_email)) e.clerk_email = "Enter a valid email address";
    (["telephone", "fax", "clerk_phone"] as const).forEach((k) => { if (form[k] && !PHONE.test(form[k])) e[k] = "Enter a valid phone number"; });
    if (!form.logo_url) e.logo_url = "Upload the centre logo";
    return e;
  }, [form]);
  const blocking = REQUIRED.some((k) => errors[k]) || !!errors.email || !!errors.clerk_email || !!errors.telephone || !!errors.fax || !!errors.clerk_phone;
  const previewHtml = useMemo(() => proofDocumentHtml(sampleProofData(form as unknown as ProofSettings, form.centre_name || null), { sample: true }), [form]);
  const show = (k: keyof Form) => (touched || undefined) && errors[k];
  const current = centres?.find((c) => c.organization_id === org);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setTouched(true);
    if (!org || blocking) return;
    await save.mutateAsync({ org, settings: { ...form } });
  };
  const status = (c: ProofCentre) => <Badge variant={c.configured ? "default" : "secondary"}>{c.configured ? "Configured" : "Incomplete"}</Badge>;

  return (
    <DashboardLayout title="Proof of Registration" subtitle="Letterhead, contacts and signatory used on every proof of registration" navItems={navItems} groupLabel={groupLabel}>
      <div className="space-y-6">
        {loadingCentres ? <Skeleton className="h-20" /> : (
          <Card>
            <CardHeader className="flex-row flex-wrap items-center justify-between gap-2 space-y-0">
              <div><CardTitle className="flex items-center gap-2 text-base"><FileCheck className="h-4 w-4" />Centres</CardTitle><CardDescription>One set of details per centre. The document always uses the settings of the centre the trainee is registered at.</CardDescription></div>
              {(centres?.length ?? 0) > 1 && org && (
                <div className="flex gap-2">
                  <Select value={copyFrom} onValueChange={setCopyFrom}><SelectTrigger className="w-56" aria-label="Copy settings from"><SelectValue placeholder="Copy settings from…" /></SelectTrigger>
                    <SelectContent>{centres!.filter((c) => c.organization_id !== org).map((c) => <SelectItem key={c.organization_id} value={c.organization_id}>{c.name}</SelectItem>)}</SelectContent></Select>
                  <Button variant="outline" disabled={!copyFrom || copy.isPending} onClick={async () => { await copy.mutateAsync({ from: copyFrom, to: org }); setCopyFrom(""); }}>Copy</Button>
                </div>
              )}
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {centres?.map((c) => (
                <Button key={c.organization_id} variant={c.organization_id === org ? "default" : "outline"} onClick={() => setOrg(c.organization_id)} className="gap-2">{c.name}{status(c)}</Button>
              ))}
              {!centres?.length && <p className="text-sm text-muted-foreground">You do not manage any centre.</p>}
            </CardContent>
          </Card>
        )}

        {org && (error ? <Alert variant="destructive"><AlertDescription>{(error as Error).message}</AlertDescription></Alert> : isLoading ? <Skeleton className="h-96" /> : (
          <div className="grid gap-6 xl:grid-cols-2">
            <form onSubmit={submit} className="space-y-6" noValidate>
              <Card>
                <CardHeader><CardTitle className="text-base">Letterhead and footer {current && status(current)}</CardTitle><CardDescription>The logo goes at the top of every page. The footer at the bottom shows exactly what you enter here: centre name and address on the left; telephone, fax, postal address, email and website in the middle; the correspondence note on the right. Empty fields are left out.</CardDescription></CardHeader>
                <CardContent className="space-y-4">
                  <Field label="Centre logo *" error={show("logo_url")}><ImageField org={org} kind="logo" value={form.logo_url} onChange={(u) => { setForm({ ...form, logo_url: u }); setTouched(true); }} hint="PNG, JPG or SVG, up to 2 MB. A transparent background and roughly 3:2 shape works best." /></Field>
                  <Field label="Centre name *" error={show("centre_name")}><Input value={form.centre_name} onChange={set("centre_name")} /></Field>
                  <Field label="Physical address *" error={show("physical_address")} hint="Each line you type shows on its own line in the footer."><Textarea rows={2} value={form.physical_address} onChange={set("physical_address")} /></Field>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Postal address / P.O. Box"><Input value={form.postal_address} onChange={set("postal_address")} /></Field>
                    <Field label="Website"><Input value={form.website} onChange={set("website")} /></Field>
                    <Field label="Telephone *" error={show("telephone")}><Input value={form.telephone} onChange={set("telephone")} /></Field>
                    <Field label="Fax" error={show("fax")}><Input value={form.fax} onChange={set("fax")} /></Field>
                  </div>
                  <Field label="Email *" error={show("email")}><Input type="email" value={form.email} onChange={set("email")} /></Field>
                  <Field label="Correspondence note (footer, right-hand column)"><Input value={form.correspondence_note} onChange={set("correspondence_note")} /></Field>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="text-base">Contacts and signatory</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-3">
                    <Field label="Registration clerk title"><Input value={form.clerk_title} onChange={set("clerk_title")} placeholder="Ms." /></Field>
                    <div className="sm:col-span-2"><Field label="Registration clerk name"><Input value={form.clerk_name} onChange={set("clerk_name")} /></Field></div>
                    <Field label="Role label"><Input value={form.clerk_role_label} onChange={set("clerk_role_label")} /></Field>
                    <Field label="Clerk telephone" error={show("clerk_phone")}><Input value={form.clerk_phone} onChange={set("clerk_phone")} /></Field>
                    <Field label="Clerk email" error={show("clerk_email")}><Input type="email" value={form.clerk_email} onChange={set("clerk_email")} /></Field>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-3">
                    <Field label="Signatory title"><Input value={form.signatory_title} onChange={set("signatory_title")} placeholder="Ms." /></Field>
                    <div className="sm:col-span-2"><Field label="Signatory name *" error={show("signatory_name")}><Input value={form.signatory_name} onChange={set("signatory_name")} /></Field></div>
                    <div className="sm:col-span-3"><Field label="Signatory job title"><Input value={form.signatory_job_title} onChange={set("signatory_job_title")} /></Field></div>
                  </div>
                  <Field label="Signature image (optional)"><ImageField org={org} kind="signature" value={form.signature_url} onChange={(u) => { setForm({ ...form, signature_url: u }); setTouched(true); }} hint="Leave empty to keep the signature line blank for signing by hand." /></Field>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="text-base">Document options</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-3">
                    <Field label="Currency label"><Input value={form.currency_label} onChange={set("currency_label")} /></Field>
                    <Field label="Stamp label"><Input value={form.stamp_label} onChange={set("stamp_label")} /></Field>
                    <div />
                    <Field label="Primary colour"><Input type="color" className="h-10 p-1" value={form.primary_color} onChange={set("primary_color")} /></Field>
                    <Field label="Accent colour"><Input type="color" className="h-10 p-1" value={form.accent_color} onChange={set("accent_color")} /></Field>
                  </div>
                  <Field label="Footer disclaimer"><Textarea rows={2} value={form.footer_disclaimer} onChange={set("footer_disclaimer")} /></Field>
                  {touched && blocking && <Alert variant="destructive"><AlertDescription>Fix the highlighted fields before saving.</AlertDescription></Alert>}
                  <Button type="submit" disabled={save.isPending}>{save.isPending && <ButtonSpinner />}Save settings</Button>
                </CardContent>
              </Card>
            </form>

            <Card className="xl:sticky xl:top-4 xl:self-start">
              <CardHeader><CardTitle className="text-base">Live preview</CardTitle><CardDescription>Sample data, watermarked. Updates as you type; save to use it on real documents.</CardDescription></CardHeader>
              <CardContent><ProofFrame html={previewHtml} /></CardContent>
            </Card>
          </div>
        ))}
      </div>
    </DashboardLayout>
  );
}

export default withRoleAccess(ProofOfRegistrationSettings, { requiredRoles: ["organization_admin", "admin"] });
