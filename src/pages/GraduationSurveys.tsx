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
import { Plus } from "lucide-react";
import { toast } from "sonner";
import {
  useCeremonies, useCreateCeremony, useInvitations, useSendInvitations, useRecordRsvp,
  useSurveys, useSurveyStatus, useSendSurvey,
} from "@/hooks/useGraduation";
import { SurveyBuilderDialog } from "@/components/graduation/SurveyBuilderDialog";
import { SurveyResults } from "@/components/graduation/SurveyResults";

function CeremonyDialog() {
  const [open, setOpen] = useState(false);
  const empty = { title: "", graduation_year: new Date().getFullYear(), ceremony_date: "", venue: "", notes: "" };
  const [form, setForm] = useState(empty);
  const create = useCreateCeremony();
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    await create.mutateAsync({ ...form, ceremony_date: new Date(form.ceremony_date).toISOString(), venue: form.venue || null, notes: form.notes || null });
    setForm(empty);
    setOpen(false);
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />New ceremony</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Schedule graduation ceremony</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-1"><Label>Title</Label><Input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><Label>Graduating class (year)</Label><Input type="number" required value={form.graduation_year} onChange={(e) => setForm({ ...form, graduation_year: Number(e.target.value) })} /></div>
            <div className="space-y-1"><Label>Date &amp; time</Label><Input type="datetime-local" required value={form.ceremony_date} onChange={(e) => setForm({ ...form, ceremony_date: e.target.value })} /></div>
          </div>
          <div className="space-y-1"><Label>Venue</Label><Input value={form.venue} onChange={(e) => setForm({ ...form, venue: e.target.value })} /></div>
          <div className="space-y-1"><Label>Notes</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
          <Button type="submit" className="w-full" disabled={create.isPending}>Save</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function CeremoniesTab() {
  const { data: ceremonies } = useCeremonies();
  const [selected, setSelected] = useState("");
  const ceremony = ceremonies?.find((c) => c.id === selected);
  const { data: invitations } = useInvitations(selected || undefined);
  const send = useSendInvitations();
  const rsvp = useRecordRsvp();

  const yes = invitations?.filter((i) => i.response_code === 1).length ?? 0;
  const no = invitations?.filter((i) => i.response_code === 2).length ?? 0;
  const pending = (invitations?.length ?? 0) - yes - no;

  return (
    <div className="space-y-4">
      <div className="flex gap-3 justify-between">
        <Select value={selected} onValueChange={setSelected}>
          <SelectTrigger className="max-w-sm"><SelectValue placeholder="Select a ceremony" /></SelectTrigger>
          <SelectContent>{ceremonies?.map((c) => <SelectItem key={c.id} value={c.id}>{c.title} ({c.graduation_year})</SelectItem>)}</SelectContent>
        </Select>
        <CeremonyDialog />
      </div>

      {ceremony && (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm text-muted-foreground">{new Date(ceremony.ceremony_date).toLocaleString()}{ceremony.venue ? ` · ${ceremony.venue}` : ""}</span>
            <Button size="sm" disabled={send.isPending} onClick={() => send.mutate(ceremony.id)}>
              {ceremony.invitations_sent_at ? "Send to graduates not yet invited / unanswered" : "Send invitations"}
            </Button>
          </div>
          <div className="flex gap-2">
            <Badge>Attending (1): {yes}</Badge><Badge variant="secondary">Declined (2): {no}</Badge><Badge variant="outline">Awaiting reply: {pending}</Badge>
          </div>
          <Table>
            <TableHeader><TableRow><TableHead>Graduate</TableHead><TableHead>Response</TableHead><TableHead>Via</TableHead><TableHead /></TableRow></TableHeader>
            <TableBody>
              {invitations?.map((i) => (
                <TableRow key={i.id}>
                  <TableCell>{i.alumni?.trainees ? `${i.alumni.trainees.first_name} ${i.alumni.trainees.last_name} (${i.alumni.trainees.trainee_id})` : "-"}</TableCell>
                  <TableCell>{i.response_code === 1 ? "1 - Yes" : i.response_code === 2 ? "2 - No" : "Awaiting"}</TableCell>
                  <TableCell>{i.response_channel ?? "-"}</TableCell>
                  <TableCell className="space-x-2 text-right">
                    <Button size="sm" variant="outline" onClick={() => rsvp.mutate({ id: i.id, code: 1 })}>Yes</Button>
                    <Button size="sm" variant="outline" onClick={() => rsvp.mutate({ id: i.id, code: 2 })}>No</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {!invitations?.length && <p className="text-sm text-muted-foreground text-center py-4">No invitations yet. Sending creates one for every active graduate of {ceremony.graduation_year}.</p>}
        </>
      )}
    </div>
  );
}

function SurveysTab() {
  const { data: surveys } = useSurveys();
  const send = useSendSurvey();
  const setStatus = useSurveyStatus();
  const [selected, setSelected] = useState("");
  const survey = surveys?.find((s) => s.id === selected);

  return (
    <div className="space-y-4">
      <div className="flex justify-end"><SurveyBuilderDialog /></div>
      <Table>
        <TableHeader><TableRow><TableHead>Survey</TableHead><TableHead>Audience</TableHead><TableHead>Status</TableHead><TableHead /></TableRow></TableHeader>
        <TableBody>
          {surveys?.map((s) => (
            <TableRow key={s.id} className={s.id === selected ? "bg-muted/50" : ""}>
              <TableCell className="font-medium">{s.title}{s.anonymous && <Badge variant="outline" className="ml-2">anonymous</Badge>}</TableCell>
              <TableCell>{s.target_graduation_year ? `Class of ${s.target_graduation_year}` : "All graduates"}</TableCell>
              <TableCell><Badge variant={s.status === "open" ? "default" : "secondary"}>{s.status}</Badge></TableCell>
              <TableCell className="space-x-2 text-right">
                {s.status !== "closed" && (
                  <Button size="sm" disabled={send.isPending} onClick={() => send.mutate(s.id)}>{s.status === "draft" ? "Send" : "Send to new graduates"}</Button>
                )}
                {s.status === "open" && <Button size="sm" variant="outline" onClick={() => setStatus.mutate({ id: s.id, status: "closed" })}>Close</Button>}
                <Button size="sm" variant="outline" onClick={() => { setSelected(s.id); if (s.status === "draft") toast.info("Results appear once the survey is sent."); }}>Results</Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {!surveys?.length && <p className="text-sm text-muted-foreground text-center py-4">No surveys yet.</p>}
      {survey && <SurveyResults surveyId={survey.id} title={survey.title} />}
    </div>
  );
}

export default function GraduationSurveys() {
  const { navItems, groupLabel } = useRoleNavigation();
  return (
    <DashboardLayout title="Graduation & Surveys" subtitle="Ceremony attendance and graduate feedback" navItems={navItems} groupLabel={groupLabel}>
      <Card>
        <CardHeader>
          <CardTitle>Graduation &amp; Surveys</CardTitle>
          <CardDescription>Invite graduates to ceremonies and collect feedback with surveys.</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="ceremonies">
            <TabsList><TabsTrigger value="ceremonies">Ceremonies</TabsTrigger><TabsTrigger value="surveys">Surveys &amp; Reports</TabsTrigger></TabsList>
            <TabsContent value="ceremonies"><CeremoniesTab /></TabsContent>
            <TabsContent value="surveys"><SurveysTab /></TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </DashboardLayout>
  );
}
