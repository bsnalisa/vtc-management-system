import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  AttendanceRegisterRow, RegisterKey, useAttendanceForDate, useCreateRegister, useMyTrainerId, useSaveAttendance, useTrainerOptions,
} from "@/hooks/useAttendance";
import { toISODate } from "@/lib/attendanceStats";

export interface ClassTrainee { id: string; trainee_id: string; first_name: string; last_name: string }

type Mark = { present: boolean; remarks: string };

export function CaptureTab({ register, registerKey, trainees }: { register: AttendanceRegisterRow | null | undefined; registerKey: RegisterKey; trainees: ClassTrainee[] }) {
  const today = toISODate(new Date());
  const [date, setDate] = useState(today);
  const [marks, setMarks] = useState<Record<string, Mark>>({});
  const [dirty, setDirty] = useState(false);
  const [trainerId, setTrainerId] = useState("");
  const { data: saved, isFetching } = useAttendanceForDate(register?.id, date);
  const { data: myTrainer } = useMyTrainerId();
  const { data: trainers } = useTrainerOptions();
  const save = useSaveAttendance();
  const create = useCreateRegister();

  // Load what has already been recorded for the chosen date (and discard unsaved edits for another date)
  useEffect(() => {
    const next: Record<string, Mark> = {};
    saved?.forEach((r) => { next[r.trainee_id] = { present: r.present === true, remarks: r.remarks ?? "" }; });
    setMarks(next);
    setDirty(false);
  }, [saved, date, register?.id]);

  useEffect(() => { if (!trainerId && myTrainer) setTrainerId(myTrainer); }, [myTrainer, trainerId]);

  const counts = useMemo(() => {
    const v = Object.values(marks);
    return { present: v.filter((m) => m.present).length, absent: v.filter((m) => !m.present).length, unmarked: trainees.length - v.length };
  }, [marks, trainees.length]);

  const set = (id: string, patch: Partial<Mark>) => {
    setMarks((m) => ({ ...m, [id]: { present: m[id]?.present ?? true, remarks: m[id]?.remarks ?? "", ...patch } }));
    setDirty(true);
  };

  if (!register) {
    return (
      <div className="space-y-3 max-w-md">
        <p className="text-sm text-muted-foreground">No register has been started for this trade, level, mode and year. Start one to begin recording attendance.</p>
        <div className="space-y-1">
          <Label>Trainer responsible</Label>
          <Select value={trainerId} onValueChange={setTrainerId}>
            <SelectTrigger><SelectValue placeholder="Select trainer" /></SelectTrigger>
            <SelectContent>{trainers?.map((t) => <SelectItem key={t.id} value={t.id}>{t.full_name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <Button disabled={!trainerId || create.isPending} onClick={() => create.mutate({ ...registerKey, trainerId })}>Start register</Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label htmlFor="att-date">Date</Label>
          <Input id="att-date" type="date" max={today} value={date} onChange={(e) => e.target.value && setDate(e.target.value)} className="w-44" />
        </div>
        <Button variant="outline" size="sm" onClick={() => { setMarks(Object.fromEntries(trainees.map((t) => [t.id, { present: true, remarks: marks[t.id]?.remarks ?? "" }]))); setDirty(true); }}>Mark everyone present</Button>
        <div className="flex gap-2 text-sm">
          <Badge>{counts.present} present</Badge><Badge variant="destructive">{counts.absent} absent</Badge>
          {counts.unmarked > 0 && <Badge variant="outline">{counts.unmarked} not marked</Badge>}
        </div>
      </div>

      <Table>
        <TableHeader><TableRow><TableHead>Trainee no.</TableHead><TableHead>Name</TableHead><TableHead>Attendance</TableHead><TableHead>Remarks</TableHead></TableRow></TableHeader>
        <TableBody>
          {trainees.map((t) => {
            const m = marks[t.id];
            return (
              <TableRow key={t.id}>
                <TableCell className="font-mono">{t.trainee_id}</TableCell>
                <TableCell>{t.last_name}, {t.first_name}</TableCell>
                <TableCell>
                  <div className="flex gap-2" role="group" aria-label={`Attendance for ${t.first_name} ${t.last_name}`}>
                    <Button size="sm" variant={m?.present === true ? "default" : "outline"} aria-pressed={m?.present === true} onClick={() => set(t.id, { present: true })}>Present</Button>
                    <Button size="sm" variant={m && !m.present ? "destructive" : "outline"} aria-pressed={!!m && !m.present} onClick={() => set(t.id, { present: false })}>Absent</Button>
                  </div>
                </TableCell>
                <TableCell><Input aria-label={`Remarks for ${t.first_name} ${t.last_name}`} placeholder={m && !m.present ? "Reason, if known" : ""} value={m?.remarks ?? ""} disabled={!m} onChange={(e) => set(t.id, { remarks: e.target.value })} /></TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      {!trainees.length && <p className="text-sm text-muted-foreground text-center py-6">No active trainees match this trade, level, mode and year.</p>}

      <div className="flex items-center gap-3">
        <Button disabled={!dirty || save.isPending || !Object.keys(marks).length} onClick={() => save.mutate({
          registerId: register.id, date,
          entries: Object.entries(marks).map(([traineeId, m]) => ({ traineeId, present: m.present, remarks: m.remarks })),
        })}>Save attendance</Button>
        {isFetching && <span className="text-xs text-muted-foreground">Loading saved attendance…</span>}
        {dirty && <span className="text-xs text-muted-foreground">Unsaved changes</span>}
      </div>
    </div>
  );
}
