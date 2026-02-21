import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Clock, Eye } from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { usePendingQualifications, Qualification } from "@/hooks/useQualifications";
import { ApprovalPanel } from "@/components/qualifications/ApprovalPanel";
import { useRoleNavigation } from "@/hooks/useRoleNavigation";
import { Skeleton } from "@/components/ui/skeleton";
import { withRoleAccess } from "@/components/withRoleAccess";
import { format } from "date-fns";

const QualificationApprovalsPage = () => {
  const { navItems, groupLabel } = useRoleNavigation();
  const { data: pendingQualifications, isLoading, refetch } = usePendingQualifications();
  const [selectedQualification, setSelectedQualification] = useState<Qualification | null>(null);

  const handleComplete = () => {
    setSelectedQualification(null);
    refetch();
  };

  if (selectedQualification) {
    return (
      <DashboardLayout
        title="Review Qualification"
        subtitle="Approve or reject qualification submission"
        navItems={navItems}
        groupLabel={groupLabel}
      >
        <ApprovalPanel
          qualification={selectedQualification}
          onBack={() => setSelectedQualification(null)}
          onComplete={handleComplete}
        />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      title="Qualification Approvals"
      subtitle="Review and approve pending qualifications"
      navItems={navItems}
      groupLabel={groupLabel}
    >
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-muted-foreground" />
          <span className="text-muted-foreground">
            {pendingQualifications?.length || 0} qualification(s) pending approval
          </span>
        </div>

        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-2">
            <Skeleton className="h-40" />
            <Skeleton className="h-40" />
          </div>
        ) : pendingQualifications && pendingQualifications.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2">
            {pendingQualifications.map((qualification) => (
              <Card key={qualification.id} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg">{qualification.qualification_code}</CardTitle>
                      <CardDescription className="line-clamp-2">
                        {qualification.qualification_title}
                      </CardDescription>
                    </div>
                    <Badge variant="outline" className="bg-yellow-100 text-yellow-800">
                      Pending
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between text-sm text-muted-foreground mb-4">
                    <span>NQF Level {qualification.nqf_level}</span>
                    <span>{qualification.duration_value} {qualification.duration_unit}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">
                      Submitted {format(new Date(qualification.updated_at), "MMM d, yyyy")}
                    </span>
                    <Button size="sm" onClick={() => setSelectedQualification(qualification)}>
                      <Eye className="h-4 w-4 mr-2" />
                      Review
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="p-12 text-center">
            <p className="text-muted-foreground">No qualifications pending approval.</p>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
};

export default withRoleAccess(QualificationApprovalsPage, {
  requiredRoles: ["head_of_training", "super_admin"],
});
