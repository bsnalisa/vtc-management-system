import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useOrganizationContext } from "@/hooks/useOrganizationContext";

export type FeeCategory = 'tuition' | 'registration' | 'training_grant' | 'hostel' | 'materials' | 'examination' | 'other';

export interface FeeType {
  id: string;
  organization_id: string;
  name: string;
  code: string;
  description: string | null;
  default_amount: number;
  category: FeeCategory;
  is_mandatory: boolean;
  is_recurring: boolean;
  recurring_frequency: 'monthly' | 'quarterly' | 'annually' | null;
  applicable_to: string[];
  active: boolean;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export interface CreateFeeTypeData {
  name: string;
  code: string;
  description?: string;
  default_amount: number;
  category: FeeCategory;
  is_mandatory?: boolean;
  is_recurring?: boolean;
  recurring_frequency?: 'monthly' | 'quarterly' | 'annually' | null;
  applicable_to?: string[];
}

export const useFeeTypes = () => {
  const { organizationId } = useOrganizationContext();

  return useQuery({
    queryKey: ["fee-types", organizationId],
    queryFn: async () => {
      if (!organizationId) return [];
      
      const { data, error } = await supabase
        .from("fee_types")
        .select("*")
        .eq("organization_id", organizationId)
        .order("category", { ascending: true })
        .order("name", { ascending: true });

      if (error) throw error;
      return data as FeeType[];
    },
    enabled: !!organizationId,
  });
};

export const useCreateFeeType = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { organizationId } = useOrganizationContext();

  return useMutation({
    mutationFn: async (feeTypeData: CreateFeeTypeData) => {
      if (!organizationId) throw new Error("No organization");

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("fee_types")
        .insert({
          ...feeTypeData,
          organization_id: organizationId,
          created_by: user.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fee-types"] });
      toast({ title: "Fee type created successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });
};

export const useUpdateFeeType = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...data }: Partial<FeeType> & { id: string }) => {
      const { error } = await supabase
        .from("fee_types")
        .update({ ...data, updated_at: new Date().toISOString() })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fee-types"] });
      toast({ title: "Fee type updated" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });
};

export const useDeleteFeeType = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("fee_types")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fee-types"] });
      toast({ title: "Fee type deleted" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });
};
