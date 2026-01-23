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
import { bdlCoordinatorNavItems } from "@/lib/navigationConfig";
import { 
  BookOpen, 
  Users, 
  Video, 
  FileText, 
  Calendar,
  Plus,
  Search,
  Monitor,
  Clock,
  TrendingUp,
  CheckCircle,
  AlertCircle,
  PlayCircle,
  Upload,
  Settings
} from "lucide-react";

// Static data for demonstration
const blendedCourses = [
  { id: "1", code: "BDL-001", name: "Introduction to Welding (Blended)", trade: "Welding", enrolled: 45, online: 60, faceToFace: 40, status: "active" },
  { id: "2", code: "BDL-002", name: "Electrical Fundamentals (Distance)", trade: "Electrical", enrolled: 38, online: 80, faceToFace: 20, status: "active" },
  { id: "3", code: "BDL-003", name: "Carpentry Basics (Blended)", trade: "Carpentry", enrolled: 32, online: 50, faceToFace: 50, status: "active" },
  { id: "4", code: "BDL-004", name: "Plumbing Theory (Distance)", trade: "Plumbing", enrolled: 28, online: 90, faceToFace: 10, status: "draft" },
];

const learningMaterials = [
  { id: "1", title: "Welding Safety Guidelines", type: "Video", course: "BDL-001", duration: "45 min", views: 234, status: "published" },
  { id: "2", title: "Electrical Circuit Theory", type: "Document", course: "BDL-002", pages: 25, downloads: 189, status: "published" },
  { id: "3", title: "Wood Types and Properties", type: "Interactive", course: "BDL-003", duration: "30 min", completions: 156, status: "published" },
  { id: "4", title: "Pipe Fitting Techniques", type: "Video", course: "BDL-004", duration: "60 min", views: 0, status: "draft" },
];

const virtualSessions = [
  { id: "1", title: "Live Q&A: Welding Techniques", course: "BDL-001", date: "2024-01-15", time: "10:00 AM", trainer: "John Smith", registered: 32, status: "scheduled" },
  { id: "2", title: "Electrical Safety Workshop", course: "BDL-002", date: "2024-01-16", time: "2:00 PM", trainer: "Mary Johnson", registered: 28, status: "scheduled" },
  { id: "3", title: "Carpentry Tools Demo", course: "BDL-003", date: "2024-01-14", time: "11:00 AM", trainer: "Peter Brown", registered: 25, status: "completed" },
];

const studentProgress = [
  { id: "1", name: "Alice Moyo", course: "BDL-001", progress: 78, lastActive: "2024-01-14", assignments: 8, completed: 6, status: "on-track" },
  { id: "2", name: "Brian Ncube", course: "BDL-002", progress: 45, lastActive: "2024-01-10", assignments: 10, completed: 4, status: "at-risk" },
  { id: "3", name: "Chipo Dube", course: "BDL-003", progress: 92, lastActive: "2024-01-15", assignments: 12, completed: 11, status: "on-track" },
  { id: "4", name: "David Sithole", course: "BDL-001", progress: 35, lastActive: "2024-01-05", assignments: 8, completed: 2, status: "at-risk" },
];

const getStatusBadge = (status: string) => {
  const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
    active: "default",
    published: "default",
    scheduled: "secondary",
    completed: "outline",
    draft: "outline",
    "on-track": "default",
    "at-risk": "destructive",
  };
  return <Badge variant={variants[status] || "outline"}>{status}</Badge>;
};

const getMaterialIcon = (type: string) => {
  switch (type) {
    case "Video": return <PlayCircle className="h-4 w-4" />;
    case "Document": return <FileText className="h-4 w-4" />;
    case "Interactive": return <Monitor className="h-4 w-4" />;
    default: return <FileText className="h-4 w-4" />;
  }
};

export default function BDLCoordinatorDashboard() {
  const [searchTerm, setSearchTerm] = useState("");
  const [isAddCourseOpen, setIsAddCourseOpen] = useState(false);
  const [isAddMaterialOpen, setIsAddMaterialOpen] = useState(false);
  const [isScheduleSessionOpen, setIsScheduleSessionOpen] = useState(false);

  return (
    <DashboardLayout 
      title="BDL Coordinator Dashboard" 
      subtitle="Manage blended and distance learning programs"
      groupLabel="Distance Learning"
      navItems={bdlCoordinatorNavItems}
    >
      <div className="space-y-6">
        {/* Stats Overview */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Courses</CardTitle>
              <BookOpen className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{blendedCourses.filter(c => c.status === "active").length}</div>
              <p className="text-xs text-muted-foreground">+2 new this month</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Enrolled Students</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{blendedCourses.reduce((acc, c) => acc + c.enrolled, 0)}</div>
              <p className="text-xs text-muted-foreground">Across all BDL courses</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Learning Materials</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{learningMaterials.length}</div>
              <p className="text-xs text-muted-foreground">{learningMaterials.filter(m => m.status === "published").length} published</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Virtual Sessions</CardTitle>
              <Video className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{virtualSessions.filter(s => s.status === "scheduled").length}</div>
              <p className="text-xs text-muted-foreground">Scheduled this week</p>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Tabs */}
        <Tabs defaultValue="courses" className="space-y-4">
          <TabsList>
            <TabsTrigger value="courses">Courses</TabsTrigger>
            <TabsTrigger value="materials">Learning Materials</TabsTrigger>
            <TabsTrigger value="sessions">Virtual Sessions</TabsTrigger>
            <TabsTrigger value="progress">Student Progress</TabsTrigger>
          </TabsList>

          {/* Courses Tab */}
          <TabsContent value="courses" className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="relative w-64">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search courses..." className="pl-8" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
              </div>
              <Dialog open={isAddCourseOpen} onOpenChange={setIsAddCourseOpen}>
                <DialogTrigger asChild>
                  <Button><Plus className="mr-2 h-4 w-4" /> Add Course</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create Blended/Distance Course</DialogTitle>
                    <DialogDescription>Set up a new blended or distance learning course.</DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                      <Label>Course Code</Label>
                      <Input placeholder="e.g., BDL-005" />
                    </div>
                    <div className="grid gap-2">
                      <Label>Course Name</Label>
                      <Input placeholder="Enter course name" />
                    </div>
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
                    <div className="grid grid-cols-2 gap-4">
                      <div className="grid gap-2">
                        <Label>Online Component (%)</Label>
                        <Input type="number" placeholder="60" />
                      </div>
                      <div className="grid gap-2">
                        <Label>Face-to-Face (%)</Label>
                        <Input type="number" placeholder="40" />
                      </div>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsAddCourseOpen(false)}>Cancel</Button>
                    <Button onClick={() => setIsAddCourseOpen(false)}>Create Course</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>

            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>Course Name</TableHead>
                    <TableHead>Trade</TableHead>
                    <TableHead>Enrolled</TableHead>
                    <TableHead>Online/F2F Split</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {blendedCourses.map((course) => (
                    <TableRow key={course.id}>
                      <TableCell className="font-medium">{course.code}</TableCell>
                      <TableCell>{course.name}</TableCell>
                      <TableCell>{course.trade}</TableCell>
                      <TableCell>{course.enrolled}</TableCell>
                      <TableCell>{course.online}% / {course.faceToFace}%</TableCell>
                      <TableCell>{getStatusBadge(course.status)}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm">Manage</Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>

          {/* Learning Materials Tab */}
          <TabsContent value="materials" className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="relative w-64">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search materials..." className="pl-8" />
              </div>
              <Dialog open={isAddMaterialOpen} onOpenChange={setIsAddMaterialOpen}>
                <DialogTrigger asChild>
                  <Button><Upload className="mr-2 h-4 w-4" /> Upload Material</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Upload Learning Material</DialogTitle>
                    <DialogDescription>Add new learning content for BDL courses.</DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                      <Label>Title</Label>
                      <Input placeholder="Material title" />
                    </div>
                    <div className="grid gap-2">
                      <Label>Type</Label>
                      <Select>
                        <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="video">Video</SelectItem>
                          <SelectItem value="document">Document</SelectItem>
                          <SelectItem value="interactive">Interactive Module</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-2">
                      <Label>Course</Label>
                      <Select>
                        <SelectTrigger><SelectValue placeholder="Select course" /></SelectTrigger>
                        <SelectContent>
                          {blendedCourses.map(c => (
                            <SelectItem key={c.id} value={c.code}>{c.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-2">
                      <Label>Description</Label>
                      <Textarea placeholder="Brief description of the material" />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsAddMaterialOpen(false)}>Cancel</Button>
                    <Button onClick={() => setIsAddMaterialOpen(false)}>Upload</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>

            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead>Course</TableHead>
                    <TableHead>Duration/Size</TableHead>
                    <TableHead>Engagement</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {learningMaterials.map((material) => (
                    <TableRow key={material.id}>
                      <TableCell>{getMaterialIcon(material.type)}</TableCell>
                      <TableCell className="font-medium">{material.title}</TableCell>
                      <TableCell>{material.course}</TableCell>
                      <TableCell>{"duration" in material ? material.duration : `${material.pages} pages`}</TableCell>
                      <TableCell>{"views" in material ? `${material.views} views` : "downloads" in material ? `${material.downloads} downloads` : `${material.completions} completions`}</TableCell>
                      <TableCell>{getStatusBadge(material.status)}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm">Edit</Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>

          {/* Virtual Sessions Tab */}
          <TabsContent value="sessions" className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="relative w-64">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search sessions..." className="pl-8" />
              </div>
              <Dialog open={isScheduleSessionOpen} onOpenChange={setIsScheduleSessionOpen}>
                <DialogTrigger asChild>
                  <Button><Calendar className="mr-2 h-4 w-4" /> Schedule Session</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Schedule Virtual Session</DialogTitle>
                    <DialogDescription>Plan a live online session for students.</DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                      <Label>Session Title</Label>
                      <Input placeholder="e.g., Live Q&A: Welding Techniques" />
                    </div>
                    <div className="grid gap-2">
                      <Label>Course</Label>
                      <Select>
                        <SelectTrigger><SelectValue placeholder="Select course" /></SelectTrigger>
                        <SelectContent>
                          {blendedCourses.map(c => (
                            <SelectItem key={c.id} value={c.code}>{c.name}</SelectItem>
                          ))}
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
                      <Label>Trainer</Label>
                      <Input placeholder="Trainer name" />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsScheduleSessionOpen(false)}>Cancel</Button>
                    <Button onClick={() => setIsScheduleSessionOpen(false)}>Schedule</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>

            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Course</TableHead>
                    <TableHead>Date & Time</TableHead>
                    <TableHead>Trainer</TableHead>
                    <TableHead>Registered</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {virtualSessions.map((session) => (
                    <TableRow key={session.id}>
                      <TableCell className="font-medium">{session.title}</TableCell>
                      <TableCell>{session.course}</TableCell>
                      <TableCell>{session.date} at {session.time}</TableCell>
                      <TableCell>{session.trainer}</TableCell>
                      <TableCell>{session.registered}</TableCell>
                      <TableCell>{getStatusBadge(session.status)}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm">
                          {session.status === "scheduled" ? "Join" : "View"}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>

          {/* Student Progress Tab */}
          <TabsContent value="progress" className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="relative w-64">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search students..." className="pl-8" />
              </div>
              <Select defaultValue="all">
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Students</SelectItem>
                  <SelectItem value="on-track">On Track</SelectItem>
                  <SelectItem value="at-risk">At Risk</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student Name</TableHead>
                    <TableHead>Course</TableHead>
                    <TableHead>Progress</TableHead>
                    <TableHead>Last Active</TableHead>
                    <TableHead>Assignments</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {studentProgress.map((student) => (
                    <TableRow key={student.id}>
                      <TableCell className="font-medium">{student.name}</TableCell>
                      <TableCell>{student.course}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="w-24 bg-muted rounded-full h-2">
                            <div 
                              className={`h-2 rounded-full ${student.progress >= 70 ? 'bg-green-500' : student.progress >= 40 ? 'bg-yellow-500' : 'bg-red-500'}`}
                              style={{ width: `${student.progress}%` }}
                            />
                          </div>
                          <span className="text-sm">{student.progress}%</span>
                        </div>
                      </TableCell>
                      <TableCell>{student.lastActive}</TableCell>
                      <TableCell>{student.completed}/{student.assignments}</TableCell>
                      <TableCell>{getStatusBadge(student.status)}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm">View Details</Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
