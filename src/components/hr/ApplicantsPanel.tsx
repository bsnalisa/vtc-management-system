import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { APPLICANT_STAGES, Applicant, ApplicantStage, Vacancy, labelOf, useApplicants, useDeleteApplicant, useMoveApplicant, useSaveApplicant } from "@/hooks/useHr";

const blank = { full_name: "", email: "", phone: "", notes: "" };

export function ApplicantsPanel({ vacancy }: { vacancy: Vacancy }) {
  const { data, isLoading, error } = useApplicants(vacancy.id);
  const save = useSaveApplicant();
  const move = useMoveApplicant();
  const del = useDeleteApplicant();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Applicant | null>(null);
  const [form, setForm] = useState(blank);
  useEffect(() => { setOpen(false); }, [vacancy.id]);

  const start = (a: Applicant | null) => {
    setEditing(a);
    setForm(a ? { full_name: a.full_name, email: a.email ?? "", phone: a.phone ?? "", notes: a.notes ?? "" } : blank);
    setOpen(true);
  };
  const submit = async () => {
    try {
      await save.mutateAsync({ id: editing?.id, vacancy_id: vacancy.id, full_name: form.full_name.trim(), email: form.email.trim() || null, phone: form.phone.trim() || null, notes: form.notes.trim() || null });
      setOpen(false);
    } catch {
      // the mutation already showed the error toast
    }
  };
  const counts = APPLICANT_STAGES.map((s) => ({ s, n: (data ?? []).filter((a) => a.stage === s).length }));

  return (
    <Card className="border-0 shadow-md">
      <CardHeader className="flex-col sm:flex-row items-start justify-between space-y-0 gap-3">
        <div><CardTitle>Applicants: {vacancy.title}</CardTitle><CardDescription>{data?.length ?? 0} applicant(s)</CardDescription></div>
        <Button onClick={() => start(null)}>Add applicant</Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">{counts.map(({ s, n }) => <Badge key={s} variant={n ? "secondary" : "outline"}>{labelOf(s)}: {n}</Badge>)}</div>
        {isLoading && <LoadingSpinner text="Loading applicants" />}
        {error && <p role="alert" className="text-sm text-destructive">Could not load applicants: {(error as Error).message}</p>}
        {!isLoading && !error && (
          <Table>
            <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Contact</TableHead><TableHead>Stage</TableHead><TableHead>Notes</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
            <TableBody>
              {(data ?? []).map((a) => (
                <TableRow key={a.id}>
                  <TableCell>{a.full_name}</TableCell>
                  <TableCell>{a.email ?? "-"}<div className="text-xs text-muted-foreground">{a.phone}</div></TableCell>
                  <TableCell>
                    <Select value={a.stage} onValueChange={(v) => move.mutate({ id: a.id, stage: v as ApplicantStage })}>
                      <SelectTrigger className="w-[150px]" aria-label={`Stage for ${a.full_name}`}><SelectValue /></SelectTrigger>
                      <SelectContent>{APPLICANT_STAGES.map((s) => <SelectItem key={s} value={s}>{labelOf(s)}</SelectItem>)}</SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="whitespace-normal min-w-[200px]">{a.notes ?? "-"}</TableCell>
                  <TableCell className="text-right space-x-2">
                    <Button size="sm" variant="outline" onClick={() => start(a)}>Edit</Button>
                    <Button size="sm" variant="outline" onClick={() => del.mutate(a.id)} disabled={del.isPending}>Remove</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        {!isLoading && !error && !data?.length && <p className="text-sm text-muted-foreground text-center py-6">No applicants for this vacancy yet.</p>}
      </CardContent>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Edit applicant" : "Add applicant"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1"><Label>Full name</Label><Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1"><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
              <div className="space-y-1"><Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
            </div>
            <div className="space-y-1"><Label>Notes</Label><Textarea rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0"><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={submit} disabled={!form.full_name.trim() || save.isPending}>Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
