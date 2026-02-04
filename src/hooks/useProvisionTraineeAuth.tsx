import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface ProvisionResult {
  success: boolean;
  user_id?: string;
  email?: string;
  message?: string;
  password_reset_required?: boolean;
}

export const useProvisionTraineeAuth = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      applicationId, 
      traineeId,
      forceProvision = false 
    }: { 
      applicationId?: string; 
      traineeId?: string;
      forceProvision?: boolean;
    }): Promise<ProvisionResult> => {
      if (!applicationId && !traineeId) {
        throw new Error("Either applicationId or traineeId is required");
      }

      const { data, error } = await supabase.functions.invoke('provision-trainee-auth', {
        body: { 
          application_id: applicationId,
          trainee_id: traineeId,
          force_provision: forceProvision
        }
      });

      if (error) {
        throw new Error(error.message || 'Failed to provision trainee account');
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      return data as ProvisionResult;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["trainee_applications"] });
      queryClient.invalidateQueries({ queryKey: ["trainees"] });
      toast({
        title: "Account Provisioned",
        description: data.message || `Trainee account created with email: ${data.email}`,
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
