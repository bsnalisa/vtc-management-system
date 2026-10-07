import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useOrganizationContext } from "./useOrganizationContext";

// Newer than the generated Supabase types, so access untyped.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export const CALENDAR_EVENT_TYPES = ["term", "holiday", "registration", "exam", "assessment", "graduation", "break", "other"] as const;
export type CalendarEventType = (typeof CALENDAR_EVENT_TYPES)[number];

export interface CalendarEvent {
  id: string; organization_id: string; title: string; event_type: CalendarEventType;
  academic_year: string | null; start_date: string; end_date: string | null; description: string | null;
}
export type CalendarEventInput = Omit<CalendarEvent, "id" | "organization_id"> & { id?: string };

export const useAcademicCalendar = () => {
  const { organizationId } = useOrganizationContext();
  return useQuery({
    queryKey: ["academic-calendar", organizationId], enabled: !!organizationId,
    queryFn: async () => {
      const { data, error } = await db.from("academic_calendar_events").select("*")
        .eq("organization_id", organizationId).order("start_date");
      if (error) throw error;
      return data as CalendarEvent[];
    },
  });
};

export const useSaveCalendarEvent = () => {
  const queryClient = useQueryClient();
  const { organizationId } = useOrganizationContext();
  return useMutation({
    mutationFn: async (e: CalendarEventInput) => {
      if (e.id) {
        const { id, ...patch } = e;
        const { error } = await db.from("academic_calendar_events").update(patch).eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await db.from("academic_calendar_events").insert([{ ...e, organization_id: organizationId }]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["academic-calendar"] });
      toast.success("Calendar updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });
};

export const useDeleteCalendarEvent = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from("academic_calendar_events").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["academic-calendar"] });
      toast.success("Event deleted");
    },
    onError: (e: Error) => toast.error(e.message),
  });
};
