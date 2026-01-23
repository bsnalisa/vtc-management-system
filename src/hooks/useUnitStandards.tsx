import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface UnitStandard {
  id: string;
  unit_no: string;
  module_title: string;
  level: number;
  credit: number;
  active: boolean;
}

export const useUnitStandards = () => {
  return useQuery({
    queryKey: ["unitStandards"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("unit_standards")
        .select("*")
        .eq("active", true)
        .order("unit_no");

      if (error) throw error;
      return data as UnitStandard[];
    },
  });
};

export const useCourseUnitStandards = (courseId?: string) => {
  return useQuery({
    queryKey: ["courseUnitStandards", courseId],
    queryFn: async () => {
      if (!courseId) return [];
      
      const { data, error } = await supabase
        .from("course_unit_standards")
        .select(`
          id,
          unit_standards:unit_standard_id (
            id,
            unit_no,
            module_title,
            level,
            credit
          )
        `)
        .eq("course_id", courseId);

      if (error) throw error;
      return data;
    },
    enabled: !!courseId,
  });
};

export const useAddUnitStandard = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: Omit<UnitStandard, "id" | "active">) => {
      const { data: result, error } = await supabase
        .from("unit_standards")
        .insert([data])
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["unitStandards"] });
      toast({
        title: "Success",
        description: "Unit standard added successfully!",
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

export const useLinkUnitStandardToCourse = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      courseId,
      unitStandardId,
    }: {
      courseId: string;
      unitStandardId: string;
    }) => {
      const { data, error } = await supabase
        .from("course_unit_standards")
        .insert([{ course_id: courseId, unit_standard_id: unitStandardId }])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["courseUnitStandards"] });
      toast({
        title: "Success",
        description: "Unit standard linked to course successfully!",
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
