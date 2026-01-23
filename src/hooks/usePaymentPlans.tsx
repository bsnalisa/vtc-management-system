import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useOrganizationContext } from "@/hooks/useOrganizationContext";

export interface PaymentPlan {
  id: string;
  organization_id: string;
  trainee_id: string;
  fee_record_id: string;
  plan_name: string;
  total_amount: number;
  installments: number;
  installment_amount: number;
  start_date: string;
  end_date: string | null;
  status: string;
  notes: string | null;
  created_by: string;
  created_at: string;
  trainees?: { trainee_id: string; first_name: string; last_name: string };
}

export interface CreatePaymentPlanData {
  trainee_id: string;
  fee_record_id: string;
  plan_name: string;
  total_amount: number;
  installments: number;
  start_date: string;
  notes?: string;
}

export const usePaymentPlans = () => {
  const { organizationId } = useOrganizationContext();

  return useQuery({
    queryKey: ["payment-plans", organizationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payment_plans")
        .select(`
          *,
          trainees (trainee_id, first_name, last_name)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as PaymentPlan[];
    },
    enabled: !!organizationId,
  });
};

export const useCreatePaymentPlan = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { organizationId } = useOrganizationContext();

  return useMutation({
    mutationFn: async (data: CreatePaymentPlanData) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !organizationId) throw new Error("Not authenticated");

      const installmentAmount = data.total_amount / data.installments;

      const { data: plan, error } = await supabase
        .from("payment_plans")
        .insert({
          organization_id: organizationId,
          trainee_id: data.trainee_id,
          fee_record_id: data.fee_record_id,
          plan_name: data.plan_name,
          total_amount: data.total_amount,
          installments: data.installments,
          installment_amount: installmentAmount,
          start_date: data.start_date,
          notes: data.notes,
          created_by: user.id,
        })
        .select()
        .single();

      if (error) throw error;

      // Create installments
      const startDate = new Date(data.start_date);
      const installments = Array.from({ length: data.installments }, (_, i) => {
        const dueDate = new Date(startDate);
        dueDate.setMonth(dueDate.getMonth() + i);
        return {
          payment_plan_id: plan.id,
          installment_number: i + 1,
          amount: installmentAmount,
          due_date: dueDate.toISOString().split('T')[0],
        };
      });

      const { error: installError } = await supabase
        .from("payment_plan_installments")
        .insert(installments);

      if (installError) throw installError;

      return plan;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payment-plans"] });
      toast({ title: "Payment plan created successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });
};

export const usePaymentPlanInstallments = (planId: string) => {
  return useQuery({
    queryKey: ["payment-plan-installments", planId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payment_plan_installments")
        .select("*")
        .eq("payment_plan_id", planId)
        .order("installment_number");

      if (error) throw error;
      return data;
    },
    enabled: !!planId,
  });
};
