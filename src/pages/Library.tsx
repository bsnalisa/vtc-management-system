import { DashboardLayout } from "@/components/DashboardLayout";
import { useRoleNavigation } from "@/hooks/useRoleNavigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLibraryMembers } from "@/hooks/useLibraryCentre";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { CatalogueTab } from "@/components/library/CatalogueTab";
import { CirculationTab } from "@/components/library/CirculationTab";
import { MembersTab } from "@/components/library/MembersTab";
import { ReservationsTab } from "@/components/library/ReservationsTab";
import { FinesTab } from "@/components/library/FinesTab";
import { InterlibraryTab } from "@/components/library/InterlibraryTab";
import { ReportsSettingsTab } from "@/components/library/ReportsSettingsTab";

const STAFF_ROLES = ["super_admin", "organization_admin", "admin", "librarian", "resource_center_coordinator"];
const TABS = ["catalogue", "circulation", "members", "reservations", "fines", "interlibrary", "reports"];
const STAFF_TABS = ["circulation", "members", "fines", "interlibrary", "reports"];

export default function Library() {
  const { role, navItems, groupLabel } = useRoleNavigation();
  const isStaff = !!role && STAFF_ROLES.includes(role);
  const [searchParams, setSearchParams] = useSearchParams();
  const requested = searchParams.get("tab") ?? "catalogue";
  const tab = TABS.includes(requested) && (isStaff || !STAFF_TABS.includes(requested)) ? requested : "catalogue";
  const { data: members } = useLibraryMembers();
  const { data: userId } = useQuery({
    queryKey: ["auth-user-id"],
    queryFn: async () => (await supabase.auth.getUser()).data.user?.id ?? null,
  });
  // Members can only see their own profile (RLS), so this finds the caller's membership.
  const ownMember = members?.find((m) => m.user_id === userId && m.status === "active");

  return (
    <DashboardLayout title="Resource Centre" subtitle="Library catalogue, circulation and members" navItems={navItems} groupLabel={groupLabel}>
      <Card>
        <CardHeader>
          <CardTitle>Resource Centre</CardTitle>
          <CardDescription>
            {isStaff ? "Manage the catalogue, circulation, members and fines." : ownMember ? "Search the catalogue and manage your reservations." : "Search the catalogue. Ask the librarian to register you as a member to borrow or reserve."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={tab} onValueChange={(v) => setSearchParams({ tab: v }, { replace: true })}>
            <TabsList className="flex flex-wrap h-auto">
              <TabsTrigger value="catalogue">Catalogue</TabsTrigger>
              {isStaff && <TabsTrigger value="circulation">Circulation</TabsTrigger>}
              {isStaff && <TabsTrigger value="members">Members</TabsTrigger>}
              <TabsTrigger value="reservations">Reservations</TabsTrigger>
              {isStaff && <TabsTrigger value="fines">Fines</TabsTrigger>}
              {isStaff && <TabsTrigger value="interlibrary">Interlibrary Loans</TabsTrigger>}
              {isStaff && <TabsTrigger value="reports">Reports &amp; Settings</TabsTrigger>}
            </TabsList>
            <TabsContent value="catalogue"><CatalogueTab isStaff={isStaff} memberId={ownMember?.id} /></TabsContent>
            {isStaff && <TabsContent value="circulation"><CirculationTab /></TabsContent>}
            {isStaff && <TabsContent value="members"><MembersTab /></TabsContent>}
            <TabsContent value="reservations"><ReservationsTab isStaff={isStaff} /></TabsContent>
            {isStaff && <TabsContent value="fines"><FinesTab /></TabsContent>}
            {isStaff && <TabsContent value="interlibrary"><InterlibraryTab /></TabsContent>}
            {isStaff && <TabsContent value="reports"><ReportsSettingsTab /></TabsContent>}
          </Tabs>
        </CardContent>
      </Card>
    </DashboardLayout>
  );
}
