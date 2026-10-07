import { useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useRoleNavigation } from "@/hooks/useRoleNavigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ExportMenu } from "@/components/ExportMenu";
import { RequestDetailDialog } from "@/components/assessment/RequestDetailDialog";
import { AssessmentRequest, REQUEST_LABELS, RequestType, useAssessmentRequests } from "@/hooks/useAssessmentRequests";

const STATUSES = ["all", "submitted", "more_info_needed", "under_review", "assessment_scheduled", "approved", "rejected"];

function RequestsTable({ type }: { type: RequestType }) {
  const { data } = useAssessmentRequests(type);
  const [status, setStatus] = useState("all");
  const [selected, setSelected] = useState<AssessmentRequest | null>(null);
  const rows = (data ?? []).filter((r) => status === "all" || r.status === status);

  return (
    <div className="space-y-4">
      <div className="flex justify-between gap-3">
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-52"><SelectValue /></SelectTrigger>
          <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s}>{s === "all" ? "All statuses" : s.replace(/_/g, " ")}</SelectItem>)}</SelectContent>
        </Select>
        <ExportMenu title={`${REQUEST_LABELS[type]} requests`} filename={`${type}-requests`} disabled={!rows.length}
          data={() => rows.map((r) => ({ reference: r.reference_number, applicant: r.applicant_name, national_id: r.national_id, qualification: r.qualifications?.qualification_title, unit_standard: r.unit_standards?.unit_no, status: r.status, outcome: r.outcome, assessor: r.assessor_name, scheduled: r.scheduled_at, submitted: r.created_at }))} />
      </div>
      <Table>
        <TableHeader><TableRow><TableHead>Reference</TableHead><TableHead>Applicant</TableHead><TableHead>Subject</TableHead><TableHead>Submitted</TableHead><TableHead>Status</TableHead><TableHead /></TableRow></TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.id}>
              <TableCell className="font-mono">{r.reference_number}</TableCell>
              <TableCell className="font-medium">{r.applicant_name}</TableCell>
              <TableCell>{r.unit_standards?.unit_no ?? r.qualifications?.qualification_title ?? "-"}</TableCell>
              <TableCell>{new Date(r.created_at).toLocaleDateString()}</TableCell>
              <TableCell><Badge variant={r.status === "approved" ? "default" : r.status === "rejected" ? "destructive" : "secondary"}>{r.status.replace(/_/g, " ")}</Badge></TableCell>
              <TableCell className="text-right"><Button size="sm" variant="outline" onClick={() => setSelected(r)}>Review</Button></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {!rows.length && <p className="text-sm text-muted-foreground text-center py-6">No requests.</p>}
      <RequestDetailDialog request={selected} onClose={() => setSelected(null)} />
    </div>
  );
}

export default function AssessmentRequests() {
  const { navItems, groupLabel } = useRoleNavigation();
  const { data: all } = useAssessmentRequests();
  const open = (t: RequestType) => all?.filter((r) => r.request_type === t && (r.status === "submitted" || r.status === "under_review")).length ?? 0;
  return (
    <DashboardLayout title="RPL, Exemptions & External Assessments" subtitle="Review applications from trainees and candidates" navItems={navItems} groupLabel={groupLabel}>
      <Card>
        <CardHeader><CardTitle>Assessment requests</CardTitle><CardDescription>Approve, reject or ask applicants for more information. Applicants are notified of every status change.</CardDescription></CardHeader>
        <CardContent>
          <Tabs defaultValue="rpl">
            <TabsList>
              {(Object.keys(REQUEST_LABELS) as RequestType[]).map((t) => <TabsTrigger key={t} value={t}>{REQUEST_LABELS[t]} ({open(t)} open)</TabsTrigger>)}
            </TabsList>
            {(Object.keys(REQUEST_LABELS) as RequestType[]).map((t) => <TabsContent key={t} value={t}><RequestsTable type={t} /></TabsContent>)}
          </Tabs>
        </CardContent>
      </Card>
    </DashboardLayout>
  );
}
