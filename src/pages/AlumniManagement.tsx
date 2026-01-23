import { useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { placementOfficerNavItems } from "@/lib/navigationConfig";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  GraduationCap,
  Briefcase,
  Calendar,
  Megaphone,
  Download,
  Search,
  Plus,
  Users,
} from "lucide-react";
import { useAlumni, useAlumniEvents, useAlumniAnnouncements } from "@/hooks/useAlumni";
import { exportToExcel } from "@/lib/exportUtils";
import { withRoleAccess } from "@/components/withRoleAccess";

const AlumniManagement = () => {
  const { alumni, isLoading } = useAlumni();
  const { events } = useAlumniEvents();
  const { announcements } = useAlumniAnnouncements();
  const [searchTerm, setSearchTerm] = useState("");

  const filteredAlumni = alumni?.filter(
    (alum: any) =>
      alum.trainees?.first_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      alum.trainees?.last_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      alum.trainees?.trainee_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      alum.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleExport = () => {
    if (!filteredAlumni || filteredAlumni.length === 0) {
      return;
    }

    const exportData = filteredAlumni.map((alum: any) => ({
      "Trainee ID": alum.trainees?.trainee_id,
      "Name": `${alum.trainees?.first_name} ${alum.trainees?.last_name}`,
      "Graduation Year": alum.graduation_year,
      "Trade": alum.trades?.name,
      "Email": alum.email,
      "Phone": alum.phone,
      "LinkedIn": alum.linkedin_profile,
    }));

    exportToExcel(exportData, "alumni_records");
  };

  const stats = {
    totalAlumni: alumni?.length || 0,
    recentGraduates: alumni?.filter((a: any) => 
      a.graduation_year === new Date().getFullYear()
    ).length || 0,
    upcomingEvents: events?.filter((e: any) => 
      new Date(e.event_date) > new Date()
    ).length || 0,
    activeAnnouncements: announcements?.filter((a: any) => 
      a.status === "published"
    ).length || 0,
  };

  return (
    <DashboardLayout
      title="Alumni Management"
      subtitle="Manage graduate profiles, events, and communications"
      navItems={placementOfficerNavItems}
      groupLabel="Placement"
    >
      <div className="space-y-6">
        <div className="flex justify-end">
          <Button onClick={handleExport} disabled={!filteredAlumni || filteredAlumni.length === 0}>
            <Download className="h-4 w-4 mr-2" />
            Export Data
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Alumni</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalAlumni}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Recent Graduates</CardTitle>
              <GraduationCap className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.recentGraduates}</div>
              <p className="text-xs text-muted-foreground">This year</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Upcoming Events</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.upcomingEvents}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Announcements</CardTitle>
              <Megaphone className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.activeAnnouncements}</div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <Tabs defaultValue="alumni" className="space-y-4">
          <TabsList>
            <TabsTrigger value="alumni">Alumni Profiles</TabsTrigger>
            <TabsTrigger value="employment">Employment Tracking</TabsTrigger>
            <TabsTrigger value="events">Events</TabsTrigger>
            <TabsTrigger value="announcements">Announcements</TabsTrigger>
          </TabsList>

          <TabsContent value="alumni" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Alumni Directory</CardTitle>
                    <CardDescription>View and manage graduate profiles</CardDescription>
                  </div>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Alumni
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="mb-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search alumni..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>

                {isLoading ? (
                  <p className="text-muted-foreground text-center py-8">Loading alumni...</p>
                ) : filteredAlumni && filteredAlumni.length > 0 ? (
                  <div className="space-y-4">
                    {filteredAlumni.map((alum: any) => (
                      <div
                        key={alum.id}
                        className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors"
                      >
                        <div className="flex items-center gap-4">
                          <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                            <GraduationCap className="h-6 w-6 text-primary" />
                          </div>
                          <div>
                            <p className="font-semibold">
                              {alum.trainees?.first_name} {alum.trainees?.last_name}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {alum.trainees?.trainee_id} • {alum.trades?.name}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Class of {alum.graduation_year}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {alum.email && (
                            <Badge variant="outline">{alum.email}</Badge>
                          )}
                          {alum.phone && (
                            <Badge variant="outline">{alum.phone}</Badge>
                          )}
                          <Button variant="outline" size="sm">
                            View Profile
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-center py-8">
                    No alumni records found
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="employment" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Employment Tracking</CardTitle>
                <CardDescription>Monitor alumni career progress</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground text-center py-8">
                  Select an alumni profile to view employment history
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="events" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Alumni Events</CardTitle>
                    <CardDescription>Manage reunions and gatherings</CardDescription>
                  </div>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Event
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {events && events.length > 0 ? (
                  <div className="space-y-4">
                    {events.map((event: any) => (
                      <div
                        key={event.id}
                        className="flex items-center justify-between p-4 border rounded-lg"
                      >
                        <div className="flex items-center gap-4">
                          <Calendar className="h-8 w-8 text-primary" />
                          <div>
                            <p className="font-semibold">{event.event_name}</p>
                            <p className="text-sm text-muted-foreground">
                              {new Date(event.event_date).toLocaleDateString()}
                              {event.location && ` • ${event.location}`}
                            </p>
                          </div>
                        </div>
                        <Badge>{event.status}</Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-center py-8">
                    No events scheduled
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="announcements" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Announcements</CardTitle>
                    <CardDescription>Communicate with alumni</CardDescription>
                  </div>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    New Announcement
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {announcements && announcements.length > 0 ? (
                  <div className="space-y-4">
                    {announcements.map((announcement: any) => (
                      <div
                        key={announcement.id}
                        className="p-4 border rounded-lg"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <p className="font-semibold">{announcement.title}</p>
                          <Badge variant={announcement.status === "published" ? "default" : "secondary"}>
                            {announcement.status}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {announcement.content.substring(0, 150)}...
                        </p>
                        <p className="text-xs text-muted-foreground mt-2">
                          {new Date(announcement.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-center py-8">
                    No announcements yet
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default withRoleAccess(AlumniManagement, {
  requiredRoles: ["placement_officer", "admin", "super_admin", "organization_admin"],
});
