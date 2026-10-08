import { DashboardLayout } from "@/components/DashboardLayout";
import { useRoleNavigation } from "@/hooks/useRoleNavigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SmeApplicationsTab } from "@/components/assessment/SmeApplicationsTab";
import { PlansTab } from "@/components/assessment/PlansTab";
import { QuestionBankTab } from "@/components/assessment/QuestionBankTab";
import { PapersTab } from "@/components/assessment/PapersTab";

const STAFF_ROLES = ["admin", "organization_admin", "assessment_coordinator", "rpl_coordinator", "head_of_training", "registration_officer", "super_admin"];

export default function AssessmentDevelopment() {
  const { role, navItems, groupLabel } = useRoleNavigation();
  const isStaff = !!role && STAFF_ROLES.includes(role);

  return (
    <DashboardLayout title="Assessment Development" subtitle="Experts, development plans, question bank and papers" navItems={navItems} groupLabel={groupLabel}>
      <Card>
        <CardHeader>
          <CardTitle>Assessment Development</CardTitle>
          <CardDescription>
            {isStaff ? "Approve experts, plan materials development, review the question bank and generate papers." : "Work on your assigned plans and submit questions for approval. You only see your own questions."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="plans">
            <TabsList>
              <TabsTrigger value="plans">Development Plans</TabsTrigger>
              <TabsTrigger value="bank">Question Bank</TabsTrigger>
              {isStaff && <TabsTrigger value="papers">Papers</TabsTrigger>}
              {isStaff && <TabsTrigger value="experts">Expert Applications</TabsTrigger>}
            </TabsList>
            <TabsContent value="plans"><PlansTab isStaff={isStaff} /></TabsContent>
            <TabsContent value="bank"><QuestionBankTab isStaff={isStaff} /></TabsContent>
            {isStaff && <TabsContent value="papers"><PapersTab /></TabsContent>}
            {isStaff && <TabsContent value="experts"><SmeApplicationsTab /></TabsContent>}
          </Tabs>
        </CardContent>
      </Card>
    </DashboardLayout>
  );
}
