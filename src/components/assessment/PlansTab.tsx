import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus } from "lucide-react";
import { DevelopmentPlan, useCreatePlan, useDevelopmentPlans, useSmes, useUpdatePlan } from "@/hooks/useAssessmentDevelopment";
import { useQualificationOptions, useUnitStandardOptions } from "@/hooks/useAssessmentRequests";

function NewPlanDialog() {
  const [open, setOpen] = useState(false);
  const year = String(new Date().getFullYear());
  const empty = { qualification_id: "", unit_standard_id: "", academic_year: year, assessment_type: "theory" as DevelopmentPlan["assessment_type"], assigned_to: "", questions_required: 20, due_date: "", brief: "" };
  const [f, setF] = useState(empty);
  const { data: quals } = useQualificationOptions();
  const { data: units } = useUnitStandardOptions();
  const { data: smes } = useSmes(true);
  const create = useCreatePlan();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    await create.mutateAsync({
      ...f, unit_standard_id: f.unit_standard_id || null, assigned_to: f.assigned_to || null,
      due_date: f.due_date || null, brief: f.brief || null,
    });
    setF(empty);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />New plan</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Assessment materials development plan</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-1"><Label>Qualification</Label>
            <Select value={f.qualification_id} onValueChange={(v) => setF({ ...f, qualification_id: v })}>
              <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>{quals?.map((q) => <SelectItem key={q.id} value={q.id}>{q.qualification_title}</SelectItem>)}</SelectContent>
            </Select></div>
          <div className="space-y-1"><Label>Unit standard (optional)</Label>
            <Select value={f.unit_standard_id} onValueChange={(v) => setF({ ...f, unit_standard_id: v })}>
              <SelectTrigger><SelectValue placeholder="Whole qualification" /></SelectTrigger>
              <SelectContent>{units?.map((u) => <SelectItem key={u.id} value={u.id}>{u.unit_no} - {u.module_title}</SelectItem>)}</SelectContent>
            </Select></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><Label>Academic year</Label><Input required value={f.academic_year} onChange={(e) => setF({ ...f, academic_year: e.target.value })} /></div>
            <div className="space-y-1"><Label>Type</Label>
              <Select value={f.assessment_type} onValueChange={(v) => setF({ ...f, assessment_type: v as DevelopmentPlan["assessment_type"] })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="theory">Theory</SelectItem><SelectItem value="practical">Practical</SelectItem></SelectContent>
              </Select></div>
            <div className="space-y-1"><Label>Questions required</Label><Input type="number" min={1} value={f.questions_required} onChange={(e) => setF({ ...f, questions_required: Math.max(1, Number(e.target.value)) })} /></div>
            <div className="space-y-1"><Label>Due date</Label><Input type="date" value={f.due_date} onChange={(e) => setF({ ...f, due_date: e.target.value })} /></div>
          </div>
          <div className="space-y-1"><Label>Assign to expert</Label>
            <Select value={f.assigned_to} onValueChange={(v) => setF({ ...f, assigned_to: v })}>
              <SelectTrigger><SelectValue placeholder={smes?.length ? "Select an approved SME" : "No approved SMEs yet"} /></SelectTrigger>
              <SelectContent>{smes?.map((s) => <SelectItem key={s.user_id} value={s.user_id}>{s.full_name} ({s.email})</SelectItem>)}</SelectContent>
            </Select></div>
          <div className="space-y-1"><Label>Brief</Label><Textarea value={f.brief} onChange={(e) => setF({ ...f, brief: e.target.value })} /></div>
          <Button type="submit" className="w-full" disabled={create.isPending || !f.qualification_id}>Create plan</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function PlansTab({ isStaff }: { isStaff: boolean }) {
  const { data } = useDevelopmentPlans();
  const { data: smes } = useSmes(isStaff);
  const update = useUpdatePlan();
  const smeName = (id: string | null) => smes?.find((s) => s.user_id === id)?.full_name ?? (id ? "Assigned" : "Unassigned");

  return (
    <div className="space-y-4">
      {isStaff && <div className="flex justify-end"><NewPlanDialog /></div>}
      <Table>
        <TableHeader><TableRow><TableHead>Qualification</TableHead><TableHead>Type</TableHead><TableHead>Questions</TableHead><TableHead>Due</TableHead>{isStaff && <TableHead>Expert</TableHead>}<TableHead>Status</TableHead><TableHead /></TableRow></TableHeader>
        <TableBody>
          {data?.map((p) => (
            <TableRow key={p.id}>
              <TableCell><div className="font-medium">{p.qualifications?.qualification_title}</div><div className="text-xs text-muted-foreground">{p.unit_standards?.unit_no ?? "Whole qualification"} · {p.academic_year}</div>{p.brief && <div className="text-xs mt-1">{p.brief}</div>}</TableCell>
              <TableCell>{p.assessment_type}</TableCell>
              <TableCell>{p.questions_required}</TableCell>
              <TableCell>{p.due_date ?? "-"}</TableCell>
              {isStaff && <TableCell>{smeName(p.assigned_to)}</TableCell>}
              <TableCell><Badge variant={p.status === "approved" ? "default" : p.status === "rejected" ? "destructive" : "secondary"}>{p.status.replace("_", " ")}</Badge>{p.review_notes && <div className="text-xs mt-1">{p.review_notes}</div>}</TableCell>
              <TableCell className="space-x-2 text-right">
                {!isStaff && (p.status === "assigned" || p.status === "rejected") && <Button size="sm" variant="outline" onClick={() => update.mutate({ id: p.id, status: "in_progress" })}>Start</Button>}
                {!isStaff && p.status === "in_progress" && <Button size="sm" onClick={() => update.mutate({ id: p.id, status: "submitted" })}>Submit for review</Button>}
                {isStaff && p.status === "submitted" && (
                  <>
                    <Button size="sm" onClick={() => update.mutate({ id: p.id, status: "approved" })}>Approve</Button>
                    <Button size="sm" variant="destructive" onClick={() => {
                      const notes = window.prompt("Reason for rejecting (the expert will see this):");
                      if (notes?.trim()) update.mutate({ id: p.id, status: "rejected", review_notes: notes.trim() });
                    }}>Reject</Button>
                  </>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {!data?.length && <p className="text-sm text-muted-foreground text-center py-6">No development plans.</p>}
    </div>
  );
}
