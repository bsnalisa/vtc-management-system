import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useOrganizationContext } from "@/hooks/useOrganizationContext";

export interface ExamTimetableRow {
  id: string;
  organization_id: string;
  qualification_id: string;
  gradebook_id: string | null;
  academic_year: string;
  level: number;
  exam_type: "theory" | "practical";
  subject_name: string;
  exam_date: string;
  start_time: string | null;
  end_time: string | null;
  venue: string | null;
  room_id: string | null;
  invigilator_id: string | null;
  min_theory_ca: number;
  min_practical_avg: number;
  published: boolean;
  published_at: string | null;
  published_by: string | null;
  notes: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  qualifications?: { qualification_title: string; qualification_code: string } | null;
  training_rooms?: { id: string; name: string; code: string } | null;
  invigilators?: { id: string; full_name: string; invigilator_type: string } | null;
  gradebooks?: { id: string; title: string } | null;
}

export const useExamTimetables = (filters?: { academic_year?: string; published?: boolean }) => {
  const { organizationId } = useOrganizationContext();
  return useQuery({
    queryKey: ["exam_timetables", organizationId, filters],
    queryFn: async () => {
      if (!organizationId) return [];
      let q = supabase
        .from("exam_timetables")
        .select(`*,
          qualifications:qualification_id (qualification_title, qualification_code),
          training_rooms:room_id (id, name, code),
          invigilators:invigilator_id (id, full_name, invigilator_type),
          gradebooks:gradebook_id (id, title)
        `)
        .eq("organization_id", organizationId)
        .order("exam_date", { ascending: true });
      if (filters?.academic_year) q = q.eq("academic_year", filters.academic_year);
      if (typeof filters?.published === "boolean") q = q.eq("published", filters.published);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as unknown as ExamTimetableRow[];
    },
    enabled: !!organizationId,
  });
};

export const useSaveExamTimetable = () => {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { organizationId } = useOrganizationContext();

  return useMutation({
    mutationFn: async (payload: Partial<ExamTimetableRow> & { id?: string }) => {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!organizationId || !uid) throw new Error("Not authenticated");

      const row: any = {
        organization_id: organizationId,
        qualification_id: payload.qualification_id,
        gradebook_id: payload.gradebook_id || null,
        academic_year: payload.academic_year,
        level: payload.level ?? 1,
        exam_type: payload.exam_type ?? "theory",
        subject_name: payload.subject_name,
        exam_date: payload.exam_date,
        start_time: payload.start_time || null,
        end_time: payload.end_time || null,
        venue: payload.venue || null,
        room_id: payload.room_id || null,
        invigilator_id: payload.invigilator_id || null,
        min_theory_ca: payload.min_theory_ca ?? 50,
        min_practical_avg: payload.min_practical_avg ?? 60,
        notes: payload.notes || null,
      };

      if (payload.id) {
        const { error } = await supabase.from("exam_timetables").update(row).eq("id", payload.id);
        if (error) throw error;
      } else {
        row.created_by = uid;
        const { error } = await supabase.from("exam_timetables").insert(row);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["exam_timetables"] });
      toast({ title: "Saved", description: "Exam timetable entry saved" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });
};

export const useTogglePublishExam = () => {
  const { toast } = useToast();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, published }: { id: string; published: boolean }) => {
      const { data: userData } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("exam_timetables")
        .update({
          published,
          published_at: published ? new Date().toISOString() : null,
          published_by: published ? userData.user?.id : null,
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["exam_timetables"] });
      toast({ title: v.published ? "Published" : "Unpublished" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });
};

export const useDeleteExamTimetable = () => {
  const { toast } = useToast();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("exam_timetables").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["exam_timetables"] });
      toast({ title: "Deleted" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });
};

// ─── Invigilators ───

export interface InvigilatorRow {
  id: string;
  organization_id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  invigilator_type: "internal" | "external";
  notes: string | null;
  active: boolean;
}

export const useInvigilators = () => {
  const { organizationId } = useOrganizationContext();
  return useQuery({
    queryKey: ["invigilators", organizationId],
    queryFn: async () => {
      if (!organizationId) return [];
      const { data, error } = await supabase
        .from("invigilators")
        .select("*")
        .eq("organization_id", organizationId)
        .order("full_name");
      if (error) throw error;
      return (data || []) as InvigilatorRow[];
    },
    enabled: !!organizationId,
  });
};

export const useSaveInvigilator = () => {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { organizationId } = useOrganizationContext();
  return useMutation({
    mutationFn: async (payload: Partial<InvigilatorRow> & { id?: string }) => {
      if (!organizationId) throw new Error("No organization");
      const row: any = {
        organization_id: organizationId,
        full_name: payload.full_name,
        email: payload.email || null,
        phone: payload.phone || null,
        invigilator_type: payload.invigilator_type ?? "internal",
        notes: payload.notes || null,
        active: payload.active ?? true,
      };
      if (payload.id) {
        const { error } = await supabase.from("invigilators").update(row).eq("id", payload.id);
        if (error) throw error;
      } else {
        const { data: userData } = await supabase.auth.getUser();
        row.created_by = userData.user?.id;
        const { error } = await supabase.from("invigilators").insert(row);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["invigilators"] });
      toast({ title: "Saved" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });
};

export const useDeleteInvigilator = () => {
  const { toast } = useToast();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("invigilators").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["invigilators"] });
      toast({ title: "Deleted" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });
};

// ─── Trainee-facing ───

export const useTraineePublishedExams = (traineeId?: string | null) => {
  return useQuery({
    queryKey: ["trainee-published-exams", traineeId],
    queryFn: async () => {
      if (!traineeId) return [];
      // Find gradebooks trainee is in
      const { data: gbRows } = await supabase
        .from("gradebook_trainees")
        .select("gradebook_id")
        .eq("trainee_id", traineeId);
      const gbIds = (gbRows || []).map((r) => r.gradebook_id);
      if (gbIds.length === 0) return [];

      const { data, error } = await supabase
        .from("exam_timetables")
        .select(`*,
          qualifications:qualification_id (qualification_title, qualification_code),
          training_rooms:room_id (id, name, code),
          invigilators:invigilator_id (id, full_name, invigilator_type)
        `)
        .eq("published", true)
        .in("gradebook_id", gbIds)
        .order("exam_date", { ascending: true });
      if (error) throw error;

      // Attach eligibility per exam
      const withEligibility = await Promise.all(
        (data || []).map(async (exam: any) => {
          if (!exam.gradebook_id) return { ...exam, eligible: false, eligibility: null };
          const { data: elig } = await supabase.rpc("get_trainee_exam_eligibility", {
            _gradebook_id: exam.gradebook_id,
            _trainee_id: traineeId,
          });
          const row = Array.isArray(elig) ? elig[0] : elig;
          const eligible =
            exam.exam_type === "theory"
              ? !!row?.theory_eligible
              : !!row?.practical_eligible;
          return { ...exam, eligible, eligibility: row || null };
        })
      );
      return withEligibility;
    },
    enabled: !!traineeId,
  });
};
