import { ReactNode, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CalendarDays, CheckSquare, ClipboardCheck, Inbox, Mail, Plus } from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { useRoleNavigation } from "@/hooks/useRoleNavigation";
import { useProfile } from "@/hooks/useProfile";
import { useUserRole } from "@/hooks/useUserRole";
import {
  Correspondence, Meeting, OfficeTask, useAddMeeting, useAddOfficeTask, useCorrespondence, useDelegationLog, useLogCorrespondence, useMeetings, useOfficeTasks,
  useSetCorrespondenceStatus, useSetOfficeTaskStatus, useUpdateMeeting,
} from "@/hooks/useCentreOffice";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { ButtonSpinner } from "@/components/ui/loading-spinner";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { withRoleAccess } from "@/components/withRoleAccess";

const today = () => new Date().toISOString().slice(0, 10);
const fmt = (d: string | null | undefined) => (d ? new Date(d.length === 10 ? d + "T00:00:00" : d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—");
const overdue = (d: string | null) => !!d && d < today();
const STATUS: Record<string, string> = { received: "Received", in_progress: "In progress", replied: "Replied", filed: "Filed", closed: "Closed", scheduled: "Scheduled", held: "Held", cancelled: "Cancelled", open: "Open", done: "Done" };
const Loading = () => <div className="space-y-2" aria-busy="true">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-10" />)}</div>;

function Modal({ title, description, onClose, onSubmit, pending, disabled, children }: { title: string; description?: string; onClose: () => void; onSubmit: () => Promise<unknown>; pending: boolean; disabled?: boolean; children: ReactNode }) {
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <form onSubmit={async (e) => { e.preventDefault(); await onSubmit(); onClose(); }} className="space-y-4">
          <DialogHeader><DialogTitle>{title}</DialogTitle>{description && <DialogDescription>{description}</DialogDescription>}</DialogHeader>
          {children}
          <DialogFooter className="gap-2 sm:gap-0"><Button type="button" variant="outline" onClick={onClose}>Cancel</Button><Button type="submit" disabled={pending || disabled}>{pending && <ButtonSpinner />}Save</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
const Field = ({ label, children }: { label: string; children: ReactNode }) => <div className="space-y-1.5"><Label>{label}</Label>{children}</div>;

function CorrespondenceDialog({ onClose }: { onClose: () => void }) {
  const save = useLogCorrespondence();
  const [f, setF] = useState({ direction: "incoming", subject: "", party: "", channel: "letter", date: today(), due: "" });
  return (
    <Modal title="Log correspondence" onClose={onClose} pending={save.isPending} disabled={!f.subject.trim() || !f.party.trim()} onSubmit={() => save.mutateAsync(f)}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Direction"><Select value={f.direction} onValueChange={(v) => setF({ ...f, direction: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="incoming">Incoming</SelectItem><SelectItem value="outgoing">Outgoing</SelectItem></SelectContent></Select></Field>
        <Field label="Channel"><Select value={f.channel} onValueChange={(v) => setF({ ...f, channel: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{["letter", "email", "phone", "visit", "other"].map((c) => <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>)}</SelectContent></Select></Field>
      </div>
      <Field label="Subject"><Input value={f.subject} onChange={(e) => setF({ ...f, subject: e.target.value })} required /></Field>
      <Field label={f.direction === "incoming" ? "From" : "To"}><Input value={f.party} onChange={(e) => setF({ ...f, party: e.target.value })} required /></Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Date"><Input type="date" max={today()} value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></Field>
        <Field label="Reply due by"><Input type="date" min={f.date} value={f.due} onChange={(e) => setF({ ...f, due: e.target.value })} /></Field>
      </div>
    </Modal>
  );
}

function MeetingDialog({ onClose }: { onClose: () => void }) {
  const save = useAddMeeting();
  const [f, setF] = useState({ title: "", date: today(), start: "", end: "", location: "", attendees: "", agenda: "" });
  return (
    <Modal title="Schedule a meeting" onClose={onClose} pending={save.isPending} disabled={!f.title.trim() || (!!f.start && !!f.end && f.end <= f.start)} onSubmit={() => save.mutateAsync(f)}>
      <Field label="Title"><Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} required /></Field>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Date"><Input type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} required /></Field>
        <Field label="Starts"><Input type="time" value={f.start} onChange={(e) => setF({ ...f, start: e.target.value })} /></Field>
        <Field label="Ends"><Input type="time" value={f.end} onChange={(e) => setF({ ...f, end: e.target.value })} /></Field>
      </div>
      <Field label="Location"><Input value={f.location} onChange={(e) => setF({ ...f, location: e.target.value })} /></Field>
      <Field label="Attendees"><Input value={f.attendees} onChange={(e) => setF({ ...f, attendees: e.target.value })} /></Field>
      <Field label="Agenda"><Textarea rows={3} value={f.agenda} onChange={(e) => setF({ ...f, agenda: e.target.value })} /></Field>
    </Modal>
  );
}

function TaskDialog({ onClose }: { onClose: () => void }) {
  const save = useAddOfficeTask();
  const [f, setF] = useState({ title: "", due: "", detail: "", source: "centre_manager" });
  return (
    <Modal title="Add a task" onClose={onClose} pending={save.isPending} disabled={!f.title.trim()} onSubmit={() => save.mutateAsync(f)}>
      <Field label="Task"><Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} required /></Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Due"><Input type="date" value={f.due} onChange={(e) => setF({ ...f, due: e.target.value })} /></Field>
        <Field label="Requested by"><Select value={f.source} onValueChange={(v) => setF({ ...f, source: v })}><SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="centre_manager">Centre Manager</SelectItem><SelectItem value="self">Myself</SelectItem><SelectItem value="meeting">A meeting</SelectItem><SelectItem value="correspondence">Correspondence</SelectItem></SelectContent></Select></Field>
      </div>
      <Field label="Details"><Textarea rows={3} value={f.detail} onChange={(e) => setF({ ...f, detail: e.target.value })} /></Field>
    </Modal>
  );
}

function MinutesDialog({ meeting, onClose }: { meeting: Meeting; onClose: () => void }) {
  const save = useUpdateMeeting();
  const [minutes, setMinutes] = useState(meeting.minutes ?? "");
  return (
    <Modal title="Record minutes" description={meeting.title} onClose={onClose} pending={save.isPending} disabled={!minutes.trim()} onSubmit={() => save.mutateAsync({ id: meeting.id, status: "held", minutes })}>
      <Field label="Minutes and decisions"><Textarea rows={8} value={minutes} onChange={(e) => setMinutes(e.target.value)} /></Field>
      <p className="text-xs text-muted-foreground">Saving marks the meeting as held.</p>
    </Modal>
  );
}

function PADashboard() {
  const navigate = useNavigate();
  const { navItems, groupLabel } = useRoleNavigation();
  const { data: profile } = useProfile();
  const { role } = useUserRole();
  const canEdit = role === "pa_to_centre_manager";
  const { data: letters, isLoading: loadingLetters } = useCorrespondence();
  const { data: meetings, isLoading: loadingMeetings } = useMeetings();
  const { data: tasks, isLoading: loadingTasks } = useOfficeTasks();
  const { data: log, isLoading: loadingLog, error: logError } = useDelegationLog();
  const setLetter = useSetCorrespondenceStatus();
  const setMeeting = useUpdateMeeting();
  const setTask = useSetOfficeTaskStatus();
  const [dlg, setDlg] = useState<null | "letter" | "meeting" | "task">(null);
  const [minutes, setMinutes] = useState<Meeting | null>(null);

  const openLetters = (letters ?? []).filter((l) => l.status === "received" || l.status === "in_progress");
  const upcoming = (meetings ?? []).filter((m) => m.status === "scheduled" && m.meeting_date >= today());
  const week = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
  const openTasks = (tasks ?? []).filter((t) => t.status === "open");
  const activeDelegations = (log?.delegations ?? []).filter((d) => d.active);

  return (
    <DashboardLayout title={`Welcome back, ${profile?.firstname || "User"}`} subtitle="Centre Manager's office" navItems={navItems} groupLabel={groupLabel}>
      <DashboardShell
        name={profile?.firstname || undefined}
        heroIcon={Inbox}
        heroSubtitle="Correspondence, meetings and tasks for the Centre Manager's office."
        stats={[
          { label: "Open correspondence", value: openLetters.length, icon: Mail, loading: loadingLetters, hint: `${openLetters.filter((l) => overdue(l.due_on)).length} overdue` },
          { label: "Meetings this week", value: upcoming.filter((m) => m.meeting_date <= week).length, icon: CalendarDays, loading: loadingMeetings },
          { label: "Open tasks", value: openTasks.length, icon: CheckSquare, loading: loadingTasks, tone: openTasks.some((t) => overdue(t.due_on)) ? "destructive" : "primary", hint: `${openTasks.filter((t) => overdue(t.due_on)).length} overdue` },
          { label: "Active delegations", value: activeDelegations.length, icon: ClipboardCheck, loading: loadingLog, tone: "secondary", hint: "Approvals delegated to you" },
        ]}
      >
        <Alert>
          <AlertDescription>
            You have no approval authority of your own. You can only decide requests the Centre Manager has delegated to you, and you cannot see finance, personnel or trainee records.
          </AlertDescription>
        </Alert>

        <Card>
          <CardHeader className="flex-row flex-wrap items-start justify-between gap-2 space-y-0">
            <div><CardTitle className="text-base">Centre office</CardTitle><CardDescription>{canEdit ? "Keep the registers up to date." : "Read-only view of the office registers."}</CardDescription></div>
            {canEdit && <div className="flex gap-2"><Button size="sm" onClick={() => setDlg("letter")}><Plus className="mr-1 h-4 w-4" />Correspondence</Button><Button size="sm" variant="outline" onClick={() => setDlg("meeting")}><Plus className="mr-1 h-4 w-4" />Meeting</Button><Button size="sm" variant="outline" onClick={() => setDlg("task")}><Plus className="mr-1 h-4 w-4" />Task</Button></div>}
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="correspondence">
              <TabsList className="flex h-auto flex-wrap justify-start"><TabsTrigger value="correspondence">Correspondence</TabsTrigger><TabsTrigger value="meetings">Meetings</TabsTrigger><TabsTrigger value="tasks">Tasks</TabsTrigger><TabsTrigger value="delegations">Delegations</TabsTrigger></TabsList>

              <TabsContent value="correspondence">
                {loadingLetters ? <Loading /> : !letters?.length ? <EmptyState title="No correspondence logged" description="Log letters, emails and calls for the Centre Manager as they arrive." /> : (
                  <Table>
                    <TableHeader><TableRow><TableHead>Reference</TableHead><TableHead>Subject</TableHead><TableHead>From / to</TableHead><TableHead>Date</TableHead><TableHead>Reply due</TableHead><TableHead>Status</TableHead><TableHead><span className="sr-only">Actions</span></TableHead></TableRow></TableHeader>
                    <TableBody>
                      {letters.map((l: Correspondence) => (
                        <TableRow key={l.id}>
                          <TableCell className="font-medium">{l.reference}<span className="block text-xs capitalize text-muted-foreground">{l.direction} · {l.channel}</span></TableCell>
                          <TableCell className="min-w-48 whitespace-normal">{l.subject}{l.handling_note && <span className="block text-xs text-muted-foreground">{l.handling_note}</span>}</TableCell>
                          <TableCell>{l.party}</TableCell><TableCell>{fmt(l.item_date)}</TableCell>
                          <TableCell className={overdue(l.due_on) && (l.status === "received" || l.status === "in_progress") ? "font-medium text-destructive" : ""}>{fmt(l.due_on)}</TableCell>
                          <TableCell><Badge variant={l.status === "closed" || l.status === "filed" ? "secondary" : "outline"}>{STATUS[l.status]}</Badge></TableCell>
                          <TableCell>{canEdit && (
                            <Select value={l.status} onValueChange={(v) => setLetter.mutate({ id: l.id, status: v })}>
                              <SelectTrigger className="w-32" aria-label={`Status of ${l.reference}`}><SelectValue /></SelectTrigger>
                              <SelectContent>{["received", "in_progress", "replied", "filed", "closed"].map((s) => <SelectItem key={s} value={s}>{STATUS[s]}</SelectItem>)}</SelectContent>
                            </Select>)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </TabsContent>

              <TabsContent value="meetings">
                {loadingMeetings ? <Loading /> : !meetings?.length ? <EmptyState title="No meetings scheduled" /> : (
                  <Table>
                    <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Meeting</TableHead><TableHead>Where / who</TableHead><TableHead>Status</TableHead><TableHead><span className="sr-only">Actions</span></TableHead></TableRow></TableHeader>
                    <TableBody>
                      {meetings.map((m) => (
                        <TableRow key={m.id}>
                          <TableCell className="whitespace-nowrap">{fmt(m.meeting_date)}<span className="block text-xs text-muted-foreground">{m.start_time?.slice(0, 5)}{m.end_time ? `–${m.end_time.slice(0, 5)}` : ""}</span></TableCell>
                          <TableCell className="min-w-48 whitespace-normal font-medium">{m.title}{m.agenda && <span className="block text-xs font-normal text-muted-foreground">{m.agenda}</span>}{m.minutes && <span className="mt-1 block text-xs font-normal">Minutes: {m.minutes}</span>}</TableCell>
                          <TableCell className="min-w-40 whitespace-normal">{m.location ?? "—"}<span className="block text-xs text-muted-foreground">{m.attendees}</span></TableCell>
                          <TableCell><Badge variant={m.status === "cancelled" ? "destructive" : m.status === "held" ? "secondary" : "outline"}>{STATUS[m.status]}</Badge></TableCell>
                          <TableCell className="space-x-1 whitespace-nowrap">{canEdit && m.status === "scheduled" && <><Button size="sm" variant="outline" onClick={() => setMinutes(m)}>Record minutes</Button><Button size="sm" variant="ghost" onClick={() => setMeeting.mutate({ id: m.id, status: "cancelled" })}>Cancel</Button></>}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </TabsContent>

              <TabsContent value="tasks">
                {loadingTasks ? <Loading /> : !tasks?.length ? <EmptyState title="No tasks" description="Add tasks the Centre Manager asks for, or that follow from meetings and letters." /> : (
                  <ul className="divide-y">
                    {tasks.map((t: OfficeTask) => (
                      <li key={t.id} className="flex flex-wrap items-start justify-between gap-3 py-3">
                        <div><p className={`font-medium ${t.status !== "open" ? "text-muted-foreground line-through" : ""}`}>{t.title}</p>
                          {t.detail && <p className="text-sm text-muted-foreground">{t.detail}</p>}
                          <p className={`text-xs ${t.status === "open" && overdue(t.due_on) ? "text-destructive" : "text-muted-foreground"}`}>{t.due_on ? `Due ${fmt(t.due_on)}` : "No due date"} · {STATUS[t.status]}{t.completed_at ? ` ${fmt(t.completed_at)}` : ""}</p></div>
                        {canEdit && t.status === "open" && <div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => setTask.mutate({ id: t.id, status: "done" })}>Mark done</Button><Button size="sm" variant="ghost" onClick={() => setTask.mutate({ id: t.id, status: "cancelled" })}>Cancel</Button></div>}
                      </li>
                    ))}
                  </ul>
                )}
              </TabsContent>

              <TabsContent value="delegations" className="space-y-4">
                {logError ? <Alert variant="destructive"><AlertDescription>{(logError as Error).message}</AlertDescription></Alert> : loadingLog ? <Loading /> : (<>
                  <p className="text-sm text-muted-foreground">Delegations are granted by the Centre Manager from My Approvals. Anything you decide under one is recorded here.</p>
                  {canEdit && <Button size="sm" variant="outline" onClick={() => navigate("/my-approvals")}>Open My Approvals</Button>}
                  {!log?.delegations.length ? <EmptyState title="No delegations" description="You cannot approve anything until the Centre Manager delegates it." /> : (
                    <Table>
                      <TableHeader><TableRow><TableHead>Delegated by</TableHead><TableHead>Covers</TableHead><TableHead>From</TableHead><TableHead>Until</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                      <TableBody>{log.delegations.map((d) => <TableRow key={d.id}><TableCell>{d.from ?? "—"}</TableCell><TableCell>{d.process_type ? d.process_type.replace(/_/g, " ") : "Every request"}</TableCell><TableCell>{fmt(d.starts_at)}</TableCell><TableCell>{fmt(d.ends_at)}</TableCell><TableCell><Badge variant={d.active ? "default" : "secondary"}>{d.active ? "Active" : "Not active"}</Badge></TableCell></TableRow>)}</TableBody>
                    </Table>
                  )}
                  <h3 className="pt-2 font-medium">Decisions taken under delegation (90 days)</h3>
                  {!log?.decisions.length ? <p className="text-sm text-muted-foreground">No decisions recorded.</p> : (
                    <Table>
                      <TableHeader><TableRow><TableHead>When</TableHead><TableHead>Request</TableHead><TableHead>Step</TableHead><TableHead>Outcome</TableHead><TableHead>By</TableHead></TableRow></TableHeader>
                      <TableBody>{log.decisions.map((d, i) => <TableRow key={i}><TableCell>{fmt(d.acted_at)}</TableCell><TableCell>{d.reference} · {d.title}</TableCell><TableCell>{d.step}</TableCell><TableCell className="capitalize">{d.outcome.replace(/_/g, " ")}</TableCell><TableCell>{d.by}</TableCell></TableRow>)}</TableBody>
                    </Table>
                  )}
                </>)}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </DashboardShell>
      {dlg === "letter" && <CorrespondenceDialog onClose={() => setDlg(null)} />}
      {dlg === "meeting" && <MeetingDialog onClose={() => setDlg(null)} />}
      {dlg === "task" && <TaskDialog onClose={() => setDlg(null)} />}
      {minutes && <MinutesDialog meeting={minutes} onClose={() => setMinutes(null)} />}
    </DashboardLayout>
  );
}

export default withRoleAccess(PADashboard, { requiredRoles: ["pa_to_centre_manager", "centre_manager"] });
