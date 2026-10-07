import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { traineeNavItems } from "@/lib/navigationConfig";
import { useRoleNavigation } from "@/hooks/useRoleNavigation";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useLearningClasses } from "@/hooks/useLearningSpace";
import { ContentTab } from "@/components/learning/ContentTab";
import { AssignmentsTab } from "@/components/learning/AssignmentsTab";
import { QuizzesTab } from "@/components/learning/QuizzesTab";
import { ForumTab } from "@/components/learning/ForumTab";

export default function LearningSpace() {
  const { role, navItems, groupLabel } = useRoleNavigation();
  const isTrainee = role === "trainee";
  const { data: classes = [], isLoading, error } = useLearningClasses();
  const [classId, setClassId] = useState<string>("");

  useEffect(() => {
    if (!classId && classes.length) setClassId(classes[0].class_id);
  }, [classes, classId]);

  const current = classes.find((c) => c.class_id === classId);
  const canManage = !!current?.can_manage;

  return (
    <DashboardLayout
      title="Learning Space" subtitle="Content, assignments, quizzes and discussion for your class"
      navItems={isTrainee ? traineeNavItems : navItems} groupLabel={isTrainee ? "Trainee iEnabler" : groupLabel}>
      <div className="space-y-4">
        <Card className="border-0 shadow-md">
          <CardContent className="pt-6 flex items-end gap-3 flex-wrap">
            <div className="space-y-1 min-w-[16rem]">
              <Label>Class</Label>
              <Select value={classId} onValueChange={setClassId} disabled={!classes.length}>
                <SelectTrigger><SelectValue placeholder={isLoading ? "Loading classes..." : "No classes available"} /></SelectTrigger>
                <SelectContent>
                  {classes.map((c) => (
                    <SelectItem key={c.class_id} value={c.class_id}>{c.class_name} ({c.class_code}, {c.academic_year})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {current && <Badge variant="secondary">{canManage ? "You manage this class" : "Enrolled"}</Badge>}
          </CardContent>
        </Card>

        {error && <p className="text-sm text-destructive">Could not load your classes: {(error as Error).message}</p>}
        {!isLoading && !classes.length && !error && (
          <p className="text-sm text-muted-foreground text-center py-8">You have no classes in the learning space.</p>
        )}

        {current && (
          <Tabs defaultValue="content" key={current.class_id}>
            <TabsList>
              <TabsTrigger value="content">Content</TabsTrigger>
              <TabsTrigger value="assignments">Assignments</TabsTrigger>
              <TabsTrigger value="quizzes">Quizzes</TabsTrigger>
              <TabsTrigger value="forum">Forum</TabsTrigger>
            </TabsList>
            <TabsContent value="content"><ContentTab classId={current.class_id} canManage={canManage} /></TabsContent>
            <TabsContent value="assignments"><AssignmentsTab classId={current.class_id} canManage={canManage} /></TabsContent>
            <TabsContent value="quizzes"><QuizzesTab classId={current.class_id} canManage={canManage} /></TabsContent>
            <TabsContent value="forum"><ForumTab classId={current.class_id} canManage={canManage} /></TabsContent>
          </Tabs>
        )}
      </div>
    </DashboardLayout>
  );
}
