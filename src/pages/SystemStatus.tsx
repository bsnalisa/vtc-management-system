import { useNavigate } from "react-router-dom";
import { AlertTriangle, CheckCircle2, Mail, ServerCog, UserX } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { DashboardLayout } from "@/components/DashboardLayout";
import { LoadingIndicator } from "@/components/ui/loading-spinner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useRoleNavigation } from "@/hooks/useRoleNavigation";
import { useItSystemStatus } from "@/hooks/useItSupport";

const when = (iso: string) => formatDistanceToNow(new Date(iso), { addSuffix: true });
const Empty = ({ text }: { text: string }) => <p className="flex items-center gap-2 py-3 text-sm text-muted-foreground"><CheckCircle2 className="h-4 w-4 text-primary" />{text}</p>;

// Diagnostics for the centre's IT administrator, from the system's own records: undelivered messages, accounts that could not be set up, and people who cannot sign in.
export default function SystemStatus() {
  const { navItems, groupLabel } = useRoleNavigation();
  const navigate = useNavigate();
  const { data, isLoading, error } = useItSystemStatus();
  const c = data?.counts;
  const problems = (c && !c.delivery_configured ? 1 : 0) + (c?.messages_waiting ?? 0) + (c?.messages_failed_7d ?? 0) + (c?.account_setup_failures_14d ?? 0) + (data?.accounts.failed_logins ?? 0);

  return (
    <DashboardLayout title="System Diagnostics" subtitle="What is failing at your centre right now" navItems={navItems} groupLabel={groupLabel}>
      {error && <Alert variant="destructive"><AlertDescription>{(error as Error).message}</AlertDescription></Alert>}
      {isLoading || !data ? <div className="flex h-64 items-center justify-center"><LoadingIndicator className="h-8 w-8 text-muted-foreground" /></div> : (
        <div className="space-y-6">
          <Alert variant={problems ? "destructive" : "default"}>
            {problems ? <AlertTriangle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
            <AlertDescription>{problems ? `${problems} thing${problems === 1 ? "" : "s"} need attention below.` : "Nothing is failing at your centre."}</AlertDescription>
          </Alert>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["Messages waiting over an hour", c!.messages_waiting, Mail],
              ["Failed messages (7 days)", c!.messages_failed_7d, Mail],
              ["Account set-up failures (14 days)", c!.account_setup_failures_14d, UserX],
              ["Modules enabled", c!.modules_enabled, ServerCog],
            ].map(([label, value, Icon]) => {
              const I = Icon as typeof Mail;
              return (
                <Card key={label as string}><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">{label as string}</CardTitle><I className="h-4 w-4 text-muted-foreground" /></CardHeader>
                  <CardContent><div className="text-3xl font-bold">{value as number}</div></CardContent></Card>
              );
            })}
          </div>

          <Card>
            <CardHeader><CardTitle>Message delivery</CardTitle><CardDescription>Emails and SMS to trainees and staff are sent by a background job.</CardDescription></CardHeader>
            <CardContent className="space-y-2 text-sm">
              {c!.delivery_configured ? (
                <p>Delivery is switched on. {c!.messages_sent_7d} message{c!.messages_sent_7d === 1 ? "" : "s"} sent in the last 7 days.</p>
              ) : (
                <>
                  <p className="font-medium">Message delivery is not set up, so messages stay in the queue and are never sent.</p>
                  <p className="text-muted-foreground">This is a platform set-up step for the Super Admin: store the functions URL and dispatch secret in the database vault, add the matching DISPATCH_SECRET and email provider keys to the edge functions, then the queue sends within five minutes. See docs/messaging-setup.md.</p>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Account set-up failures</CardTitle><CardDescription>Trainee accounts the system could not create. Check the details, then use Support Tickets to follow up or escalate.</CardDescription></CardHeader>
            <CardContent>
              {data.account_setup_failures.length === 0 ? <Empty text="No account set-up failures." /> : (
                <Table><TableHeader><TableRow><TableHead>When</TableHead><TableHead>Account</TableHead><TableHead>Step</TableHead><TableHead>Error</TableHead></TableRow></TableHeader>
                  <TableBody>{data.account_setup_failures.map((f, i) => (
                    <TableRow key={i}><TableCell className="whitespace-nowrap">{when(f.created_at)}</TableCell><TableCell>{f.email ?? "-"}</TableCell><TableCell>{f.trigger ?? "-"}</TableCell><TableCell className="whitespace-normal text-sm">{f.error ?? "No detail recorded"}</TableCell></TableRow>
                  ))}</TableBody></Table>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Messages not delivered</CardTitle><CardDescription>Emails and notifications that are stuck in the queue or failed to send.</CardDescription></CardHeader>
            <CardContent className="space-y-4">
              {data.waiting_messages.length === 0 && data.failed_messages.length === 0 ? <Empty text="All messages have been delivered." /> : (<>
                {data.waiting_messages.length > 0 && (<div><p className="mb-1 text-sm font-medium">Waiting more than an hour</p>
                  <Table><TableHeader><TableRow><TableHead>Queued</TableHead><TableHead>Channel</TableHead><TableHead>To</TableHead><TableHead>Subject</TableHead><TableHead>Attempts</TableHead></TableRow></TableHeader>
                    <TableBody>{data.waiting_messages.map((m, i) => <TableRow key={i}><TableCell className="whitespace-nowrap">{when(m.created_at)}</TableCell><TableCell>{m.channel}</TableCell><TableCell>{m.recipient}</TableCell><TableCell className="whitespace-normal">{m.subject ?? "-"}</TableCell><TableCell>{m.attempts}</TableCell></TableRow>)}</TableBody></Table></div>)}
                {data.failed_messages.length > 0 && (<div><p className="mb-1 text-sm font-medium">Failed</p>
                  <Table><TableHeader><TableRow><TableHead>When</TableHead><TableHead>Channel</TableHead><TableHead>To</TableHead><TableHead>Error</TableHead><TableHead>Attempts</TableHead></TableRow></TableHeader>
                    <TableBody>{data.failed_messages.map((m, i) => <TableRow key={i}><TableCell className="whitespace-nowrap">{when(m.created_at)}</TableCell><TableCell>{m.channel}</TableCell><TableCell>{m.recipient}</TableCell><TableCell className="whitespace-normal text-sm">{m.error ?? "-"}</TableCell><TableCell>{m.attempts}</TableCell></TableRow>)}</TableBody></Table></div>)}
              </>)}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>People who may need help signing in</CardTitle><CardDescription>Repeated failed sign-ins, deactivated accounts and accounts that have never been used.</CardDescription></CardHeader>
            <CardContent>
              {data.accounts.needs_help.length === 0 ? <Empty text="Nobody needs sign-in help right now." /> : (
                <ul className="divide-y">{data.accounts.needs_help.map((a) => (
                  <li key={a.email} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                    <div><div className="font-medium">{a.name ?? a.email}</div><div className="text-xs text-muted-foreground">{a.email} · {a.roles.replace(/_/g, " ")}</div></div>
                    <div className="flex items-center gap-2"><Badge variant={a.reason === "failed_logins" ? "destructive" : "secondary"}>{a.detail}</Badge>
                      <Button size="sm" variant="outline" onClick={() => navigate(`/users?q=${encodeURIComponent(a.email)}`)}>Open account</Button></div>
                  </li>))}</ul>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </DashboardLayout>
  );
}
