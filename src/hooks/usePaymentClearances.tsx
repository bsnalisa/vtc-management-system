import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useEffect } from "react";

export interface PaymentClearance {
  id: string;
  organization_id: string;
  trainee_id: string | null;
  application_id: string | null;
  clearance_type: string;
  fee_type: string | null;
  amount_required: number;
  amount_paid: number;
  balance: number;
  payment_method: string | null;
  status: string;
  source_dashboard: string | null;
  requested_by: string | null;
  requested_at: string | null;
  cleared_by: string | null;
  cleared_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  trainees?: {
    id: string;
    trainee_id: string;
    first_name: string;
    last_name: string;
    phone: string | null;
    email: string | null;
    trade_id?: string | null;
  } | null;
  trainee_applications?: {
    id: string;
    application_number: string;
    trainee_number: string | null;
    first_name: string;
    last_name: string;
    phone: string | null;
    email: string | null;
    registration_status: string | null;
    trade_id?: string | null;
  } | null;
}

export interface ClearPaymentData {
  clearance_id: string;
  amount: number;
  payment_method: string;
  notes?: string;
}

export const usePaymentClearances = (statusFilter?: string) => {
  const queryClient = useQueryClient();

  // Set up realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel('payment-clearances-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'payment_clearances'
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['payment-clearances'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return useQuery({
    queryKey: ['payment-clearances', statusFilter],
    queryFn: async () => {
      let query = supabase
        .from('payment_clearances')
        .select(`
          *,
          trainees (
            id,
            trainee_id,
            first_name,
            last_name,
            phone,
            email,
            trade_id
          ),
          trainee_applications (
            id,
            application_number,
            trainee_number,
            first_name,
            last_name,
            phone,
            email,
            registration_status,
            trade_id
          )
        `)
        .order('created_at', { ascending: false });

      if (statusFilter && statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as PaymentClearance[];
    },
  });
};

export const usePaymentClearanceStats = () => {
  return useQuery({
    queryKey: ['payment-clearance-stats'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payment_clearances')
        .select('status, amount_required, amount_paid');

      if (error) throw error;

      const stats = {
        pending: 0,
        partial: 0,
        cleared: 0,
        totalPending: 0,
        totalCleared: 0,
        pendingAmount: 0,
        clearedAmount: 0,
      };

      data?.forEach((record) => {
        if (record.status === 'pending') {
          stats.pending++;
          stats.totalPending++;
          stats.pendingAmount += Number(record.amount_required) - Number(record.amount_paid);
        } else if (record.status === 'partial') {
          stats.partial++;
          stats.totalPending++;
          stats.pendingAmount += Number(record.amount_required) - Number(record.amount_paid);
        } else if (record.status === 'cleared') {
          stats.cleared++;
          stats.totalCleared++;
          stats.clearedAmount += Number(record.amount_paid);
        }
      });

      return stats;
    },
  });
};

export const useClearPayment = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: ClearPaymentData) => {
      // Call the database function to clear payment
      const { data: result, error } = await supabase.rpc('clear_payment', {
        _clearance_id: data.clearance_id,
        _amount: data.amount,
        _payment_method: data.payment_method,
        _notes: data.notes || null,
      });

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payment-clearances'] });
      queryClient.invalidateQueries({ queryKey: ['payment-clearance-stats'] });
      queryClient.invalidateQueries({ queryKey: ['trainee-applications'] });
      queryClient.invalidateQueries({ queryKey: ['application-stats'] });
      toast({
        title: "Payment Cleared! 🎉",
        description: "The payment has been processed and the trainee notified.",
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

export const useCreatePaymentClearance = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      trainee_id?: string;
      application_id?: string;
      clearance_type: string;
      fee_type?: string;
      amount_required: number;
      source_dashboard?: string;
      notes?: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Get user's organization
      const { data: userRole } = await supabase
        .from('user_roles')
        .select('organization_id')
        .eq('user_id', user.id)
        .single();

      if (!userRole?.organization_id) throw new Error("Organization not found");

      const { data: result, error } = await supabase
        .from('payment_clearances')
        .insert({
          organization_id: userRole.organization_id,
          trainee_id: data.trainee_id || null,
          application_id: data.application_id || null,
          clearance_type: data.clearance_type,
          fee_type: data.fee_type || 'registration',
          amount_required: data.amount_required,
          amount_paid: 0,
          balance: data.amount_required,
          status: 'pending',
          source_dashboard: data.source_dashboard,
          requested_by: user.id,
          requested_at: new Date().toISOString(),
          notes: data.notes,
        })
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payment-clearances'] });
      queryClient.invalidateQueries({ queryKey: ['payment-clearance-stats'] });
      toast({
        title: "Clearance Request Created",
        description: "Payment clearance request sent to the debtor officer.",
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
