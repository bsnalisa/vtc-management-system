import { useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { rplCoordinatorNavItems } from "@/lib/navigationConfig";
import { 
  Award, 
  Users, 
  FileCheck, 
  ClipboardList, 
  Calendar,
  Plus,
  Search,
  CheckCircle,
  AlertCircle,
  Clock,
  FileText,
  Target,
  TrendingUp,
  Eye,
  Download
} from "lucide-react";

// Static data for demonstration
const rplApplications = [
  { id: "1", applicantName: "John Banda", nationalId: "63-123456A78", trade: "Welding", level: 3, submittedDate: "2024-01-10", status: "under-review", assignedAssessor: "Mr. Moyo" },
  { id: "2", applicantName: "Mary Chikwanha", nationalId: "63-789012B34", trade: "Electrical", level: 2, submittedDate: "2024-01-08", status: "assessment-scheduled", assignedAssessor: "Mrs. Dube" },
  { id: "3", applicantName: "Peter Ncube", nationalId: "63-456789C12", trade: "Carpentry", level: 4, submittedDate: "2024-01-05", status: "competent", assignedAssessor: "Mr. Sithole" },
  { id: "4", applicantName: "Grace Mutasa", nationalId: "63-234567D89", trade: "Plumbing", level: 2, submittedDate: "2024-01-12", status: "pending", assignedAssessor: null },
  { id: "5", applicantName: "David Zhou", nationalId: "63-567890E45", trade: "Welding", level: 3, submittedDate: "2024-01-03", status: "not-yet-competent", assignedAssessor: "Mr. Moyo" },
];

const portfolioAssessments = [
  { id: "1", candidateName: "John Banda", trade: "Welding", portfolioItems: 12, documentsVerified: 10, gapsIdentified: 2, status: "in-progress" },
  { id: "2", candidateName: "Mary Chikwanha", trade: "Electrical", portfolioItems: 15, documentsVerified: 15, gapsIdentified: 0, status: "complete" },
  { id: "3", candidateName: "Peter Ncube", trade: "Carpentry", portfolioItems: 18, documentsVerified: 18, gapsIdentified: 0, status: "complete" },
];

const assessmentSchedule = [
  { id: "1", candidateName: "John Banda", trade: "Welding", type: "Practical", date: "2024-01-20", time: "09:00 AM", venue: "Workshop A", assessor: "Mr. Moyo", status: "scheduled" },
  { id: "2", candidateName: "Mary Chikwanha", trade: "Electrical", type: "Theory + Practical", date: "2024-01-18", time: "10:00 AM", venue: "Workshop B", assessor: "Mrs. Dube", status: "scheduled" },
  { id: "3", candidateName: "Peter Ncube", trade: "Carpentry", type: "Practical", date: "2024-01-15", time: "08:00 AM", venue: "Workshop C", assessor: "Mr. Sithole", status: "completed" },
];

const creditMappings = [
  { id: "1", candidateName: "Peter Ncube", trade: "Carpentry", priorQualification: "NC Level 3", creditsAwarded: 45, creditsRequired: 60, gapCredits: 15, status: "approved" },
  { id: "2", candidateName: "John Banda", trade: "Welding", priorQualification: "Industry Experience", creditsAwarded: 30, creditsRequired: 50, gapCredits: 20, status: "pending" },
  { id: "3", candidateName: "Mary Chikwanha", trade: "Electrical", priorQualification: "NC Level 2", creditsAwarded: 40, creditsRequired: 45, gapCredits: 5, status: "approved" },
];

const getStatusBadge = (status: string) => {
  const config: Record<string, { variant: "default" | "secondary" | "destructive" | "outline", label: string }> = {
    "pending": { variant: "outline", label: "Pending" },
    "under-review": { variant: "secondary", label: "Under Review" },
    "assessment-scheduled": { variant: "secondary", label: "Assessment Scheduled" },
    "competent": { variant: "default", label: "Competent" },
    "not-yet-competent": { variant: "destructive", label: "Not Yet Competent" },
    "in-progress": { variant: "secondary", label: "In Progress" },
    "complete": { variant: "default", label: "Complete" },
    "scheduled": { variant: "secondary", label: "Scheduled" },
    "completed": { variant: "default", label: "Completed" },
    "approved": { variant: "default", label: "Approved" },
  };
  const { variant, label } = config[status] || { variant: "outline" as const, label: status };
  return <Badge variant={variant}>{label}</Badge>;
};

export default function RPLCoordinatorDashboard() {
  const [searchTerm, setSearchTerm] = useState("");
  const [isNewApplicationOpen, setIsNewApplicationOpen] = useState(false);
  const [isScheduleAssessmentOpen, setIsScheduleAssessmentOpen] = useState(false);

  const pendingCount = rplApplications.filter(a => a.status === "pending").length;
  const underReviewCount = rplApplications.filter(a => a.status === "under-review").length;
  const competentCount = rplApplications.filter(a => a.status === "competent").length;

  return (
    <DashboardLayout 
      title="RPL Coordinator Dashboard" 
      subtitle="Manage Recognition of Prior Learning applications and assessments"
      groupLabel="RPL Management"
      navItems={rplCoordinatorNavItems}
    >
      <div className="space-y-6">
        {/* Stats Overview */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending Applications</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{pendingCount}</div>
              <p className="text-xs text-muted-foreground">Awaiting initial review</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Under Review</CardTitle>
              <FileCheck className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{underReviewCount}</div>
              <p className="text-xs text-muted-foreground">Being assessed</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Competent This Month</CardTitle>
              <Award className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{competentCount}</div>
              <p className="text-xs text-muted-foreground">Successfully certified</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">78%</div>
              <p className="text-xs text-muted-foreground">Last 3 months average</p>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Tabs */}
        <Tabs defaultValue="applications" className="space-y-4">
          <TabsList>
            <TabsTrigger value="applications">Applications</TabsTrigger>
            <TabsTrigger value="portfolio">Portfolio Assessment</TabsTrigger>
            <TabsTrigger value="schedule">Assessment Schedule</TabsTrigger>
            <TabsTrigger value="credits">Credit Mapping</TabsTrigger>
          </TabsList>

          {/* Applications Tab */}
          <TabsContent value="applications" className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="relative w-64">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search applications..." className="pl-8" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
              </div>
              <Dialog open={isNewApplicationOpen} onOpenChange={setIsNewApplicationOpen}>
                <DialogTrigger asChild>
                  <Button><Plus className="mr-2 h-4 w-4" /> New Application</Button>
                </DialogTrigger>
                <DialogContent className="max-w-lg">
                  <DialogHeader>
                    <DialogTitle>Register RPL Application</DialogTitle>
                    <DialogDescription>Capture a new Recognition of Prior Learning application.</DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="grid gap-2">
                        <Label>Applicant Name</Label>
                        <Input placeholder="Full name" />
                      </div>
                      <div className="grid gap-2">
                        <Label>National ID</Label>
                        <Input placeholder="e.g., 63-123456A78" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="grid gap-2">
                        <Label>Trade</Label>
                        <Select>
                          <SelectTrigger><SelectValue placeholder="Select trade" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="welding">Welding</SelectItem>
                            <SelectItem value="electrical">Electrical</SelectItem>
                            <SelectItem value="carpentry">Carpentry</SelectItem>
                            <SelectItem value="plumbing">Plumbing</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid gap-2">
                        <Label>Target Level</Label>
                        <Select>
                          <SelectTrigger><SelectValue placeholder="Select level" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="1">Level 1</SelectItem>
                            <SelectItem value="2">Level 2</SelectItem>
                            <SelectItem value="3">Level 3</SelectItem>
                            <SelectItem value="4">Level 4</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="grid gap-2">
                      <Label>Prior Experience Summary</Label>
                      <Textarea placeholder="Describe relevant work experience and qualifications" />
                    </div>
                    <div className="grid gap-2">
                      <Label>Contact Phone</Label>
                      <Input placeholder="Phone number" />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsNewApplicationOpen(false)}>Cancel</Button>
                    <Button onClick={() => setIsNewApplicationOpen(false)}>Register</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>

            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Applicant</TableHead>
                    <TableHead>National ID</TableHead>
                    <TableHead>Trade</TableHead>
                    <TableHead>Level</TableHead>
                    <TableHead>Submitted</TableHead>
                    <TableHead>Assessor</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rplApplications.map((app) => (
                    <TableRow key={app.id}>
                      <TableCell className="font-medium">{app.applicantName}</TableCell>
                      <TableCell>{app.nationalId}</TableCell>
                      <TableCell>{app.trade}</TableCell>
                      <TableCell>Level {app.level}</TableCell>
                      <TableCell>{app.submittedDate}</TableCell>
                      <TableCell>{app.assignedAssessor || "-"}</TableCell>
                      <TableCell>{getStatusBadge(app.status)}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="sm"><Eye className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="sm"><FileText className="h-4 w-4" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>

          {/* Portfolio Assessment Tab */}
          <TabsContent value="portfolio" className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="relative w-64">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search portfolios..." className="pl-8" />
              </div>
              <Select defaultValue="all">
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Filter status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="in-progress">In Progress</SelectItem>
                  <SelectItem value="complete">Complete</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Candidate</TableHead>
                    <TableHead>Trade</TableHead>
                    <TableHead>Portfolio Items</TableHead>
                    <TableHead>Verified</TableHead>
                    <TableHead>Gaps Identified</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {portfolioAssessments.map((portfolio) => (
                    <TableRow key={portfolio.id}>
                      <TableCell className="font-medium">{portfolio.candidateName}</TableCell>
                      <TableCell>{portfolio.trade}</TableCell>
                      <TableCell>{portfolio.portfolioItems}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {portfolio.documentsVerified === portfolio.portfolioItems ? (
                            <CheckCircle className="h-4 w-4 text-green-500" />
                          ) : (
                            <AlertCircle className="h-4 w-4 text-yellow-500" />
                          )}
                          {portfolio.documentsVerified}/{portfolio.portfolioItems}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={portfolio.gapsIdentified === 0 ? "default" : "destructive"}>
                          {portfolio.gapsIdentified} gaps
                        </Badge>
                      </TableCell>
                      <TableCell>{getStatusBadge(portfolio.status)}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm">Review</Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>

          {/* Assessment Schedule Tab */}
          <TabsContent value="schedule" className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="relative w-64">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search schedule..." className="pl-8" />
              </div>
              <Dialog open={isScheduleAssessmentOpen} onOpenChange={setIsScheduleAssessmentOpen}>
                <DialogTrigger asChild>
                  <Button><Calendar className="mr-2 h-4 w-4" /> Schedule Assessment</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Schedule RPL Assessment</DialogTitle>
                    <DialogDescription>Book an assessment session for a candidate.</DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                      <Label>Candidate</Label>
                      <Select>
                        <SelectTrigger><SelectValue placeholder="Select candidate" /></SelectTrigger>
                        <SelectContent>
                          {rplApplications.filter(a => a.status !== "competent" && a.status !== "not-yet-competent").map(a => (
                            <SelectItem key={a.id} value={a.id}>{a.applicantName} - {a.trade}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-2">
                      <Label>Assessment Type</Label>
                      <Select>
                        <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="practical">Practical Only</SelectItem>
                          <SelectItem value="theory">Theory Only</SelectItem>
                          <SelectItem value="both">Theory + Practical</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="grid gap-2">
                        <Label>Date</Label>
                        <Input type="date" />
                      </div>
                      <div className="grid gap-2">
                        <Label>Time</Label>
                        <Input type="time" />
                      </div>
                    </div>
                    <div className="grid gap-2">
                      <Label>Venue</Label>
                      <Input placeholder="e.g., Workshop A" />
                    </div>
                    <div className="grid gap-2">
                      <Label>Assessor</Label>
                      <Select>
                        <SelectTrigger><SelectValue placeholder="Assign assessor" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="moyo">Mr. Moyo</SelectItem>
                          <SelectItem value="dube">Mrs. Dube</SelectItem>
                          <SelectItem value="sithole">Mr. Sithole</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsScheduleAssessmentOpen(false)}>Cancel</Button>
                    <Button onClick={() => setIsScheduleAssessmentOpen(false)}>Schedule</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>

            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Candidate</TableHead>
                    <TableHead>Trade</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Date & Time</TableHead>
                    <TableHead>Venue</TableHead>
                    <TableHead>Assessor</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {assessmentSchedule.map((assessment) => (
                    <TableRow key={assessment.id}>
                      <TableCell className="font-medium">{assessment.candidateName}</TableCell>
                      <TableCell>{assessment.trade}</TableCell>
                      <TableCell>{assessment.type}</TableCell>
                      <TableCell>{assessment.date} at {assessment.time}</TableCell>
                      <TableCell>{assessment.venue}</TableCell>
                      <TableCell>{assessment.assessor}</TableCell>
                      <TableCell>{getStatusBadge(assessment.status)}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm">
                          {assessment.status === "scheduled" ? "Edit" : "View Results"}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>

          {/* Credit Mapping Tab */}
          <TabsContent value="credits" className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="relative w-64">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search credit mappings..." className="pl-8" />
              </div>
              <Button variant="outline"><Download className="mr-2 h-4 w-4" /> Export Report</Button>
            </div>

            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Candidate</TableHead>
                    <TableHead>Trade</TableHead>
                    <TableHead>Prior Qualification</TableHead>
                    <TableHead>Credits Awarded</TableHead>
                    <TableHead>Required</TableHead>
                    <TableHead>Gap</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {creditMappings.map((mapping) => (
                    <TableRow key={mapping.id}>
                      <TableCell className="font-medium">{mapping.candidateName}</TableCell>
                      <TableCell>{mapping.trade}</TableCell>
                      <TableCell>{mapping.priorQualification}</TableCell>
                      <TableCell>{mapping.creditsAwarded}</TableCell>
                      <TableCell>{mapping.creditsRequired}</TableCell>
                      <TableCell>
                        <Badge variant={mapping.gapCredits <= 10 ? "default" : "secondary"}>
                          {mapping.gapCredits} credits
                        </Badge>
                      </TableCell>
                      <TableCell>{getStatusBadge(mapping.status)}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm">View Details</Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>

            {/* Gap Training Recommendations */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Gap Training Recommendations</CardTitle>
                <CardDescription>Suggested training to close identified competency gaps</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <p className="font-medium">John Banda - Welding Level 3</p>
                      <p className="text-sm text-muted-foreground">Gap: 20 credits in Advanced Welding Techniques</p>
                    </div>
                    <div className="flex gap-2">
                      <Badge>2 weeks training</Badge>
                      <Button size="sm">Enroll</Button>
                    </div>
                  </div>
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <p className="font-medium">Mary Chikwanha - Electrical Level 2</p>
                      <p className="text-sm text-muted-foreground">Gap: 5 credits in Safety Procedures</p>
                    </div>
                    <div className="flex gap-2">
                      <Badge>3 days training</Badge>
                      <Button size="sm">Enroll</Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
