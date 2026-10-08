import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LeaveRequest, fmtDate } from "@/hooks/useHr";

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** Approved leave for one month: a day grid plus a grouped list per person. */
export function LeaveCalendar({ requests, names }: { requests: LeaveRequest[]; names: Map<string, string> }) {
  const [month, setMonth] = useState(() => { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), 1); });
  const days = useMemo(() => Array.from({ length: new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate() }, (_, i) => new Date(month.getFullYear(), month.getMonth(), i + 1)), [month]);
  const first = iso(days[0]); const last = iso(days[days.length - 1]);
  const approved = useMemo(() => requests.filter((r) => r.status === "approved" && r.start_date <= last && r.end_date >= first), [requests, first, last]);
  const perDay = (d: Date) => approved.filter((r) => r.start_date <= iso(d) && r.end_date >= iso(d)).length;
  const shift = (n: number) => setMonth(new Date(month.getFullYear(), month.getMonth() + n, 1));
  const today = iso(new Date());

  return (
    <Card className="border-0 shadow-md">
      <CardHeader className="flex-col sm:flex-row items-start justify-between space-y-0 gap-3">
        <div><CardTitle>{month.toLocaleDateString(undefined, { month: "long", year: "numeric" })}</CardTitle><CardDescription>Approved leave only. {approved.length} request(s) overlap this month.</CardDescription></div>
        <div className="flex gap-2">
          <Button variant="outline" size="icon" aria-label="Previous month" onClick={() => shift(-1)}><ChevronLeft className="h-4 w-4" /></Button>
          <Button variant="outline" onClick={() => { const n = new Date(); setMonth(new Date(n.getFullYear(), n.getMonth(), 1)); }}>This month</Button>
          <Button variant="outline" size="icon" aria-label="Next month" onClick={() => shift(1)}><ChevronRight className="h-4 w-4" /></Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-7 gap-1 text-center text-xs">
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => <div key={d} className="font-medium text-muted-foreground">{d}</div>)}
          {Array.from({ length: (days[0].getDay() + 6) % 7 }).map((_, i) => <div key={`pad${i}`} />)}
          {days.map((d) => {
            const n = perDay(d);
            return (
              <div key={iso(d)} title={`${n} away`} className={`rounded-md border p-1 min-h-[3rem] ${iso(d) === today ? "border-primary" : "border-border"} ${n ? "bg-accent" : ""}`}>
                <div className="text-muted-foreground">{d.getDate()}</div>
                {n > 0 && <div className="font-semibold">{n}</div>}
              </div>
            );
          })}
        </div>
        {approved.length === 0 ? <p className="text-sm text-muted-foreground text-center py-4">Nobody has approved leave this month.</p> : (
          <ul className="divide-y rounded-md border">
            {approved.map((r) => (
              <li key={r.id} className="flex flex-col gap-1 p-3 sm:flex-row sm:items-center sm:justify-between">
                <span className="font-medium">{names.get(r.user_id) ?? "Unknown"}</span>
                <span className="text-sm text-muted-foreground">{r.leave_types?.name} - {fmtDate(r.start_date)} to {fmtDate(r.end_date)} ({r.days} working days)</span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
