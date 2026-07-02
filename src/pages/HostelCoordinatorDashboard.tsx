import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Building, Bed, Users, AlertCircle, Wrench, DollarSign } from "lucide-react";
import { useHostelBuildings, useHostelRooms, useHostelAllocations, useHostelFees, useHostelMaintenanceIssues } from "@/hooks/useHostel";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { withRoleAccess } from "@/components/withRoleAccess";
import { DashboardLayout } from "@/components/DashboardLayout";
import { SidebarGroupLabel, SidebarGroupContent } from "@/components/ui/sidebar";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { hostelCoordinatorNavItems } from "@/lib/navigationConfig";
import { useProfile } from "@/hooks/useProfile";
import { DashboardShell } from "@/components/dashboard/DashboardShell";

function HostelCoordinatorDashboard() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: buildings } = useHostelBuildings();
  const { data: rooms } = useHostelRooms();
  const { data: allocations } = useHostelAllocations();
  const { data: fees } = useHostelFees();
  const { data: maintenanceIssues } = useHostelMaintenanceIssues();
  const { data: profile } = useProfile();

  const activeAllocations = allocations?.filter((a) => a.status === "active").length || 0;
  const pendingMaintenance = maintenanceIssues?.filter((m) => m.status === "reported").length || 0;
  const overduePayments = fees?.filter((f) => f.payment_status === "overdue").length || 0;
  const totalBeds = rooms?.reduce((sum, room) => sum + (room.capacity || 0), 0) || 0;
  const occupancyRate = totalBeds > 0 ? Math.round((activeAllocations / totalBeds) * 100) : 0;
  const totalFeeAmount = fees?.reduce((sum, f) => sum + Number(f.fee_amount), 0) || 0;
  const totalPaid = fees?.reduce((sum, f) => sum + Number(f.amount_paid), 0) || 0;
  const collectionRate = totalFeeAmount > 0 ? Math.round((totalPaid / totalFeeAmount) * 100) : 0;

  useEffect(() => {
    const channel = supabase
      .channel("hostel-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "hostel_allocations" }, () =>
        queryClient.invalidateQueries({ queryKey: ["hostel-allocations"] })
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "hostel_fees" }, () =>
        queryClient.invalidateQueries({ queryKey: ["hostel-fees"] })
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "hostel_maintenance_issues" }, () =>
        queryClient.invalidateQueries({ queryKey: ["hostel-maintenance"] })
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const statsContent = (
    <>
      <SidebarGroupLabel>Quick Stats</SidebarGroupLabel>
      <SidebarGroupContent>
        <div className="space-y-3 px-2 py-1">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Occupancy</span>
            <span className="font-medium text-primary">{occupancyRate}%</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Active Residents</span>
            <span className="font-medium text-green-600">{activeAllocations}</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Collection</span>
            <span className="font-medium text-blue-600">{collectionRate}%</span>
          </div>
        </div>
      </SidebarGroupContent>
    </>
  );

  return (
    <DashboardLayout
      title={`Welcome back, ${profile?.firstname || "User"}`}
      subtitle="Manage hostel operations, allocations, and maintenance"
      navItems={hostelCoordinatorNavItems}
      groupLabel="Hostel Management"
      statsContent={statsContent}
    >
      <DashboardShell
        name={profile?.firstname || undefined}
        heroIcon={Building}
        heroSubtitle="Buildings, allocations, fees and maintenance in one view."
        stats={[
          { label: "Buildings", value: buildings?.length || 0, icon: Building, hint: "Registered hostels" },
          { label: "Occupancy", value: `${occupancyRate}%`, icon: Bed, hint: `${activeAllocations}/${totalBeds} beds`, progress: occupancyRate, tone: "accent" },
          { label: "Maintenance", value: pendingMaintenance, icon: Wrench, hint: "Pending issues", tone: pendingMaintenance > 0 ? "destructive" : "secondary" },
          { label: "Fee Collection", value: `${collectionRate}%`, icon: DollarSign, hint: `N$${totalPaid.toLocaleString()} collected`, progress: collectionRate, tone: "secondary" },
        ]}
        actions={[
          { icon: Building, label: "Buildings & Rooms", desc: "Manage layout", url: "/hostel" },
          { icon: Users, label: "Allocations", desc: "Room assignments", url: "/hostel" },
          { icon: DollarSign, label: "Hostel Fees", desc: "Track payments", url: "/hostel", badge: overduePayments || undefined },
          { icon: Wrench, label: "Maintenance", desc: "Reported issues", url: "/hostel", badge: pendingMaintenance || undefined },
        ]}
        actionCols={4}
      >
        {(pendingMaintenance > 0 || overduePayments > 0) && (
          <div className="space-y-2">
            {pendingMaintenance > 0 && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{pendingMaintenance} maintenance issue(s) require attention</AlertDescription>
              </Alert>
            )}
            {overduePayments > 0 && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{overduePayments} hostel fee(s) are overdue</AlertDescription>
              </Alert>
            )}
          </div>
        )}

        {maintenanceIssues && maintenanceIssues.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Recent Maintenance Issues</CardTitle>
              <CardDescription>Latest reported maintenance concerns</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {maintenanceIssues.slice(0, 5).map((issue) => (
                  <div key={issue.id} className="flex justify-between items-center border-b pb-2">
                    <div>
                      <p className="font-medium">{issue.issue_type.replace("_", " ")}</p>
                      <p className="text-sm text-muted-foreground">{issue.description}</p>
                    </div>
                    <div className="text-right">
                      <p className={`text-sm capitalize px-2 py-1 rounded ${
                        issue.status === "reported" ? "bg-yellow-100 text-yellow-800" :
                        issue.status === "in_progress" ? "bg-blue-100 text-blue-800" :
                        "bg-green-100 text-green-800"
                      }`}>
                        {issue.status.replace("_", " ")}
                      </p>
                    </div>
                  </div>
                ))}
                {maintenanceIssues.length > 5 && (
                  <Button variant="link" onClick={() => navigate("/hostel")} className="w-full">
                    View all {maintenanceIssues.length} maintenance issues
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </DashboardShell>
    </DashboardLayout>
  );
}

export default withRoleAccess(HostelCoordinatorDashboard, {
  requiredRoles: ["hostel_coordinator", "admin", "super_admin"],
});
