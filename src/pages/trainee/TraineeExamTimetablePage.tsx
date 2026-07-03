import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DashboardLayout } from "@/components/DashboardLayout";
import { traineeNavItems } from "@/lib/navigationConfig";
import { Calendar, Clock, MapPin, User, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { withRoleAccess } from "@/components/withRoleAccess";
import { useTraineeUserId, useTraineeRecord } from "@/hooks/useTraineePortalData";
import { useTraineePublishedExams } from "@/hooks/useExamTimetables";

const TraineeExamTimetablePage = () => {
  const userId = useTraineeUserId();
  const { data: trainee, isLoading: tLoading } = useTraineeRecord(userId);
  const { data: exams = [], isLoading: eLoading } = useTraineePublishedExams(trainee?.id);

  const isLoading = tLoading || eLoading;

  if (isLoading) {
    return (
      <DashboardLayout title="Exam Timetable" subtitle="Your published examinations" navItems={traineeNavItems} groupLabel="Trainee iEnabler">
        <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      </DashboardLayout>
    );
  }

  const upcoming = exams.filter((e: any) => new Date(e.exam_date) >= new Date(new Date().toDateString()));
  const past = exams.filter((e: any) => new Date(e.exam_date) < new Date(new Date().toDateString()));

  const ExamCard = ({ exam }: { exam: any }) => (
    <div className="flex flex-col md:flex-row md:items-center justify-between p-4 rounded-lg border hover:bg-muted/50 transition-colors gap-4">
      <div className="flex items-start gap-4 flex-1">
        <div className="p-3 rounded-lg bg-primary/10 text-primary">
          <Calendar className="h-5 w-5" />
        </div>
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="font-semibold">{exam.subject_name}</h4>
            <Badge variant={exam.exam_type === "theory" ? "secondary" : "outline"}>{exam.exam_type}</Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            {exam.qualifications?.qualification_code} — {exam.qualifications?.qualification_title}
          </p>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {new Date(exam.exam_date).toLocaleDateString("en-ZA", { weekday: "short", day: "numeric", month: "short", year: "numeric" })}
            </span>
            {exam.start_time && (
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {exam.start_time.slice(0, 5)}{exam.end_time ? `–${exam.end_time.slice(0, 5)}` : ""}
              </span>
            )}
            {(exam.training_rooms?.name || exam.venue) && (
              <span className="flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {exam.training_rooms?.name || exam.venue}
              </span>
            )}
            {exam.invigilators?.full_name && (
              <span className="flex items-center gap-1">
                <User className="h-3 w-3" />
                {exam.invigilators.full_name}
              </span>
            )}
          </div>
        </div>
      </div>
      <div className="flex flex-col items-end gap-1">
        {exam.eligible ? (
          <Badge className="bg-green-100 text-green-800">
            <CheckCircle2 className="h-3 w-3 mr-1" /> Eligible
          </Badge>
        ) : (
          <Badge variant="destructive">
            <XCircle className="h-3 w-3 mr-1" /> Not Eligible
          </Badge>
        )}
        {exam.eligibility && (
          <p className="text-xs text-muted-foreground text-right">
            {exam.exam_type === "theory"
              ? `CA: ${Number(exam.eligibility.theory_ca_percent || 0).toFixed(1)}% / ${exam.min_theory_ca}%`
              : `Practical: ${Number(exam.eligibility.practical_avg_percent || 0).toFixed(1)}% / ${exam.min_practical_avg}%`}
          </p>
        )}
      </div>
    </div>
  );

  return (
    <DashboardLayout title="Exam Timetable" subtitle="Your published examinations & eligibility" navItems={traineeNavItems} groupLabel="Trainee iEnabler">
      <div className="space-y-6">
        <Card className="border-0 shadow-md">
          <CardHeader>
            <CardTitle>Upcoming Exams</CardTitle>
            <CardDescription>{upcoming.length} scheduled sitting(s)</CardDescription>
          </CardHeader>
          <CardContent>
            {upcoming.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground">
                <Calendar className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No upcoming exams have been published yet.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {upcoming.map((e: any) => <ExamCard key={e.id} exam={e} />)}
              </div>
            )}
          </CardContent>
        </Card>

        {past.length > 0 && (
          <Card className="border-0 shadow-md">
            <CardHeader>
              <CardTitle>Past Exams</CardTitle>
              <CardDescription>{past.length} completed sitting(s)</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 opacity-80">
                {past.map((e: any) => <ExamCard key={e.id} exam={e} />)}
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="border-0 shadow-md">
          <CardHeader><CardTitle>Examination Guidelines</CardTitle></CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              {[
                "Arrive at least 30 minutes before the scheduled start time",
                "Bring your student ID card and examination permit",
                "No electronic devices allowed in the examination room",
                "For practical exams, wear appropriate PPE and safety gear",
                "Late arrivals may not be permitted to enter after 30 minutes",
                "You must meet CA/Practical eligibility thresholds to sit for the exam",
              ].map((rule, i) => (
                <li key={i} className="flex items-start gap-2"><div className="w-2 h-2 rounded-full bg-primary mt-2" /><span>{rule}</span></li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default withRoleAccess(TraineeExamTimetablePage, { requiredRoles: ["trainee"] });
