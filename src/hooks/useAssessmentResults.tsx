import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

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
        }])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assessmentResults"] });
      toast({
        title: "Success",
        description: "Assessment result recorded successfully!",
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
      // Get course unit standards
      const { data: courseUnits, error: courseError } = await supabase
        .from("course_unit_standards")
        .select("unit_standard_id")
        .eq("course_id", courseId);

      if (courseError) throw courseError;

      // Create pending results for each unit standard
      const results = courseUnits.map((unit) => ({
        trainee_id: traineeId,
        enrollment_id: enrollmentId,
        unit_standard_id: unit.unit_standard_id,
        competency_status: "pending" as const,
      }));

      const { error } = await supabase
        .from("assessment_results")
        .insert(results);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assessmentResults"] });
      toast({
        title: "Success",
        description: "Assessment results template created!",
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
