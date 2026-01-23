import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useOrganizationContext } from "@/hooks/useOrganizationContext";

export interface HostelVisitor {
  id: string;
  organization_id: string;
  building_id: string;
  trainee_id: string;
  visitor_name: string;
  visitor_id_number: string | null;
  visitor_phone: string | null;
  relationship: string | null;
  visit_date: string;
  check_in_time: string;
  check_out_time: string | null;
  purpose: string | null;
  approved_by: string | null;
  status: string;
  notes: string | null;
  created_at: string;
  trainees?: { trainee_id: string; first_name: string; last_name: string };
  hostel_buildings?: { building_name: string };
}

export interface CreateVisitorData {
  building_id: string;
  trainee_id: string;
  visitor_name: string;
  visitor_id_number?: string;
  visitor_phone?: string;
  relationship?: string;
  visit_date: string;
  check_in_time: string;
  purpose?: string;
  notes?: string;
}

export const useHostelVisitors = (date?: string) => {
  const { organizationId } = useOrganizationContext();

  return useQuery({
    queryKey: ["hostel-visitors", organizationId, date],
    queryFn: async () => {
      let query = supabase
        .from("hostel_visitors")
        .select(`
          *,
          trainees (trainee_id, first_name, last_name),
          hostel_buildings (building_name)
        `)
        .order("check_in_time", { ascending: false });

      if (date) {
        query = query.eq("visit_date", date);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as HostelVisitor[];
    },
    enabled: !!organizationId,
  });
};

export const useCheckInVisitor = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { organizationId } = useOrganizationContext();

  return useMutation({
    mutationFn: async (data: CreateVisitorData) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !organizationId) throw new Error("Not authenticated");

      const { data: visitor, error } = await supabase
        .from("hostel_visitors")
        .insert({
          organization_id: organizationId,
          ...data,
          approved_by: user.id,
        })
        .select()
        .single();

      if (error) throw error;
      return visitor;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["hostel-visitors"] });
      toast({ title: "Visitor checked in successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });
};

export const useCheckOutVisitor = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (visitorId: string) => {
      const { error } = await supabase
        .from("hostel_visitors")
        .update({
          check_out_time: new Date().toLocaleTimeString('en-US', { hour12: false }),
          status: "checked_out",
        })
        .eq("id", visitorId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["hostel-visitors"] });
      toast({ title: "Visitor checked out" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });
};
