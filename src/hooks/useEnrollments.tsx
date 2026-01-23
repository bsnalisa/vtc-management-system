import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface Enrollment {
  id: string;
  trainee_id: string;
  course_id: string;
  enrollment_date: string;
  status: "active" | "completed" | "withdrawn" | "suspended";
  academic_year: string;
}

export const useTraineeEnrollments = (traineeId?: string) => {
  return useQuery({
    queryKey: ["traineeEnrollments", traineeId],
    queryFn: async () => {
      if (!traineeId) return [];
      
      const { data, error } = await supabase
        .from("trainee_enrollments")
        .select(`
          *,
          courses:course_id (
            id,
            name,
            code,
            level
          )
        `)
        .eq("trainee_id", traineeId)
        .order("enrollment_date", { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!traineeId,
  });
};

export const useCheckEnrollmentEligibility = () => {
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      traineeId,
      trainingMode,
    }: {
      traineeId: string;
      trainingMode: "fulltime" | "bdl" | "shortcourse";
    }) => {
      const { data, error } = await supabase.rpc("can_trainee_enroll", {
        _trainee_id: traineeId,
        _training_mode: trainingMode as any,
      });

      if (error) throw error;
      return data as boolean;
    },
    onError: (error: Error) => {
      toast({
        title: "Error checking eligibility",
        description: error.message,
        variant: "destructive",
      });
    },
  });
};

export const useEnrollTrainee = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (enrollmentData: Omit<Enrollment, "id">) => {
      const { data, error } = await supabase
        .from("trainee_enrollments")
        .insert([enrollmentData])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["traineeEnrollments"] });
      toast({
        title: "Success",
        description: "Trainee enrolled successfully!",
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

export const useUpdateEnrollmentStatus = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      enrollmentId,
      status,
    }: {
      enrollmentId: string;
      status: "active" | "completed" | "withdrawn" | "suspended";
    }) => {
      const { data, error } = await supabase
        .from("trainee_enrollments")
        .update({ status })
        .eq("id", enrollmentId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["traineeEnrollments"] });
      toast({
        title: "Success",
        description: "Enrollment status updated successfully!",
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
