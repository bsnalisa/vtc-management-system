import { useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { LoadingIndicator } from "@/components/ui/loading-spinner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useRoleNavigation } from "@/hooks/useRoleNavigation";
import { useEscalatedTickets } from "@/hooks/useSupportTickets";
import { SupportTicketsTable } from "@/components/support/SupportTicketsTable";
import { TicketThread } from "@/components/support/TicketThread";

// Super Admin: advanced technical problems that centres' IT administrators could not resolve.
export default function EscalatedTickets() {
  const { navItems, groupLabel } = useRoleNavigation();
  const { data, isLoading, error } = useEscalatedTickets();
  const [openId, setOpenId] = useState<string | null>(null);
  const rows = data ?? [];
  const waiting = rows.filter((t) => t.escalation_status === "escalated");
  const returned = rows.filter((t) => t.escalation_status === "returned");
  const done = rows.filter((t) => t.escalation_status === "resolved");
  const opened = rows.find((t) => t.id === openId) ?? null;

  return (
    <DashboardLayout title="Escalated Tickets" subtitle="Advanced technical issues passed up by centre administrators" navItems={navItems} groupLabel={groupLabel}>
      {error && <Alert variant="destructive"><AlertDescription>{(error as Error).message}</AlertDescription></Alert>}
      <Card>
        <CardHeader>
          <CardTitle>Escalations from every centre</CardTitle>
          <CardDescription>Return a ticket with guidance, or resolve it yourself. The centre's administrator and the requester are notified.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? <div className="flex h-40 items-center justify-center"><LoadingIndicator className="h-8 w-8 text-muted-foreground" /></div> : (
            <Tabs defaultValue="waiting">
              <TabsList className="h-auto flex-wrap justify-start">
                <TabsTrigger value="waiting">Needs my response ({waiting.length})</TabsTrigger>
                <TabsTrigger value="returned">Returned to centre ({returned.length})</TabsTrigger>
                <TabsTrigger value="done">Resolved by me ({done.length})</TabsTrigger>
              </TabsList>
              <TabsContent value="waiting"><SupportTicketsTable tickets={waiting} staffView showCentre onOpen={(t) => setOpenId(t.id)} empty="No escalations are waiting for you" /></TabsContent>
              <TabsContent value="returned"><SupportTicketsTable tickets={returned} staffView showCentre onOpen={(t) => setOpenId(t.id)} empty="Nothing has been returned" /></TabsContent>
              <TabsContent value="done"><SupportTicketsTable tickets={done} staffView showCentre onOpen={(t) => setOpenId(t.id)} empty="Nothing resolved yet" /></TabsContent>
            </Tabs>
          )}
        </CardContent>
      </Card>
      {opened && <TicketThread ticket={opened} viewer="super" onClose={() => setOpenId(null)} />}
    </DashboardLayout>
  );
}
