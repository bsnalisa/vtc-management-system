import { DashboardLayout } from "@/components/DashboardLayout";
import { useRoleNavigation } from "@/hooks/useRoleNavigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SupportTicketDialog } from "@/components/support/SupportTicketDialog";
import { SupportTicketsTable } from "@/components/support/SupportTicketsTable";
import { useSupportTickets } from "@/hooks/useSupportTickets";
import { Loader2 } from "lucide-react";

export default function SupportTickets() {
  const { role, navItems, groupLabel } = useRoleNavigation();
  const { data: tickets, isLoading } = useSupportTickets();

  const isAdmin = role === 'admin' || role === 'organization_admin' || role === 'super_admin';

  const openTickets = tickets?.filter(t => t.status === 'open') || [];
  const inProgressTickets = tickets?.filter(t => t.status === 'in_progress') || [];
  const resolvedTickets = tickets?.filter(t => t.status === 'resolved' || t.status === 'closed') || [];

  if (isLoading) {
    return (
      <DashboardLayout
        title="Support Tickets"
        subtitle="Manage support requests"
        navItems={navItems}
        groupLabel={groupLabel}
      >
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      title="Support Tickets"
      subtitle={isAdmin ? "View and resolve support requests from your organization" : "Submit and track your support requests"}
      navItems={navItems}
      groupLabel={groupLabel}
    >
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Support Tickets</CardTitle>
              <CardDescription>
                {isAdmin ? "Manage and resolve user support requests" : "Create and track your support tickets"}
              </CardDescription>
            </div>
            <SupportTicketDialog />
          </div>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="open" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="open">
                Open ({openTickets.length})
              </TabsTrigger>
              <TabsTrigger value="in_progress">
                In Progress ({inProgressTickets.length})
              </TabsTrigger>
              <TabsTrigger value="resolved">
                Resolved ({resolvedTickets.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="open" className="space-y-4">
              <SupportTicketsTable tickets={openTickets} isAdmin={isAdmin} />
            </TabsContent>

            <TabsContent value="in_progress" className="space-y-4">
              <SupportTicketsTable tickets={inProgressTickets} isAdmin={isAdmin} />
            </TabsContent>

            <TabsContent value="resolved" className="space-y-4">
              <SupportTicketsTable tickets={resolvedTickets} isAdmin={isAdmin} />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </DashboardLayout>
  );
}
