import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DashboardLayout } from "@/components/DashboardLayout";
import { traineeNavItems } from "@/lib/navigationConfig";
import { withRoleAccess } from "@/components/withRoleAccess";
import { supabase } from "@/integrations/supabase/client";
import { useOrganizationContext } from "@/hooks/useOrganizationContext";
import { useSubmitAnonymously, useCreateAffairsRecord } from "@/hooks/useTraineeAffairs";
import { useTraineeUserId, useTraineeRecord } from "@/hooks/useTraineePortalData";

function SuggestionForm() {
  const [message, setMessage] = useState("");
  const submit = useSubmitAnonymously();
  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        await submit.mutateAsync({ kind: "suggestion", message });
        setMessage("");
      }}
    >
      <p className="text-sm text-muted-foreground">Your identity is not stored with this submission.</p>
      <Textarea required rows={5} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Your suggestion or concern" />
      <Button type="submit" disabled={submit.isPending}>Submit anonymously</Button>
    </form>
  );
}

function TrainerEvaluationForm() {
  const { organizationId } = useOrganizationContext();
  const [trainerId, setTrainerId] = useState("");
  const [rating, setRating] = useState("5");
  const [message, setMessage] = useState("");
  const submit = useSubmitAnonymously();
  const { data: trainers } = useQuery({
    queryKey: ["trainer-options", organizationId],
    enabled: !!organizationId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trainers").select("id, full_name").eq("organization_id", organizationId!).eq("active", true);
      if (error) throw error;
      return data;
    },
  });
  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        await submit.mutateAsync({ kind: "trainer_evaluation", trainer_id: trainerId, rating: Number(rating), message });
        setMessage("");
      }}
    >
      <p className="text-sm text-muted-foreground">Evaluations are anonymous. Your identity is not stored.</p>
      <div className="space-y-2">
        <Label>Trainer</Label>
        <Select value={trainerId} onValueChange={setTrainerId}>
          <SelectTrigger><SelectValue placeholder="Select trainer" /></SelectTrigger>
          <SelectContent>{trainers?.map((t) => <SelectItem key={t.id} value={t.id}>{t.full_name}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>Rating (1 poor – 5 excellent)</Label>
        <Select value={rating} onValueChange={setRating}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>{[1, 2, 3, 4, 5].map((n) => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <Textarea required rows={4} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Comments" />
      <Button type="submit" disabled={submit.isPending || !trainerId}>Submit evaluation</Button>
    </form>
  );
}

function GrievanceForm() {
  const userId = useTraineeUserId();
  const { data: trainee } = useTraineeRecord(userId);
  const create = useCreateAffairsRecord();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("general");
  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!trainee) return;
        await create.mutateAsync({
          record_type: "grievance", trainee_id: trainee.id, title, description,
          ...(category === "hostel" ? { category: "hostel" } : {}),
        });
        setTitle("");
        setDescription("");
        setCategory("general");
      }}
    >
      <p className="text-sm text-muted-foreground">Raise a grievance or give feedback. Trainee Affairs staff will follow up with you.</p>
      <div className="space-y-2">
        <Label>Category</Label>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="general">General</SelectItem>
            <SelectItem value="hostel">Hostel</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <Input required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Subject" />
      <Textarea required rows={5} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Describe your grievance or feedback" />
      <Button type="submit" disabled={create.isPending || !trainee}>Submit</Button>
    </form>
  );
}

const TraineeFeedbackPage = () => (
  <DashboardLayout title="Feedback & Suggestions" subtitle="Share suggestions, evaluate trainers or raise a grievance" navItems={traineeNavItems} groupLabel="Trainee iEnabler">
    <Card className="border-0 shadow-md">
      <CardHeader>
        <CardTitle>Have your say</CardTitle>
        <CardDescription>Suggestions and trainer evaluations are anonymous.</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="suggestion">
          <TabsList>
            <TabsTrigger value="suggestion">Suggestion Box</TabsTrigger>
            <TabsTrigger value="evaluation">Evaluate a Trainer</TabsTrigger>
            <TabsTrigger value="grievance">Grievance</TabsTrigger>
          </TabsList>
          <TabsContent value="suggestion"><SuggestionForm /></TabsContent>
          <TabsContent value="evaluation"><TrainerEvaluationForm /></TabsContent>
          <TabsContent value="grievance"><GrievanceForm /></TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  </DashboardLayout>
);

export default withRoleAccess(TraineeFeedbackPage, { requiredRoles: ["trainee"] });
