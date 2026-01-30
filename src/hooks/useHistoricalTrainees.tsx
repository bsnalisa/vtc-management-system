import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useOrganizationContext } from "./useOrganizationContext";

export interface HistoricalTraineeData {
  first_name: string;
  last_name: string;
  national_id: string;
  phone?: string;
  email?: string;
  address?: string;
  trade_id: string;
  level: number;
  academic_year: string;
  training_mode: "fulltime" | "bdl" | "shortcourse";
  archive_notes?: string;
}

export const useHistoricalTrainees = () => {
  const { organizationId } = useOrganizationContext();

  return useQuery({
    queryKey: ["historical-trainees", organizationId],
    queryFn: async () => {
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
        .eq("organization_id", organizationId!)
        .eq("status", "archived")
        .order("academic_year", { ascending: false })
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!organizationId,
  });
};

export const useArchiveTrainee = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ traineeId, notes }: { traineeId: string; notes?: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("trainees")
        .update({
          status: "archived",
          archived_at: new Date().toISOString(),
          archived_by: user.id,
          archive_notes: notes,
        })
        .eq("id", traineeId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trainees"] });
      queryClient.invalidateQueries({ queryKey: ["historical-trainees"] });
      toast({
        title: "Success",
        description: "Trainee archived successfully",
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

export const useCaptureHistoricalTrainee = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { organizationId } = useOrganizationContext();

  return useMutation({
    mutationFn: async (data: HistoricalTraineeData) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      if (!organizationId) throw new Error("No organization selected");

      const { data: result, error } = await supabase
        .from("trainees")
        .insert([{
          first_name: data.first_name,
          last_name: data.last_name,
          national_id: data.national_id,
          phone: data.phone || "",
          email: data.email,
          address: data.address || "",
          trade_id: data.trade_id,
          level: data.level,
          academic_year: data.academic_year,
          training_mode: data.training_mode,
          organization_id: organizationId,
          gender: "other" as const,
          date_of_birth: "1990-01-01",
          status: "archived",
          archived_at: new Date().toISOString(),
          archived_by: user.id,
          archive_notes: data.archive_notes,
          trainee_id: "",
        }])
        .select()
        .single();

      if (error) {
        if (error.code === "23505" && error.message.includes("national_id")) {
          throw new Error("A trainee with this National ID already exists");
        }
        throw error;
      }
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["historical-trainees"] });
      toast({
        title: "Success",
        description: "Historical trainee record captured successfully",
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
