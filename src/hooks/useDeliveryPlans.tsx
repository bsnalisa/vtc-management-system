import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useOrganizationContext } from "./useOrganizationContext";

// Newer than the generated Supabase types, so access untyped.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export interface DeliveryPlan {
  id: string; class_id: string; title: string; start_date: string; weeks: number;
  status: "draft" | "submitted" | "approved" | "rejected"; review_notes: string | null; created_at: string;
  classes?: { class_name: string; class_code: string } | null;
  trainers?: { full_name: string | null } | null;
}
export interface PlanWeek {
  id: string; plan_id: string; week_no: number; week_start: string; unit_standard_code: string | null;
  topic: string; outcomes: string | null; methods: string | null; resources: string | null;
  assessment_activity: string | null; status: "planned" | "delivered" | "deferred"; delivered_on: string | null; remarks: string | null;
}

export const useDeliveryPlans = () => {
  const { organizationId } = useOrganizationContext();
  return useQuery({
    queryKey: ["delivery-plans", organizationId], enabled: !!organizationId,
    queryFn: async () => {
      const { data, error } = await db.from("delivery_plans").select("*, classes(class_name, class_code), trainers(full_name)")
        .eq("organization_id", organizationId).order("created_at", { ascending: false });
      if (error) throw error;
      return data as DeliveryPlan[];
    },
  });
};

export const usePlanWeeks = (planId: string | undefined) =>
  useQuery({
    queryKey: ["delivery-plan-weeks", planId], enabled: !!planId,
    queryFn: async () => {
      const { data, error } = await db.from("delivery_plan_weeks").select("*").eq("plan_id", planId).order("week_no");
      if (error) throw error;
      return data as PlanWeek[];
    },
  });

export const useClassOptions = () => {
  const { organizationId } = useOrganizationContext();
  return useQuery({
    queryKey: ["class-options", organizationId], enabled: !!organizationId,
    queryFn: async () => {
      const { data, error } = await supabase.from("classes").select("id, class_name, class_code, academic_year, qualification_id")
        .eq("organization_id", organizationId!).eq("active", true).order("class_name");
      if (error) throw error;
      return data;
    },
  });
};

export const useGenerateDeliveryPlan = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (v: { classId: string; start: string; weeks: number; title: string }) => {
      const { data, error } = await db.rpc("generate_delivery_plan", { _class: v.classId, _start: v.start, _weeks: v.weeks, _title: v.title || null });
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["delivery-plans"] }); toast.success("Delivery plan generated"); },
    onError: (e: Error) => toast.error(e.message),
  });
};

export const useUpdateDeliveryPlan = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...patch }: Partial<DeliveryPlan> & { id: string }) => {
      const { error } = await db.from("delivery_plans").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["delivery-plans"] }); toast.success("Plan updated"); },
    onError: (e: Error) => toast.error(e.message),
  });
};

export const useUpdatePlanWeek = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...patch }: Partial<PlanWeek> & { id: string }) => {
      const { error } = await db.from("delivery_plan_weeks").update(patch).eq("id", id).select().single();
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["delivery-plan-weeks"] }),
    // a blocked update (plan awaiting review) matches no row, which .single() reports as a rows error
    onError: (e: Error) => toast.error(/no\) rows|0 rows/.test(e.message) ? "This plan is locked while it is awaiting review" : e.message),
  });
};
