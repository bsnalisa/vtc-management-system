import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface TraineeAuthInfo {
  id: string;
  trainee_id: string;
  first_name: string;
  last_name: string;
  system_email: string | null;
  user_id: string | null;
  organization_id: string | null;
  password_reset_required: boolean | null;
}

export const useTraineeAuthInfo = (traineeId?: string) => {
  return useQuery({
    queryKey: ["trainee-auth-info", traineeId],
    queryFn: async () => {
      if (!traineeId) return null;

      const { data, error } = await supabase
        .from("trainees")
        .select(`
          id,
          trainee_id,
          first_name,
          last_name,
          system_email,
          user_id,
          organization_id,
          password_reset_required
        `)
        .eq("id", traineeId)
        .single();

      if (error) throw error;
      return data as TraineeAuthInfo;
    },
    enabled: !!traineeId,
  });
};

export const useProvisionTraineeAuth = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      trainee_id, 
      application_id 
    }: { 
      trainee_id?: string; 
      application_id?: string 
    }) => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error("Not authenticated");
      }

      const response = await supabase.functions.invoke('provision-trainee-auth', {
        body: { trainee_id, application_id }
      });

      if (response.error) {
        throw new Error(response.error.message || 'Failed to provision trainee account');
      }

      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["trainee-auth-info"] });
      queryClient.invalidateQueries({ queryKey: ["trainees"] });
      queryClient.invalidateQueries({ queryKey: ["trainee-applications"] });
      
      toast({
        title: "Account Provisioned",
        description: data.message || "Trainee account has been created successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Provisioning Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });
};

export const useCheckPasswordResetRequired = () => {
  return useQuery({
    queryKey: ["password-reset-required"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) return false;

      // Check user metadata first
      if (user.user_metadata?.password_reset_required) {
        return true;
      }

      // Check trainee record
      const { data } = await supabase
        .from("trainees")
        .select("password_reset_required")
        .eq("user_id", user.id)
        .maybeSingle();

      return data?.password_reset_required === true;
    },
  });
};