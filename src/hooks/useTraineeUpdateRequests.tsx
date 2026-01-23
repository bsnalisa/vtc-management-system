import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface TraineeUpdateRequest {
  id: string;
  trainee_id: string;
  requested_by: string;
  request_type: "personal_details" | "enrollment_details";
  old_values: any;
  new_values: any;
  status: "pending" | "approved" | "rejected";
  approver_id?: string;
  approval_notes?: string;
  approved_at?: string;
  created_at: string;
  updated_at: string;
}

export const useTraineeUpdateRequests = (status?: string) => {
  return useQuery({
    queryKey: ["trainee_update_requests", status],
    queryFn: async () => {
      let query = supabase
        .from("trainee_update_requests")
        .select(`
          *,
          trainees:trainee_id (
            id,
            trainee_id,
            first_name,
            last_name,
            trades:trade_id (name)
          )
        `)
        .order("created_at", { ascending: false });

      if (status) {
        query = query.eq("status", status);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data;
    },
  });
};

export const useCreateUpdateRequest = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (requestData: {
      trainee_id: string;
      request_type: "personal_details" | "enrollment_details";
      old_values: any;
      new_values: any;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("trainee_update_requests")
        .insert([{
          ...requestData,
          requested_by: user.id,
          status: "pending"
        }])
        .select()
        .single();

      if (error) throw error;

      // Update trainee has_pending_update flag
      await supabase
        .from("trainees")
        .update({ has_pending_update: true })
        .eq("id", requestData.trainee_id);

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trainee_update_requests"] });
      queryClient.invalidateQueries({ queryKey: ["trainees"] });
      toast({
        title: "Update Request Submitted",
        description: "Your changes have been sent for approval by Head of Trainee Support.",
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

export const useApproveUpdateRequest = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      requestId, 
      approve, 
      notes 
    }: { 
      requestId: string; 
      approve: boolean; 
      notes?: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Get the request details
      const { data: request, error: fetchError } = await supabase
        .from("trainee_update_requests")
        .select("*")
        .eq("id", requestId)
        .single();

      if (fetchError) throw fetchError;

      // Update request status
      const { error: updateError } = await supabase
        .from("trainee_update_requests")
        .update({
          status: approve ? "approved" : "rejected",
          approver_id: user.id,
          approval_notes: notes,
          approved_at: new Date().toISOString()
        })
        .eq("id", requestId);

      if (updateError) throw updateError;

      // If approved, apply changes to trainee record
      if (approve) {
        const updateData = { ...(request.new_values as Record<string, any>), has_pending_update: false };
        const { error: traineeError } = await supabase
          .from("trainees")
          .update(updateData)
          .eq("id", request.trainee_id);

        if (traineeError) throw traineeError;
      } else {
        // If rejected, just clear pending flag
        await supabase
          .from("trainees")
          .update({ has_pending_update: false })
          .eq("id", request.trainee_id);
      }

      return { approve };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["trainee_update_requests"] });
      queryClient.invalidateQueries({ queryKey: ["trainees"] });
      toast({
        title: data.approve ? "Request Approved" : "Request Rejected",
        description: data.approve 
          ? "Changes have been applied to trainee record." 
          : "The update request has been rejected.",
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
