import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useOrganizationContext } from "./useOrganizationContext";
import type { TrainingMode } from "@/lib/trainingModes";

export interface RegisterKey {
  tradeId: string;
  level: number;
  mode: TrainingMode;
  academicYear: string;
}

export interface AttendanceRegisterRow {
  id: string;
  trade_id: string;
  trainer_id: string;
  level: number;
  training_mode: TrainingMode;
  academic_year: string;
}

export interface SavedAttendance { trainee_id: string; present: boolean | null; remarks: string | null }

const keyOf = (k: RegisterKey | null) => (k ? [k.tradeId, k.level, k.mode, k.academicYear] : null);

/** The register for a trade / level / training mode / academic year, if one has been started. */
export const useAttendanceRegister = (key: RegisterKey | null) => {
  const { organizationId } = useOrganizationContext();
  return useQuery({
    queryKey: ["attendance-register", organizationId, keyOf(key)],
    enabled: !!organizationId && !!key,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("attendance_registers").select("id, trade_id, trainer_id, level, training_mode, academic_year")
        .eq("organization_id", organizationId!).eq("trade_id", key!.tradeId).eq("level", key!.level)
        .eq("training_mode", key!.mode).eq("academic_year", key!.academicYear)
        .order("created_at").limit(1).maybeSingle();
      if (error) throw error;
      return data as AttendanceRegisterRow | null;
    },
  });
};

/** The trainer record of the signed-in user, if they are a trainer. */
export const useMyTrainerId = () => {
  const { organizationId } = useOrganizationContext();
  return useQuery({
    queryKey: ["my-trainer-id", organizationId],
    enabled: !!organizationId,
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data, error } = await supabase.from("trainers").select("id").eq("organization_id", organizationId!).eq("user_id", user.id).maybeSingle();
      if (error) throw error;
      return (data?.id as string | undefined) ?? null;
    },
  });
};

export const useTrainerOptions = () => {
  const { organizationId } = useOrganizationContext();
  return useQuery({
    queryKey: ["trainer-options-attendance", organizationId],
    enabled: !!organizationId,
    queryFn: async () => {
      const { data, error } = await supabase.from("trainers").select("id, full_name").eq("organization_id", organizationId!).eq("active", true).order("full_name");
      if (error) throw error;
      return data;
    },
  });
};

export const useCreateRegister = () => {
  const queryClient = useQueryClient();
  const { organizationId } = useOrganizationContext();
  return useMutation({
    mutationFn: async (v: RegisterKey & { trainerId: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const year = /^\d{4}$/.test(v.academicYear) ? Number(v.academicYear) : new Date().getFullYear();
      const { error } = await supabase.from("attendance_registers").insert({
        organization_id: organizationId!, trade_id: v.tradeId, trainer_id: v.trainerId, level: v.level, training_mode: v.mode,
        academic_year: v.academicYear, start_date: `${year}-01-01`, end_date: `${year}-12-31`, created_by: user!.id,
      });
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["attendance-register"] }); toast.success("Register started"); },
    onError: (e: Error) => toast.error(e.message),
  });
};

export const useAttendanceForDate = (registerId: string | undefined, date: string) =>
  useQuery({
    queryKey: ["attendance-day", registerId, date],
    enabled: !!registerId && !!date,
    queryFn: async () => {
      const { data, error } = await supabase.from("attendance_records").select("trainee_id, present, remarks")
        .eq("register_id", registerId!).eq("attendance_date", date);
      if (error) throw error;
      return data as SavedAttendance[];
    },
  });

export const useSaveAttendance = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (v: { registerId: string; date: string; entries: { traineeId: string; present: boolean; remarks: string }[] }) => {
      if (!v.entries.length) throw new Error("Mark at least one trainee first");
      const { error } = await supabase.from("attendance_records").upsert(
        v.entries.map((e) => ({ register_id: v.registerId, trainee_id: e.traineeId, attendance_date: v.date, present: e.present, remarks: e.remarks.trim() || null })),
        { onConflict: "register_id,trainee_id,attendance_date" },
      );
      if (error) throw error;
      return v.entries.length;
    },
    onSuccess: (n) => {
      queryClient.invalidateQueries({ queryKey: ["attendance-day"] });
      queryClient.invalidateQueries({ queryKey: ["attendance-range"] });
      toast.success(`Attendance saved for ${n} trainee${n === 1 ? "" : "s"}`);
    },
    onError: (e: Error) => toast.error(/row-level security/.test(e.message) ? "You do not have permission to record attendance for this class" : e.message),
  });
};

export const useAttendanceRange = (registerId: string | undefined, from: string, to: string) =>
  useQuery({
    queryKey: ["attendance-range", registerId, from, to],
    enabled: !!registerId,
    queryFn: async () => {
      const { data, error } = await supabase.from("attendance_records").select("trainee_id, attendance_date, present")
        .eq("register_id", registerId!).gte("attendance_date", from).lte("attendance_date", to).limit(20000);
      if (error) throw error;
      return data as { trainee_id: string; attendance_date: string; present: boolean | null }[];
    },
  });
