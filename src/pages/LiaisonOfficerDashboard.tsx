import { useMemo } from "react";
import { Link } from "react-router-dom";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Briefcase, Building2, CalendarCheck, MessageSquare, Handshake, BellRing } from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useRoleNavigation } from "@/hooks/useRoleNavigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { FollowUpsList } from "@/components/liaison/FollowUpsList";
import { INTERACTION_TYPES, todayISO, usePartnerInteractions, usePartnerPlacementCounts, usePartners } from "@/hooks/useLiaison";

const COLOURS = ["--primary", "--secondary", "--accent", "--muted-foreground", "--destructive", "--ring"];
const QUICK = [{ to: "/liaison/partners", label: "Partners" }, { to: "/messages", label: "Messages" }, { to: "/support-tickets", label: "Support tickets" }, { to: "/onboarding", label: "Onboarding" }];
const fmt = (d: string) => new Date(`${d.slice(0, 10)}T00:00:00`).toLocaleDateString();

const LiaisonOfficerDashboard = () => {
  const { navItems, groupLabel } = useRoleNavigation();
  const { data: partners = [], isLoading, error } = usePartners();
  const { data: interactions = [], error: intError } = usePartnerInteractions();
  const { data: placements = {}, error: plError } = usePartnerPlacementCounts();

  const today = todayISO();
  const month = today.slice(0, 7);
  const due = interactions.filter((i) => i.follow_up_date && !i.follow_up_done && i.follow_up_date <= today).sort((a, b) => a.follow_up_date!.localeCompare(b.follow_up_date!));
  const monthContacts = interactions.filter((i) => i.interaction_date.startsWith(month)).length;
  const withPlacements = Object.values(placements).reduce((s, n) => s + n, 0);

  const chart = useMemo(() => {
    const now = new Date();
    return Array.from({ length: 6 }, (_, k) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (5 - k), 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const row: Record<string, string | number> = { month: d.toLocaleDateString(undefined, { month: "short", year: "2-digit" }) };
      INTERACTION_TYPES.forEach((t) => { row[t] = interactions.filter((i) => i.interaction_type === t && i.interaction_date.startsWith(key)).length; });
      return row;
    });
  }, [interactions]);

  const stats = [
    { title: "Partners", value: partners.length, note: "On the register", icon: Building2 },
    { title: "Active partners", value: partners.filter((p) => p.active).length, note: "Currently engaged", icon: Handshake },
    { title: "Contacts this month", value: monthContacts, note: "Calls, visits, meetings...", icon: MessageSquare },
    { title: "Follow-ups due", value: due.length, note: "Today or overdue", icon: BellRing },
    { title: "Placements with partners", value: withPlacements, note: "Internship placements", icon: Briefcase },
  ];
  const loadError = error ?? intError ?? plError;

  return (
    <DashboardLayout title="Liaison Officer Dashboard" subtitle="Employer and industry partner relationships" navItems={navItems} groupLabel={groupLabel}>
      <div className="space-y-6">
        {loadError && <p role="alert" className="text-sm text-destructive">Some figures could not be loaded: {(loadError as Error).message}</p>}
        {isLoading ? <LoadingSpinner text="Loading partner figures..." /> : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              {stats.map((s) => (
                <Card key={s.title}>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">{s.title}</CardTitle><s.icon className="h-4 w-4 text-muted-foreground" /></CardHeader>
                  <CardContent><div className="text-2xl font-bold">{s.value}</div><p className="text-xs text-muted-foreground">{s.note}</p></CardContent>
                </Card>
              ))}
            </div>
            <Card>
              <CardHeader><CardTitle>Quick actions</CardTitle></CardHeader>
              <CardContent className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                {QUICK.map((q) => <Button key={q.to} asChild variant="outline"><Link to={q.to}>{q.label}</Link></Button>)}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Contacts per month</CardTitle><CardDescription>Last six months, by type</CardDescription></CardHeader>
              <CardContent>
                {interactions.length ? (
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={chart}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="month" /><YAxis allowDecimals={false} /><Tooltip /><Legend />
                      {INTERACTION_TYPES.map((t, k) => <Bar key={t} dataKey={t} stackId="a" fill={`hsl(var(${COLOURS[k]}))`} />)}
                    </BarChart>
                  </ResponsiveContainer>
                ) : <p className="text-sm text-muted-foreground text-center py-10">No contacts logged yet.</p>}
              </CardContent>
            </Card>
            <div className="grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between space-y-0">
                  <div><CardTitle>Follow-ups due</CardTitle><CardDescription>Oldest first</CardDescription></div>
                  <Button asChild variant="outline" size="sm"><Link to="/liaison/partners">Open partners</Link></Button>
                </CardHeader>
                <CardContent><FollowUpsList items={due.slice(0, 6)} /></CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle>Recent interactions</CardTitle><CardDescription>Latest contacts logged</CardDescription></CardHeader>
                <CardContent>
                  <ul className="space-y-2 text-sm">
                    {interactions.slice(0, 6).map((i) => (
                      <li key={i.id} className="rounded-md border p-2">
                        <div className="flex flex-wrap items-center gap-2"><span className="font-medium">{i.employers?.name ?? "Partner"}</span><Badge variant="outline">{i.interaction_type}</Badge><span className="text-muted-foreground">{fmt(i.interaction_date)}</span></div>
                        <div className="text-muted-foreground">{i.summary}</div>
                      </li>
                    ))}
                  </ul>
                  {!interactions.length && <p className="text-sm text-muted-foreground text-center py-6">No interactions yet.</p>}
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
};

export default LiaisonOfficerDashboard;
