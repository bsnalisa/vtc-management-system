import { useNavigate } from "react-router-dom";
import { BookOpenCheck, ClipboardCheck, FileQuestion, FileText, Pencil, RotateCcw } from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useRoleNavigation } from "@/hooks/useRoleNavigation";
import { useProfile } from "@/hooks/useProfile";
import { useMyTasks } from "@/hooks/useWorkflows";
import { useDevelopmentPlans, useQuestions } from "@/hooks/useAssessmentDevelopment";

const TYPE = { theory: "Theory", practical: "Practical" } as const;

// The Subject Matter Expert's home: the assessments they have been asked to write and how their questions are doing
const SmeDashboard = () => {
  const navigate = useNavigate();
  const { navItems, groupLabel } = useRoleNavigation();
  const { data: profile } = useProfile();
  const { data: plans, isLoading: plansLoading } = useDevelopmentPlans();
  const { data: questions, isLoading: questionsLoading } = useQuestions();
  const { data: tasks } = useMyTasks();

  const open = (plans ?? []).filter((p) => p.status === "assigned" || p.status === "in_progress" || p.status === "rejected");
  const count = (s: string) => (questions ?? []).filter((q) => q.status === s).length;
  const returned = count("rejected");
  const dueSoon = [...open].filter((p) => p.due_date).sort((a, b) => (a.due_date! < b.due_date! ? -1 : 1)).slice(0, 5);

  return (
    <DashboardLayout title={`Welcome back, ${profile?.firstname || "User"}`} subtitle="Assessment development" navItems={navItems} groupLabel={groupLabel}>
      <DashboardShell
        name={profile?.firstname || undefined}
        heroIcon={BookOpenCheck}
        heroSubtitle="The assessments you are writing, and how your questions are doing."
        stats={[
          { label: "Assessments to write", value: open.length, icon: FileText, loading: plansLoading, tone: open.length > 0 ? "primary" : "secondary" },
          { label: "Questions in draft", value: count("draft"), icon: Pencil, loading: questionsLoading, tone: "secondary" },
          { label: "Waiting for review", value: count("submitted"), icon: ClipboardCheck, loading: questionsLoading, tone: "secondary" },
          { label: "Approved questions", value: count("approved"), icon: FileQuestion, loading: questionsLoading, tone: "accent" },
          { label: "Returned to you", value: returned, icon: RotateCcw, loading: questionsLoading, tone: returned > 0 ? "destructive" : "secondary", hint: "Reviewer asked for changes" },
          { label: "Waiting for you", value: tasks?.length ?? 0, icon: ClipboardCheck, tone: (tasks?.length ?? 0) > 0 ? "destructive" : "secondary", hint: "Approvals" },
        ]}
        actions={[
          { icon: Pencil, label: "Write questions", desc: "Assessment development", url: "/assessment-development" },
          { icon: ClipboardCheck, label: "My Approvals", desc: "Pending tasks", url: "/my-approvals", badge: tasks?.length },
        ]}
        actionCols={4}
      >
        <Card>
          <CardHeader><CardTitle>Due soonest</CardTitle><CardDescription>Assessments you still have to finish</CardDescription></CardHeader>
          <CardContent className="space-y-2">
            {dueSoon.length === 0 && <p className="text-sm text-muted-foreground">{open.length === 0 ? "Nothing has been assigned to you." : "None of your assessments has a due date."}</p>}
            {dueSoon.map((p) => (
              <button key={p.id} type="button" onClick={() => navigate("/assessment-development")} className="flex w-full items-center justify-between gap-3 border-b py-2 text-left last:border-0 hover:bg-muted/50">
                <span className="min-w-0"><span className="block break-words text-sm font-medium">{p.qualifications?.qualification_title ?? "Assessment"}{p.unit_standards?.unit_no ? ` · ${p.unit_standards.unit_no}` : ""}</span>
                  <span className="block text-xs text-muted-foreground">{TYPE[p.assessment_type]} · {p.questions_required} questions · due {new Date(p.due_date!).toLocaleDateString()}</span></span>
                <Badge variant={p.status === "rejected" ? "destructive" : "secondary"}>{p.status.replace("_", " ")}</Badge>
              </button>
            ))}
            <Button variant="link" className="px-0" onClick={() => navigate("/assessment-development")}>Open assessment development</Button>
          </CardContent>
        </Card>
      </DashboardShell>
    </DashboardLayout>
  );
};

export default SmeDashboard;
