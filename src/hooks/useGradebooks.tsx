import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

// ─── Types ───
export interface Gradebook {
  id: string;
  organization_id: string;
  qualification_id: string;
  trainer_id: string;
  academic_year: string;
  intake_label?: string;
  level: number;
  title: string;
  test_weight: number;
  mock_weight: number;
  is_locked: boolean;
  locked_at?: string;
  status: string;
  submitted_at?: string;
  hot_approved_at?: string;
  ac_approved_at?: string;
  finalised_at?: string;
  submission_opens_at?: string;
  submission_closes_at?: string;
  created_at: string;
  updated_at: string;
}

export interface GradebookComponent {
  id: string;
  gradebook_id: string;
  group_id?: string;
  name: string;
  component_type: string;
  max_marks: number;
  sort_order: number;
}

export interface GradebookComponentGroup {
  id: string;
  gradebook_id: string;
  name: string;
  group_type: string;
  sort_order: number;
}

export interface GradebookMark {
  id: string;
  gradebook_id: string;
  component_id: string;
  trainee_id: string;
  marks_obtained?: number;
  competency_status: string;
  entered_by: string;
  entered_at: string;
}

export interface GradebookFeedback {
  id: string;
  gradebook_id: string;
  component_id: string;
  trainee_id: string;
  feedback_text: string;
  is_final: boolean;
}

// ─── Gradebooks list for current trainer ───
export const useMyGradebooks = () => {
  return useQuery({
    queryKey: ["my-gradebooks"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("gradebooks")
        .select(`
          *,
          qualifications:qualification_id (id, qualification_title, qualification_code, nqf_level),
          trainers:trainer_id (id, full_name, trainer_id)
        `)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });
};

// ─── Single gradebook ───
export const useGradebook = (gradebookId?: string) => {
  return useQuery({
    queryKey: ["gradebook", gradebookId],
    queryFn: async () => {
      if (!gradebookId) return null;
      const { data, error } = await supabase
        .from("gradebooks")
        .select(`
          *,
          qualifications:qualification_id (id, qualification_title, qualification_code, nqf_level),
          trainers:trainer_id (id, full_name, trainer_id)
        `)
        .eq("id", gradebookId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!gradebookId,
  });
};

// ─── Component groups ───
export const useGradebookGroups = (gradebookId?: string) => {
  return useQuery({
    queryKey: ["gradebook-groups", gradebookId],
    queryFn: async () => {
      if (!gradebookId) return [];
      const { data, error } = await supabase
        .from("gradebook_component_groups")
        .select("*")
        .eq("gradebook_id", gradebookId)
        .order("sort_order");
      if (error) throw error;
      return data || [];
    },
    enabled: !!gradebookId,
  });
};

// ─── Components ───
export const useGradebookComponents = (gradebookId?: string) => {
  return useQuery({
    queryKey: ["gradebook-components", gradebookId],
    queryFn: async () => {
      if (!gradebookId) return [];
      const { data, error } = await supabase
        .from("gradebook_components")
        .select(`
          *,
          group:group_id (id, name, group_type)
        `)
        .eq("gradebook_id", gradebookId)
        .order("sort_order");
      if (error) throw error;
      return data || [];
    },
    enabled: !!gradebookId,
  });
};

// ─── Gradebook trainees ───
export const useGradebookTrainees = (gradebookId?: string) => {
  return useQuery({
    queryKey: ["gradebook-trainees", gradebookId],
    queryFn: async () => {
      if (!gradebookId) return [];
      const { data, error } = await supabase
        .from("gradebook_trainees")
        .select(`
          *,
          trainees:trainee_id (id, trainee_id, first_name, last_name, level)
        `)
        .eq("gradebook_id", gradebookId);
      if (error) throw error;
      return data || [];
    },
    enabled: !!gradebookId,
  });
};

// ─── Marks for a gradebook ───
export const useGradebookMarks = (gradebookId?: string) => {
  return useQuery({
    queryKey: ["gradebook-marks", gradebookId],
    queryFn: async () => {
      if (!gradebookId) return [];
      const { data, error } = await supabase
        .from("gradebook_marks")
        .select("*")
        .eq("gradebook_id", gradebookId);
      if (error) throw error;
      return data || [];
    },
    enabled: !!gradebookId,
  });
};

// ─── Feedback for a gradebook ───
export const useGradebookFeedbackList = (gradebookId?: string) => {
  return useQuery({
    queryKey: ["gradebook-feedback", gradebookId],
    queryFn: async () => {
      if (!gradebookId) return [];
      const { data, error } = await supabase
        .from("gradebook_feedback")
        .select("*")
        .eq("gradebook_id", gradebookId);
      if (error) throw error;
      return data || [];
    },
    enabled: !!gradebookId,
  });
};

// ─── CA Scores ───
export const useGradebookCAScores = (gradebookId?: string) => {
  return useQuery({
    queryKey: ["gradebook-ca-scores", gradebookId],
    queryFn: async () => {
      if (!gradebookId) return [];
      const { data, error } = await supabase
        .from("gradebook_ca_scores")
        .select("*")
        .eq("gradebook_id", gradebookId);
      if (error) throw error;
      return data || [];
    },
    enabled: !!gradebookId,
  });
};

// ─── Mutations ───

export const useCreateGradebook = () => {
  const { toast } = useToast();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (gb: Partial<Gradebook>) => {
      const { data, error } = await supabase
        .from("gradebooks")
        .insert([gb as any])
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-gradebooks"] });
      toast({ title: "Gradebook Created", description: "Your new gradebook has been created." });
    },
    onError: (e: Error) => {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    },
  });
};

export const useCreateComponentGroup = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (group: { gradebook_id: string; name: string; group_type: string; sort_order: number }) => {
      const { data, error } = await supabase
        .from("gradebook_component_groups")
        .insert([group])
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["gradebook-groups", vars.gradebook_id] });
    },
  });
};

export const useCreateComponent = () => {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (comp: { gradebook_id: string; group_id?: string; name: string; component_type: string; max_marks: number; sort_order: number }) => {
      const { data, error } = await supabase
        .from("gradebook_components")
        .insert([comp])
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["gradebook-components", vars.gradebook_id] });
      toast({ title: "Component Added" });
    },
    onError: (e: Error) => {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    },
  });
};

export const useDeleteComponent = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, gradebook_id }: { id: string; gradebook_id: string }) => {
      const { error } = await supabase.from("gradebook_components").delete().eq("id", id);
      if (error) throw error;
      return gradebook_id;
    },
    onSuccess: (gbId) => {
      qc.invalidateQueries({ queryKey: ["gradebook-components", gbId] });
    },
  });
};

export const useAddGradebookTrainees = () => {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async ({ gradebook_id, trainee_ids }: { gradebook_id: string; trainee_ids: string[] }) => {
      const rows = trainee_ids.map(tid => ({ gradebook_id, trainee_id: tid }));
      const { error } = await supabase.from("gradebook_trainees").upsert(rows, { onConflict: "gradebook_id,trainee_id" });
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["gradebook-trainees", vars.gradebook_id] });
      toast({ title: "Trainees Added" });
    },
    onError: (e: Error) => {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    },
  });
};

export const useSaveMark = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (mark: { gradebook_id: string; component_id: string; trainee_id: string; marks_obtained?: number; competency_status: string; entered_by: string }) => {
      const { data, error } = await supabase
        .from("gradebook_marks")
        .upsert([{ ...mark, entered_at: new Date().toISOString(), updated_at: new Date().toISOString() }], { onConflict: "component_id,trainee_id" })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["gradebook-marks", data.gradebook_id] });
      qc.invalidateQueries({ queryKey: ["gradebook-ca-scores", data.gradebook_id] });
    },
  });
};

export const useSaveFeedback = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (fb: { gradebook_id: string; component_id: string; trainee_id: string; feedback_text: string; is_final: boolean; written_by: string }) => {
      const { data, error } = await supabase
        .from("gradebook_feedback")
        .upsert([{ ...fb, written_at: new Date().toISOString(), updated_at: new Date().toISOString() }], { onConflict: "component_id,trainee_id" })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["gradebook-feedback", data.gradebook_id] });
    },
  });
};

export const useSubmitGradebook = () => {
  const { toast } = useToast();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (gradebookId: string) => {
      const { data: user } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("gradebooks")
        .update({ status: "submitted", submitted_at: new Date().toISOString(), submitted_by: user.user?.id })
        .eq("id", gradebookId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-gradebooks"] });
      qc.invalidateQueries({ queryKey: ["gradebook"] });
      toast({ title: "Submitted", description: "Gradebook submitted for HoT review." });
    },
    onError: (e: Error) => {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    },
  });
};

// ─── Org-wide gradebook queries for HoT / AC ───
export const useOrgGradebooks = (status?: string) => {
  return useQuery({
    queryKey: ["org-gradebooks", status],
    queryFn: async () => {
      let query = supabase
        .from("gradebooks")
        .select(`
          *,
          qualifications:qualification_id (id, qualification_title, qualification_code, nqf_level),
          trainers:trainer_id (id, full_name, trainer_id)
        `)
        .order("updated_at", { ascending: false });
      if (status) query = query.eq("status", status);
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });
};

// ─── HoT approve / return ───
export const useHoTApproveGradebook = () => {
  const { toast } = useToast();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (gradebookId: string) => {
      const { error } = await supabase
        .from("gradebooks")
        .update({ status: "hot_approved", hot_approved_at: new Date().toISOString() })
        .eq("id", gradebookId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["org-gradebooks"] });
      qc.invalidateQueries({ queryKey: ["gradebook"] });
      toast({ title: "Approved", description: "Gradebook approved. Forwarded to Assessment Coordinator." });
    },
    onError: (e: Error) => {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    },
  });
};

export const useReturnGradebook = () => {
  const { toast } = useToast();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ gradebookId, returnTo }: { gradebookId: string; returnTo: "draft" | "submitted" }) => {
      const updateData: Record<string, any> = { status: returnTo };
      if (returnTo === "draft") {
        updateData.submitted_at = null;
        updateData.submitted_by = null;
      }
      const { error } = await supabase
        .from("gradebooks")
        .update(updateData)
        .eq("id", gradebookId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["org-gradebooks"] });
      qc.invalidateQueries({ queryKey: ["gradebook"] });
      toast({ title: "Returned", description: "Gradebook returned for revision." });
    },
    onError: (e: Error) => {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    },
  });
};

// ─── AC approve / finalise ───
export const useACApproveGradebook = () => {
  const { toast } = useToast();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (gradebookId: string) => {
      const { error } = await supabase
        .from("gradebooks")
        .update({ status: "ac_approved", ac_approved_at: new Date().toISOString() })
        .eq("id", gradebookId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["org-gradebooks"] });
      qc.invalidateQueries({ queryKey: ["gradebook"] });
      toast({ title: "Approved", description: "Gradebook approved by Assessment Coordinator." });
    },
    onError: (e: Error) => {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    },
  });
};

export const useFinaliseGradebook = () => {
  const { toast } = useToast();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (gradebookId: string) => {
      const { error } = await supabase
        .from("gradebooks")
        .update({ status: "finalised", finalised_at: new Date().toISOString() })
        .eq("id", gradebookId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["org-gradebooks"] });
      qc.invalidateQueries({ queryKey: ["gradebook"] });
      toast({ title: "Finalised", description: "Gradebook finalised. Marks are now official." });
    },
    onError: (e: Error) => {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    },
  });
};
