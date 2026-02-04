import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export type ProvisioningStatus = 'not_started' | 'auto_provisioned' | 'manually_provisioned' | 'failed';
export type TriggerType = 'auto' | 'manual' | 'bulk';

interface ProvisionResult {
  success: boolean;
  user_id?: string;
  email?: string;
  message: string;
  provisioning_status: ProvisioningStatus;
  error?: string;
}

interface ProvisionParams {
  traineeId?: string;
  applicationId?: string;
  triggerType?: TriggerType;
  forceProvision?: boolean;
}

export const useProvisionTraineeAuth = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: ProvisionParams): Promise<ProvisionResult> => {
      const { data, error } = await supabase.functions.invoke('provision-trainee-auth', {
        body: {
          trainee_id: params.traineeId,
          application_id: params.applicationId,
          trigger_type: params.triggerType || 'manual',
          force_provision: params.forceProvision,
        }
      });

      if (error) {
        throw new Error(error.message || 'Failed to provision trainee account');
      }

      if (!data.success) {
        throw new Error(data.error || 'Provisioning failed');
      }

      return data as ProvisionResult;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["trainee_applications"] });
      queryClient.invalidateQueries({ queryKey: ["trainees"] });
      queryClient.invalidateQueries({ queryKey: ["provisioning_logs"] });
      
      toast({
        title: "Account Provisioned 🎉",
        description: result.message || `Account created for ${result.email}`,
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

// Hook for checking provisioning eligibility
export const canProvisionAccount = (application: {
  qualification_status: string;
  account_provisioning_status?: string | null;
  trainee_number?: string | null;
  system_email?: string | null;
  user_id?: string | null;
}): { canProvision: boolean; reason?: string } => {
  // Already has an account
  if (application.user_id) {
    return { canProvision: false, reason: 'Account already exists' };
  }

  // Check qualification status
  if (application.qualification_status !== 'provisionally_qualified') {
    return { canProvision: false, reason: 'Not yet qualified' };
  }

  // Check provisioning status - allow retry for failed
  const provStatus = application.account_provisioning_status;
  if (provStatus === 'auto_provisioned' || provStatus === 'manually_provisioned') {
    return { canProvision: false, reason: 'Already provisioned' };
  }

  // Check required fields
  if (!application.trainee_number) {
    return { canProvision: false, reason: 'Missing trainee number' };
  }

  if (!application.system_email) {
    return { canProvision: false, reason: 'Missing system email' };
  }

  // Can provision (including retry for 'failed' or 'not_started')
  return { canProvision: true };
};

// Helper to get display status
export const getProvisioningStatusDisplay = (
  status: ProvisioningStatus | string | null | undefined,
  hasUserId: boolean
): {
  label: string;
  variant: 'default' | 'secondary' | 'destructive' | 'outline';
  color: string;
} => {
  // If user_id exists, account is created regardless of status field
  if (hasUserId) {
    return { label: 'Created', variant: 'default', color: 'text-green-600' };
  }
  
  switch (status) {
    case 'auto_provisioned':
      return { label: 'Auto Created', variant: 'secondary', color: 'text-green-600' };
    case 'manually_provisioned':
      return { label: 'Manually Created', variant: 'secondary', color: 'text-blue-600' };
    case 'failed':
      return { label: 'Failed', variant: 'destructive', color: 'text-red-600' };
    case 'not_started':
    default:
      return { label: 'Not Created', variant: 'outline', color: 'text-muted-foreground' };
  }
};