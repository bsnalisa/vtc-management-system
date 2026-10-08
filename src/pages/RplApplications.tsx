import { DashboardLayout } from "@/components/DashboardLayout";
import { useRoleNavigation } from "@/hooks/useRoleNavigation";
import { withRoleAccess } from "@/components/withRoleAccess";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PublicRplInbox } from "@/components/assessment/PublicRplInbox";
import { RplRequestsList } from "@/components/rpl/RplRequestsList";
import { useAssessmentRequests } from "@/hooks/useAssessmentRequests";

const RplApplications = () => {
  const { navItems, groupLabel } = useRoleNavigation();
  const { data } = useAssessmentRequests("rpl");
  const open = data?.filter((r) => r.status === "submitted" || r.status === "under_review").length ?? 0;
  return (
    <DashboardLayout title="RPL Applications" subtitle="All recognition of prior learning work in one place" navItems={navItems} groupLabel={groupLabel}>
      <Card>
        <CardHeader><CardTitle>Applications</CardTitle><CardDescription>Review requests from trainees and applications that came in through the public link. Applicants are notified of every status change.</CardDescription></CardHeader>
        <CardContent>
          <Tabs defaultValue="requests">
            <TabsList>
              <TabsTrigger value="requests">Requests ({open} open)</TabsTrigger>
              <TabsTrigger value="public">Public applications</TabsTrigger>
            </TabsList>
            <TabsContent value="requests"><RplRequestsList /></TabsContent>
            <TabsContent value="public"><PublicRplInbox /></TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </DashboardLayout>
  );
};

export default withRoleAccess(RplApplications, {
  requiredRoles: ["rpl_coordinator", "assessment_coordinator", "admin", "organization_admin", "head_of_training"],
});
