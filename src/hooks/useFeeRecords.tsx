import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface PaymentData {
  fee_record_id: string;
  amount: number;
  payment_method: string;
  reference_number?: string;
  notes?: string;
}

export const useFeeRecords = () => {
  return useQuery({
    queryKey: ["fee_records"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fee_records")
        .select(`
          *,
          trainees (
            id,
            trainee_id,
            first_name,
            last_name,
            trades (
              name
            )
          )
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });
};

export const useRecordPayment = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (paymentData: PaymentData) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Insert payment
      const { data: payment, error: paymentError } = await supabase
        .from("payments")
        .insert({
          ...paymentData,
          recorded_by: user.id,
        })
        .select()
        .single();

      if (paymentError) throw paymentError;

      // Update fee record balance
      const { data: feeRecord, error: feeError } = await supabase
        .from("fee_records")
        .select("*")
        .eq("id", paymentData.fee_record_id)
        .single();

      if (feeError) throw feeError;

      const newAmountPaid = (feeRecord.amount_paid || 0) + paymentData.amount;
      const newBalance = feeRecord.total_fee - newAmountPaid;

      const { error: updateError } = await supabase
        .from("fee_records")
        .update({
          amount_paid: newAmountPaid,
          balance: newBalance,
        })
        .eq("id", paymentData.fee_record_id);

      if (updateError) throw updateError;

      return payment;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fee_records"] });
      queryClient.invalidateQueries({ queryKey: ["payments"] });
      toast({
        title: "Success",
        description: "Payment recorded successfully!",
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
