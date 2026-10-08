import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Printer } from "lucide-react";
import { ExportMenu } from "@/components/ExportMenu";
import { useAttendanceRange, AttendanceRegisterRow } from "@/hooks/useAttendance";
import { ATTENDANCE_WARNING_PERCENT, Period, periodRange, summarise, toISODate } from "@/lib/attendanceStats";
import { esc, htmlTable, printHtml } from "@/lib/printDocument";
import { useOrganizationContext } from "@/hooks/useOrganizationContext";
import type { ClassTrainee } from "./CaptureTab";

export function SummaryTab({ register, trainees, title }: { register: AttendanceRegisterRow | null | undefined; trainees: ClassTrainee[]; title: string }) {
  const [period, setPeriod] = useState<Period>("month");
  const [anchor, setAnchor] = useState(toISODate(new Date()));
  const { organizationName, settings } = useOrganizationContext();
  const range = useMemo(() => periodRange(period, anchor), [period, anchor]);
  const { data: records, isLoading } = useAttendanceRange(register?.id, range.from, range.to);

  const { sessions, rows } = useMemo(() => summarise(trainees.map((t) => t.id), records ?? []), [trainees, records]);
  const byId = new Map(trainees.map((t) => [t.id, t]));
  const table = rows.map((r) => {
    const t = byId.get(r.trainee_id)!;
    return { "Trainee no.": t.trainee_id, Name: `${t.last_name}, ${t.first_name}`, Sessions: r.sessions, Present: r.present, Absent: r.absent, "Not recorded": r.notRecorded, "Attendance %": r.rate ?? "" };
  });
  const heading = `${title} · ${range.from} to ${range.to}`;

  if (!register) return <p className="text-sm text-muted-foreground">No register has been started yet, so there is nothing to summarise.</p>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label>Period</Label>
          <Select value={period} onValueChange={(v) => setPeriod(v as Period)}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="week">Weekly</SelectItem><SelectItem value="month">Monthly</SelectItem><SelectItem value="year">Yearly</SelectItem></SelectContent>
          </Select>
        </div>
        <div className="space-y-1"><Label htmlFor="sum-date">Any date in the period</Label><Input id="sum-date" type="date" value={anchor} onChange={(e) => e.target.value && setAnchor(e.target.value)} className="w-44" /></div>
        <ExportMenu label="Export" title={heading} filename={`attendance-${period}-${range.from}`} disabled={!table.length || !sessions} data={() => table} />
        <Button variant="outline" disabled={!table.length || !sessions} onClick={() => printHtml("Attendance summary", `<p class="note">${esc(heading)} · ${sessions} session(s)</p>` +
          htmlTable(["Trainee no.", "Name", "Sessions", "Present", "Absent", "Not recorded", "Attendance %"], table.map((r) => Object.values(r)), { rightAlign: [2, 3, 4, 5, 6] }),
          { name: organizationName, logoUrl: settings?.logo_url })}><Printer className="h-4 w-4 mr-2" />Print</Button>
      </div>

      <p className="text-sm text-muted-foreground">{isLoading ? "Loading…" : `${sessions} session${sessions === 1 ? "" : "s"} recorded from ${range.from} to ${range.to}. Trainees below ${ATTENDANCE_WARNING_PERCENT}% are flagged.`}</p>
      <Table>
        <TableHeader><TableRow><TableHead>Trainee no.</TableHead><TableHead>Name</TableHead><TableHead className="text-right">Present</TableHead><TableHead className="text-right">Absent</TableHead><TableHead className="text-right">Not recorded</TableHead><TableHead className="text-right">Attendance</TableHead></TableRow></TableHeader>
        <TableBody>
          {rows.map((r) => {
            const t = byId.get(r.trainee_id)!;
            const low = r.rate !== null && r.rate < ATTENDANCE_WARNING_PERCENT;
            return (
              <TableRow key={r.trainee_id}>
                <TableCell className="font-mono">{t.trainee_id}</TableCell>
                <TableCell>{t.last_name}, {t.first_name}</TableCell>
                <TableCell className="text-right">{r.present}</TableCell><TableCell className="text-right">{r.absent}</TableCell><TableCell className="text-right">{r.notRecorded}</TableCell>
                <TableCell className="text-right">{r.rate === null ? "-" : <Badge variant={low ? "destructive" : "secondary"}>{r.rate}%</Badge>}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
