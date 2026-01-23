import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface TimetableSlotData {
  class_id: string;
  course_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  room_number?: string;
  academic_year: string;
}

export const useTimetable = (classId?: string) => {
  return useQuery({
    queryKey: ["timetable", classId],
    queryFn: async () => {
      let query = supabase
        .from("timetable_slots")
        .select(`
          *,
          classes:class_id (
            id,
            class_code,
            class_name
          ),
          courses:course_id (
            id,
            code,
            name
          )
        `)
        .eq("active", true)
        .order("day_of_week")
        .order("start_time");

      if (classId) {
        query = query.eq("class_id", classId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });
};

export const useCreateTimetableSlot = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (slotData: TimetableSlotData) => {
      const { data, error } = await supabase
        .from("timetable_slots")
        .insert([slotData])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["timetable"] });
      toast({
        title: "Success",
        description: "Timetable slot created!",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });
};

export const useDeleteTimetableSlot = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (slotId: string) => {
      const { error } = await supabase
        .from("timetable_slots")
        .update({ active: false })
        .eq("id", slotId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["timetable"] });
      toast({
        title: "Success",
        description: "Timetable slot removed!",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });
};
