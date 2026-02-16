import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export type AssessmentStatus = "draft" | "submitted_by_trainer" | "returned_to_trainer" | "approved_by_hot" | "finalised";

export interface AssessmentResult {
  id: string;
  trainee_id: string;
  enrollment_id: string;
  unit_standard_id: string;
  marks_obtained?: number;
  competency_status: "competent" | "not_yet_competent" | "pending";
  assessment_date?: string;
  assessed_by?: string;
  remarks?: string;
  assessment_status: AssessmentStatus;
  submitted_at?: string;
  hot_approved_at?: string;
  hot_approved_by?: string;
  ac_finalised_at?: string;
  ac_finalised_by?: string;
  returned_at?: string;
  return_reason?: string;
}

export const useTraineeResults = (traineeId?: string, enrollmentId?: string) => {
  return useQuery({
    queryKey: ["assessmentResults", traineeId, enrollmentId],
    queryFn: async () => {
      if (!traineeId || !enrollmentId) return [];
      
      const { data, error } = await supabase
        .from("assessment_results")
        .select(`
          *,
          unit_standards:unit_standard_id (
            id,
            unit_no,
            module_title,
            level,
            credit
          )
        `)
        .eq("trainee_id", traineeId)
        .eq("enrollment_id", enrollmentId);

      if (error) throw error;
      return data;
    },
    enabled: !!traineeId && !!enrollmentId,
  });
};

// Fetch results filtered by assessment_status for workflow-aware queries
export const useAssessmentResultsByStatus = (statuses: AssessmentStatus[], organizationId?: string | null) => {
  return useQuery({
    queryKey: ["assessmentResultsByStatus", statuses, organizationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("assessment_results")
        .select(`
          *,
          unit_standards:unit_standard_id (id, unit_no, module_title, level, credit),
          trainees:trainee_id (id, trainee_id, first_name, last_name, organization_id, trades:trade_id (name)),
          trainee_enrollments:enrollment_id (id, academic_year, courses:course_id (name, code, level))
        `)
        .in("assessment_status", statuses)
        .order("updated_at", { ascending: false })
        .limit(500);

      if (error) throw error;
      // Filter by org if provided
      if (organizationId) {
        return (data || []).filter((r: any) => r.trainees?.organization_id === organizationId);
      }
      return data || [];
    },
    enabled: statuses.length > 0,
  });
};

export const useRecordAssessmentResult = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (resultData: Omit<AssessmentResult, "id">) => {
      const { data: user } = await supabase.auth.getUser();
      
      const { data, error } = await supabase
        .from("assessment_results")
        .upsert([{
          ...resultData,
          assessed_by: user.user?.id,
          assessment_date: new Date().toISOString().split('T')[0],
          assessment_status: resultData.assessment_status || 'draft',
        }])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assessmentResults"] });
      queryClient.invalidateQueries({ queryKey: ["assessmentResultsByStatus"] });
      toast({ title: "Success", description: "Assessment result recorded successfully!" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });
};

// Batch submit: change status from draft → submitted_by_trainer
export const useSubmitAssessments = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (resultIds: string[]) => {
      const { error } = await supabase
        .from("assessment_results")
        .update({
          assessment_status: "submitted_by_trainer",
          submitted_at: new Date().toISOString(),
        })
        .in("id", resultIds);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assessmentResults"] });
      queryClient.invalidateQueries({ queryKey: ["assessmentResultsByStatus"] });
      toast({ title: "Submitted", description: "Assessments submitted for review." });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });
};

// HoT approve: submitted_by_trainer → approved_by_hot
export const useApproveAssessments = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (resultIds: string[]) => {
      const { data: user } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("assessment_results")
        .update({
          assessment_status: "approved_by_hot",
          hot_approved_at: new Date().toISOString(),
          hot_approved_by: user.user?.id,
        })
        .in("id", resultIds);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assessmentResults"] });
      queryClient.invalidateQueries({ queryKey: ["assessmentResultsByStatus"] });
      toast({ title: "Approved", description: "Assessments approved and forwarded to Assessment Coordinator." });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });
};

// HoT return: submitted_by_trainer → returned_to_trainer
export const useReturnAssessments = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ resultIds, reason }: { resultIds: string[]; reason: string }) => {
      const { error } = await supabase
        .from("assessment_results")
        .update({
          assessment_status: "returned_to_trainer",
          returned_at: new Date().toISOString(),
          return_reason: reason,
        })
        .in("id", resultIds);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assessmentResults"] });
      queryClient.invalidateQueries({ queryKey: ["assessmentResultsByStatus"] });
      toast({ title: "Returned", description: "Assessments returned to trainer for revision." });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });
};

// AC finalise: approved_by_hot → finalised
export const useFinaliseAssessments = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (resultIds: string[]) => {
      const { data: user } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("assessment_results")
        .update({
          assessment_status: "finalised",
          ac_finalised_at: new Date().toISOString(),
          ac_finalised_by: user.user?.id,
        })
        .in("id", resultIds);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assessmentResults"] });
      queryClient.invalidateQueries({ queryKey: ["assessmentResultsByStatus"] });
      toast({ title: "Finalised", description: "Assessments finalised and now visible to trainees." });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });
};

export const useInitializeAssessmentResults = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      traineeId,
      enrollmentId,
      courseId,
    }: {
      traineeId: string;
      enrollmentId: string;
      courseId: string;
    }) => {
      const { data: courseUnits, error: courseError } = await supabase
        .from("course_unit_standards")
        .select("unit_standard_id")
        .eq("course_id", courseId);

      if (courseError) throw courseError;

      const results = courseUnits.map((unit) => ({
        trainee_id: traineeId,
        enrollment_id: enrollmentId,
        unit_standard_id: unit.unit_standard_id,
        competency_status: "pending" as const,
        assessment_status: "draft" as const,
      }));

      const { error } = await supabase
        .from("assessment_results")
        .insert(results);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assessmentResults"] });
      toast({ title: "Success", description: "Assessment results template created!" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });
};
