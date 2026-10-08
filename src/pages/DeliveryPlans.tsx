import { useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useRoleNavigation } from "@/hooks/useRoleNavigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus } from "lucide-react";
import { ExportMenu } from "@/components/ExportMenu";
import {
  DeliveryPlan, PlanWeek, useClassOptions, useDeliveryPlans, useGenerateDeliveryPlan, usePlanWeeks,
  useUpdateDeliveryPlan, useUpdatePlanWeek,
} from "@/hooks/useDeliveryPlans";

const STAFF_ROLES = ["super_admin", "admin", "organization_admin", "head_of_training", "hod", "assessment_coordinator"];

function GenerateDialog({ onCreated }: { onCreated: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const [classId, setClassId] = useState("");
  const [start, setStart] = useState("");
  const [weeks, setWeeks] = useState(13);
  const [title, setTitle] = useState("");
  const { data: classes } = useClassOptions();
  const generate = useGenerateDeliveryPlan();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const id = await generate.mutateAsync({ classId, start, weeks, title });
    setOpen(false); setClassId(""); setStart(""); setTitle("");
    onCreated(id);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />Generate plan</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Generate delivery plan</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <p className="text-sm text-muted-foreground">The plan is pre-filled from the unit standards of the class's qualification, weighted by credits. The last week is kept for revision and assessment. You can edit every week afterwards.</p>
          <div className="space-y-1"><Label>Class</Label>
            <Select value={classId} onValueChange={setClassId}>
              <SelectTrigger><SelectValue placeholder="Select class" /></SelectTrigger>
              <SelectContent>{classes?.map((c) => <SelectItem key={c.id} value={c.id}>{c.class_name} ({c.class_code}, {c.academic_year})</SelectItem>)}</SelectContent>
            </Select></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><Label>Start date</Label><Input type="date" required value={start} onChange={(e) => setStart(e.target.value)} /></div>
            <div className="space-y-1"><Label>Number of weeks</Label><Input type="number" min={2} max={60} required value={weeks} onChange={(e) => setWeeks(Number(e.target.value))} /></div>
          </div>
          <div className="space-y-1"><Label>Title (optional)</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} /></div>
          <Button type="submit" className="w-full" disabled={generate.isPending || !classId || !start}>Generate</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function WeekRow({ week, locked }: { week: PlanWeek; locked: boolean }) {
  const update = useUpdatePlanWeek();
  const [edit, setEdit] = useState({ topic: week.topic, outcomes: week.outcomes ?? "", methods: week.methods ?? "", resources: week.resources ?? "", assessment_activity: week.assessment_activity ?? "", remarks: week.remarks ?? "" });
  const dirty = edit.topic !== week.topic || edit.outcomes !== (week.outcomes ?? "") || edit.methods !== (week.methods ?? "") || edit.resources !== (week.resources ?? "") || edit.assessment_activity !== (week.assessment_activity ?? "") || edit.remarks !== (week.remarks ?? "");
  const field = (k: keyof typeof edit) => (
    <Input disabled={locked} value={edit[k]} onChange={(e) => setEdit({ ...edit, [k]: e.target.value })} className="min-w-32" />
  );
  return (
    <TableRow>
      <TableCell>{week.week_no}<div className="text-xs text-muted-foreground">{week.week_start}</div></TableCell>
      <TableCell>{field("topic")}{week.unit_standard_code && <div className="text-xs text-muted-foreground">{week.unit_standard_code}</div>}</TableCell>
      <TableCell>{field("outcomes")}</TableCell>
      <TableCell>{field("methods")}</TableCell>
      <TableCell>{field("resources")}</TableCell>
      <TableCell>{field("assessment_activity")}</TableCell>
      <TableCell>
        <Select disabled={locked} value={week.status} onValueChange={(status) => update.mutate({ id: week.id, status: status as PlanWeek["status"] })}>
          <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
          <SelectContent>{["planned", "delivered", "deferred"].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
        </Select>
      </TableCell>
      <TableCell>{field("remarks")}</TableCell>
      <TableCell>{dirty && <Button size="sm" disabled={update.isPending} onClick={() => update.mutate({ id: week.id, topic: edit.topic, outcomes: edit.outcomes || null, methods: edit.methods || null, resources: edit.resources || null, assessment_activity: edit.assessment_activity || null, remarks: edit.remarks || null })}>Save</Button>}</TableCell>
    </TableRow>
  );
}

function PlanDetail({ plan, isStaff }: { plan: DeliveryPlan; isStaff: boolean }) {
  const { data: weeks } = usePlanWeeks(plan.id);
  const update = useUpdateDeliveryPlan();
  const delivered = weeks?.filter((w) => w.status === "delivered").length ?? 0;
  const pct = weeks?.length ? Math.round((delivered / weeks.length) * 100) : 0;
  // trainers edit while drafting/after rejection; staff can always edit
  const locked = !isStaff && plan.status === "submitted";

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between space-y-0">
        <div>
          <CardTitle className="text-base">{plan.title}</CardTitle>
          <CardDescription>{plan.classes?.class_name} · {plan.trainers?.full_name ?? "No trainer"} · {plan.start_date} · {plan.weeks} weeks</CardDescription>
        </div>
        <div className="flex gap-2 items-center">
          <Badge variant={plan.status === "approved" ? "default" : plan.status === "rejected" ? "destructive" : "secondary"}>{plan.status}</Badge>
          <ExportMenu size="sm" label="Export" title={plan.title} filename={`delivery-plan-${plan.title.replace(/\W+/g, "-").toLowerCase()}`} disabled={!weeks?.length}
            data={() => (weeks ?? []).map((w) => ({ week: w.week_no, starts: w.week_start, unit_standard: w.unit_standard_code, topic: w.topic, outcomes: w.outcomes, methods: w.methods, resources: w.resources, assessment: w.assessment_activity, status: w.status, delivered_on: w.delivered_on, remarks: w.remarks }))} />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1"><div className="text-sm">Delivered {delivered} of {weeks?.length ?? 0} weeks ({pct}%)</div><Progress value={pct} /></div>
        {plan.review_notes && <p className="text-sm"><span className="text-muted-foreground">Reviewer notes: </span>{plan.review_notes}</p>}
        <div className="overflow-x-auto">
          <Table>
            <TableHeader><TableRow><TableHead>Week</TableHead><TableHead>Topic</TableHead><TableHead>Outcomes</TableHead><TableHead>Methods</TableHead><TableHead>Resources</TableHead><TableHead>Assessment</TableHead><TableHead>Status</TableHead><TableHead>Remarks</TableHead><TableHead /></TableRow></TableHeader>
            <TableBody>{weeks?.map((w) => <WeekRow key={`${w.id}-${w.topic}`} week={w} locked={locked} />)}</TableBody>
          </Table>
        </div>
        <div className="flex gap-2">
          {!isStaff && (plan.status === "draft" || plan.status === "rejected") && <Button disabled={update.isPending} onClick={() => update.mutate({ id: plan.id, status: "submitted" })}>Submit for approval</Button>}
          {isStaff && plan.status === "submitted" && (
            <>
              <Button disabled={update.isPending} onClick={() => update.mutate({ id: plan.id, status: "approved" })}>Approve</Button>
              <Button variant="destructive" disabled={update.isPending} onClick={() => {
                const notes = window.prompt("Reason for returning the plan (the trainer will see this):");
                if (notes?.trim()) update.mutate({ id: plan.id, status: "rejected", review_notes: notes.trim() });
              }}>Return to trainer</Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default function DeliveryPlans() {
  const { role, navItems, groupLabel } = useRoleNavigation();
  const isStaff = !!role && STAFF_ROLES.includes(role);
  const { data: plans } = useDeliveryPlans();
  const [selectedId, setSelectedId] = useState("");
  const plan = plans?.find((p) => p.id === selectedId);

  return (
    <DashboardLayout title="Delivery Plans" subtitle="Weekly plans for each class" navItems={navItems} groupLabel={groupLabel}>
      <div className="space-y-4">
        <Card>
          <CardHeader><CardTitle>Delivery plans</CardTitle><CardDescription>{isStaff ? "Review and approve trainers' plans." : "Generate a plan from the qualification, adjust it, and submit it for approval."}</CardDescription></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between gap-3">
              <Select value={selectedId} onValueChange={setSelectedId}>
                <SelectTrigger className="max-w-md"><SelectValue placeholder={plans?.length ? "Select a plan" : "No plans yet"} /></SelectTrigger>
                <SelectContent>{plans?.map((p) => <SelectItem key={p.id} value={p.id}>{p.title} · {p.status}</SelectItem>)}</SelectContent>
              </Select>
              <GenerateDialog onCreated={setSelectedId} />
            </div>
          </CardContent>
        </Card>
        {plan && <PlanDetail key={plan.id} plan={plan} isStaff={isStaff} />}
      </div>
    </DashboardLayout>
  );
}
