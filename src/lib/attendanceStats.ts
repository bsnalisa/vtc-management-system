export interface AttendanceRow { trainee_id: string; attendance_date: string; present: boolean | null }

export const ATTENDANCE_WARNING_PERCENT = 80;

export type Period = "week" | "month" | "year";

const pad = (n: number) => String(n).padStart(2, "0");
export const toISODate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
/** Parse YYYY-MM-DD as a local date (new Date("YYYY-MM-DD") would be UTC and can shift the day). */
export const fromISODate = (s: string) => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
};

/** Inclusive date range of the week (Monday to Sunday), month or year that contains `anchor`. */
export function periodRange(period: Period, anchor: string): { from: string; to: string } {
  const a = fromISODate(anchor);
  if (period === "week") {
    const monday = new Date(a.getFullYear(), a.getMonth(), a.getDate() - ((a.getDay() + 6) % 7));
    const sunday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6);
    return { from: toISODate(monday), to: toISODate(sunday) };
  }
  if (period === "month") {
    return { from: toISODate(new Date(a.getFullYear(), a.getMonth(), 1)), to: toISODate(new Date(a.getFullYear(), a.getMonth() + 1, 0)) };
  }
  return { from: `${a.getFullYear()}-01-01`, to: `${a.getFullYear()}-12-31` };
}

export interface TraineeAttendance {
  trainee_id: string;
  present: number;
  absent: number;
  notRecorded: number;
  sessions: number;
  rate: number | null; // percent, null when no sessions were held
}

/**
 * A "session" is a date on which attendance was taken for the register (any trainee has a row).
 * A trainee with no row on a session date is "not recorded" and does NOT count as present.
 */
export function summarise(traineeIds: string[], records: AttendanceRow[]): { sessions: number; rows: TraineeAttendance[] } {
  const dates = new Set(records.map((r) => r.attendance_date));
  const byTrainee = new Map<string, Map<string, boolean>>();
  for (const r of records) {
    if (!byTrainee.has(r.trainee_id)) byTrainee.set(r.trainee_id, new Map());
    byTrainee.get(r.trainee_id)!.set(r.attendance_date, r.present === true);
  }
  const sessions = dates.size;
  const rows = traineeIds.map((id) => {
    const mine = byTrainee.get(id) ?? new Map<string, boolean>();
    let present = 0;
    let absent = 0;
    mine.forEach((p, date) => {
      if (!dates.has(date)) return;
      if (p) present++; else absent++;
    });
    const notRecorded = sessions - present - absent;
    return { trainee_id: id, present, absent, notRecorded, sessions, rate: sessions ? Math.round((present / sessions) * 1000) / 10 : null };
  });
  return { sessions, rows };
}
