import { useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { hrOfficerNavItems } from "@/lib/navigationConfig";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { 
  Users, 
  Calendar, 
  FileText, 
  TrendingUp, 
  UserPlus, 
  Clock, 
  Award,
  Briefcase,
  Search,
  Filter,
  Plus,
  Eye,
  Edit,
  CheckCircle,
  XCircle,
  AlertCircle
} from "lucide-react";

// Static data for demonstration
const employees = [
  { id: 1, name: "John Moyo", department: "Engineering", position: "Senior Trainer", status: "active", joinDate: "2022-01-15" },
  { id: 2, name: "Sarah Ndlovu", department: "Administration", position: "Admin Officer", status: "active", joinDate: "2021-06-20" },
  { id: 3, name: "Peter Shikongo", department: "Training", position: "Head of Training", status: "active", joinDate: "2020-03-10" },
  { id: 4, name: "Maria Haimbodi", department: "Finance", position: "Debtor Officer", status: "on_leave", joinDate: "2023-02-01" },
  { id: 5, name: "James Amukwaya", department: "Operations", position: "Stock Controller", status: "active", joinDate: "2022-09-15" },
];

const leaveRequests = [
  { id: 1, employee: "John Moyo", type: "Annual Leave", startDate: "2024-12-20", endDate: "2024-12-27", days: 5, status: "pending" },
  { id: 2, employee: "Sarah Ndlovu", type: "Sick Leave", startDate: "2024-12-10", endDate: "2024-12-11", days: 2, status: "approved" },
  { id: 3, employee: "Peter Shikongo", type: "Study Leave", startDate: "2025-01-05", endDate: "2025-01-10", days: 5, status: "pending" },
  { id: 4, employee: "Maria Haimbodi", type: "Maternity Leave", startDate: "2024-11-01", endDate: "2025-02-01", days: 90, status: "approved" },
];

const recruitmentApplications = [
  { id: 1, position: "Trainer - Automotive", applicant: "Thomas Nghipondoka", appliedDate: "2024-12-01", status: "shortlisted", stage: "Interview" },
  { id: 2, position: "Registration Officer", applicant: "Anna Shiimi", appliedDate: "2024-12-05", status: "new", stage: "Screening" },
  { id: 3, position: "Trainer - Electrical", applicant: "David Iipinge", appliedDate: "2024-11-28", status: "rejected", stage: "Complete" },
  { id: 4, position: "Admin Assistant", applicant: "Grace Mwetulundila", appliedDate: "2024-12-08", status: "shortlisted", stage: "Assessment" },
];

const performanceReviews = [
  { id: 1, employee: "John Moyo", reviewPeriod: "Q3 2024", rating: 4.5, status: "completed", reviewer: "Peter Shikongo" },
  { id: 2, employee: "Sarah Ndlovu", reviewPeriod: "Q3 2024", rating: 4.0, status: "completed", reviewer: "Admin Manager" },
  { id: 3, employee: "James Amukwaya", reviewPeriod: "Q3 2024", rating: 0, status: "pending", reviewer: "Operations Head" },
];

const getStatusBadge = (status: string) => {
  const variants: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; icon: React.ReactNode }> = {
    active: { variant: "default", icon: <CheckCircle className="h-3 w-3" /> },
    on_leave: { variant: "secondary", icon: <Clock className="h-3 w-3" /> },
    inactive: { variant: "destructive", icon: <XCircle className="h-3 w-3" /> },
    pending: { variant: "outline", icon: <AlertCircle className="h-3 w-3" /> },
    approved: { variant: "default", icon: <CheckCircle className="h-3 w-3" /> },
    rejected: { variant: "destructive", icon: <XCircle className="h-3 w-3" /> },
    shortlisted: { variant: "secondary", icon: <CheckCircle className="h-3 w-3" /> },
    new: { variant: "outline", icon: <AlertCircle className="h-3 w-3" /> },
    completed: { variant: "default", icon: <CheckCircle className="h-3 w-3" /> },
  };
  
  const config = variants[status] || { variant: "outline" as const, icon: null };
  return (
    <Badge variant={config.variant} className="gap-1 capitalize">
      {config.icon}
      {status.replace("_", " ")}
    </Badge>
  );
};

export default function HROfficerDashboard() {
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("overview");

  const stats = [
    { title: "Total Employees", value: "48", icon: Users, trend: "+3 this month", color: "text-blue-500" },
    { title: "Pending Leave Requests", value: "5", icon: Calendar, trend: "2 urgent", color: "text-amber-500" },
    { title: "Open Positions", value: "4", icon: Briefcase, trend: "12 applications", color: "text-green-500" },
    { title: "Performance Reviews Due", value: "8", icon: Award, trend: "Q4 2024", color: "text-purple-500" },
  ];

  return (
    <DashboardLayout 
      navItems={hrOfficerNavItems} 
      groupLabel="HR Officer"
      title="HR Officer Dashboard"
      subtitle="Manage employees, leave requests, recruitment, and performance reviews"
    >
      <div className="space-y-6">
        {/* Stats Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat) => (
            <Card key={stat.title}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
                <stat.icon className={`h-4 w-4 ${stat.color}`} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
                <p className="text-xs text-muted-foreground">{stat.trend}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Main Content Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="employees">Employees</TabsTrigger>
            <TabsTrigger value="leave">Leave Management</TabsTrigger>
            <TabsTrigger value="recruitment">Recruitment</TabsTrigger>
            <TabsTrigger value="performance">Performance</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              {/* Recent Leave Requests */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="h-5 w-5" />
                    Recent Leave Requests
                  </CardTitle>
                  <CardDescription>Pending approvals requiring action</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {leaveRequests.filter(l => l.status === "pending").slice(0, 3).map((leave) => (
                      <div key={leave.id} className="flex items-center justify-between p-3 rounded-lg border">
                        <div>
                          <p className="font-medium">{leave.employee}</p>
                          <p className="text-sm text-muted-foreground">{leave.type} • {leave.days} days</p>
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline">
                            <XCircle className="h-4 w-4" />
                          </Button>
                          <Button size="sm">
                            <CheckCircle className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Recruitment Pipeline */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <UserPlus className="h-5 w-5" />
                    Recruitment Pipeline
                  </CardTitle>
                  <CardDescription>Active applications by stage</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {recruitmentApplications.filter(r => r.status !== "rejected").slice(0, 3).map((app) => (
                      <div key={app.id} className="flex items-center justify-between p-3 rounded-lg border">
                        <div>
                          <p className="font-medium">{app.applicant}</p>
                          <p className="text-sm text-muted-foreground">{app.position}</p>
                        </div>
                        <Badge variant="secondary">{app.stage}</Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-4">
                  <Button className="h-auto py-4 flex-col gap-2">
                    <UserPlus className="h-5 w-5" />
                    Add Employee
                  </Button>
                  <Button variant="outline" className="h-auto py-4 flex-col gap-2">
                    <FileText className="h-5 w-5" />
                    Post Job Opening
                  </Button>
                  <Button variant="outline" className="h-auto py-4 flex-col gap-2">
                    <Calendar className="h-5 w-5" />
                    View Leave Calendar
                  </Button>
                  <Button variant="outline" className="h-auto py-4 flex-col gap-2">
                    <TrendingUp className="h-5 w-5" />
                    Generate HR Report
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Employees Tab */}
          <TabsContent value="employees" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Employee Directory</CardTitle>
                    <CardDescription>Manage all staff members</CardDescription>
                  </div>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Employee
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4 mb-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search employees..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                  <Button variant="outline">
                    <Filter className="h-4 w-4 mr-2" />
                    Filter
                  </Button>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Department</TableHead>
                      <TableHead>Position</TableHead>
                      <TableHead>Join Date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {employees.map((employee) => (
                      <TableRow key={employee.id}>
                        <TableCell className="font-medium">{employee.name}</TableCell>
                        <TableCell>{employee.department}</TableCell>
                        <TableCell>{employee.position}</TableCell>
                        <TableCell>{new Date(employee.joinDate).toLocaleDateString()}</TableCell>
                        <TableCell>{getStatusBadge(employee.status)}</TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button size="sm" variant="ghost">
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button size="sm" variant="ghost">
                              <Edit className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Leave Management Tab */}
          <TabsContent value="leave" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Leave Requests</CardTitle>
                    <CardDescription>Review and manage employee leave applications</CardDescription>
                  </div>
                  <Button variant="outline">
                    <Calendar className="h-4 w-4 mr-2" />
                    View Calendar
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Employee</TableHead>
                      <TableHead>Leave Type</TableHead>
                      <TableHead>Start Date</TableHead>
                      <TableHead>End Date</TableHead>
                      <TableHead>Days</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {leaveRequests.map((leave) => (
                      <TableRow key={leave.id}>
                        <TableCell className="font-medium">{leave.employee}</TableCell>
                        <TableCell>{leave.type}</TableCell>
                        <TableCell>{new Date(leave.startDate).toLocaleDateString()}</TableCell>
                        <TableCell>{new Date(leave.endDate).toLocaleDateString()}</TableCell>
                        <TableCell>{leave.days}</TableCell>
                        <TableCell>{getStatusBadge(leave.status)}</TableCell>
                        <TableCell>
                          {leave.status === "pending" ? (
                            <div className="flex gap-2">
                              <Button size="sm" variant="outline">
                                <XCircle className="h-4 w-4" />
                              </Button>
                              <Button size="sm">
                                <CheckCircle className="h-4 w-4" />
                              </Button>
                            </div>
                          ) : (
                            <Button size="sm" variant="ghost">
                              <Eye className="h-4 w-4" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Recruitment Tab */}
          <TabsContent value="recruitment" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Recruitment Management</CardTitle>
                    <CardDescription>Track job postings and applications</CardDescription>
                  </div>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Post New Job
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Position</TableHead>
                      <TableHead>Applicant</TableHead>
                      <TableHead>Applied Date</TableHead>
                      <TableHead>Stage</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recruitmentApplications.map((app) => (
                      <TableRow key={app.id}>
                        <TableCell className="font-medium">{app.position}</TableCell>
                        <TableCell>{app.applicant}</TableCell>
                        <TableCell>{new Date(app.appliedDate).toLocaleDateString()}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">{app.stage}</Badge>
                        </TableCell>
                        <TableCell>{getStatusBadge(app.status)}</TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button size="sm" variant="ghost">
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button size="sm" variant="ghost">
                              <Edit className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Performance Tab */}
          <TabsContent value="performance" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Performance Reviews</CardTitle>
                    <CardDescription>Track and manage employee performance evaluations</CardDescription>
                  </div>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Schedule Review
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Employee</TableHead>
                      <TableHead>Review Period</TableHead>
                      <TableHead>Reviewer</TableHead>
                      <TableHead>Rating</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {performanceReviews.map((review) => (
                      <TableRow key={review.id}>
                        <TableCell className="font-medium">{review.employee}</TableCell>
                        <TableCell>{review.reviewPeriod}</TableCell>
                        <TableCell>{review.reviewer}</TableCell>
                        <TableCell>
                          {review.status === "completed" ? (
                            <div className="flex items-center gap-1">
                              <span className="font-medium">{review.rating}</span>
                              <span className="text-muted-foreground">/5</span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>{getStatusBadge(review.status)}</TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button size="sm" variant="ghost">
                              <Eye className="h-4 w-4" />
                            </Button>
                            {review.status === "pending" && (
                              <Button size="sm" variant="ghost">
                                <Edit className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
