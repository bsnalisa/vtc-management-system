import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DashboardLayout } from "@/components/DashboardLayout";
import { traineeNavItems } from "@/lib/navigationConfig";
import { withRoleAccess } from "@/components/withRoleAccess";
import { ExportMenu } from "@/components/ExportMenu";
import { SupervisorLinkDialog } from "@/components/placement/SupervisorLinkDialog";
import { LogbookEntry, useDeleteLogbookDraft, useLogbookEntries, useMyLogbookPlacements, useSaveLogbookEntry } from "@/hooks/useLogbook";

const today = () => new Date().toISOString().slice(0, 10);

function EntryForm({ placementId, traineeId, start, end, editing, onDone }: { placementId: string; traineeId: string; start: string; end: string | null; editing: LogbookEntry | null; onDone: () => void }) {
  const [f, setF] = useState({
    entry_date: editing?.entry_date ?? today(), hours: String(editing?.hours ?? 8), activities: editing?.activities ?? "",
    skills_learned: editing?.skills_learned ?? "", challenges: editing?.challenges ?? "",
  });
  const save = useSaveLogbookEntry();
  const max = end && end < today() ? end : today();

  const submit = async (status: "draft" | "submitted") => {
    await save.mutateAsync({
      id: editing?.id, placement_id: placementId, trainee_id: traineeId, entry_date: f.entry_date, hours: Number(f.hours),
      activities: f.activities, skills_learned: f.skills_learned || null, challenges: f.challenges || null, status,
    });
    onDone();
  };
  const valid = f.activities.trim() && Number(f.hours) > 0 && Number(f.hours) <= 24;

  return (
    <div className="space-y-3 border rounded-md p-4">
      <h4 className="font-medium">{editing ? "Edit entry" : "New entry"}</h4>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1"><Label>Date</Label><Input type="date" min={start} max={max} disabled={!!editing} value={f.entry_date} onChange={(e) => setF({ ...f, entry_date: e.target.value })} /></div>
        <div className="space-y-1"><Label>Hours worked</Label><Input type="number" min={0.5} max={24} step={0.5} value={f.hours} onChange={(e) => setF({ ...f, hours: e.target.value })} /></div>
      </div>
      <div className="space-y-1"><Label>Activities / tasks performed</Label><Textarea rows={3} value={f.activities} onChange={(e) => setF({ ...f, activities: e.target.value })} /></div>
      <div className="space-y-1"><Label>Skills learned</Label><Textarea rows={2} value={f.skills_learned} onChange={(e) => setF({ ...f, skills_learned: e.target.value })} /></div>
      <div className="space-y-1"><Label>Challenges</Label><Textarea rows={2} value={f.challenges} onChange={(e) => setF({ ...f, challenges: e.target.value })} /></div>
      <div className="flex gap-2">
        <Button variant="outline" disabled={!valid || save.isPending} onClick={() => submit("draft")}>Save draft</Button>
        <Button disabled={!valid || save.isPending} onClick={() => submit("submitted")}>Submit for sign-off</Button>
        {editing && <Button variant="ghost" onClick={onDone}>Cancel</Button>}
      </div>
    </div>
  );
}

const TraineeLogbookPage = () => {
  const { data: placements } = useMyLogbookPlacements();
  const [selected, setSelected] = useState("");
  const placement = placements?.find((p) => p.id === (selected || placements[0]?.id));
  const { data: entries } = useLogbookEntries(placement?.id);
  const del = useDeleteLogbookDraft();
  const [editing, setEditing] = useState<LogbookEntry | null>(null);
  const [adding, setAdding] = useState(false);
  const totalHours = entries?.filter((e) => e.status === "approved").reduce((s, e) => s + Number(e.hours), 0) ?? 0;
  const editable = (e: LogbookEntry) => e.status === "draft" || e.status === "returned";

  return (
    <DashboardLayout title="Industrial Attachment Logbook" subtitle="Record what you do each day" navItems={traineeNavItems} groupLabel="Trainee iEnabler">
      {!placements?.length ? (
        <Card><CardContent className="p-8 text-center text-muted-foreground">You have no approved industrial attachment yet. Your logbook opens once your placement is approved.</CardContent></Card>
      ) : (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{placement?.employer_name ?? "Placement"} · {placement?.placement_number}</CardTitle>
              <CardDescription>{placement?.start_date} to {placement?.end_date ?? "open"} · Supervisor: {placement?.supervisor_name ?? "not recorded"} · Approved hours: {totalHours}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {placements.length > 1 && (
                <Select value={placement?.id} onValueChange={setSelected}>
                  <SelectTrigger className="max-w-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>{placements.map((p) => <SelectItem key={p.id} value={p.id}>{p.placement_number} · {p.employer_name}</SelectItem>)}</SelectContent>
                </Select>
              )}
              <div className="flex gap-2">
                {!adding && !editing && <Button onClick={() => setAdding(true)}>Add entry</Button>}
                {placement && <SupervisorLinkDialog key={placement.id} placementId={placement.id} defaultName={placement.supervisor_name} />}
                <ExportMenu label="Export logbook" title={`Logbook ${placement?.placement_number ?? ""}`} filename={`logbook-${placement?.placement_number ?? "placement"}`} disabled={!entries?.length}
                  data={() => (entries ?? []).map((e) => ({ date: e.entry_date, hours: e.hours, activities: e.activities, skills_learned: e.skills_learned, challenges: e.challenges, status: e.status, supervisor: e.supervisor_signed_by, supervisor_signed_on: e.supervisor_signed_on, comment: e.reviewer_comment }))} />
              </div>
              {(adding || editing) && placement && (
                <EntryForm key={editing?.id ?? "new"} placementId={placement.id} traineeId={placement.trainee_id} start={placement.start_date} end={placement.end_date} editing={editing} onDone={() => { setAdding(false); setEditing(null); }} />
              )}
              <div className="space-y-2">
                {entries?.map((e) => (
                  <div key={e.id} className="border rounded-md p-3 text-sm space-y-1">
                    <div className="flex justify-between items-center">
                      <span className="font-medium">{e.entry_date} · {e.hours} h</span>
                      <Badge variant={e.status === "approved" ? "default" : e.status === "returned" ? "destructive" : "secondary"}>{e.status.replace("_", " ")}</Badge>
                    </div>
                    <p className="whitespace-pre-wrap">{e.activities}</p>
                    {e.reviewer_comment && <p className="text-destructive">Reviewer: {e.reviewer_comment}</p>}
                    {e.supervisor_signed_by && <p className="text-muted-foreground">Signed by {e.supervisor_signed_by} on {e.supervisor_signed_on}</p>}
                    {editable(e) && (
                      <div className="space-x-2">
                        <Button size="sm" variant="outline" onClick={() => { setAdding(false); setEditing(e); }}>Edit</Button>
                        {e.status === "draft" && <Button size="sm" variant="ghost" onClick={() => del.mutate(e.id)}>Delete</Button>}
                      </div>
                    )}
                  </div>
                ))}
                {!entries?.length && <p className="text-sm text-muted-foreground text-center py-4">No entries yet.</p>}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </DashboardLayout>
  );
};

export default withRoleAccess(TraineeLogbookPage, { requiredRoles: ["trainee"] });
