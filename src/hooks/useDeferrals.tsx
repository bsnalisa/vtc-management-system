import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useOrganizationContext } from "./useOrganizationContext";

// Newer than the generated Supabase types, so access untyped.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export type DeferralStatus = "submitted" | "approved" | "rejected" | "cancelled" | "reinstated";

export interface DeferralRequest {
  id: string; organization_id: string; trainee_id: string; reason: string; defer_from: string;
  expected_return: string | null; status: DeferralStatus; decision_notes: string | null;
  decided_at: string | null; created_at: string;
  trainees?: { first_name: string; last_name: string; trainee_id: string } | null;
}

/** Every request in the centre (staff only; row-level security limits the rest). */
export const useDeferralRequests = () => {
  const { organizationId } = useOrganizationContext();
  return useQuery({
    queryKey: ["deferral-requests", organizationId], enabled: !!organizationId,
    queryFn: async () => {
      const { data, error } = await db.from("deferral_requests").select("*, trainees(first_name,last_name,trainee_id)")
        .eq("organization_id", organizationId).order("created_at", { ascending: false });
      if (error) throw error;
      return data as DeferralRequest[];
    },
  });
};

/** The signed-in trainee's own row, used to file requests. */
export const useMyTraineeRecord = () =>
  useQuery({
    queryKey: ["my-trainee-record"],
    queryFn: async () => {
      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!auth.user) return null;
      const { data, error } = await db.from("trainees").select("id, organization_id, status")
        .eq("user_id", auth.user.id).maybeSingle();
      if (error) throw error;
      return data as { id: string; organization_id: string; status: string } | null;
    },
  });

export const useMyDeferralRequests = (traineeId: string | undefined) =>
  useQuery({
    queryKey: ["my-deferral-requests", traineeId], enabled: !!traineeId,
    queryFn: async () => {
      const { data, error } = await db.from("deferral_requests").select("*")
        .eq("trainee_id", traineeId).order("created_at", { ascending: false });
      if (error) throw error;
      return data as DeferralRequest[];
    },
  });

const useInvalidate = () => {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: ["deferral-requests"] });
    queryClient.invalidateQueries({ queryKey: ["my-deferral-requests"] });
    queryClient.invalidateQueries({ queryKey: ["my-trainee-record"] });
    queryClient.invalidateQueries({ queryKey: ["trainees"] });
  };
};

const friendly = (e: Error) =>
  /uq_deferral_one_open|duplicate key/.test(e.message) ? "You already have an open deferral request" : e.message;

export const useSubmitDeferral = () => {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (v: { trainee_id: string; organization_id: string; reason: string; defer_from: string; expected_return: string | null }) => {
      const { error } = await db.from("deferral_requests").insert([{ ...v, status: "submitted" }]);
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast.success("Deferral request submitted"); },
    onError: (e: Error) => toast.error(friendly(e)),
  });
};

export const useWithdrawDeferral = () => {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from("deferral_requests").update({ status: "cancelled" }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast.success("Request withdrawn"); },
    onError: (e: Error) => toast.error(e.message),
  });
};

export const useDecideDeferral = () => {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (v: { id: string; approve: boolean; notes: string }) => {
      const { error } = await db.rpc("decide_deferral", { _id: v.id, _approve: v.approve, _notes: v.notes || null });
      if (error) throw error;
    },
    onSuccess: (_d, v) => { invalidate(); toast.success(v.approve ? "Deferral approved" : "Deferral declined"); },
    onError: (e: Error) => toast.error(e.message),
  });
};

export const useReinstateTrainee = () => {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.rpc("reinstate_deferred_trainee", { _id: id });
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast.success("Deferral ended, trainee is active again"); },
    onError: (e: Error) => toast.error(e.message),
  });
};
