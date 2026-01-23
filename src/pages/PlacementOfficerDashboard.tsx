import { useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Briefcase, Users, Building, TrendingUp, FileText, Calendar, Plus, Search, Eye, Edit } from "lucide-react";
import { withRoleAccess } from "@/components/withRoleAccess";
import { useAlumni } from "@/hooks/useAlumni";
import { useJobPostings, useJobApplications, useInternshipPlacements, useEmployers } from "@/hooks/usePlacement";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { placementOfficerNavItems } from "@/lib/navigationConfig";
import { useProfile } from "@/hooks/useProfile";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useTrades } from "@/hooks/useTrades";
import { toast } from "sonner";

const PlacementOfficerDashboard = () => {
  const navigate = useNavigate();
  const { alumni } = useAlumni();
  const { jobPostings, isLoading: jobsLoading, createJobPosting } = useJobPostings();
  const { applications } = useJobApplications();
  const { placements, isLoading: placementsLoading, createPlacement } = useInternshipPlacements();
  const { employers, isLoading: employersLoading, createEmployer } = useEmployers();
  const { data: profile } = useProfile();
  const { data: trades } = useTrades();

  const [searchTerm, setSearchTerm] = useState("");
  const [isJobDialogOpen, setIsJobDialogOpen] = useState(false);
  const [isEmployerDialogOpen, setIsEmployerDialogOpen] = useState(false);
  const [isPlacementDialogOpen, setIsPlacementDialogOpen] = useState(false);

  const [jobForm, setJobForm] = useState({
    title: "",
    employer_id: "",
    trade_id: "",
    description: "",
    requirements: "",
    location: "",
    salary_range: "",
    application_deadline: "",
  });

  const [employerForm, setEmployerForm] = useState({
    name: "",
    industry: "",
    contact_person: "",
    contact_email: "",
    contact_phone: "",
    address: "",
    website: "",
  });

  const stats = {
    totalAlumni: alumni?.length || 0,
    employed: alumni?.filter((a: any) => 
      a.alumni_employment?.some((e: any) => e.is_current)
    ).length || 0,
    activeJobs: jobPostings?.filter((j: any) => j.status === 'active').length || 0,
    activePlacements: placements?.filter((p: any) => p.status === 'active').length || 0,
    totalApplications: applications?.length || 0,
    partnerEmployers: employers?.filter((e: any) => e.active).length || 0,
  };

  const handleCreateJob = async () => {
    try {
      await createJobPosting.mutateAsync({
        ...jobForm,
        status: "active",
        posted_date: new Date().toISOString(),
      });
      setIsJobDialogOpen(false);
      setJobForm({
        title: "",
        employer_id: "",
        trade_id: "",
        description: "",
        requirements: "",
        location: "",
        salary_range: "",
        application_deadline: "",
      });
      toast.success("Job posting created successfully");
    } catch (error) {
      toast.error("Failed to create job posting");
    }
  };

  const handleCreateEmployer = async () => {
    try {
      await createEmployer.mutateAsync({
        ...employerForm,
        active: true,
      });
      setIsEmployerDialogOpen(false);
      setEmployerForm({
        name: "",
        industry: "",
        contact_person: "",
        contact_email: "",
        contact_phone: "",
        address: "",
        website: "",
      });
    } catch (error) {
      toast.error("Failed to add employer");
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      active: "default",
      closed: "secondary",
      draft: "outline",
      completed: "default",
      pending: "outline",
    };
    return <Badge variant={variants[status] || "outline"}>{status}</Badge>;
  };

  return (
    <DashboardLayout
      title={`Welcome back, ${profile?.firstname || 'User'}`}
      subtitle="Manage alumni placement, job opportunities, and employer relations"
      navItems={placementOfficerNavItems}
      groupLabel="Placement Services"
    >
      <div className="space-y-6">
        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Alumni</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalAlumni}</div>
              <p className="text-xs text-muted-foreground">{stats.employed} employed</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Internships</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.activePlacements}</div>
              <p className="text-xs text-muted-foreground">On attachment</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Job Postings</CardTitle>
              <Briefcase className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.activeJobs}</div>
              <p className="text-xs text-muted-foreground">{stats.totalApplications} applications</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Partner Employers</CardTitle>
              <Building className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.partnerEmployers}</div>
              <p className="text-xs text-muted-foreground">Active partners</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Placement Rate</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {stats.totalAlumni > 0 ? Math.round((stats.employed / stats.totalAlumni) * 100) : 0}%
              </div>
              <p className="text-xs text-muted-foreground">Alumni employed</p>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:bg-accent/50" onClick={() => navigate("/alumni")}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Quick Action</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <Button variant="link" className="p-0 h-auto text-primary">
                Manage Alumni →
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Tabs */}
        <Tabs defaultValue="jobs" className="space-y-4">
          <TabsList>
            <TabsTrigger value="jobs">Job Postings</TabsTrigger>
            <TabsTrigger value="employers">Employers</TabsTrigger>
            <TabsTrigger value="placements">Internship Placements</TabsTrigger>
          </TabsList>

          {/* Job Postings Tab */}
          <TabsContent value="jobs" className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="relative w-64">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Search jobs..." 
                  className="pl-8" 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <Dialog open={isJobDialogOpen} onOpenChange={setIsJobDialogOpen}>
                <DialogTrigger asChild>
                  <Button><Plus className="mr-2 h-4 w-4" /> Post Job</Button>
                </DialogTrigger>
                <DialogContent className="max-w-lg">
                  <DialogHeader>
                    <DialogTitle>Post New Job Opening</DialogTitle>
                    <DialogDescription>Create a job posting for alumni and trainees.</DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                      <Label>Job Title</Label>
                      <Input 
                        value={jobForm.title}
                        onChange={(e) => setJobForm({ ...jobForm, title: e.target.value })}
                        placeholder="e.g., Welder, Electrician"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="grid gap-2">
                        <Label>Employer</Label>
                        <Select value={jobForm.employer_id} onValueChange={(v) => setJobForm({ ...jobForm, employer_id: v })}>
                          <SelectTrigger><SelectValue placeholder="Select employer" /></SelectTrigger>
                          <SelectContent>
                            {employers?.map((emp: any) => (
                              <SelectItem key={emp.id} value={emp.id}>{emp.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid gap-2">
                        <Label>Trade</Label>
                        <Select value={jobForm.trade_id} onValueChange={(v) => setJobForm({ ...jobForm, trade_id: v })}>
                          <SelectTrigger><SelectValue placeholder="Select trade" /></SelectTrigger>
                          <SelectContent>
                            {trades?.map((trade: any) => (
                              <SelectItem key={trade.id} value={trade.id}>{trade.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="grid gap-2">
                        <Label>Location</Label>
                        <Input 
                          value={jobForm.location}
                          onChange={(e) => setJobForm({ ...jobForm, location: e.target.value })}
                          placeholder="City, Region"
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label>Salary Range</Label>
                        <Input 
                          value={jobForm.salary_range}
                          onChange={(e) => setJobForm({ ...jobForm, salary_range: e.target.value })}
                          placeholder="e.g., N$5000 - N$8000"
                        />
                      </div>
                    </div>
                    <div className="grid gap-2">
                      <Label>Application Deadline</Label>
                      <Input 
                        type="date"
                        value={jobForm.application_deadline}
                        onChange={(e) => setJobForm({ ...jobForm, application_deadline: e.target.value })}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label>Description</Label>
                      <Textarea 
                        value={jobForm.description}
                        onChange={(e) => setJobForm({ ...jobForm, description: e.target.value })}
                        placeholder="Job description and responsibilities"
                        rows={3}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label>Requirements</Label>
                      <Textarea 
                        value={jobForm.requirements}
                        onChange={(e) => setJobForm({ ...jobForm, requirements: e.target.value })}
                        placeholder="Qualifications and experience required"
                        rows={2}
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsJobDialogOpen(false)}>Cancel</Button>
                    <Button onClick={handleCreateJob} disabled={createJobPosting.isPending}>
                      {createJobPosting.isPending ? "Creating..." : "Post Job"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>

            <Card>
              <CardContent className="p-0">
                {jobsLoading ? (
                  <div className="text-center py-8">Loading job postings...</div>
                ) : jobPostings && jobPostings.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Job Title</TableHead>
                        <TableHead>Employer</TableHead>
                        <TableHead>Trade</TableHead>
                        <TableHead>Location</TableHead>
                        <TableHead>Deadline</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {jobPostings.map((job: any) => (
                        <TableRow key={job.id}>
                          <TableCell className="font-medium">{job.title}</TableCell>
                          <TableCell>{job.employers?.name || "-"}</TableCell>
                          <TableCell>{job.trades?.name || "-"}</TableCell>
                          <TableCell>{job.location || "-"}</TableCell>
                          <TableCell>{job.application_deadline ? new Date(job.application_deadline).toLocaleDateString() : "-"}</TableCell>
                          <TableCell>{getStatusBadge(job.status)}</TableCell>
                          <TableCell>
                            <Button variant="ghost" size="sm"><Eye className="h-4 w-4" /></Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Briefcase className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No job postings yet. Click "Post Job" to create one.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Employers Tab */}
          <TabsContent value="employers" className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="relative w-64">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search employers..." className="pl-8" />
              </div>
              <Dialog open={isEmployerDialogOpen} onOpenChange={setIsEmployerDialogOpen}>
                <DialogTrigger asChild>
                  <Button><Plus className="mr-2 h-4 w-4" /> Add Employer</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add Partner Employer</DialogTitle>
                    <DialogDescription>Register a new employer partner for placements.</DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                      <Label>Company Name</Label>
                      <Input 
                        value={employerForm.name}
                        onChange={(e) => setEmployerForm({ ...employerForm, name: e.target.value })}
                        placeholder="Company name"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label>Industry</Label>
                      <Input 
                        value={employerForm.industry}
                        onChange={(e) => setEmployerForm({ ...employerForm, industry: e.target.value })}
                        placeholder="e.g., Construction, Manufacturing"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="grid gap-2">
                        <Label>Contact Person</Label>
                        <Input 
                          value={employerForm.contact_person}
                          onChange={(e) => setEmployerForm({ ...employerForm, contact_person: e.target.value })}
                          placeholder="Full name"
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label>Phone</Label>
                        <Input 
                          value={employerForm.contact_phone}
                          onChange={(e) => setEmployerForm({ ...employerForm, contact_phone: e.target.value })}
                          placeholder="Phone number"
                        />
                      </div>
                    </div>
                    <div className="grid gap-2">
                      <Label>Email</Label>
                      <Input 
                        type="email"
                        value={employerForm.contact_email}
                        onChange={(e) => setEmployerForm({ ...employerForm, contact_email: e.target.value })}
                        placeholder="contact@company.com"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label>Address</Label>
                      <Input 
                        value={employerForm.address}
                        onChange={(e) => setEmployerForm({ ...employerForm, address: e.target.value })}
                        placeholder="Physical address"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label>Website</Label>
                      <Input 
                        value={employerForm.website}
                        onChange={(e) => setEmployerForm({ ...employerForm, website: e.target.value })}
                        placeholder="https://company.com"
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsEmployerDialogOpen(false)}>Cancel</Button>
                    <Button onClick={handleCreateEmployer} disabled={createEmployer.isPending}>
                      {createEmployer.isPending ? "Adding..." : "Add Employer"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>

            <Card>
              <CardContent className="p-0">
                {employersLoading ? (
                  <div className="text-center py-8">Loading employers...</div>
                ) : employers && employers.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Company</TableHead>
                        <TableHead>Industry</TableHead>
                        <TableHead>Contact Person</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Phone</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {employers.map((emp: any) => (
                        <TableRow key={emp.id}>
                          <TableCell className="font-medium">{emp.name}</TableCell>
                          <TableCell>{emp.industry || "-"}</TableCell>
                          <TableCell>{emp.contact_person || "-"}</TableCell>
                          <TableCell>{emp.contact_email || "-"}</TableCell>
                          <TableCell>{emp.contact_phone || "-"}</TableCell>
                          <TableCell>
                            <Badge variant={emp.active ? "default" : "secondary"}>
                              {emp.active ? "Active" : "Inactive"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Button variant="ghost" size="sm"><Edit className="h-4 w-4" /></Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Building className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No employers registered yet. Click "Add Employer" to start.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Internship Placements Tab */}
          <TabsContent value="placements" className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="relative w-64">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search placements..." className="pl-8" />
              </div>
              <Button onClick={() => setIsPlacementDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" /> New Placement
              </Button>
            </div>

            <Card>
              <CardContent className="p-0">
                {placementsLoading ? (
                  <div className="text-center py-8">Loading placements...</div>
                ) : placements && placements.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Trainee</TableHead>
                        <TableHead>Employer</TableHead>
                        <TableHead>Position</TableHead>
                        <TableHead>Start Date</TableHead>
                        <TableHead>End Date</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {placements.map((placement: any) => (
                        <TableRow key={placement.id}>
                          <TableCell className="font-medium">
                            {placement.trainees?.first_name} {placement.trainees?.last_name}
                          </TableCell>
                          <TableCell>{placement.employers?.name || "-"}</TableCell>
                          <TableCell>{placement.position || "-"}</TableCell>
                          <TableCell>{placement.start_date ? new Date(placement.start_date).toLocaleDateString() : "-"}</TableCell>
                          <TableCell>{placement.end_date ? new Date(placement.end_date).toLocaleDateString() : "-"}</TableCell>
                          <TableCell>{getStatusBadge(placement.status)}</TableCell>
                          <TableCell>
                            <Button variant="ghost" size="sm"><Eye className="h-4 w-4" /></Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No internship placements yet. Click "New Placement" to create one.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default withRoleAccess(PlacementOfficerDashboard, {
  requiredRoles: ["placement_officer", "admin", "super_admin", "organization_admin"],
});
