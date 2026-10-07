import { Link } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Clock, FileCheck, Award, TrendingUp } from "lucide-react";
import { rplCoordinatorNavItems } from "@/lib/navigationConfig";
import { useAssessmentRequests } from "@/hooks/useAssessmentRequests";

export default function RPLCoordinatorDashboard() {
  const { data: rpl = [] } = useAssessmentRequests("rpl");

  const pending = rpl.filter((r) => r.status === "submitted" || r.status === "more_info_needed").length;
  const underReview = rpl.filter((r) => r.status === "under_review").length;
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime();
  const competentThisMonth = rpl.filter((r) => r.outcome === "competent" && r.decided_at && new Date(r.decided_at).getTime() >= monthStart).length;
  const assessed = rpl.filter((r) => r.outcome);
  const successRate = assessed.length ? Math.round((assessed.filter((r) => r.outcome === "competent").length / assessed.length) * 100) : null;
  const upcoming = rpl
    .filter((r) => r.status === "assessment_scheduled" && r.scheduled_at && new Date(r.scheduled_at).getTime() >= Date.now())
    .sort((a, b) => new Date(a.scheduled_at!).getTime() - new Date(b.scheduled_at!).getTime());

  const stats = [
    { title: "Awaiting review", value: pending, note: "New or waiting on the applicant", icon: Clock },
    { title: "Under review", value: underReview, note: "Being assessed", icon: FileCheck },
    { title: "Competent this month", value: competentThisMonth, note: "Outcomes recorded", icon: Award },
    { title: "Success rate", value: successRate === null ? "-" : `${successRate}%`, note: `${assessed.length} assessed to date`, icon: TrendingUp },
  ];

  return (
    <DashboardLayout title="RPL Coordinator Dashboard" subtitle="Recognition of Prior Learning applications and assessments" groupLabel="RPL Management" navItems={rplCoordinatorNavItems}>
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {stats.map((s) => (
            <Card key={s.title}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{s.title}</CardTitle>
                <s.icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent><div className="text-2xl font-bold">{s.value}</div><p className="text-xs text-muted-foreground">{s.note}</p></CardContent>
            </Card>
          ))}
        </div>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div><CardTitle>Upcoming assessments</CardTitle><CardDescription>Scheduled RPL assessments</CardDescription></div>
            <Button asChild><Link to="/assessment-requests">Review applications</Link></Button>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader><TableRow><TableHead>When</TableHead><TableHead>Candidate</TableHead><TableHead>Qualification</TableHead><TableHead>Assessor</TableHead><TableHead>Venue</TableHead></TableRow></TableHeader>
              <TableBody>
                {upcoming.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>{new Date(r.scheduled_at!).toLocaleString()}</TableCell>
                    <TableCell className="font-medium">{r.applicant_name} <Badge variant="outline" className="ml-1">{r.reference_number}</Badge></TableCell>
                    <TableCell>{r.qualifications?.qualification_title ?? "-"}</TableCell>
                    <TableCell>{r.assessor_name ?? "-"}</TableCell>
                    <TableCell>{r.venue ?? "-"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {!upcoming.length && <p className="text-sm text-muted-foreground text-center py-6">No assessments scheduled.</p>}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
