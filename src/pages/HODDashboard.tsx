import { FileText, TrendingUp, Users, GraduationCap, BookOpen, Award, Building2 } from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { hodNavItems } from "@/lib/navigationConfig";
import { useProfile } from "@/hooks/useProfile";
import { useHODStats } from "@/hooks/useHODStats";
import { EnrollmentChart, FeeCollectionChart } from "@/components/dashboard/DashboardCharts";
import { DashboardShell } from "@/components/dashboard/DashboardShell";

const HODDashboard = () => {
  const { data: profile } = useProfile();
  const { data: stats, isLoading } = useHODStats();

  const enrollmentData = [
    { name: "Electrical", value: 45 },
    { name: "Plumbing", value: 32 },
    { name: "Carpentry", value: 28 },
    { name: "Welding", value: 38 },
  ];
  const competencyData = [
    { name: "Competent", value: stats?.competencyRate || 0 },
    { name: "Not Yet", value: 100 - (stats?.competencyRate || 0) },
  ];

  return (
    <DashboardLayout
      title={`Welcome back, ${profile?.firstname || "User"}`}
      subtitle="Department overview and reporting"
      navItems={hodNavItems}
      groupLabel="Department Management"
    >
      <DashboardShell
        name={profile?.firstname || undefined}
        heroIcon={Building2}
        heroSubtitle="Department overview, staff performance and academic outcomes."
        stats={[
          { label: "Total Trainees", value: stats?.totalTrainees || 0, icon: Users, hint: "Active trainees", loading: isLoading },
          { label: "Trainers", value: stats?.totalTrainers || 0, icon: GraduationCap, hint: "Active trainers", loading: isLoading, tone: "secondary" },
          { label: "Competency Rate", value: `${stats?.competencyRate || 0}%`, icon: Award, hint: "Assessment pass rate", loading: isLoading, progress: stats?.competencyRate || 0, tone: "accent" },
          { label: "Active Classes", value: stats?.totalClasses || 0, icon: BookOpen, hint: `Across ${stats?.totalTrades || 0} trades`, loading: isLoading, tone: "secondary" },
        ]}
        actions={[
          { icon: FileText, label: "Reports", desc: "Departmental reports", url: "/reports" },
          { icon: TrendingUp, label: "Assessments", desc: "Results & progress", url: "/assessment-results" },
          { icon: BookOpen, label: "Classes", desc: "Manage classes", url: "/classes" },
          { icon: Users, label: "Trainers", desc: "Team & workload", url: "/trainers" },
        ]}
        actionCols={4}
      >
        <div className="grid gap-4 md:grid-cols-2">
          <EnrollmentChart data={enrollmentData} />
          <FeeCollectionChart data={competencyData} />
        </div>
      </DashboardShell>
    </DashboardLayout>
  );
};

export default HODDashboard;
