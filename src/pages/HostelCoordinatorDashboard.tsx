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

function HostelCoordinatorDashboard() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: buildings } = useHostelBuildings();
  const { data: rooms } = useHostelRooms();
  const { data: allocations } = useHostelAllocations();
  const { data: fees } = useHostelFees();
  const { data: maintenanceIssues } = useHostelMaintenanceIssues();
  const { data: profile } = useProfile();

  const activeAllocations = allocations?.filter(a => a.status === 'active').length || 0;
  const pendingMaintenance = maintenanceIssues?.filter(m => m.status === 'reported').length || 0;
  const overduePayments = fees?.filter(f => f.payment_status === 'overdue').length || 0;
  const totalBeds = rooms?.reduce((sum, room) => sum + (room.capacity || 0), 0) || 0;
  const occupancyRate = totalBeds > 0 ? ((activeAllocations / totalBeds) * 100).toFixed(1) : "0";
  const totalFeeAmount = fees?.reduce((sum, fee) => sum + Number(fee.fee_amount), 0) || 0;
  const totalPaid = fees?.reduce((sum, fee) => sum + Number(fee.amount_paid), 0) || 0;
  const collectionRate = totalFeeAmount > 0 ? ((totalPaid / totalFeeAmount) * 100).toFixed(1) : "0";

  // Real-time updates for hostel data
  useEffect(() => {
    const channel = supabase
      .channel('hostel-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'hostel_allocations'
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['hostel-allocations'] });
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'hostel_fees'
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['hostel-fees'] });
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'hostel_maintenance_issues'
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['hostel-maintenance'] });
        }
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
      title={`Welcome back, ${profile?.firstname || 'User'}`}
      subtitle="Manage hostel operations, allocations, and maintenance"
      navItems={hostelCoordinatorNavItems}
      groupLabel="Hostel Management"
      statsContent={statsContent}
    >
      <div className="space-y-6">
        {(pendingMaintenance > 0 || overduePayments > 0) && (
          <div className="space-y-2">
            {pendingMaintenance > 0 && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  {pendingMaintenance} maintenance issue(s) require attention
                </AlertDescription>
              </Alert>
            )}
            {overduePayments > 0 && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  {overduePayments} hostel fee(s) are overdue
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Buildings</CardTitle>
              <Building className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{buildings?.length || 0}</div>
              <p className="text-xs text-muted-foreground">Hostel buildings</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Occupancy</CardTitle>
              <Bed className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{occupancyRate}%</div>
              <p className="text-xs text-muted-foreground">
                {activeAllocations} of {totalBeds} beds
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Maintenance</CardTitle>
              <Wrench className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{pendingMaintenance}</div>
              <p className="text-xs text-muted-foreground">Pending issues</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Fee Collection</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{collectionRate}%</div>
              <p className="text-xs text-muted-foreground">
                N${totalPaid.toLocaleString()} collected
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Card className="hover:bg-accent cursor-pointer" onClick={() => navigate("/hostel")}>
            <CardHeader>
              <Building className="h-8 w-8 mb-2 text-primary" />
              <CardTitle>Buildings & Rooms</CardTitle>
              <CardDescription>Manage hostel buildings and room configurations</CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline" className="w-full">
                Manage Buildings
              </Button>
            </CardContent>
          </Card>

          <Card className="hover:bg-accent cursor-pointer" onClick={() => navigate("/hostel")}>
            <CardHeader>
              <Users className="h-8 w-8 mb-2 text-primary" />
              <CardTitle>Allocations</CardTitle>
              <CardDescription>View and manage trainee room allocations</CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline" className="w-full">
                Manage Allocations
              </Button>
            </CardContent>
          </Card>

          <Card className="hover:bg-accent cursor-pointer" onClick={() => navigate("/hostel")}>
            <CardHeader>
              <DollarSign className="h-8 w-8 mb-2 text-primary" />
              <CardTitle>Hostel Fees</CardTitle>
              <CardDescription>Track and manage hostel fee payments</CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline" className="w-full">
                Manage Fees
              </Button>
            </CardContent>
          </Card>
        </div>

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
                        issue.status === 'reported' ? 'bg-yellow-100 text-yellow-800' :
                        issue.status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
                        'bg-green-100 text-green-800'
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
      </div>
    </DashboardLayout>
  );
}

export default withRoleAccess(HostelCoordinatorDashboard, {
  requiredRoles: ["hostel_coordinator", "admin", "super_admin"],
});
