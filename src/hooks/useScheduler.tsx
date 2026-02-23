import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface TimePeriodRow {
  id: string;
  organization_id: string;
  day: string;
  period_number: number;
  start_time: string;
  end_time: string;
  is_break: boolean;
  label: string | null;
}

export const useTimeStructure = (orgId?: string) => {
  return useQuery({
    queryKey: ["academic_time_structure", orgId],
    queryFn: async () => {
      let query = supabase
        .from("academic_time_structure")
        .select("*")
        .order("period_number");
      if (orgId) query = query.eq("organization_id", orgId);
      const { data, error } = await query;
      if (error) throw error;
      return data as TimePeriodRow[];
    },
    enabled: !!orgId,
  });
};

export const useSeedDefaultPeriods = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (orgId: string) => {
      // Check if periods already exist
      const { data: existing } = await supabase
        .from("academic_time_structure")
        .select("id")
        .eq("organization_id", orgId)
        .limit(1);

      if (existing && existing.length > 0) return;

      const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
      const periods = [
        { period_number: 1, start_time: '07:30', end_time: '08:15', is_break: false, label: 'Period 1' },
        { period_number: 2, start_time: '08:15', end_time: '09:00', is_break: false, label: 'Period 2' },
        { period_number: 3, start_time: '09:00', end_time: '09:45', is_break: false, label: 'Period 3' },
        { period_number: 4, start_time: '09:45', end_time: '10:00', is_break: true, label: 'Break' },
        { period_number: 5, start_time: '10:00', end_time: '10:45', is_break: false, label: 'Period 4' },
        { period_number: 6, start_time: '10:45', end_time: '11:30', is_break: false, label: 'Period 5' },
        { period_number: 7, start_time: '11:30', end_time: '12:15', is_break: false, label: 'Period 6' },
        { period_number: 8, start_time: '12:15', end_time: '13:00', is_break: true, label: 'Lunch' },
        { period_number: 9, start_time: '13:00', end_time: '13:45', is_break: false, label: 'Period 7' },
        { period_number: 10, start_time: '13:45', end_time: '14:30', is_break: false, label: 'Period 8' },
      ];

      const rows = days.flatMap(day =>
        periods.map(p => ({
          organization_id: orgId,
          day,
          ...p,
        }))
      );

      const { error } = await supabase.from("academic_time_structure").insert(rows);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["academic_time_structure"] });
      toast({ title: "Success", description: "Default period structure created" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });
};

export const useTimetableEntries = (academicYear?: string, term?: number) => {
  return useQuery({
    queryKey: ["timetable_entries", academicYear, term],
    queryFn: async () => {
      let query = supabase
        .from("timetable_entries")
        .select(`
          *,
          classes:class_id (id, class_name, class_code, capacity),
          courses:course_id (id, name, code),
          trainers:trainer_id (id, full_name),
          training_rooms:room_id (id, name, code, room_type, capacity)
        `);
      if (academicYear) query = query.eq("academic_year", academicYear);
      if (term !== undefined) query = query.eq("term", term);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!academicYear,
  });
};

export const useGenerationRuns = () => {
  return useQuery({
    queryKey: ["timetable_generation_runs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("timetable_generation_runs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data;
    },
  });
};

export const useSaveTimetable = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      entries,
      runMeta,
    }: {
      entries: Array<{
        organization_id: string;
        academic_year: string;
        term: number;
        class_id: string;
        course_id: string;
        trainer_id: string;
        room_id: string;
        day: string;
        period_number: number;
        is_locked: boolean;
        lock_type?: string;
        generation_run_id: string;
        soft_penalty_score: number;
      }>;
      runMeta: {
        id: string;
        organization_id: string;
        academic_year: string;
        term: number;
        status: string;
        total_lessons: number;
        placed_lessons: number;
        failed_lessons: number;
        global_penalty_score: number;
        conflict_report: any;
        created_by: string;
        started_at: string;
        completed_at: string;
      };
    }) => {
      // Delete existing non-locked entries for this year/term
      await supabase
        .from("timetable_entries")
        .delete()
        .eq("academic_year", runMeta.academic_year)
        .eq("term", runMeta.term)
        .eq("is_locked", false);

      // Insert generation run
      const { error: runError } = await supabase
        .from("timetable_generation_runs")
        .insert([runMeta]);
      if (runError) throw runError;

      // Batch insert entries
      if (entries.length > 0) {
        const { error } = await supabase
          .from("timetable_entries")
          .insert(entries);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["timetable_entries"] });
      queryClient.invalidateQueries({ queryKey: ["timetable_generation_runs"] });
      toast({ title: "Success", description: "Timetable saved to database" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });
};

export const useToggleLock = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, isLocked, lockType }: { id: string; isLocked: boolean; lockType?: string }) => {
      const { error } = await supabase
        .from("timetable_entries")
        .update({
          is_locked: isLocked,
          lock_type: isLocked ? lockType || 'full' : null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["timetable_entries"] });
      toast({ title: "Lock updated" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });
};
