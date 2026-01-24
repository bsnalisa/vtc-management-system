import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  User,
  BookOpen,
  ClipboardList,
  Home,
  GraduationCap,
  FileText,
  DollarSign,
  ShieldCheck,
  ChevronRight,
  Calendar,
  Bell,
  TrendingUp,
  Clock,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Users,
  Megaphone,
  CalendarDays,
  CreditCard,
} from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { traineeNavItems } from "@/lib/navigationConfig";
import { useProfile } from "@/hooks/useProfile";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";

// Sample data for enrolled courses
const enrolledCourses = [
  {
    id: 1,
    title: "Welding Theory & Safety",
    code: "WELD101",
    instructor: "Dr. James Carter",
    progress: 75,
    nextClass: "Mon, 10:00 AM"
  },
  {
    id: 2,
    title: "Metal Fabrication Fundamentals",
    code: "MFAB102",
    instructor: "Prof. Sarah Johnson",
    progress: 60,
    nextClass: "Tue, 2:00 PM"
  },
  {
    id: 3,
    title: "Advanced Joining Techniques",
    code: "WELD203",
    instructor: "Dr. Robert Kim",
    progress: 40,
    nextClass: "Wed, 9:00 AM"
  },
];

// Sample data for course instructors
const courseInstructors = [
  { id: 1, name: "Dr. James Carter", course: "Welding Theory", email: "j.carter@institute.edu" },
  { id: 2, name: "Prof. Sarah Johnson", course: "Metal Fabrication", email: "s.johnson@institute.edu" },
  { id: 3, name: "Dr. Robert Kim", course: "Advanced Joining", email: "r.kim@institute.edu" },
];

// Sample daily notices
const dailyNotices = [
  { id: 1, title: "Workshop Maintenance", content: "Maintenance scheduled for Building B workshop this Friday.", time: "2 hours ago" },
  { id: 2, title: "Scholarship Deadline", content: "Applications for semester scholarship close next Monday.", time: "1 day ago" },
  { id: 3, title: "Guest Lecture", content: "Industry expert talk on modern welding techniques tomorrow.", time: "2 days ago" },
];

const TraineeDashboard = () => {
  const { data: profile } = useProfile();

  return (
    <DashboardLayout
      title="Trainee Portal"
      subtitle="Always stay updated in your trainee portal"
      navItems={traineeNavItems}
      groupLabel="Trainee iEnabler"
    >
      {/* Modern Hero Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              Welcome back, {profile?.firstname || "John"}!
            </h1>
            <p className="text-muted-foreground mt-2">
              Always stay updated in your trainee portal
            </p>
          </div>
          <div className="hidden md:flex items-center gap-3">
            <Avatar className="h-12 w-12">
              <AvatarImage src={profile?.avatar_url} />
              <AvatarFallback className="bg-primary/10 text-primary">
                <User className="h-6 w-6" />
              </AvatarFallback>
            </Avatar>
            <div className="text-right">
              <p className="font-medium">{profile?.firstname} {profile?.surname}</p>
              <Badge variant="outline" className="mt-1">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Active
              </Badge>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left Column - Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Finance Overview - Modern Card Design */}
          <Card className="border-0 shadow-md">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5 text-blue-600" />
                  Finance Overview
                </CardTitle>
                <Button variant="ghost" size="sm">
                  Details <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2 p-4 rounded-lg bg-gradient-to-r from-blue-50 to-blue-100/50 dark:from-blue-950/30 dark:to-blue-900/20">
                  <p className="text-sm text-muted-foreground">Total Payable</p>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-bold">N$ 10,000</span>
                  </div>
                  <p className="text-xs text-muted-foreground">For Semester 1, 2025</p>
                </div>

                <div className="space-y-2 p-4 rounded-lg bg-gradient-to-r from-emerald-50 to-emerald-100/50 dark:from-emerald-950/30 dark:to-emerald-900/20">
                  <p className="text-sm text-muted-foreground">Total Paid</p>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">N$ 5,000</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-muted-foreground">50% paid</p>
                    <Badge variant="outline" className="bg-white dark:bg-gray-800">
                      Balance: N$ 5,000
                    </Badge>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Enrolled Courses - Modern List Design */}
          <Card className="border-0 shadow-md">
            <CardHeader>
              <CardTitle>Enrolled Courses</CardTitle>
              <CardDescription>Your current semester courses</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {enrolledCourses.map((course) => (
                <div
                  key={course.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-lg border hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                >
                  <div className="flex-1">
                    <div className="flex items-start gap-3">
                      <div className="p-2 rounded-md bg-primary/10">
                        <BookOpen className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-semibold">{course.title}</h3>
                        <div className="flex items-center gap-3 mt-1">
                          <p className="text-sm text-muted-foreground">{course.code}</p>
                          <span className="text-xs px-2 py-1 rounded-full bg-gray-100 dark:bg-gray-800">
                            {course.instructor}
                          </span>
                        </div>
                        <div className="mt-3">
                          <div className="flex items-center justify-between text-sm mb-1">
                            <span className="text-muted-foreground">Progress</span>
                            <span className="font-medium">{course.progress}%</span>
                          </div>
                          <Progress value={course.progress} className="h-2" />
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col items-end mt-4 sm:mt-0 sm:ml-4">
                    <div className="text-right mb-3">
                      <p className="text-sm text-muted-foreground">Next class</p>
                      <p className="font-medium">{course.nextClass}</p>
                    </div>
                    <Button variant="outline" size="sm">
                      View Details
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Bottom Section with Important Notices */}
          <div className="grid gap-6 md:grid-cols-2">
            {/* Prelim Payment Due */}
            <Card className="border-0 shadow-md">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <AlertCircle className="h-5 w-5 text-amber-500" />
                    Prelim Payment Due
                  </CardTitle>
                  <Badge variant="secondary" className="bg-amber-500/10 text-amber-700 dark:text-amber-400">
                    Important
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground mb-4">
                  First installment of semester fees due by November 30, 2025.
                  Late payments may incur additional charges.
                </p>
                <div className="flex gap-2">
                  <Button className="flex-1">Pay Now</Button>
                  <Button variant="outline">See Details</Button>
                </div>
              </CardContent>
            </Card>

            {/* Exam Schedule */}
            <Card className="border-0 shadow-md">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <CalendarDays className="h-5 w-5 text-blue-500" />
                    Exam Schedule
                  </CardTitle>
                  <Badge variant="outline">Upcoming</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Welding Theory</p>
                      <p className="text-sm text-muted-foreground">December 15, 2025 • 9:00 AM</p>
                    </div>
                    <Badge variant="secondary">Hall A</Badge>
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Metal Fabrication</p>
                      <p className="text-sm text-muted-foreground">December 18, 2025 • 2:00 PM</p>
                    </div>
                    <Badge variant="secondary">Workshop 3</Badge>
                  </div>
                </div>
                <Button variant="ghost" className="w-full mt-4">
                  View Full Schedule
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Right Column - Sidebar Content */}
        <div className="space-y-6">
          {/* Course Instructors */}
          <Card className="border-0 shadow-md">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-purple-600" />
                  Course Instructors
                </CardTitle>
                <Button variant="ghost" size="sm">
                  See All
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {courseInstructors.map((instructor) => (
                <div key={instructor.id} className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                  <Avatar className="h-10 w-10">
                    <AvatarFallback className="bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
                      {instructor.name.split(' ').map(n => n[0]).join('')}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{instructor.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{instructor.course}</p>
                  </div>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Daily Notice */}
          <Card className="border-0 shadow-md">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Megaphone className="h-5 w-5 text-orange-600" />
                  Daily Notices
                </CardTitle>
                <Button variant="ghost" size="sm">
                  See All
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {dailyNotices.map((notice) => (
                <div key={notice.id} className="p-3 rounded-lg border">
                  <div className="flex items-start justify-between">
                    <h4 className="font-semibold text-sm">{notice.title}</h4>
                    <Badge variant="outline" className="text-xs">
                      {notice.time}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                    {notice.content}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Quick Stats */}
          <Card className="border-0 shadow-md bg-gradient-to-br from-gray-50 to-gray-100/50 dark:from-gray-900 dark:to-gray-800/50">
            <CardContent className="p-6">
              <h3 className="font-semibold mb-4">Quick Stats</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Attendance</span>
                  <span className="font-bold">94%</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Assignments Due</span>
                  <span className="font-bold">3</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Days to Semester End</span>
                  <span className="font-bold">42</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Workshop Hours</span>
                  <span className="font-bold">120/150</span>
                </div>
              </div>
              <Button className="w-full mt-6" variant="outline">
                View Full Report
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default TraineeDashboard;