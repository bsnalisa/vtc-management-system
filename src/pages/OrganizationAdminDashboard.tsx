import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import {
  AlertCircle, AlertTriangle, ArrowUpCircle, CalendarClock, CheckCircle2, ClipboardCheck, FileText, History, LifeBuoy, MailWarning, ServerCog,
  Settings, Shield, UserCheck, UserCog, Users, Workflow,
} from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { PriorityBadge, StatusBadge } from "@/components/support/TicketThread";
import { useRoleNavigation } from "@/hooks/useRoleNavigation";
import { useProfile } from "@/hooks/useProfile";
import { useItDashboard } from "@/hooks/useItSupport";
import { useEmailOverview } from "@/hooks/useEmailSettings";
import { useOrganizationContext } from "@/hooks/useOrganizationContext";

const ago = (iso: string) => formatDistanceToNow(new Date(iso), { addSuffix: true });
const label = (v: string) => v.replace(/_/g, " ");
const Quiet = ({ text }: { text: string }) => <p className="flex items-center gap-2 py-2 text-sm text-muted-foreground"><CheckCircle2 className="h-4 w-4 text-primary" />{text}</p>;

// The Organization Admin is the centre's IT Systems Administrator: support requests, account help, centre set-up and system health.
const OrganizationAdminDashboard = () => {
  const navigate = useNavigate();
  const { navItems, groupLabel } = useRoleNavigation();
  const { data: profile } = useProfile();
  const { data: d, isLoading, error } = useItDashboard();
  const { organizationId } = useOrganizationContext();
  const { data: mail } = useEmailOverview(organizationId);

  useEffect(() => { if (error) toast.error(`Could not load the dashboard: ${(error as Error).message}`); }, [error]);

  const t = d?.tickets;
  const a = d?.accounts;
  const sys = d?.system;
  const accountsToHelp = (a?.failed_logins ?? 0) + (a?.deactivated ?? 0) + (a?.never_signed_in ?? 0);
  const alerts = d ? [
    ...(t!.escalated > 0 ? [{ tone: "info", text: `${t!.escalated} ticket${t!.escalated === 1 ? " is" : "s are"} with the Super Admin`, url: "/support-tickets?tab=escalated" }] : []),
    ...(t!.returned > 0 ? [{ tone: "warn", text: `${t!.returned} escalated ticket${t!.returned === 1 ? " was" : "s were"} returned to you with guidance`, url: "/support-tickets?tab=escalated" }] : []),
    ...(sys!.account_setup_failures_14d > 0 ? [{ tone: "warn", text: `${sys!.account_setup_failures_14d} trainee account set-up failure${sys!.account_setup_failures_14d === 1 ? "" : "s"} in the last 14 days`, url: "/system-status" }] : []),
    ...(mail && !mail.settings?.enabled ? [{ tone: "warn", text: "Email is not switched on for this centre, so no email is being sent. The Super Admin sets up Microsoft 365 for each centre; check Email Settings", url: "/email-settings" }] : []),
    ...(!sys!.delivery_configured ? [{ tone: "warn", text: "Message delivery is not set up, so no email or SMS is being sent. The Super Admin must complete the set-up", url: "/system-status" }] : []),
    ...(sys!.delivery_configured && sys!.messages_waiting > 0 ? [{ tone: "warn", text: `${sys!.messages_waiting} message${sys!.messages_waiting === 1 ? " has" : "s have"} been waiting to send for over an hour`, url: "/system-status" }] : []),
    ...(sys!.messages_failed_7d > 0 ? [{ tone: "warn", text: `${sys!.messages_failed_7d} message${sys!.messages_failed_7d === 1 ? "" : "s"} failed to send this week`, url: "/system-status" }] : []),
    ...(a!.failed_logins > 0 ? [{ tone: "warn", text: `${a!.failed_logins} account${a!.failed_logins === 1 ? " has" : "s have"} repeated failed sign-ins`, url: "/system-status" }] : []),
  ] : [];

  return (
    <DashboardLayout title={`Welcome back, ${profile?.firstname || "User"}`} subtitle="IT systems administration" navItems={navItems} groupLabel={groupLabel}>
      <DashboardShell
        name={profile?.firstname || undefined}
        heroIcon={ServerCog}
        heroSubtitle="Support requests, account help, centre set-up and system health for your centre."
        stats={[
          { label: "Open tickets", value: (t?.open ?? 0) + (t?.in_progress ?? 0), icon: LifeBuoy, loading: isLoading, hint: `${t?.open ?? 0} new, ${t?.in_progress ?? 0} in progress`, tone: (t?.open ?? 0) > 0 ? "destructive" : "secondary" },
          { label: "Awaiting a response", value: t?.awaiting_response ?? 0, icon: ClipboardCheck, loading: isLoading, hint: "The requester wrote last", tone: (t?.awaiting_response ?? 0) > 0 ? "destructive" : "secondary" },
          { label: "Assigned to me", value: t?.assigned_to_me ?? 0, icon: UserCheck, loading: isLoading, hint: `${t?.unassigned ?? 0} unassigned in the centre` },
          { label: "With the Super Admin", value: t?.escalated ?? 0, icon: ArrowUpCircle, loading: isLoading, hint: `${t?.returned ?? 0} returned with guidance`, tone: "accent" },
          { label: "Resolved (14 days)", value: t?.resolved_14d ?? 0, icon: CheckCircle2, loading: isLoading, tone: "secondary" },
          { label: "Accounts needing help", value: accountsToHelp, icon: UserCog, loading: isLoading, hint: `${a?.total ?? 0} accounts in the centre`, tone: accountsToHelp > 0 ? "destructive" : "secondary" },
        ]}
        actions={[
          { icon: LifeBuoy, label: "Support Tickets", desc: "Queue and escalations", url: "/support-tickets", badge: (t?.open ?? 0) + (t?.in_progress ?? 0) },
          { icon: Users, label: "User Accounts", desc: "Search, reset, deactivate", url: "/users" },
          { icon: Shield, label: "Roles & Permissions", desc: "Ordinary and custom roles", url: "/roles" },
          { icon: Settings, label: "Organization Settings", desc: "Identity, logo, branding", url: "/organization-settings" },
          { icon: CalendarClock, label: "Registration Windows", desc: "Application periods", url: "/registration-windows" },
          { icon: FileText, label: "Document Settings", desc: "Templates and numbering", url: "/document-settings" },
          { icon: Workflow, label: "Workflows", desc: "Approval processes", url: "/workflows" },
          { icon: History, label: "Audit Trail", desc: "Who changed what", url: "/system-logs" },
        ]}
        actionCols={4}
      >
        {isLoading && <div className="flex justify-center py-6"><LoadingSpinner text="Loading your support queue" /></div>}
        {error && <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertDescription>The dashboard could not be loaded: {(error as Error).message}</AlertDescription></Alert>}
        {d && (
          <>
            {alerts.length > 0 && (
              <Card>
                <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-base"><AlertTriangle className="h-4 w-4 text-destructive" />Needs your attention</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  {alerts.map((al) => (
                    <div key={al.text} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                      <span>{al.text}</span><Button size="sm" variant="outline" onClick={() => navigate(al.url)}>Review</Button>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            <div className="grid gap-6 lg:grid-cols-3">
              <Card className="lg:col-span-2">
                <CardHeader><CardTitle>Support queue</CardTitle><CardDescription>Open tickets, most urgent first</CardDescription></CardHeader>
                <CardContent>
                  {d.queue.length === 0 ? <Quiet text="No open tickets. Nothing is waiting for support." /> : (
                    <ul className="divide-y">
                      {d.queue.map((q) => (
                        <li key={q.id}>
                          <button type="button" onClick={() => navigate(`/support-tickets?ticket=${q.id}`)} className="flex w-full flex-wrap items-center justify-between gap-2 py-2 text-left hover:bg-muted/40">
                            <div className="min-w-0">
                              <div className="truncate text-sm font-medium">{q.subject}</div>
                              <div className="text-xs text-muted-foreground">{q.reference} · {q.requester ?? "Unknown"} · {ago(q.created_at)}{q.assignee ? ` · ${q.mine ? "you" : q.assignee}` : " · unassigned"}</div>
                            </div>
                            <div className="flex flex-wrap items-center gap-1">
                              <PriorityBadge priority={q.priority} /><StatusBadge status={q.status} />
                              {q.awaiting_response && <Badge variant="outline">Awaiting reply</Badge>}
                              {q.escalation_status === "escalated" && <Badge variant="destructive">With Super Admin</Badge>}
                              {q.escalation_status === "returned" && <Badge variant="secondary">Guidance received</Badge>}
                            </div>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  <Button variant="link" className="px-0" onClick={() => navigate("/support-tickets")}>Open the support queue</Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle>Accounts needing help</CardTitle><CardDescription>Sign-in and access problems</CardDescription></CardHeader>
                <CardContent>
                  {a!.needs_help.length === 0 ? <Quiet text="Nobody needs sign-in help." /> : (
                    <ul className="space-y-3">
                      {a!.needs_help.map((p) => (
                        <li key={p.email} className="text-sm">
                          <div className="font-medium">{p.name ?? p.email}</div>
                          <div className="text-xs text-muted-foreground">{p.email} · {label(p.roles)}</div>
                          <div className="mt-1 flex items-center justify-between gap-2">
                            <Badge variant={p.reason === "failed_logins" ? "destructive" : "secondary"}>{p.detail}</Badge>
                            <Button size="sm" variant="outline" onClick={() => navigate(`/users?q=${encodeURIComponent(p.email)}`)}>Open</Button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
              <Card>
                <CardHeader><CardTitle>System health</CardTitle><CardDescription>From the system's own records</CardDescription></CardHeader>
                <CardContent className="space-y-2 text-sm">
                  {[
                    ["Messages waiting over an hour", sys!.messages_waiting], ["Failed messages (7 days)", sys!.messages_failed_7d],
                    ["Account set-up failures (14 days)", sys!.account_setup_failures_14d], ["Modules enabled", sys!.modules_enabled],
                  ].map(([k, v]) => (
                    <div key={k as string} className="flex items-center justify-between"><span className="text-muted-foreground">{k as string}</span>
                      <span className={`font-semibold ${(v as number) > 0 && k !== "Modules enabled" ? "text-destructive" : ""}`}>{v as number}</span></div>
                  ))}
                  <Button variant="link" className="px-0" onClick={() => navigate("/system-status")}><MailWarning className="mr-1 h-4 w-4" />Open system diagnostics</Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle>Recently resolved</CardTitle><CardDescription>Latest tickets closed out</CardDescription></CardHeader>
                <CardContent>
                  {d.recently_resolved.length === 0 ? <p className="py-2 text-sm text-muted-foreground">No tickets resolved yet.</p> : (
                    <ul className="space-y-2 text-sm">
                      {d.recently_resolved.map((r) => (
                        <li key={r.id}><button type="button" className="text-left hover:underline" onClick={() => navigate(`/support-tickets?tab=resolved&ticket=${r.id}`)}>{r.subject}</button>
                          <div className="text-xs text-muted-foreground">{r.reference}{r.resolved_at ? ` · ${ago(r.resolved_at)}` : ""}{r.escalated ? " · resolved by the Super Admin" : ""}</div></li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle>Recent administrative activity</CardTitle><CardDescription>From the audit trail</CardDescription></CardHeader>
                <CardContent>
                  {d.activity.length === 0 ? <p className="py-2 text-sm text-muted-foreground">No recorded activity yet.</p> : (
                    <ul className="space-y-2 text-sm">
                      {d.activity.map((x, i) => (
                        <li key={i}><div>{x.summary ?? x.action}</div><div className="text-xs text-muted-foreground">{x.actor ?? "System"} · {ago(x.at)}</div></li>
                      ))}
                    </ul>
                  )}
                  <Button variant="link" className="px-0" onClick={() => navigate("/system-logs")}>Open the audit trail</Button>
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </DashboardShell>
    </DashboardLayout>
  );
};

export default OrganizationAdminDashboard;
