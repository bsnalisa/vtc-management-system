import { useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useRoleNavigation } from "@/hooks/useRoleNavigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus } from "lucide-react";
import { ExportMenu } from "@/components/ExportMenu";
import { useQualificationOptions } from "@/hooks/useAssessmentRequests";
import {
  RosterEntry, Sitting, useAddRosterEntry, useCandidates, useCreateSitting, useNotifyInduction, useNotifyPrinting,
  usePapers, useQualifiedTrainees, useRegisterCandidates, useRemoveRosterEntry, useRoster, useSetCandidateStatus,
  useSittings, useUpdateSitting,
} from "@/hooks/useAssessmentDevelopment";

const STAFF_ROLES = ["admin", "organization_admin", "assessment_coordinator", "rpl_coordinator", "head_of_training", "registration_officer", "super_admin"];

function NewSittingDialog() {
  const [open, setOpen] = useState(false);
  const empty = { qualification_id: "", title: "", sitting_date: "", venue: "" };
  const [f, setF] = useState(empty);
  const { data: quals } = useQualificationOptions();
  const create = useCreateSitting();
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    await create.mutateAsync({ ...f, venue: f.venue || null });
    setF(empty);
    setOpen(false);
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />New sitting</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Assessment sitting</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-1"><Label>Title</Label><Input required value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></div>
          <div className="space-y-1"><Label>Qualification</Label>
            <Select value={f.qualification_id} onValueChange={(v) => setF({ ...f, qualification_id: v })}>
              <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>{quals?.map((q) => <SelectItem key={q.id} value={q.id}>{q.qualification_title}</SelectItem>)}</SelectContent>
            </Select></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><Label>Date</Label><Input type="date" required value={f.sitting_date} onChange={(e) => setF({ ...f, sitting_date: e.target.value })} /></div>
            <div className="space-y-1"><Label>Venue</Label><Input value={f.venue} onChange={(e) => setF({ ...f, venue: e.target.value })} /></div>
          </div>
          <Button type="submit" className="w-full" disabled={create.isPending || !f.qualification_id}>Create</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function CandidatesTab({ sitting, isStaff }: { sitting: Sitting; isStaff: boolean }) {
  const { data: candidates } = useCandidates(sitting.id);
  const { data: trainees } = useQualifiedTrainees(isStaff ? sitting.qualification_id : undefined);
  const register = useRegisterCandidates();
  const setStatus = useSetCandidateStatus();
  const notifyPrint = useNotifyPrinting();
  const [picked, setPicked] = useState<string[]>([]);
  const registered = new Set(candidates?.map((c) => c.trainee_id));
  const available = trainees?.filter((t) => !registered.has(t.id)) ?? [];
  const approved = candidates?.filter((c) => c.status === "approved") ?? [];

  return (
    <div className="space-y-4">
      {isStaff && (
        <div className="border rounded-md p-3 space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="font-medium text-sm">Register trainees on this qualification ({available.length} not yet registered)</h4>
            <div className="space-x-2">
              <Button size="sm" variant="outline" onClick={() => setPicked(picked.length === available.length ? [] : available.map((t) => t.id))}>{picked.length === available.length && available.length ? "Clear" : "Select all"}</Button>
              <Button size="sm" disabled={!picked.length || register.isPending} onClick={async () => { await register.mutateAsync({ sittingId: sitting.id, traineeIds: picked }); setPicked([]); }}>Register {picked.length || ""}</Button>
            </div>
          </div>
          <div className="max-h-40 overflow-y-auto grid sm:grid-cols-2 gap-1">
            {available.map((t) => (
              <label key={t.id} className="flex items-center gap-2 text-sm">
                <Checkbox checked={picked.includes(t.id)} onCheckedChange={(on) => setPicked(on ? [...picked, t.id] : picked.filter((x) => x !== t.id))} />
                {t.last_name}, {t.first_name} ({t.trainee_id})
              </label>
            ))}
            {!available.length && <span className="text-sm text-muted-foreground">No more active trainees on this qualification.</span>}
          </div>
        </div>
      )}
      <div className="flex justify-between gap-2">
        <ExportMenu label="Export approved list" title={`${sitting.title} approved candidates`} filename={`candidates-${sitting.title.replace(/\W+/g, "-").toLowerCase()}`} disabled={!approved.length}
          data={() => approved.map((c) => ({ trainee_number: c.trainees?.trainee_id, surname: c.trainees?.last_name, first_name: c.trainees?.first_name, qualification: sitting.qualifications?.qualification_title, date: sitting.sitting_date }))} />
        {isStaff && (
          <div className="space-x-2">
            <Button size="sm" variant="outline" disabled={!candidates?.some((c) => c.status === "registered")} onClick={() => setStatus.mutate({ sittingId: sitting.id, traineeIds: candidates!.filter((c) => c.status === "registered").map((c) => c.trainee_id), status: "approved" })}>Approve all registered</Button>
            <Button size="sm" disabled={!approved.length || notifyPrint.isPending} onClick={() => notifyPrint.mutate(sitting.id)}>{sitting.printing_notified_at ? "Notify printing officer again" : "Notify printing officer"}</Button>
          </div>
        )}
      </div>
      <Table>
        <TableHeader><TableRow><TableHead>Trainee no.</TableHead><TableHead>Name</TableHead><TableHead>Status</TableHead>{isStaff && <TableHead />}</TableRow></TableHeader>
        <TableBody>
          {candidates?.map((c) => (
            <TableRow key={c.trainee_id}>
              <TableCell className="font-mono">{c.trainees?.trainee_id}</TableCell>
              <TableCell>{c.trainees?.last_name}, {c.trainees?.first_name}</TableCell>
              <TableCell><Badge variant={c.status === "approved" ? "default" : "secondary"}>{c.status}</Badge></TableCell>
              {isStaff && (
                <TableCell className="space-x-2 text-right">
                  {c.status !== "approved" && <Button size="sm" variant="outline" onClick={() => setStatus.mutate({ sittingId: sitting.id, traineeIds: [c.trainee_id], status: "approved" })}>Approve</Button>}
                  {c.status !== "withdrawn" && <Button size="sm" variant="ghost" onClick={() => setStatus.mutate({ sittingId: sitting.id, traineeIds: [c.trainee_id], status: "withdrawn" })}>Withdraw</Button>}
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {!candidates?.length && <p className="text-sm text-muted-foreground text-center py-4">No candidates registered.</p>}
    </div>
  );
}

function RosterTab({ sitting }: { sitting: Sitting }) {
  const { data } = useRoster(sitting.id);
  const add = useAddRosterEntry();
  const remove = useRemoveRosterEntry();
  const empty = { duty: "invigilator" as RosterEntry["duty"], staff_name: "", room: "", session_start: "", session_end: "" };
  const [f, setF] = useState(empty);
  const bad = !!f.session_start && !!f.session_end && new Date(f.session_end) <= new Date(f.session_start);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    await add.mutateAsync({
      sitting_id: sitting.id, duty: f.duty, staff_name: f.staff_name, room: f.room || null,
      session_start: f.session_start ? new Date(f.session_start).toISOString() : null,
      session_end: f.session_end ? new Date(f.session_end).toISOString() : null,
    });
    setF(empty);
  };

  return (
    <div className="space-y-4">
      <form onSubmit={submit} className="grid gap-3 md:grid-cols-5 items-end">
        <div className="space-y-1"><Label>Duty</Label>
          <Select value={f.duty} onValueChange={(v) => setF({ ...f, duty: v as RosterEntry["duty"] })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{["chief_invigilator", "invigilator", "assessor", "supervisor"].map((d) => <SelectItem key={d} value={d}>{d.replace("_", " ")}</SelectItem>)}</SelectContent>
          </Select></div>
        <div className="space-y-1"><Label>Staff member</Label><Input required value={f.staff_name} onChange={(e) => setF({ ...f, staff_name: e.target.value })} /></div>
        <div className="space-y-1"><Label>Room</Label><Input value={f.room} onChange={(e) => setF({ ...f, room: e.target.value })} /></div>
        <div className="space-y-1"><Label>From</Label><Input type="datetime-local" value={f.session_start} onChange={(e) => setF({ ...f, session_start: e.target.value })} /></div>
        <div className="space-y-1"><Label>To</Label><Input type="datetime-local" value={f.session_end} onChange={(e) => setF({ ...f, session_end: e.target.value })} /></div>
        {bad && <p className="text-xs text-destructive md:col-span-5">The end time must be after the start time.</p>}
        <div className="md:col-span-5"><Button type="submit" disabled={add.isPending || bad}>Add to roster</Button></div>
      </form>
      <Table>
        <TableHeader><TableRow><TableHead>Duty</TableHead><TableHead>Staff</TableHead><TableHead>Room</TableHead><TableHead>Session</TableHead><TableHead /></TableRow></TableHeader>
        <TableBody>
          {data?.map((r) => (
            <TableRow key={r.id}>
              <TableCell>{r.duty.replace("_", " ")}</TableCell><TableCell>{r.staff_name}</TableCell><TableCell>{r.room ?? "-"}</TableCell>
              <TableCell>{r.session_start ? new Date(r.session_start).toLocaleString() : "-"}{r.session_end ? ` – ${new Date(r.session_end).toLocaleTimeString()}` : ""}</TableCell>
              <TableCell className="text-right"><Button size="sm" variant="ghost" onClick={() => remove.mutate(r.id)}>Remove</Button></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {!data?.length && <p className="text-sm text-muted-foreground text-center py-4">Roster is empty.</p>}
    </div>
  );
}

function InductionTab({ sitting }: { sitting: Sitting }) {
  const update = useUpdateSitting();
  const notify = useNotifyInduction();
  const local = (iso: string | null) => (iso ? new Date(new Date(iso).getTime() - new Date(iso).getTimezoneOffset() * 60000).toISOString().slice(0, 16) : "");
  const [when, setWhen] = useState(local(sitting.induction_date));
  const [venue, setVenue] = useState(sitting.induction_venue ?? "");
  const [agenda, setAgenda] = useState(sitting.induction_agenda ?? "");
  const dirty = when !== local(sitting.induction_date) || venue !== (sitting.induction_venue ?? "") || agenda !== (sitting.induction_agenda ?? "");

  return (
    <div className="space-y-3 max-w-xl">
      <div className="space-y-1"><Label>Induction date &amp; time</Label><Input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} /></div>
      <div className="space-y-1"><Label>Venue</Label><Input value={venue} onChange={(e) => setVenue(e.target.value)} /></div>
      <div className="space-y-1"><Label>Agenda / what to bring</Label><Textarea rows={4} value={agenda} onChange={(e) => setAgenda(e.target.value)} /></div>
      <div className="flex gap-2">
        <Button disabled={!dirty || update.isPending} onClick={() => update.mutate({ id: sitting.id, induction_date: when ? new Date(when).toISOString() : null, induction_venue: venue || null, induction_agenda: agenda || null })}>Save plan</Button>
        <Button variant="outline" disabled={!sitting.induction_date || dirty || notify.isPending} title={dirty ? "Save the plan first" : ""} onClick={() => notify.mutate(sitting.id)}>{sitting.induction_notified_at ? "Notify candidates again" : "Notify candidates"}</Button>
      </div>
      {sitting.induction_notified_at && <p className="text-xs text-muted-foreground">Last notified {new Date(sitting.induction_notified_at).toLocaleString()}</p>}
    </div>
  );
}

export default function AssessmentSittings() {
  const { role, navItems, groupLabel } = useRoleNavigation();
  const isStaff = !!role && STAFF_ROLES.includes(role);
  const { data: sittings } = useSittings();
  const { data: papers } = usePapers();
  const update = useUpdateSitting();
  const [selectedId, setSelectedId] = useState("");
  const sitting = sittings?.find((s) => s.id === selectedId);

  return (
    <DashboardLayout title="Assessment Sittings" subtitle="Candidates, roster, induction and printing" navItems={navItems} groupLabel={groupLabel}>
      <Card>
        <CardHeader>
          <CardTitle>Assessment sittings</CardTitle>
          <CardDescription>{isStaff ? "Register qualified trainees, plan the roster and induction, and notify the Printing & Distribution Officer." : "Approved candidate lists for materials preparation."}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-3 justify-between">
            <Select value={selectedId} onValueChange={setSelectedId}>
              <SelectTrigger className="max-w-md"><SelectValue placeholder="Select a sitting" /></SelectTrigger>
              <SelectContent>{sittings?.map((s) => <SelectItem key={s.id} value={s.id}>{s.title} · {s.sitting_date}</SelectItem>)}</SelectContent>
            </Select>
            {isStaff && <NewSittingDialog />}
          </div>
          {sitting && (
            <>
              <div className="text-sm text-muted-foreground">{sitting.qualifications?.qualification_title} · {sitting.sitting_date}{sitting.venue ? ` · ${sitting.venue}` : ""}</div>
              {isStaff && (
                <div className="flex items-center gap-2 text-sm">
                  <Label>Question paper</Label>
                  <Select value={sitting.paper_id ?? "none"} onValueChange={(v) => update.mutate({ id: sitting.id, paper_id: v === "none" ? null : v })}>
                    <SelectTrigger className="w-72"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No paper linked</SelectItem>
                      {papers?.filter((p) => p.status === "approved" && p.qualification_id === sitting.qualification_id).map((p) => <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <Tabs defaultValue="candidates">
                <TabsList>
                  <TabsTrigger value="candidates">Candidates</TabsTrigger>
                  {isStaff && <TabsTrigger value="roster">Theory Roster</TabsTrigger>}
                  {isStaff && <TabsTrigger value="induction">Induction Plan</TabsTrigger>}
                </TabsList>
                <TabsContent value="candidates"><CandidatesTab sitting={sitting} isStaff={isStaff} /></TabsContent>
                {isStaff && <TabsContent value="roster"><RosterTab sitting={sitting} /></TabsContent>}
                {isStaff && <TabsContent value="induction"><InductionTab key={sitting.id} sitting={sitting} /></TabsContent>}
              </Tabs>
            </>
          )}
          {!sitting && <p className="text-sm text-muted-foreground text-center py-6">{sittings?.length ? "Select a sitting." : "No sittings yet."}</p>}
        </CardContent>
      </Card>
    </DashboardLayout>
  );
}
