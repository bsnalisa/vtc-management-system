import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface TrainerData {
  full_name: string;
  gender: string;
  phone?: string;
  email?: string;
  designation: string;
  employment_type: string;
  trade_ids: string[];
}

export const useTrainers = () => {
  return useQuery({
    queryKey: ["trainers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trainers")
        .select(`
          *,
          trainer_trades (
            trade_id,
            trades (
              id,
              name,
              code
            )
          )
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });
};

export const useRegisterTrainer = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (trainerData: TrainerData) => {
      // Insert trainer
      const { data: trainer, error: trainerError } = await supabase
        .from("trainers")
        .insert([{
          full_name: trainerData.full_name,
          gender: trainerData.gender as "male" | "female" | "other",
          phone: trainerData.phone,
          email: trainerData.email,
          designation: trainerData.designation,
          employment_type: trainerData.employment_type as "fulltime" | "parttime" | "contract",
          trainer_id: "", // Auto-generated
        }])
        .select()
        .single();

      if (trainerError) throw trainerError;

      // Insert trainer-trade relationships
      const trainerTrades = trainerData.trade_ids.map(trade_id => ({
        trainer_id: trainer.id,
        trade_id,
      }));

      const { error: tradesError } = await supabase
        .from("trainer_trades")
        .insert(trainerTrades);

      if (tradesError) throw tradesError;

      return trainer;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trainers"] });
      toast({
        title: "Success",
        description: "Trainer registered successfully!",
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

export const useUpdateTrainer = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...trainerData }: TrainerData & { id: string }) => {
      // Update trainer
      const { data: trainer, error: trainerError } = await supabase
        .from("trainers")
        .update({
          full_name: trainerData.full_name,
          gender: trainerData.gender as "male" | "female" | "other",
          phone: trainerData.phone,
          email: trainerData.email,
          designation: trainerData.designation,
          employment_type: trainerData.employment_type as "fulltime" | "parttime" | "contract",
        })
        .eq("id", id)
        .select()
        .single();

      if (trainerError) throw trainerError;

      // Delete existing trainer-trade relationships
      const { error: deleteError } = await supabase
        .from("trainer_trades")
        .delete()
        .eq("trainer_id", id);

      if (deleteError) throw deleteError;

      // Insert new trainer-trade relationships
      const trainerTrades = trainerData.trade_ids.map(trade_id => ({
        trainer_id: id,
        trade_id,
      }));

      const { error: tradesError } = await supabase
        .from("trainer_trades")
        .insert(trainerTrades);

      if (tradesError) throw tradesError;

      return trainer;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trainers"] });
      toast({
        title: "Success",
        description: "Trainer updated successfully!",
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

export const useDeleteTrainer = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      // Delete trainer-trade relationships first
      const { error: tradesError } = await supabase
        .from("trainer_trades")
        .delete()
        .eq("trainer_id", id);

      if (tradesError) throw tradesError;

      // Delete trainer
      const { error } = await supabase
        .from("trainers")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trainers"] });
      toast({
        title: "Success",
        description: "Trainer deleted successfully!",
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
