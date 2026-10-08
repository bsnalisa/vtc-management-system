import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DashboardLayout } from "@/components/DashboardLayout";
import { traineeNavItems } from "@/lib/navigationConfig";
import { withRoleAccess } from "@/components/withRoleAccess";
import { DocumentUpload } from "@/components/application/DocumentUpload";
import { useTraineeUserId, useTraineeRecord } from "@/hooks/useTraineePortalData";
import {
  EvidenceFile, REQUEST_LABELS, RequestType, useAssessmentRequests, useQualificationOptions,
  useSubmitAssessmentRequest, useUnitStandardOptions, useUpdateAssessmentRequest,
} from "@/hooks/useAssessmentRequests";

const INTRO: Record<RequestType, string> = {
  rpl: "Recognition of Prior Learning: ask to be assessed against a qualification using your work experience and evidence.",
  exemption: "Ask to be exempted from a unit standard you have already achieved elsewhere. Attach your certificate or statement of results.",
  external_assessment: "Apply to sit an external assessment for a qualification.",
};

function RequestForm({ type }: { type: RequestType }) {
  const userId = useTraineeUserId();
  const { data: trainee } = useTraineeRecord(userId);
  const { data: units } = useUnitStandardOptions();
  const { data: quals } = useQualificationOptions();
  const submit = useSubmitAssessmentRequest();
  const [unitId, setUnitId] = useState("");
  const [qualId, setQualId] = useState("");
  const [motivation, setMotivation] = useState("");
  const [evidence, setEvidence] = useState<EvidenceFile[]>([]);
  const [slot, setSlot] = useState(0); // remounts the uploader after each file so several can be added

  const needsUnit = type === "exemption";
  const ready = !!trainee && !!motivation.trim() && (needsUnit ? !!unitId : !!qualId) && (type !== "exemption" || evidence.length > 0);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!trainee) return;
    await submit.mutateAsync({
      request_type: type,
      trainee_id: trainee.id,
      applicant_name: `${trainee.first_name} ${trainee.last_name}`,
      national_id: trainee.national_id ?? null,
      phone: trainee.phone ?? null,
      email: trainee.email ?? null,
      unit_standard_id: needsUnit ? unitId : null,
      qualification_id: needsUnit ? null : qualId,
      motivation,
      evidence,
    });
    setUnitId(""); setQualId(""); setMotivation(""); setEvidence([]);
  };

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <p className="text-sm text-muted-foreground">{INTRO[type]}</p>
      {needsUnit ? (
        <div className="space-y-1"><Label>Unit standard</Label>
          <Select value={unitId} onValueChange={setUnitId}>
            <SelectTrigger><SelectValue placeholder="Select unit standard" /></SelectTrigger>
            <SelectContent>{units?.map((u) => <SelectItem key={u.id} value={u.id}>{u.unit_no} - {u.module_title}</SelectItem>)}</SelectContent>
          </Select></div>
      ) : (
        <div className="space-y-1"><Label>Qualification</Label>
          <Select value={qualId} onValueChange={setQualId}>
            <SelectTrigger><SelectValue placeholder="Select qualification" /></SelectTrigger>
            <SelectContent>{quals?.map((q) => <SelectItem key={q.id} value={q.id}>{q.qualification_title}</SelectItem>)}</SelectContent>
          </Select></div>
      )}
      <div className="space-y-1"><Label>{type === "rpl" ? "Describe your experience" : "Motivation"}</Label>
        <Textarea required rows={4} value={motivation} onChange={(e) => setMotivation(e.target.value)} /></div>
      <div className="space-y-2">
        <Label>Supporting evidence{type === "exemption" ? " (required)" : ""}</Label>
        {evidence.map((f) => <div key={f.path} className="text-sm">{f.name}</div>)}
        <DocumentUpload key={slot} label="Add a file" accept=".pdf,.jpg,.jpeg,.png" folder="assessment-requests"
          onUpload={(path) => { setEvidence((ev) => [...ev, { name: path.split("/").pop() ?? "file", path }]); setSlot((s) => s + 1); }} />
      </div>
      <Button type="submit" disabled={!ready || submit.isPending}>Submit {REQUEST_LABELS[type].toLowerCase()} request</Button>
    </form>
  );
}

function MyRequests() {
  const { data } = useAssessmentRequests();
  const update = useUpdateAssessmentRequest();
  if (!data?.length) return <p className="text-sm text-muted-foreground py-4">You have not submitted any requests.</p>;
  return (
    <div className="space-y-3">
      {data.map((r) => (
        <div key={r.id} className="border rounded-md p-3 text-sm space-y-1">
          <div className="flex justify-between items-center">
            <span className="font-mono">{r.reference_number} · {REQUEST_LABELS[r.request_type]}</span>
            <Badge variant={r.status === "approved" ? "default" : r.status === "rejected" ? "destructive" : "secondary"}>{r.status.replace(/_/g, " ")}</Badge>
          </div>
          <div>{r.unit_standards ? `${r.unit_standards.unit_no} - ${r.unit_standards.module_title}` : r.qualifications?.qualification_title}</div>
          {r.scheduled_at && <div>Assessment: {new Date(r.scheduled_at).toLocaleString()}{r.venue ? ` at ${r.venue}` : ""}</div>}
          {r.decision_notes && <div className="text-muted-foreground">Note from assessor: {r.decision_notes}</div>}
          {r.status === "more_info_needed" && (
            <Button size="sm" variant="outline" onClick={() => update.mutate({ id: r.id, status: "submitted" })}>I have added the information, resubmit</Button>
          )}
        </div>
      ))}
    </div>
  );
}

const TraineeRequestsPage = () => (
  <DashboardLayout title="Assessment Requests" subtitle="RPL, exemptions and external assessments" navItems={traineeNavItems} groupLabel="Trainee iEnabler">
    <Card className="border-0 shadow-md">
      <CardHeader><CardTitle>Apply</CardTitle><CardDescription>You will be notified when your request is reviewed.</CardDescription></CardHeader>
      <CardContent>
        <Tabs defaultValue="exemption">
          <TabsList>
            <TabsTrigger value="exemption">Exemption</TabsTrigger>
            <TabsTrigger value="rpl">RPL</TabsTrigger>
            <TabsTrigger value="external_assessment">External assessment</TabsTrigger>
            <TabsTrigger value="mine">My requests</TabsTrigger>
          </TabsList>
          {(["exemption", "rpl", "external_assessment"] as RequestType[]).map((t) => <TabsContent key={t} value={t}><RequestForm type={t} /></TabsContent>)}
          <TabsContent value="mine"><MyRequests /></TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  </DashboardLayout>
);

export default withRoleAccess(TraineeRequestsPage, { requiredRoles: ["trainee"] });
