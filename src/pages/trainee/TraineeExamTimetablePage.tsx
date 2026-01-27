import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DashboardLayout } from "@/components/DashboardLayout";
import { traineeNavItems } from "@/lib/navigationConfig";
import { Calendar, Clock, MapPin, BookOpen } from "lucide-react";
import { withRoleAccess } from "@/components/withRoleAccess";

interface Exam {
  id: string;
  subject: string;
  code: string;
  date: string;
  time: string;
  duration: string;
  venue: string;
  type: "theory" | "practical";
}

const TraineeExamTimetablePage = () => {
  // Mock exam data - in production, fetch from exams/assessments table
  const exams: Exam[] = [
    {
      id: "1",
      subject: "Welding Theory & Safety",
      code: "WELD101",
      date: "December 15, 2025",
      time: "09:00 AM",
      duration: "3 hours",
      venue: "Examination Hall A",
      type: "theory",
    },
    {
      id: "2",
      subject: "Metal Fabrication Fundamentals",
      code: "MFAB102",
      date: "December 17, 2025",
      time: "14:00 PM",
      duration: "2 hours",
      venue: "Workshop 3",
      type: "practical",
    },
    {
      id: "3",
      subject: "Blueprint Reading",
      code: "TECH103",
      date: "December 19, 2025",
      time: "09:00 AM",
      duration: "2 hours",
      venue: "Examination Hall B",
      type: "theory",
    },
    {
      id: "4",
      subject: "Advanced Joining Techniques",
      code: "WELD203",
      date: "December 21, 2025",
      time: "10:00 AM",
      duration: "4 hours",
      venue: "Welding Workshop",
      type: "practical",
    },
  ];

  const upcomingExam = exams[0];

  return (
    <DashboardLayout
      title="Exam Timetable"
      subtitle="View your upcoming examinations"
      navItems={traineeNavItems}
      groupLabel="Trainee iEnabler"
    >
      <div className="space-y-6">
        {/* Next Exam Highlight */}
        <Card className="border-0 shadow-md bg-gradient-to-r from-primary/5 to-primary/10">
          <CardHeader>
            <CardTitle className="text-lg">Next Examination</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h3 className="text-xl font-bold">{upcomingExam.subject}</h3>
                <p className="text-muted-foreground">{upcomingExam.code}</p>
              </div>
              <div className="flex flex-wrap gap-4">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">{upcomingExam.date}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span>{upcomingExam.time}</span>
                </div>
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <span>{upcomingExam.venue}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Full Exam Schedule */}
        <Card className="border-0 shadow-md">
          <CardHeader>
            <CardTitle>Examination Schedule</CardTitle>
            <CardDescription>Complete list of your upcoming exams</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {exams.map((exam) => (
                <div
                  key={exam.id}
                  className="flex flex-col md:flex-row md:items-center justify-between p-4 rounded-lg border hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-start gap-4 mb-4 md:mb-0">
                    <div className="p-3 rounded-lg bg-primary/10">
                      <BookOpen className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-semibold">{exam.subject}</h4>
                        <Badge variant={exam.type === "theory" ? "secondary" : "default"}>
                          {exam.type === "theory" ? "Theory" : "Practical"}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{exam.code}</p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 md:flex gap-4 text-sm">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span>{exam.date}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span>{exam.time} ({exam.duration})</span>
                    </div>
                    <div className="flex items-center gap-2 col-span-2">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      <span>{exam.venue}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Exam Guidelines */}
        <Card className="border-0 shadow-md">
          <CardHeader>
            <CardTitle>Examination Guidelines</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              <li className="flex items-start gap-2">
                <div className="w-2 h-2 rounded-full bg-primary mt-2" />
                <span>Arrive at least 30 minutes before the scheduled start time</span>
              </li>
              <li className="flex items-start gap-2">
                <div className="w-2 h-2 rounded-full bg-primary mt-2" />
                <span>Bring your student ID card and examination permit</span>
              </li>
              <li className="flex items-start gap-2">
                <div className="w-2 h-2 rounded-full bg-primary mt-2" />
                <span>No electronic devices allowed in the examination room</span>
              </li>
              <li className="flex items-start gap-2">
                <div className="w-2 h-2 rounded-full bg-primary mt-2" />
                <span>For practical exams, wear appropriate PPE and safety gear</span>
              </li>
              <li className="flex items-start gap-2">
                <div className="w-2 h-2 rounded-full bg-primary mt-2" />
                <span>Late arrivals may not be permitted to enter after 30 minutes</span>
              </li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default withRoleAccess(TraineeExamTimetablePage, {
  requiredRoles: ["trainee"],
});
