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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  AffairsRecord,
  AnonymousSubmission,
  AffairsRecordType,
  useAffairsRecords,
  useCreateAffairsRecord,
  useUpdateAffairsRecord,
  useExtracurricularEvents,
  useSendEventReminders,
  useCreateExtracurricularEvent,
  useAnonymousSubmissions,
  useUpdateAnonymousSubmission,
} from "@/hooks/useTraineeAffairs";

const RECORD_TABS: { type: AffairsRecordType; label: string; hasSeverity: boolean }[] = [
  { type: "incident", label: "Incidents", hasSeverity: true },
  { type: "counselling", label: "Counselling & Well-being", hasSeverity: false },
  { type: "discipline", label: "Discipline & Conduct", hasSeverity: true },
  { type: "career_guidance", label: "Career Guidance", hasSeverity: false },
  { type: "health", label: "Health Services", hasSeverity: false },
  { type: "grievance", label: "Grievances & Feedback", hasSeverity: false },
];

const STATUSES = ["open", "in_progress", "resolved", "closed"] as const;

function useTraineeOptions() {
  return useQuery({
    queryKey: ["trainee-options"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trainees")
        .select("id, first_name, last_name, trainee_id")
        .order("last_name");
      if (error) throw error;
      return data;
    },
  });
}

function RecordDialog({ type, label, hasSeverity }: { type: AffairsRecordType; label: string; hasSeverity: boolean }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ trainee_id: "", title: "", description: "", severity: "low", follow_up_date: "" });
  const { data: trainees } = useTraineeOptions();
  const create = useCreateAffairsRecord();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    await create.mutateAsync({
      record_type: type,
      trainee_id: form.trainee_id || null,
      title: form.title,
      description: form.description,
      severity: hasSeverity ? (form.severity as AffairsRecord["severity"]) : null,
      follow_up_date: form.follow_up_date || null,
    });
    setForm({ trainee_id: "", title: "", description: "", severity: "low", follow_up_date: "" });
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button><Plus className="h-4 w-4 mr-2" />New record</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>New {label} record</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label>Trainee</Label>
            <Select value={form.trainee_id} onValueChange={(v) => setForm({ ...form, trainee_id: v })}>
              <SelectTrigger><SelectValue placeholder="Select trainee" /></SelectTrigger>
              <SelectContent>
                {trainees?.map((t) => (
                  <SelectItem key={t.id} value={t.id}>{t.last_name}, {t.first_name} ({t.trainee_id})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Title</Label>
            <Input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Details</Label>
            <Textarea required rows={4} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          {hasSeverity && (
            <div className="space-y-2">
              <Label>Severity</Label>
              <Select value={form.severity} onValueChange={(v) => setForm({ ...form, severity: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["low", "medium", "high", "critical"].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-2">
            <Label>Follow-up date</Label>
            <Input type="date" value={form.follow_up_date} onChange={(e) => setForm({ ...form, follow_up_date: e.target.value })} />
          </div>
          <Button type="submit" disabled={create.isPending} className="w-full">
            {create.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Save
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function RecordsTab({ type, label, hasSeverity }: { type: AffairsRecordType; label: string; hasSeverity: boolean }) {
  const { data, isLoading } = useAffairsRecords(type);
  const update = useUpdateAffairsRecord();

  return (
    <div className="space-y-4">
      <div className="flex justify-end"><RecordDialog type={type} label={label} hasSeverity={hasSeverity} /></div>
      {isLoading ? (
        <Loader2 className="h-6 w-6 animate-spin mx-auto" />
      ) : !data?.length ? (
        <p className="text-sm text-muted-foreground text-center py-8">No records yet.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead><TableHead>Trainee</TableHead><TableHead>Title</TableHead>
              {hasSeverity && <TableHead>Severity</TableHead>}
              <TableHead>Follow-up</TableHead><TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((r) => (
              <TableRow key={r.id}>
                <TableCell>{r.record_date}</TableCell>
                <TableCell>{r.trainees ? `${r.trainees.first_name} ${r.trainees.last_name}` : "-"}</TableCell>
                <TableCell>
                  <div className="font-medium">{r.title}</div>
                  <div className="text-xs text-muted-foreground line-clamp-2">{r.description}</div>
                </TableCell>
                {hasSeverity && <TableCell><Badge variant="outline">{r.severity}</Badge></TableCell>}
                <TableCell>{r.follow_up_date ?? "-"}</TableCell>
                <TableCell>
                  <Select value={r.status} onValueChange={(status) => update.mutate({ id: r.id, status: status as AffairsRecord["status"] })}>
                    <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                    <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s}>{s.replace("_", " ")}</SelectItem>)}</SelectContent>
                  </Select>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

function EventsTab() {
  const { data, isLoading } = useExtracurricularEvents();
  const create = useCreateExtracurricularEvent();
  const remind = useSendEventReminders();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "", category: "sport", location: "", start_date: "", description: "", reminder_days_before: 1 });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    await create.mutateAsync({ ...form, start_date: new Date(form.start_date).toISOString() });
    setOpen(false);
    setForm({ title: "", category: "sport", location: "", start_date: "", description: "", reminder_days_before: 1 });
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end gap-2">
        <Button variant="outline" disabled={remind.isPending} onClick={() => remind.mutate()}>Send due reminders now</Button>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />Schedule event</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Schedule extra-curricular event</DialogTitle></DialogHeader>
            <form onSubmit={submit} className="space-y-4">
              <div className="space-y-2"><Label>Title</Label>
                <Input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
              <div className="space-y-2"><Label>Category</Label>
                <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["sport", "club", "trade_fair", "cultural", "awareness", "workshop", "seminar", "trc_affair", "other"].map((c) =>
                      <SelectItem key={c} value={c}>{c.replace("_", " ")}</SelectItem>)}
                  </SelectContent>
                </Select></div>
              <div className="space-y-2"><Label>Starts</Label>
                <Input required type="datetime-local" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} /></div>
              <div className="space-y-2"><Label>Location</Label>
                <Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} /></div>
              <div className="space-y-2"><Label>Remind trainees (days before)</Label>
                <Input type="number" min={0} value={form.reminder_days_before} onChange={(e) => setForm({ ...form, reminder_days_before: Number(e.target.value) })} /></div>
              <div className="space-y-2"><Label>Description</Label>
                <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
              <Button type="submit" disabled={create.isPending} className="w-full">Save</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>
      {isLoading ? <Loader2 className="h-6 w-6 animate-spin mx-auto" /> : !data?.length ? (
        <p className="text-sm text-muted-foreground text-center py-8">No events scheduled.</p>
      ) : (
        <Table>
          <TableHeader><TableRow><TableHead>When</TableHead><TableHead>Event</TableHead><TableHead>Category</TableHead><TableHead>Location</TableHead><TableHead>Reminder</TableHead></TableRow></TableHeader>
          <TableBody>
            {data.map((ev) => (
              <TableRow key={ev.id}>
                <TableCell>{new Date(ev.start_date).toLocaleString()}</TableCell>
                <TableCell className="font-medium">{ev.title}</TableCell>
                <TableCell><Badge variant="secondary">{ev.category.replace("_", " ")}</Badge></TableCell>
                <TableCell>{ev.location ?? "-"}</TableCell>
                <TableCell>{ev.reminder_sent ? "Sent" : `${ev.reminder_days_before} day(s) before`}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

function AnonymousTab() {
  const { data, isLoading } = useAnonymousSubmissions();
  const update = useUpdateAnonymousSubmission();
  if (isLoading) return <Loader2 className="h-6 w-6 animate-spin mx-auto" />;
  if (!data?.length) return <p className="text-sm text-muted-foreground text-center py-8">No submissions yet.</p>;
  return (
    <Table>
      <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Type</TableHead><TableHead>Rating</TableHead><TableHead>Message</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
      <TableBody>
        {data.map((s) => (
          <TableRow key={s.id}>
            <TableCell>{new Date(s.created_at).toLocaleDateString()}</TableCell>
            <TableCell><Badge variant="outline">{s.kind.replace("_", " ")}</Badge></TableCell>
            <TableCell>{s.rating ?? "-"}</TableCell>
            <TableCell className="max-w-md">{s.message}</TableCell>
            <TableCell>
              <Select value={s.status} onValueChange={(status) => update.mutate({ id: s.id, status: status as AnonymousSubmission["status"] })}>
                <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                <SelectContent>{["new", "reviewed", "actioned"].map((x) => <SelectItem key={x} value={x}>{x}</SelectItem>)}</SelectContent>
              </Select>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export default function TraineeAffairs() {
  const { navItems, groupLabel } = useRoleNavigation();
  return (
    <DashboardLayout title="Trainee Affairs" subtitle="Welfare, conduct, events and anonymous feedback" navItems={navItems} groupLabel={groupLabel}>
      <Card>
        <CardHeader>
          <CardTitle>Trainee Affairs</CardTitle>
          <CardDescription>Records are confidential to trainee affairs staff.</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="incident">
            <TabsList className="flex flex-wrap h-auto">
              {RECORD_TABS.map((t) => <TabsTrigger key={t.type} value={t.type}>{t.label}</TabsTrigger>)}
              <TabsTrigger value="events">Extra-curricular</TabsTrigger>
              <TabsTrigger value="anonymous">Suggestion Box &amp; Evaluations</TabsTrigger>
            </TabsList>
            {RECORD_TABS.map((t) => (
              <TabsContent key={t.type} value={t.type}><RecordsTab {...t} /></TabsContent>
            ))}
            <TabsContent value="events"><EventsTab /></TabsContent>
            <TabsContent value="anonymous"><AnonymousTab /></TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </DashboardLayout>
  );
}
