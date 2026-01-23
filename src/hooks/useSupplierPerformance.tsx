import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useOrganizationContext } from "@/hooks/useOrganizationContext";

export interface SupplierPerformance {
  id: string;
  organization_id: string;
  supplier_id: string;
  evaluation_date: string;
  delivery_rating: number;
  quality_rating: number;
  price_rating: number;
  communication_rating: number;
  overall_rating: number;
  notes: string | null;
  evaluated_by: string;
  created_at: string;
  suppliers?: { name: string };
}

export interface CreatePerformanceData {
  supplier_id: string;
  delivery_rating: number;
  quality_rating: number;
  price_rating: number;
  communication_rating: number;
  notes?: string;
}

export const useSupplierPerformances = (supplierId?: string) => {
  const { organizationId } = useOrganizationContext();

  return useQuery({
    queryKey: ["supplier-performances", organizationId, supplierId],
    queryFn: async () => {
      let query = supabase
        .from("supplier_performance")
        .select(`
          *,
          suppliers (name)
        `)
        .order("evaluation_date", { ascending: false });

      if (supplierId) {
        query = query.eq("supplier_id", supplierId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as SupplierPerformance[];
    },
    enabled: !!organizationId,
  });
};

export const useCreateSupplierPerformance = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { organizationId } = useOrganizationContext();

  return useMutation({
    mutationFn: async (data: CreatePerformanceData) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !organizationId) throw new Error("Not authenticated");

      const { data: performance, error } = await supabase
        .from("supplier_performance")
        .insert({
          organization_id: organizationId,
          supplier_id: data.supplier_id,
          delivery_rating: data.delivery_rating,
          quality_rating: data.quality_rating,
          price_rating: data.price_rating,
          communication_rating: data.communication_rating,
          notes: data.notes,
          evaluated_by: user.id,
        })
        .select()
        .single();

      if (error) throw error;

      // Note: Supplier rating is stored in supplier_performance table

      return performance;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["supplier-performances"] });
      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
      toast({ title: "Performance evaluation recorded" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });
};

export const useSupplierAverageRating = (supplierId: string) => {
  return useQuery({
    queryKey: ["supplier-avg-rating", supplierId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("supplier_performance")
        .select("overall_rating")
        .eq("supplier_id", supplierId);

      if (error) throw error;
      if (!data || data.length === 0) return null;

      return {
        average: data.reduce((sum, r) => sum + Number(r.overall_rating), 0) / data.length,
        count: data.length,
      };
    },
    enabled: !!supplierId,
  });
};
