import { DashboardLayout } from "@/components/DashboardLayout";
import { projectsCoordinatorNavItems } from "@/lib/navigationConfig";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FolderKanban, CheckCircle, Clock, AlertTriangle, Users, Calendar, Plus, Info, Search, Eye } from "lucide-react";
import { useOrganizationContext } from "@/hooks/useOrganizationContext";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { useState } from "react";

const ProjectsCoordinatorDashboard = () => {
  const { organizationId } = useOrganizationContext();
  const [searchTerm, setSearchTerm] = useState("");

  const stats = [
    {
      title: "Active Projects",
      value: "12",
      description: "Currently in progress",
      icon: FolderKanban,
      color: "text-blue-500",
    },
    {
      title: "Completed",
      value: "28",
      description: "This academic year",
      icon: CheckCircle,
      color: "text-green-500",
    },
    {
      title: "Pending Review",
      value: "5",
      description: "Awaiting approval",
      icon: Clock,
      color: "text-yellow-500",
    },
    {
      title: "At Risk",
      value: "2",
      description: "Need attention",
      icon: AlertTriangle,
      color: "text-red-500",
    },
  ];

  const projects = [
    { id: 1, name: "Carpentry Workshop Renovation", department: "Carpentry", status: "in_progress", progress: 65, deadline: "2026-01-15", assignedTo: "John Moyo", budget: 45000 },
    { id: 2, name: "IT Lab Equipment Installation", department: "IT", status: "in_progress", progress: 40, deadline: "2026-02-01", assignedTo: "Mary Dube", budget: 120000 },
    { id: 3, name: "Welding Bay Safety Upgrade", department: "Welding", status: "pending", progress: 0, deadline: "2026-02-15", assignedTo: "Peter Shikongo", budget: 35000 },
    { id: 4, name: "Electrical Training Materials", department: "Electrical", status: "completed", progress: 100, deadline: "2026-01-01", assignedTo: "Sarah Ncube", budget: 25000 },
    { id: 5, name: "Plumbing Workshop Extension", department: "Plumbing", status: "at_risk", progress: 25, deadline: "2026-01-20", assignedTo: "David Zhou", budget: 85000 },
  ];

  const milestones = [
    { id: 1, project: "IT Lab Equipment Installation", milestone: "Equipment Delivery", date: "2026-01-18", status: "upcoming" },
    { id: 2, project: "Welding Bay Safety Upgrade", milestone: "Safety Inspection", date: "2026-01-22", status: "upcoming" },
    { id: 3, project: "Carpentry Workshop Renovation", milestone: "Final Review", date: "2026-01-15", status: "upcoming" },
    { id: 4, project: "Plumbing Workshop Extension", milestone: "Foundation Complete", date: "2026-01-25", status: "at_risk" },
  ];

  const getStatusBadge = (status: string) => {
    const config: Record<string, { variant: "default" | "secondary" | "destructive" | "outline", label: string }> = {
      in_progress: { variant: "default", label: "In Progress" },
      completed: { variant: "secondary", label: "Completed" },
      pending: { variant: "outline", label: "Pending" },
      at_risk: { variant: "destructive", label: "At Risk" },
      upcoming: { variant: "outline", label: "Upcoming" },
    };
    const { variant, label } = config[status] || { variant: "outline" as const, label: status };
    return <Badge variant={variant}>{label}</Badge>;
  };

  const filteredProjects = projects.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.department.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <DashboardLayout
      title="Projects Coordinator Dashboard"
      subtitle="Manage and monitor training projects and initiatives"
      navItems={projectsCoordinatorNavItems}
      groupLabel="Projects Coordinator"
    >
      <div className="space-y-6">
        <Alert>
          <Info className="h-4 w-4" />
          <AlertTitle>Demo Data</AlertTitle>
          <AlertDescription>
            This dashboard displays sample project data for demonstration. Connect to a projects management system to see real data.
          </AlertDescription>
        </Alert>

        {/* Stats Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat) => (
            <Card key={stat.title}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
                <stat.icon className={`h-5 w-5 ${stat.color}`} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
                <p className="text-xs text-muted-foreground">{stat.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Main Content */}
        <Tabs defaultValue="projects" className="space-y-4">
          <TabsList>
            <TabsTrigger value="projects">All Projects</TabsTrigger>
            <TabsTrigger value="milestones">Milestones</TabsTrigger>
            <TabsTrigger value="team">Team Assignments</TabsTrigger>
          </TabsList>

          <TabsContent value="projects" className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="relative w-64">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Search projects..." 
                  className="pl-8"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <Button>
                <Plus className="mr-2 h-4 w-4" /> New Project
              </Button>
            </div>

            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Project Name</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Progress</TableHead>
                    <TableHead>Deadline</TableHead>
                    <TableHead>Assigned To</TableHead>
                    <TableHead>Budget</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProjects.map((project) => (
                    <TableRow key={project.id}>
                      <TableCell className="font-medium">{project.name}</TableCell>
                      <TableCell>{project.department}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Progress value={project.progress} className="w-20" />
                          <span className="text-xs">{project.progress}%</span>
                        </div>
                      </TableCell>
                      <TableCell>{new Date(project.deadline).toLocaleDateString()}</TableCell>
                      <TableCell>{project.assignedTo}</TableCell>
                      <TableCell>N${project.budget.toLocaleString()}</TableCell>
                      <TableCell>{getStatusBadge(project.status)}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm"><Eye className="h-4 w-4" /></Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>

          <TabsContent value="milestones" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Upcoming Milestones
                </CardTitle>
                <CardDescription>Key project deadlines and deliverables</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {milestones.map((milestone) => (
                    <div key={milestone.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div>
                        <p className="font-medium">{milestone.milestone}</p>
                        <p className="text-sm text-muted-foreground">{milestone.project}</p>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="text-sm text-muted-foreground">
                          {new Date(milestone.date).toLocaleDateString()}
                        </span>
                        {getStatusBadge(milestone.status)}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="team" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Team Assignments
                </CardTitle>
                <CardDescription>Project team allocations and workload</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-2">
                  {[
                    { name: "John Moyo", role: "Project Lead", projects: 3, department: "Carpentry" },
                    { name: "Mary Dube", role: "Coordinator", projects: 2, department: "IT" },
                    { name: "Peter Shikongo", role: "Supervisor", projects: 2, department: "Welding" },
                    { name: "Sarah Ncube", role: "Assistant", projects: 1, department: "Electrical" },
                  ].map((member, idx) => (
                    <div key={idx} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <Users className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium">{member.name}</p>
                          <p className="text-sm text-muted-foreground">{member.role} • {member.department}</p>
                        </div>
                      </div>
                      <Badge variant="secondary">{member.projects} projects</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default ProjectsCoordinatorDashboard;
