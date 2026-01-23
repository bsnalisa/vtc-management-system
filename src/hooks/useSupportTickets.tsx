import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useOrganizationContext } from "./useOrganizationContext";

export interface SupportTicket {
  id: string;
  organization_id: string;
  user_id: string;
  subject: string;
  description: string;
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  category: string | null;
  assigned_to: string | null;
  resolution_notes: string | null;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
}

export interface CreateTicketData {
  subject: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  category?: string;
}

export interface UpdateTicketData {
  status?: 'open' | 'in_progress' | 'resolved' | 'closed';
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  assigned_to?: string;
  resolution_notes?: string;
}

export const useSupportTickets = () => {
  const { organizationId } = useOrganizationContext();

  return useQuery({
    queryKey: ["support-tickets", organizationId],
    queryFn: async () => {
      if (!organizationId) return [];

      const { data, error } = await supabase
        .from("support_tickets")
        .select("*")
        .eq("organization_id", organizationId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as SupportTicket[];
    },
    enabled: !!organizationId,
  });
};

export const useCreateSupportTicket = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { organizationId } = useOrganizationContext();

  return useMutation({
    mutationFn: async (ticketData: CreateTicketData) => {
      if (!organizationId) throw new Error("No organization ID");

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("support_tickets")
        .insert([{
          organization_id: organizationId,
          user_id: user.id,
          ...ticketData,
        }])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["support-tickets"] });
      toast({
        title: "Success",
        description: "Support ticket created successfully",
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

export const useUpdateSupportTicket = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateTicketData }) => {
      const updateData: any = { ...data };
      
      if (data.status === 'resolved' || data.status === 'closed') {
        updateData.resolved_at = new Date().toISOString();
      }

      const { data: result, error } = await supabase
        .from("support_tickets")
        .update(updateData)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["support-tickets"] });
      toast({
        title: "Success",
        description: "Ticket updated successfully",
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
