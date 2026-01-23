import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface ClassData {
  trade_id: string;
  level: number;
  training_mode: string;
  class_code: string;
  class_name: string;
  academic_year: string;
  capacity?: number;
  trainer_id?: string;
}

export const useClasses = () => {
  return useQuery({
    queryKey: ["classes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("classes")
        .select(`
          *,
          trades:trade_id (
            id,
            name,
            code
          ),
          trainers:trainer_id (
            id,
            trainer_id,
            full_name
          )
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });
};

export const useCreateClass = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (classData: ClassData) => {
      const { data, error } = await supabase
        .from("classes")
        .insert([{
          ...classData,
          training_mode: classData.training_mode as "fulltime" | "bdl" | "shortcourse",
        }])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["classes"] });
      toast({
        title: "Success",
        description: "Class created successfully!",
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

export const useUpdateClass = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...classData }: ClassData & { id: string }) => {
      const { data, error } = await supabase
        .from("classes")
        .update({
          ...classData,
          training_mode: classData.training_mode as "fulltime" | "bdl" | "shortcourse",
        })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["classes"] });
      toast({
        title: "Success",
        description: "Class updated successfully!",
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

export const useDeleteClass = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("classes")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["classes"] });
      toast({
        title: "Success",
        description: "Class deleted successfully!",
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

export const useEnrollInClass = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ class_id, trainee_id }: { class_id: string; trainee_id: string }) => {
      const { data, error } = await supabase
        .from("class_enrollments")
        .insert([{ class_id, trainee_id }])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["class_enrollments"] });
      toast({
        title: "Success",
        description: "Trainee enrolled in class!",
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

export const useClassEnrollments = (classId?: string) => {
  return useQuery({
    queryKey: ["class_enrollments", classId],
    queryFn: async () => {
      let query = supabase
        .from("class_enrollments")
        .select(`
          *,
          trainees:trainee_id (
            id,
            trainee_id,
            first_name,
            last_name,
            level
          )
        `);

      if (classId) {
        query = query.eq("class_id", classId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!classId,
  });
};
