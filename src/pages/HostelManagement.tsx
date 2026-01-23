import { useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { hostelCoordinatorNavItems } from "@/lib/navigationConfig";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, Bed, Users, DollarSign, Wrench, UserCheck, ClipboardCheck } from "lucide-react";
import { BuildingsTable } from "@/components/hostel/BuildingsTable";
import { RoomsTable } from "@/components/hostel/RoomsTable";
import { AllocationsTable } from "@/components/hostel/AllocationsTable";
import { HostelFeesTable } from "@/components/hostel/HostelFeesTable";
import { MaintenanceIssuesTable } from "@/components/hostel/MaintenanceIssuesTable";
import { VisitorManagementTable } from "@/components/hostel/VisitorManagementTable";
import { RoomInspectionsTable } from "@/components/hostel/RoomInspectionsTable";
import { useHostelBuildings, useHostelRooms, useHostelAllocations } from "@/hooks/useHostel";
import { OnboardingWizard } from "@/components/onboarding/OnboardingWizard";

export default function HostelManagement() {
  const [activeTab, setActiveTab] = useState("overview");
  const { data: buildings = [] } = useHostelBuildings();
  const { data: rooms = [] } = useHostelRooms();
  const { data: allocations = [] } = useHostelAllocations();

  const totalCapacity = buildings.reduce((sum, b) => sum + b.total_capacity, 0);
  const totalOccupancy = buildings.reduce((sum, b) => sum + b.current_occupancy, 0);
  const occupancyRate = totalCapacity > 0 ? ((totalOccupancy / totalCapacity) * 100).toFixed(1) : "0";
  const activeAllocations = allocations.filter(a => a.status === 'active').length;

  return (
    <DashboardLayout
      title="Hostel Management"
      subtitle="Manage accommodation, room allocations, and hostel fees"
      navItems={hostelCoordinatorNavItems}
      groupLabel="Hostel"
    >
      <div className="space-y-6">

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Buildings</CardTitle>
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{buildings.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Rooms</CardTitle>
              <Bed className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{rooms.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Occupancy Rate</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{occupancyRate}%</div>
              <p className="text-xs text-muted-foreground">{totalOccupancy} / {totalCapacity} beds</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Allocations</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{activeAllocations}</div>
            </CardContent>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="flex-wrap">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="buildings">Buildings</TabsTrigger>
            <TabsTrigger value="rooms">Rooms</TabsTrigger>
            <TabsTrigger value="allocations">Allocations</TabsTrigger>
            <TabsTrigger value="fees">Hostel Fees</TabsTrigger>
            <TabsTrigger value="maintenance">Maintenance</TabsTrigger>
            <TabsTrigger value="visitors">Visitors</TabsTrigger>
            <TabsTrigger value="inspections">Inspections</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            {buildings.length === 0 ? (
              <OnboardingWizard type="hostel" />
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle>Buildings Overview</CardTitle>
                    <CardDescription>Active hostel buildings and capacity</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <BuildingsTable limit={5} />
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle>Recent Allocations</CardTitle>
                    <CardDescription>Latest room assignments</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <AllocationsTable limit={5} />
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>

          <TabsContent value="buildings">
            <Card>
              <CardHeader>
                <CardTitle>Hostel Buildings</CardTitle>
                <CardDescription>Manage hostel buildings and their details</CardDescription>
              </CardHeader>
              <CardContent>
                <BuildingsTable />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="rooms">
            <Card>
              <CardHeader>
                <CardTitle>Hostel Rooms</CardTitle>
                <CardDescription>View and manage rooms in each building</CardDescription>
              </CardHeader>
              <CardContent>
                <RoomsTable />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="allocations">
            <Card>
              <CardHeader>
                <CardTitle>Room Allocations</CardTitle>
                <CardDescription>Assign and manage trainee accommodations</CardDescription>
              </CardHeader>
              <CardContent>
                <AllocationsTable />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="fees">
            <Card>
              <CardHeader>
                <CardTitle>Hostel Fees</CardTitle>
                <CardDescription>Track hostel fees and payments</CardDescription>
              </CardHeader>
              <CardContent>
                <HostelFeesTable />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="maintenance">
            <Card>
              <CardHeader>
                <CardTitle>Maintenance Issues</CardTitle>
                <CardDescription>Report and track maintenance issues</CardDescription>
              </CardHeader>
              <CardContent>
                <MaintenanceIssuesTable />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="visitors">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <UserCheck className="h-5 w-5" />
                  Visitor Management
                </CardTitle>
                <CardDescription>Track and manage hostel visitors</CardDescription>
              </CardHeader>
              <CardContent>
                <VisitorManagementTable />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="inspections">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ClipboardCheck className="h-5 w-5" />
                  Room Inspections
                </CardTitle>
                <CardDescription>Record and track room inspections</CardDescription>
              </CardHeader>
              <CardContent>
                <RoomInspectionsTable />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
