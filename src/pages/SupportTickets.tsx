import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { LoadingIndicator } from "@/components/ui/loading-spinner";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useRoleNavigation } from "@/hooks/useRoleNavigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SupportTicketDialog } from "@/components/support/SupportTicketDialog";
import { SupportTicketsTable } from "@/components/support/SupportTicketsTable";
import { TicketThread } from "@/components/support/TicketThread";
import { SupportTicket, isAwaitingResponse, useSupportTickets } from "@/hooks/useSupportTickets";

export default function SupportTickets() {
  const { role, navItems, groupLabel } = useRoleNavigation();
  const { data: tickets, isLoading } = useSupportTickets();
  const [params, setParams] = useSearchParams();
  const [openId, setOpenId] = useState<string | null>(params.get("ticket"));

  const staff = role === "admin" || role === "organization_admin" || role === "super_admin";
  const list = useMemo(() => tickets ?? [], [tickets]);
  const groups = useMemo(() => ({
    open: list.filter((t) => t.status === "open"),
    in_progress: list.filter((t) => t.status === "in_progress" && t.escalation_status !== "escalated"),
    awaiting: list.filter(isAwaitingResponse),
    escalated: list.filter((t) => t.escalation_status === "escalated"),
    returned: list.filter((t) => t.escalation_status === "returned" && (t.status === "open" || t.status === "in_progress")),
    resolved: list.filter((t) => t.status === "resolved" || t.status === "closed"),
    mine: list.filter((t) => t.status === "open" || t.status === "in_progress"),
  }), [list]);

  const tab = params.get("tab") ?? (staff ? "open" : "mine");
  const setTab = (v: string) => { const p = new URLSearchParams(params); p.set("tab", v); p.delete("ticket"); setParams(p, { replace: true }); };
  const opened = list.find((t) => t.id === openId) ?? null;
  const open = (t: SupportTicket) => setOpenId(t.id);
  const close = () => { setOpenId(null); if (params.get("ticket")) { const p = new URLSearchParams(params); p.delete("ticket"); setParams(p, { replace: true }); } };

  if (isLoading) {
    return (
      <DashboardLayout title="Support Tickets" subtitle="Manage support requests" navItems={navItems} groupLabel={groupLabel}>
        <div className="flex h-64 items-center justify-center"><LoadingIndicator className="h-8 w-8 text-muted-foreground" /></div>
      </DashboardLayout>
    );
  }

  const tabs: [string, string, SupportTicket[]][] = staff
    ? [["open", "Open", groups.open], ["in_progress", "In progress", groups.in_progress], ["awaiting", "Awaiting response", groups.awaiting], ["escalated", "Escalated", [...groups.escalated, ...groups.returned]], ["resolved", "Resolved", groups.resolved]]
    : [["mine", "My open tickets", groups.mine], ["resolved", "Resolved", groups.resolved]];

  return (
    <DashboardLayout
      title="Support Tickets"
      subtitle={staff ? "Investigate, resolve and escalate your centre's support requests" : "Ask your centre's IT support for help and follow your requests"}
      navItems={navItems}
      groupLabel={groupLabel}
    >
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle>{staff ? "Support queue" : "My support tickets"}</CardTitle>
              <CardDescription>
                {staff ? "Open a ticket to reply, add internal troubleshooting notes, assign it, resolve it or escalate it to the Super Admin." : "Create a ticket and follow the replies from IT support."}
              </CardDescription>
            </div>
            <SupportTicketDialog />
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={tabs.some(([k]) => k === tab) ? tab : tabs[0][0]} onValueChange={setTab} className="w-full">
            <TabsList className="h-auto w-full flex-wrap justify-start">
              {tabs.map(([k, label, rows]) => <TabsTrigger key={k} value={k}>{label} ({rows.length})</TabsTrigger>)}
            </TabsList>
            {tabs.map(([k, , rows]) => (
              <TabsContent key={k} value={k} className="space-y-4">
                <SupportTicketsTable tickets={[...rows]} staffView={staff} onOpen={open}
                  empty={k === "escalated" ? "Nothing is escalated to the Super Admin" : "No tickets here"} />
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      </Card>
      {opened && <TicketThread ticket={opened} viewer={role === "super_admin" ? "super" : staff ? "admin" : "requester"} onClose={close} />}
    </DashboardLayout>
  );
}
