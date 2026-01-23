import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export const useTraineeDetail = (traineeId?: string) => {
  return useQuery({
    queryKey: ["trainee", traineeId],
    queryFn: async () => {
      if (!traineeId) return null;

      const { data, error } = await supabase
        .from("trainees")
        .select(`
          *,
          trades:trade_id (
            id,
            name,
            code
          )
        `)
        .eq("id", traineeId)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!traineeId,
  });
};

export const useUpdateTraineePersonalDetails = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      traineeId, 
      updates 
    }: { 
      traineeId: string; 
      updates: any;
    }) => {
      const { data, error } = await supabase
        .from("trainees")
        .update(updates)
        .eq("id", traineeId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trainee"] });
      queryClient.invalidateQueries({ queryKey: ["trainees"] });
      toast({
        title: "Success",
        description: "Personal details updated successfully!",
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
