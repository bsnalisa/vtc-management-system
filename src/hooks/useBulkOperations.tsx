import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useOrganizationContext } from "@/hooks/useOrganizationContext";

export interface BulkOperation {
  id: string;
  organization_id: string | null;
  operation_type: string;
  status: string;
  total_items: number;
  processed_items: number;
  failed_items: number;
  error_log: any[] | null;
  created_by: string;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

export const useBulkOperations = () => {
  const { organizationId } = useOrganizationContext();

  return useQuery({
    queryKey: ["bulk-operations", organizationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bulk_operations")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      return data as BulkOperation[];
    },
    enabled: !!organizationId,
  });
};

export const useBulkUserRoleAssignment = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { organizationId } = useOrganizationContext();

  return useMutation({
    mutationFn: async ({ userIds, role }: { userIds: string[]; role: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !organizationId) throw new Error("Not authenticated");

      // Create bulk operation record
      const { data: operation, error: opError } = await supabase
        .from("bulk_operations")
        .insert({
          organization_id: organizationId,
          operation_type: "role_assignment",
          total_items: userIds.length,
          created_by: user.id,
          started_at: new Date().toISOString(),
          status: "processing",
        })
        .select()
        .single();

      if (opError) throw opError;

      let processedCount = 0;
      let failedCount = 0;
      const errorLog: any[] = [];

      // Process each user
      for (const userId of userIds) {
        try {
          // Update user role
          const { error } = await supabase
            .from("user_roles")
            .update({ role: role as any })
            .eq("user_id", userId)
            .eq("organization_id", organizationId);

          if (error) throw error;
          processedCount++;
        } catch (err: any) {
          failedCount++;
          errorLog.push({ userId, error: err.message });
        }
      }

      // Update operation status
      await supabase
        .from("bulk_operations")
        .update({
          status: failedCount === 0 ? "completed" : "completed_with_errors",
          processed_items: processedCount,
          failed_items: failedCount,
          error_log: errorLog.length > 0 ? errorLog : null,
          completed_at: new Date().toISOString(),
        })
        .eq("id", operation.id);

      return { processed: processedCount, failed: failedCount, errors: errorLog };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      queryClient.invalidateQueries({ queryKey: ["bulk-operations"] });
      toast({
        title: "Bulk operation completed",
        description: `${result.processed} users updated, ${result.failed} failed`,
      });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });
};

export const useBulkUserDeactivation = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { organizationId } = useOrganizationContext();

  return useMutation({
    mutationFn: async (userIds: string[]) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: { session } } = await supabase.auth.getSession();
      if (!user || !organizationId || !session) throw new Error("Not authenticated");

      // Create bulk operation record
      const { data: operation, error: opError } = await supabase
        .from("bulk_operations")
        .insert({
          organization_id: organizationId,
          operation_type: "user_deactivation",
          total_items: userIds.length,
          created_by: user.id,
          started_at: new Date().toISOString(),
          status: "processing",
        })
        .select()
        .single();

      if (opError) throw opError;

      let processedCount = 0;
      let failedCount = 0;
      const errorLog: any[] = [];

      // Process each user
      for (const userId of userIds) {
        try {
          const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/update-user`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${session.access_token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ userId, active: false }),
          });

          if (!response.ok) throw new Error('Failed to deactivate');
          processedCount++;
        } catch (err: any) {
          failedCount++;
          errorLog.push({ userId, error: err.message });
        }
      }

      // Update operation status
      await supabase
        .from("bulk_operations")
        .update({
          status: failedCount === 0 ? "completed" : "completed_with_errors",
          processed_items: processedCount,
          failed_items: failedCount,
          error_log: errorLog.length > 0 ? errorLog : null,
          completed_at: new Date().toISOString(),
        })
        .eq("id", operation.id);

      return { processed: processedCount, failed: failedCount };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      queryClient.invalidateQueries({ queryKey: ["bulk-operations"] });
      toast({
        title: "Bulk deactivation completed",
        description: `${result.processed} users deactivated`,
      });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });
};
