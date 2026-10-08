import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { ExportMenu } from "@/components/ExportMenu";
import { RequestDetailDialog } from "@/components/assessment/RequestDetailDialog";
import { AssessmentRequest, useAssessmentRequests } from "@/hooks/useAssessmentRequests";

export const RPL_STATUSES = ["submitted", "more_info_needed", "under_review", "assessment_scheduled", "approved", "rejected"];
export const statusLabel = (s: string) => s.replace(/_/g, " ");
export const statusVariant = (s: string): "default" | "secondary" | "destructive" | "outline" =>
  s === "approved" ? "default" : s === "rejected" ? "destructive" : s === "submitted" || s === "under_review" ? "secondary" : "outline";

/** All RPL requests with a status filter; opens the shared review dialog. */
export function RplRequestsList() {
  const { data, isLoading, error } = useAssessmentRequests("rpl");
  const [status, setStatus] = useState("all");
  const [selected, setSelected] = useState<AssessmentRequest | null>(null);
  const rows = (data ?? []).filter((r) => status === "all" || r.status === status);

  if (isLoading) return <LoadingSpinner text="Loading RPL requests..." />;
  if (error) return <p role="alert" className="text-sm text-destructive py-6 text-center">Could not load RPL requests: {(error as Error).message}</p>;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:justify-between">
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-full sm:w-56" aria-label="Filter by status"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {RPL_STATUSES.map((s) => <SelectItem key={s} value={s}>{statusLabel(s)}</SelectItem>)}
          </SelectContent>
        </Select>
        <ExportMenu title="RPL requests" filename="rpl-requests" disabled={!rows.length}
          data={() => rows.map((r) => ({ reference: r.reference_number, applicant: r.applicant_name, national_id: r.national_id, qualification: r.qualifications?.qualification_title, status: r.status, outcome: r.outcome, assessor: r.assessor_name, scheduled: r.scheduled_at, submitted: r.created_at }))} />
      </div>
      <Table>
        <TableHeader><TableRow><TableHead>Reference</TableHead><TableHead>Applicant</TableHead><TableHead>Qualification</TableHead><TableHead>Submitted</TableHead><TableHead>Status</TableHead><TableHead /></TableRow></TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.id}>
              <TableCell className="font-mono">{r.reference_number}</TableCell>
              <TableCell className="font-medium">{r.applicant_name}</TableCell>
              <TableCell>{r.qualifications?.qualification_title ?? "-"}</TableCell>
              <TableCell>{new Date(r.created_at).toLocaleDateString()}</TableCell>
              <TableCell><Badge variant={statusVariant(r.status)}>{statusLabel(r.status)}</Badge></TableCell>
              <TableCell className="text-right"><Button size="sm" variant="outline" onClick={() => setSelected(r)}>Review</Button></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {!rows.length && <p className="text-sm text-muted-foreground text-center py-6">No RPL requests{status !== "all" ? " with this status" : " yet"}.</p>}
      <RequestDetailDialog request={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
