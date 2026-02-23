import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useOrganizationContext } from "@/hooks/useOrganizationContext";

export interface ClassData {
  trade_id: string;
  qualification_id?: string | null;
  level: number;
  training_mode: string;
  class_code: string;
  class_name: string;
  academic_year: string;
  capacity?: number;
  trainer_id?: string | null;
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
          ),
          qualifications:qualification_id (
            id,
            qualification_title,
            qualification_code,
            nqf_level
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
  const { organizationId } = useOrganizationContext();

  return useMutation({
    mutationFn: async (classData: ClassData) => {
      const payload: any = {
        trade_id: classData.trade_id,
        qualification_id: classData.qualification_id || null,
        level: classData.level,
        training_mode: classData.training_mode as "fulltime" | "bdl" | "shortcourse",
        class_code: classData.class_code,
        class_name: classData.class_name,
        academic_year: classData.academic_year,
        capacity: classData.capacity,
        organization_id: organizationId,
      };
      // Only include trainer_id if it has a value
      if (classData.trainer_id) {
        payload.trainer_id = classData.trainer_id;
      }

      const { data, error } = await supabase
        .from("classes")
        .insert([payload])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["classes"] });
      queryClient.invalidateQueries({ queryKey: ["class_enrollments"] });
      queryClient.invalidateQueries({ queryKey: ["trainer-stats"] });
      toast({ title: "Success", description: "Class created successfully!" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });
};

export const useUpdateClass = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...classData }: ClassData & { id: string }) => {
      const payload: any = {
        trade_id: classData.trade_id,
        qualification_id: classData.qualification_id || null,
        level: classData.level,
        training_mode: classData.training_mode as "fulltime" | "bdl" | "shortcourse",
        class_code: classData.class_code,
        class_name: classData.class_name,
        academic_year: classData.academic_year,
        capacity: classData.capacity,
        trainer_id: classData.trainer_id || null,
      };

      const { data, error } = await supabase
        .from("classes")
        .update(payload)
        .eq("id", id)
        .select()
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["classes"] });
      queryClient.invalidateQueries({ queryKey: ["class_enrollments"] });
      queryClient.invalidateQueries({ queryKey: ["trainer-stats"] });
      toast({ title: "Success", description: "Class updated successfully!" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });
};

export const useDeleteClass = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      // First remove any enrollments for this class
      await supabase
        .from("class_enrollments")
        .delete()
        .eq("class_id", id);

      const { error } = await supabase
        .from("classes")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["classes"] });
      toast({ title: "Success", description: "Class deleted successfully!" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
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
      toast({ title: "Success", description: "Trainee enrolled in class!" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
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
