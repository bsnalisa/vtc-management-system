import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// Untyped access: keeps the nested selects simple and tolerant of generated-type drift.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export interface TraineeTimetableEntry {
  id: string; academic_year: string; term: number; day: string; period_number: number;
  classes: { id: string; class_name: string; class_code: string } | null;
  courses: { id: string; name: string; code: string } | null;
  trainers: { id: string; full_name: string } | null;
  training_rooms: { id: string; name: string; code: string | null } | null;
}
export interface TraineePeriod { day: string; period_number: number; start_time: string; end_time: string; is_break: boolean; label: string | null }

/** Timetable rows for the classes the trainee is actively enrolled in, plus the centre's period times. */
export const useTraineeTimetable = (traineeId: string | undefined, organizationId: string | null | undefined) =>
  useQuery({
    queryKey: ["trainee-timetable", traineeId, organizationId],
    enabled: !!traineeId && !!organizationId,
    queryFn: async () => {
      const enr = await db.from("class_enrollments").select("class_id").eq("trainee_id", traineeId).eq("status", "active");
      if (enr.error) throw enr.error;
      const classIds = (enr.data as { class_id: string }[]).map((e) => e.class_id);
      if (!classIds.length) return { entries: [] as TraineeTimetableEntry[], periods: [] as TraineePeriod[], classCount: 0 };
      const [ent, per] = await Promise.all([
        db.from("timetable_entries")
          .select("id, academic_year, term, day, period_number, classes:class_id(id, class_name, class_code), courses:course_id(id, name, code), trainers:trainer_id(id, full_name), training_rooms:room_id(id, name, code)")
          .in("class_id", classIds),
        db.from("academic_time_structure").select("day, period_number, start_time, end_time, is_break, label").eq("organization_id", organizationId),
      ]);
      if (ent.error) throw ent.error;
      if (per.error) throw per.error;
      return { entries: ent.data as TraineeTimetableEntry[], periods: per.data as TraineePeriod[], classCount: classIds.length };
    },
  });
