import { useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useRoleNavigation } from "@/hooks/useRoleNavigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SupervisorLinkDialog } from "@/components/placement/SupervisorLinkDialog";
import { LogbookEntry, useReviewQueue, useSaveLogbookEntry } from "@/hooks/useLogbook";

function ReviewDialog({ entry, onClose }: { entry: LogbookEntry; onClose: () => void }) {
  const save = useSaveLogbookEntry();
  const [comment, setComment] = useState(entry.reviewer_comment ?? "");
  const [supervisor, setSupervisor] = useState(entry.supervisor_signed_by ?? "");
  const [signedOn, setSignedOn] = useState(entry.supervisor_signed_on ?? new Date().toISOString().slice(0, 10));

  const act = async (patch: Partial<LogbookEntry>) => { await save.mutateAsync({ id: entry.id, ...patch }); onClose(); };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader><DialogTitle>{entry.trainees?.first_name} {entry.trainees?.last_name} · {entry.entry_date}</DialogTitle></DialogHeader>
        <div className="space-y-3 text-sm">
          <div><div className="text-muted-foreground">Hours</div>{entry.hours}</div>
          <div><div className="text-muted-foreground">Activities</div><p className="whitespace-pre-wrap">{entry.activities}</p></div>
          {entry.skills_learned && <div><div className="text-muted-foreground">Skills learned</div><p>{entry.skills_learned}</p></div>}
          {entry.challenges && <div><div className="text-muted-foreground">Challenges</div><p>{entry.challenges}</p></div>}
          <div className="grid grid-cols-2 gap-3 border-t pt-3">
            <div className="space-y-1"><Label>Workplace supervisor who signed</Label><Input value={supervisor} onChange={(e) => setSupervisor(e.target.value)} /></div>
            <div className="space-y-1"><Label>Signed on</Label><Input type="date" value={signedOn} onChange={(e) => setSignedOn(e.target.value)} /></div>
          </div>
          <div className="space-y-1"><Label>Comment (required when returning)</Label><Textarea value={comment} onChange={(e) => setComment(e.target.value)} /></div>
          <div className="flex flex-wrap gap-2">
            <SupervisorLinkDialog placementId={entry.placement_id} />
            <Button variant="outline" disabled={save.isPending || !supervisor.trim()} title={supervisor.trim() ? "" : "Enter the supervisor's name"} onClick={() => act({ status: "supervisor_signed", supervisor_signed_by: supervisor.trim(), supervisor_signed_on: signedOn })}>Record supervisor sign-off</Button>
            <Button disabled={save.isPending || (!entry.supervisor_signed_by && !supervisor.trim())} title="A supervisor sign-off is needed before approval" onClick={() => act({ status: "approved", supervisor_signed_by: entry.supervisor_signed_by ?? supervisor.trim(), supervisor_signed_on: entry.supervisor_signed_on ?? signedOn, reviewer_comment: comment || null })}>Approve</Button>
            <Button variant="destructive" disabled={save.isPending || !comment.trim()} onClick={() => act({ status: "returned", reviewer_comment: comment.trim() })}>Return to trainee</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function LogbookReview() {
  const { navItems, groupLabel } = useRoleNavigation();
  const { data } = useReviewQueue();
  const [selected, setSelected] = useState<LogbookEntry | null>(null);
  return (
    <DashboardLayout title="Logbook Review" subtitle="Industrial attachment logbook entries awaiting sign-off" navItems={navItems} groupLabel={groupLabel}>
      <Card>
        <CardHeader><CardTitle>Entries to review</CardTitle><CardDescription>Record the workplace supervisor's sign-off, then approve, or return the entry to the trainee with a comment.</CardDescription></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Trainee</TableHead><TableHead>Hours</TableHead><TableHead>Activities</TableHead><TableHead>Status</TableHead><TableHead /></TableRow></TableHeader>
            <TableBody>
              {data?.map((e) => (
                <TableRow key={e.id}>
                  <TableCell>{e.entry_date}</TableCell>
                  <TableCell>{e.trainees?.last_name}, {e.trainees?.first_name}<div className="text-xs text-muted-foreground">{e.trainees?.trainee_id}</div></TableCell>
                  <TableCell>{e.hours}</TableCell>
                  <TableCell className="max-w-sm"><div className="line-clamp-2">{e.activities}</div></TableCell>
                  <TableCell><Badge variant="secondary">{e.status.replace("_", " ")}</Badge></TableCell>
                  <TableCell className="text-right"><Button size="sm" variant="outline" onClick={() => setSelected(e)}>Review</Button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {!data?.length && <p className="text-sm text-muted-foreground text-center py-6">Nothing waiting for review.</p>}
        </CardContent>
      </Card>
      {selected && <ReviewDialog key={selected.id} entry={selected} onClose={() => setSelected(null)} />}
    </DashboardLayout>
  );
}
