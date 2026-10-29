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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useRoleNavigation } from "@/hooks/useRoleNavigation";
import { useOrganizationContext } from "@/hooks/useOrganizationContext";
import { useEmailActions, useEmailCentres, useEmailConnections, useEmailOverview, type ConnectionForm, type EmailConnection, type EmailForm } from "@/hooks/useEmailSettings";

const when = (d: string | null) => (d ? new Date(d).toLocaleString() : "-");
const EVENT: Record<string, string> = { connection_saved: "Connection saved", secret_changed: "Client secret replaced", connection_removed: "Connection removed", saved: "Settings saved", enabled: "Email switched on", disabled: "Email switched off", test_ok: "Test passed", test_failed: "Test failed", requeued: "Failed messages requeued" };
const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const DOMAIN = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/;
const blankConn: ConnectionForm = { id: null, name: "", tenant: "", client: "", secret: "" };

function ConnectionsTab() {
  const { data, isLoading, error } = useEmailConnections(true);
  const act = useEmailActions(null);
  const [c, setC] = useState<ConnectionForm>(blankConn);
  const tenantOk = GUID.test(c.tenant.trim()) || /^[a-z0-9][a-z0-9.-]*\.[a-z]{2,}$/i.test(c.tenant.trim());
  const valid = c.name.trim().length >= 2 && tenantOk && GUID.test(c.client.trim()) && (c.id ? true : c.secret.trim().length >= 8);
  const edit = (x: EmailConnection) => setC({ id: x.id, name: x.name, tenant: x.tenant_id, client: x.client_id, secret: "" });
  return (
    <div className="space-y-4">
      <Alert><AlertDescription>
        A connection is one Microsoft 365 tenant with the application registered in it. Most VTCs share <strong>NTA&apos;s</strong> tenant, so they all use one connection and only differ in their domain and mailbox.
        A VTC that already has <strong>its own tenant</strong> gets its own connection. Changing a connection&apos;s tenant, client or secret switches email off for every centre that uses it until each is tested again.
      </AlertDescription></Alert>
      <Card>
        <CardHeader><CardTitle className="text-base">Connections</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? <LoadingSpinner text="Loading..." className="py-4" /> : error ? <Alert variant="destructive"><AlertDescription>{(error as Error).message}</AlertDescription></Alert> : !data?.length ? <p className="text-sm text-muted-foreground">No connection yet. Add NTA&apos;s Microsoft 365 below first.</p> : (
            <Table>
              <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Tenant</TableHead><TableHead>Secret</TableHead><TableHead>Centres using it</TableHead><TableHead /></TableRow></TableHeader>
              <TableBody>
                {data.map((x) => (
                  <TableRow key={x.id}>
                    <TableCell className="font-medium">{x.name}</TableCell>
                    <TableCell className="max-w-[16rem] truncate">{x.tenant_id}</TableCell>
                    <TableCell>{x.has_secret ? `saved ${when(x.secret_saved_at)}` : "missing"}</TableCell>
                    <TableCell className="whitespace-normal">{x.centres.length ? x.centres.join(", ") : "-"}</TableCell>
                    <TableCell className="space-x-2 whitespace-nowrap text-right">
                      <Button size="sm" variant="outline" onClick={() => edit(x)}>Edit</Button>
                      <Button size="sm" variant="ghost" disabled={x.centres.length > 0 || act.deleteConnection.isPending} onClick={() => act.deleteConnection.mutate(x.id)}>Remove</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-base">{c.id ? "Edit connection" : "Add a connection"}</CardTitle>
          <CardDescription>Done in the Microsoft Entra admin centre of that tenant by its Global Administrator. The system never sees a password; it uses an app registration limited to sending mail.</CardDescription></CardHeader>
        <CardContent className="space-y-3">
          <ol className="list-decimal space-y-1 pl-5 text-sm">
            <li>Open <em>App registrations</em> and choose <em>New registration</em> (single tenant). Copy the <strong>Directory (tenant) ID</strong> and <strong>Application (client) ID</strong>.</li>
            <li>Under <em>Certificates &amp; secrets</em>, create a <em>client secret</em> and copy its <strong>Value</strong> straight away (it is shown once).</li>
            <li>Under <em>API permissions</em>, add Microsoft Graph, <em>Application permissions</em>, <strong>Mail.Send</strong>, then <em>Grant admin consent</em>.</li>
            <li>Recommended: have the tenant&apos;s Exchange administrator restrict the app to the VTCs&apos; sending mailboxes (an application access policy on a mail-enabled security group), so it cannot send as anyone else.</li>
            <li>Secrets expire (usually after 6 to 24 months): set a reminder to replace it.</li>
          </ol>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1 sm:col-span-2"><Label htmlFor="cname">Name</Label><Input id="cname" value={c.name} maxLength={80} onChange={(e) => setC({ ...c, name: e.target.value })} placeholder="NTA Microsoft 365" /></div>
            <div className="space-y-1"><Label htmlFor="tenant">Tenant ID or domain</Label><Input id="tenant" value={c.tenant} onChange={(e) => setC({ ...c, tenant: e.target.value })} placeholder="00000000-0000-0000-0000-000000000000" autoComplete="off" /></div>
            <div className="space-y-1"><Label htmlFor="client">Application (client) ID</Label><Input id="client" value={c.client} onChange={(e) => setC({ ...c, client: e.target.value })} placeholder="00000000-0000-0000-0000-000000000000" autoComplete="off" /></div>
            <div className="space-y-1 sm:col-span-2"><Label htmlFor="secret">Client secret value</Label>
              <Input id="secret" type="password" value={c.secret} onChange={(e) => setC({ ...c, secret: e.target.value })} autoComplete="new-password" placeholder={c.id ? "Saved - leave blank to keep it" : "Paste the secret value"} /></div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button disabled={!valid || act.saveConnection.isPending} onClick={() => act.saveConnection.mutate({ ...c, name: c.name.trim(), tenant: c.tenant.trim(), client: c.client.trim(), secret: c.secret.trim() }, { onSuccess: () => setC(blankConn) })}>{act.saveConnection.isPending && <ButtonSpinner />}{c.id ? "Save changes" : "Add connection"}</Button>
            {c.id && <Button variant="ghost" onClick={() => setC(blankConn)}>Cancel</Button>}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function CentreTab({ orgId, canPickConnection }: { orgId: string | null | undefined; canPickConnection: boolean }) {
  const { data, isLoading, error } = useEmailOverview(orgId);
  const conns = useEmailConnections(canPickConnection);
  const act = useEmailActions(orgId);
  const [f, setF] = useState<EmailForm>({ connection: "", domain: "", sender: "", senderName: "", replyTo: "", enabled: false });
  const s = data?.settings ?? null;
  useEffect(() => {
    if (data) setF({ connection: s?.connection_id ?? "", domain: s?.email_domain ?? "", sender: s?.sender_address ?? "", senderName: s?.sender_name ?? "", replyTo: s?.reply_to ?? "", enabled: s?.enabled ?? false });
  }, [data, s?.connection_id, s?.email_domain, s?.sender_address, s?.sender_name, s?.reply_to, s?.enabled]);

  if (isLoading) return <LoadingSpinner text="Loading..." className="py-8" />;
  if (error || !data) return <Alert variant="destructive"><AlertDescription>{(error as Error)?.message ?? "Could not load the email settings"}</AlertDescription></Alert>;

  const edit = data.can_edit;
  const domain = f.domain.trim().toLowerCase();
  const senderOk = MAIL.test(f.sender.trim()) && f.sender.trim().toLowerCase().endsWith(`@${domain}`);
  const valid = !!f.connection && DOMAIN.test(domain) && senderOk && (!f.replyTo.trim() || MAIL.test(f.replyTo.trim()));
  const dirty = !s || s.connection_id !== f.connection || s.email_domain !== domain || s.sender_address !== f.sender.trim().toLowerCase() || (s.sender_name ?? "") !== f.senderName.trim() || (s.reply_to ?? "") !== f.replyTo.trim().toLowerCase();
  const credentialsChanged = !s || s.connection_id !== f.connection || s.email_domain !== domain || s.sender_address !== f.sender.trim().toLowerCase();
  const save = (enabled: boolean) => act.save.mutate({ ...f, domain, sender: f.sender.trim(), senderName: f.senderName.trim(), replyTo: f.replyTo.trim(), enabled });
  const canEnable = !!s && s.last_test_ok === true && !credentialsChanged;
  const name = data.centre ?? "this centre";

  return (
    <div className="space-y-4">
      <Alert variant={s?.enabled ? "default" : "destructive"}>
        <AlertDescription>
          {s?.enabled
            ? <>Email is <strong>on</strong> for {name}. Messages are sent from <strong>{s.sender_address}</strong> through Microsoft 365.</>
            : <>Email is <strong>off</strong> for {name}, so notifications and trainee emails are waiting in the queue. {!edit ? "The Super Admin sets up email for each centre." : !s ? "Choose the centre's connection, domain and sending mailbox below." : s.last_test_ok ? "Switch it on below." : "Send a successful test email, then switch it on."}</>}
        </AlertDescription>
      </Alert>

      {edit ? (
        <Card>
          <CardHeader><CardTitle className="text-base">Domain and mailbox - {name}</CardTitle>
            <CardDescription>Pick the Microsoft 365 connection this centre belongs to (NTA&apos;s, or the centre&apos;s own tenant), then give the centre&apos;s email domain and the mailbox the system sends from.</CardDescription></CardHeader>
          <CardContent className="space-y-3">
            {conns.data && !conns.data.length && <Alert variant="destructive"><AlertDescription>Add a Microsoft 365 connection on the Connections tab first.</AlertDescription></Alert>}
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1 sm:col-span-2"><Label>Microsoft 365 connection</Label>
                <Select value={f.connection} onValueChange={(v) => setF({ ...f, connection: v })}>
                  <SelectTrigger aria-label="Microsoft 365 connection"><SelectValue placeholder="Choose a connection" /></SelectTrigger>
                  <SelectContent>{(conns.data ?? []).map((x) => <SelectItem key={x.id} value={x.id}>{x.name}</SelectItem>)}</SelectContent>
                </Select></div>
              <div className="space-y-1"><Label htmlFor="domain">Centre email domain</Label><Input id="domain" value={f.domain} onChange={(e) => setF({ ...f, domain: e.target.value })} placeholder="nvtc.edu.na" autoComplete="off" /></div>
              <div className="space-y-1"><Label htmlFor="sender">Send from (mailbox on that domain)</Label><Input id="sender" type="email" value={f.sender} onChange={(e) => setF({ ...f, sender: e.target.value })} placeholder={`no-reply@${domain || "nvtc.edu.na"}`} autoComplete="off" />
                {f.sender && domain && !senderOk && <p className="text-xs text-destructive">The mailbox must end with @{domain}.</p>}</div>
              <div className="space-y-1"><Label htmlFor="sname">Sender name (optional)</Label><Input id="sname" value={f.senderName} maxLength={80} onChange={(e) => setF({ ...f, senderName: e.target.value })} /></div>
              <div className="space-y-1"><Label htmlFor="reply">Reply-to address (optional)</Label><Input id="reply" type="email" value={f.replyTo} onChange={(e) => setF({ ...f, replyTo: e.target.value })} placeholder={`office@${domain || "nvtc.edu.na"}`} autoComplete="off" /></div>
            </div>
            <p className="text-xs text-muted-foreground">The mailbox must already exist in that tenant (a shared mailbox needs no licence) and the domain must be verified there, with SPF, DKIM and DMARC set up so the email is not marked as spam.</p>
            <div className="flex flex-wrap gap-2">
              <Button disabled={!valid || !dirty || act.save.isPending} onClick={() => save(false)}>{act.save.isPending && <ButtonSpinner />}Save details</Button>
            </div>
            {dirty && !!s && credentialsChanged && <p className="text-xs text-muted-foreground">Changing the connection, domain or mailbox switches email off until the next successful test.</p>}
          </CardContent>
        </Card>
      ) : s && (
        <Card>
          <CardHeader><CardTitle className="text-base">Sending details</CardTitle></CardHeader>
          <CardContent className="space-y-1 text-sm">
            <div>Domain: <strong>@{s.email_domain}</strong></div>
            <div>Sending mailbox: <strong>{s.sender_address}</strong></div>
            <div>Last test: {s.last_test_at ? <Badge variant={s.last_test_ok ? "default" : "destructive"}>{s.last_test_ok ? "Passed" : "Failed"} - {when(s.last_test_at)}</Badge> : "not yet tested"}</div>
          </CardContent>
        </Card>
      )}

      {edit && s && (
        <Card>
          <CardHeader><CardTitle className="text-base">Test and switch on</CardTitle><CardDescription>The test goes to the address you signed in with.</CardDescription></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <Button variant="outline" disabled={credentialsChanged || act.test.isPending} onClick={() => act.test.mutate()}>{act.test.isPending && <ButtonSpinner />}Send test email</Button>
              {s.last_test_at && <Badge variant={s.last_test_ok ? "default" : "destructive"}>{s.last_test_ok ? "Last test passed" : "Last test failed"} - {when(s.last_test_at)}</Badge>}
              {credentialsChanged && <span className="text-xs text-muted-foreground">Save your changes first.</span>}
            </div>
            {s.last_test_ok === false && s.last_test_error && <Alert variant="destructive"><AlertDescription>{s.last_test_error}</AlertDescription></Alert>}
            <div className="flex items-center gap-3 rounded border p-3">
              <Switch id="on" checked={s.enabled} disabled={act.save.isPending || (!s.enabled && !canEnable)} onCheckedChange={(v) => save(v)} aria-label={`Send ${name}'s email through Microsoft 365`} />
              <Label htmlFor="on">Send {name}&apos;s email through Microsoft 365</Label>
              {!s.enabled && !canEnable && <span className="text-xs text-muted-foreground">Available after a successful test.</span>}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle className="text-base">Message queue</CardTitle><CardDescription>Email for {name} only. Messages older than 7 days are dropped rather than sent late.</CardDescription></CardHeader>
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

function EmailSettings() {
  const { navItems, groupLabel, role } = useRoleNavigation();
  const { organizationId } = useOrganizationContext();
  const isSuper = role === "super_admin";
  const centres = useEmailCentres(isSuper);
  const [picked, setPicked] = useState<string | null>(null);
  const shell = (children: React.ReactNode) => <DashboardLayout title="Email settings" subtitle="Each centre sends its email through Microsoft 365 on its own domain" navItems={navItems} groupLabel={groupLabel}>{children}</DashboardLayout>;

  if (!isSuper) return shell(<CentreTab orgId={organizationId} canPickConnection={false} />);

  return shell(
    <Tabs defaultValue="centres">
      <TabsList><TabsTrigger value="centres">Centres</TabsTrigger><TabsTrigger value="connections">Microsoft 365 connections</TabsTrigger></TabsList>
      <TabsContent value="centres" className="space-y-4 pt-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Centres</CardTitle><CardDescription>Every centre has its own email domain. Choose a centre to set up or check its email.</CardDescription></CardHeader>
          <CardContent>
            {centres.isLoading ? <LoadingSpinner text="Loading..." className="py-4" /> : centres.error ? <Alert variant="destructive"><AlertDescription>{(centres.error as Error).message}</AlertDescription></Alert> : (
              <Table>
                <TableHeader><TableRow><TableHead>Centre</TableHead><TableHead>Domain</TableHead><TableHead>Connection</TableHead><TableHead>Email</TableHead><TableHead className="text-right">Waiting</TableHead><TableHead className="text-right">Failed</TableHead><TableHead /></TableRow></TableHeader>
                <TableBody>
                  {(centres.data ?? []).map((c) => (
                    <TableRow key={c.id} className={picked === c.id ? "bg-muted/50" : undefined}>
                      <TableCell className="font-medium">{c.name}</TableCell>
                      <TableCell>{c.email_domain ? `@${c.email_domain}` : "-"}</TableCell>
                      <TableCell>{c.connection_name ?? "-"}</TableCell>
                      <TableCell>{!c.configured ? <Badge variant="outline">Not set up</Badge> : c.enabled ? <Badge>On</Badge> : <Badge variant="destructive">Off</Badge>}</TableCell>
                      <TableCell className="text-right">{c.queued}</TableCell>
                      <TableCell className="text-right">{c.failed}</TableCell>
                      <TableCell className="text-right"><Button size="sm" variant={picked === c.id ? "default" : "outline"} onClick={() => setPicked(c.id)}>{c.configured ? "Manage" : "Set up"}</Button></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
        {picked && <CentreTab key={picked} orgId={picked} canPickConnection />}
      </TabsContent>
      <TabsContent value="connections" className="pt-2"><ConnectionsTab /></TabsContent>
    </Tabs>
  );
}

export default withRoleAccess(EmailSettings, { requiredRoles: ["organization_admin", "admin", "super_admin"] });
