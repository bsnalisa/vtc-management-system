import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { withRoleAccess } from "@/components/withRoleAccess";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ButtonSpinner, LoadingSpinner } from "@/components/ui/loading-spinner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useRoleNavigation } from "@/hooks/useRoleNavigation";
import { useOrganizationContext } from "@/hooks/useOrganizationContext";
import { useEmailActions, useEmailOverview, type EmailForm } from "@/hooks/useEmailSettings";

const when = (d: string | null) => (d ? new Date(d).toLocaleString() : "-");
const EVENT: Record<string, string> = { saved: "Settings saved", secret_changed: "Client secret replaced", enabled: "Email switched on", disabled: "Email switched off", test_ok: "Test passed", test_failed: "Test failed", requeued: "Failed messages requeued" };
const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

function EmailSettings() {
  const { navItems, groupLabel } = useRoleNavigation();
  const { organizationId } = useOrganizationContext();
  const { data, isLoading, error } = useEmailOverview(organizationId);
  const act = useEmailActions(organizationId);
  const [f, setF] = useState<EmailForm>({ tenant: "", client: "", secret: "", sender: "", senderName: "", replyTo: "", enabled: false });
  const s = data?.settings ?? null;
  useEffect(() => {
    if (data) setF({ tenant: s?.tenant_id ?? "", client: s?.client_id ?? "", secret: "", sender: s?.sender_address ?? "", senderName: s?.sender_name ?? "", replyTo: s?.reply_to ?? "", enabled: s?.enabled ?? false });
  }, [data, s?.tenant_id, s?.client_id, s?.sender_address, s?.sender_name, s?.reply_to, s?.enabled]);
  const shell = (children: React.ReactNode) => <DashboardLayout title="Email settings" subtitle="Send this centre's email through its own Microsoft 365" navItems={navItems} groupLabel={groupLabel}>{children}</DashboardLayout>;

  if (isLoading) return shell(<LoadingSpinner text="Loading..." className="py-8" />);
  if (error || !data) return shell(<Alert variant="destructive"><AlertDescription>{(error as Error)?.message ?? "Could not load the email settings"}</AlertDescription></Alert>);

  const tenantOk = /^[0-9a-f-]{36}$/i.test(f.tenant.trim()) ? GUID.test(f.tenant.trim()) : /^[a-z0-9][a-z0-9.-]*\.[a-z]{2,}$/i.test(f.tenant.trim());
  const valid = tenantOk && GUID.test(f.client.trim()) && MAIL.test(f.sender.trim()) && (!f.replyTo.trim() || MAIL.test(f.replyTo.trim())) && (!!s?.has_secret || f.secret.trim().length >= 8);
  const dirty = !s || s.tenant_id !== f.tenant.trim().toLowerCase() || s.client_id !== f.client.trim().toLowerCase() || s.sender_address !== f.sender.trim().toLowerCase() || !!f.secret;
  const save = (enabled: boolean) => act.save.mutate({ ...f, tenant: f.tenant.trim(), client: f.client.trim(), secret: f.secret.trim(), sender: f.sender.trim(), replyTo: f.replyTo.trim(), enabled }, { onSuccess: () => setF((x) => ({ ...x, secret: "" })) });
  const canEnable = !!s && s.last_test_ok === true && !dirty;

  return shell(
    <div className="space-y-4">
      <Alert variant={s?.enabled ? "default" : "destructive"}>
        <AlertDescription>
          {s?.enabled
            ? <>Email is <strong>on</strong>. Messages for this centre are sent from <strong>{s.sender_address}</strong> through Microsoft 365.</>
            : <>Email is <strong>off</strong> for this centre, so notifications and trainee emails are waiting in the queue. {!s ? "Enter your Microsoft 365 details below to set it up." : s.last_test_ok ? "Switch it on below." : "Send a successful test email, then switch it on."}</>}
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader><CardTitle className="text-base">Set up Microsoft 365 (once per centre)</CardTitle><CardDescription>Done in your own Microsoft 365 tenant by a Global Administrator. The system never sees a password; it uses an app registration limited to sending mail.</CardDescription></CardHeader>
        <CardContent>
          <ol className="list-decimal space-y-1 pl-5 text-sm">
            <li>In the Microsoft Entra admin centre, open <em>App registrations</em> and choose <em>New registration</em> (single tenant). Copy the <strong>Directory (tenant) ID</strong> and <strong>Application (client) ID</strong>.</li>
            <li>Under <em>Certificates &amp; secrets</em>, create a <em>client secret</em> and copy its <strong>Value</strong> straight away (it is shown once).</li>
            <li>Under <em>API permissions</em>, add Microsoft Graph, <em>Application permissions</em>, <strong>Mail.Send</strong>, then <em>Grant admin consent</em>.</li>
            <li>Create or choose the mailbox the system sends from (for example <code>no-reply@yourvtc.edu.na</code>). It must be a licensed or shared Exchange Online mailbox.</li>
            <li>Recommended: have your Exchange administrator restrict the app to that one mailbox with an application access policy, so it can send as no one else.</li>
            <li>Enter the details below, save, send the test email, then switch email on. Secrets expire (usually after 6 to 24 months): set a reminder to replace it.</li>
          </ol>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Connection details</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1"><Label htmlFor="tenant">Tenant ID or domain</Label><Input id="tenant" value={f.tenant} onChange={(e) => setF({ ...f, tenant: e.target.value })} placeholder="00000000-0000-0000-0000-000000000000" autoComplete="off" /></div>
            <div className="space-y-1"><Label htmlFor="client">Application (client) ID</Label><Input id="client" value={f.client} onChange={(e) => setF({ ...f, client: e.target.value })} placeholder="00000000-0000-0000-0000-000000000000" autoComplete="off" /></div>
            <div className="space-y-1 sm:col-span-2"><Label htmlFor="secret">Client secret value</Label>
              <Input id="secret" type="password" value={f.secret} onChange={(e) => setF({ ...f, secret: e.target.value })} autoComplete="new-password" placeholder={s?.has_secret ? "Saved - leave blank to keep it" : "Paste the secret value"} />
              {s?.has_secret && <p className="text-xs text-muted-foreground">A secret is stored (saved {when(s.secret_saved_at)}). It is never shown again; enter a new one to replace it.</p>}</div>
            <div className="space-y-1"><Label htmlFor="sender">Send from (mailbox)</Label><Input id="sender" type="email" value={f.sender} onChange={(e) => setF({ ...f, sender: e.target.value })} placeholder="no-reply@yourvtc.edu.na" autoComplete="off" /></div>
            <div className="space-y-1"><Label htmlFor="sname">Sender name (optional)</Label><Input id="sname" value={f.senderName} maxLength={80} onChange={(e) => setF({ ...f, senderName: e.target.value })} /></div>
            <div className="space-y-1 sm:col-span-2"><Label htmlFor="reply">Reply-to address (optional)</Label><Input id="reply" type="email" value={f.replyTo} onChange={(e) => setF({ ...f, replyTo: e.target.value })} placeholder="office@yourvtc.edu.na" autoComplete="off" /></div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button disabled={!valid || !dirty || act.save.isPending} onClick={() => save(false)}>{act.save.isPending && <ButtonSpinner />}Save details</Button>
          </div>
          {dirty && !!s && <p className="text-xs text-muted-foreground">Changing the tenant, client, secret or mailbox switches email off until the next successful test.</p>}
        </CardContent>
      </Card>

      {s && (
        <Card>
          <CardHeader><CardTitle className="text-base">Test and switch on</CardTitle><CardDescription>The test goes to the address you signed in with.</CardDescription></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <Button variant="outline" disabled={dirty || act.test.isPending} onClick={() => act.test.mutate()}>{act.test.isPending && <ButtonSpinner />}Send test email</Button>
              {s.last_test_at && <Badge variant={s.last_test_ok ? "default" : "destructive"}>{s.last_test_ok ? "Last test passed" : "Last test failed"} - {when(s.last_test_at)}</Badge>}
              {dirty && <span className="text-xs text-muted-foreground">Save your changes first.</span>}
            </div>
            {s.last_test_ok === false && s.last_test_error && <Alert variant="destructive"><AlertDescription>{s.last_test_error}</AlertDescription></Alert>}
            <div className="flex items-center gap-3 rounded border p-3">
              <Switch id="on" checked={s.enabled} disabled={act.save.isPending || (!s.enabled && !canEnable)} onCheckedChange={(v) => save(v)} aria-label="Send this centre's email through Microsoft 365" />
              <Label htmlFor="on">Send this centre&apos;s email through Microsoft 365</Label>
              {!s.enabled && !canEnable && <span className="text-xs text-muted-foreground">Available after a successful test.</span>}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle className="text-base">Message queue</CardTitle><CardDescription>Email for this centre only. Messages older than 7 days are dropped rather than sent late.</CardDescription></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-6 text-sm">
            <div><div className="text-2xl font-semibold">{data.queue.queued}</div>waiting</div>
            <div><div className="text-2xl font-semibold">{data.queue.sent}</div>sent in 7 days</div>
            <div><div className="text-2xl font-semibold">{data.queue.failed}</div>failed</div>
          </div>
          {data.queue.last_error && <p className="text-xs text-muted-foreground">Latest message note: {data.queue.last_error}</p>}
          {data.queue.failed > 0 && <Button size="sm" variant="outline" disabled={act.requeue.isPending} onClick={() => act.requeue.mutate()}>Try the failed messages again</Button>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">History</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {!data.events.length && <p className="text-sm text-muted-foreground">Nothing has been recorded yet.</p>}
          {data.events.map((e, i) => <div key={i} className="rounded border p-2 text-sm"><span className="font-medium">{EVENT[e.event] ?? e.event}</span>{e.note ? ` - ${e.note}` : ""}<div className="text-xs text-muted-foreground">{e.by ?? "-"} on {when(e.at)}</div></div>)}
        </CardContent>
      </Card>
    </div>
  );
}

export default withRoleAccess(EmailSettings, { requiredRoles: ["organization_admin", "admin"] });
