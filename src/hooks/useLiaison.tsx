import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useOrganizationContext } from "./useOrganizationContext";

// Newer than the generated Supabase types, so access untyped.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export const INTERACTION_TYPES = ["call", "email", "visit", "meeting", "event", "other"] as const;
export type InteractionType = (typeof INTERACTION_TYPES)[number];

export interface Partner {
  id: string; name: string; industry: string | null; contact_person: string | null; contact_email: string | null;
  contact_phone: string | null; address: string | null; website: string | null; notes: string | null; active: boolean; rating: number | null;
}
export interface PartnerInteraction {
  id: string; employer_id: string; interaction_type: InteractionType; interaction_date: string; summary: string;
  outcome: string | null; follow_up_date: string | null; follow_up_done: boolean; created_at: string;
  employers?: { name: string } | null;
}
export type PartnerInput = Omit<Partner, "id" | "rating"> & { id?: string };
export interface InteractionInput { employer_id: string; interaction_type: InteractionType; interaction_date: string; summary: string; outcome: string | null; follow_up_date: string | null }

export const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export const usePartners = () => {
  const { organizationId } = useOrganizationContext();
  return useQuery({
    queryKey: ["liaison-partners", organizationId], enabled: !!organizationId,
    queryFn: async () => {
      const { data, error } = await db.from("employers").select("*").eq("organization_id", organizationId).order("name");
      if (error) throw error;
      return data as Partner[];
    },
  });
};

export const usePartnerInteractions = () => {
  const { organizationId } = useOrganizationContext();
  return useQuery({
    queryKey: ["partner-interactions", organizationId], enabled: !!organizationId,
    queryFn: async () => {
      const { data, error } = await db.from("partner_interactions").select("*, employers(name)")
        .eq("organization_id", organizationId).order("interaction_date", { ascending: false }).order("created_at", { ascending: false });
      if (error) throw error;
      return data as PartnerInteraction[];
    },
  });
};

/** Placements per partner (employer_id -> count). */
export const usePartnerPlacementCounts = () => {
  const { organizationId } = useOrganizationContext();
  return useQuery({
    queryKey: ["partner-placement-counts", organizationId], enabled: !!organizationId,
    queryFn: async () => {
      const { data, error } = await db.from("internship_placements").select("employer_id").eq("organization_id", organizationId).not("employer_id", "is", null);
      if (error) throw error;
      const counts: Record<string, number> = {};
      (data as { employer_id: string }[]).forEach((p) => { counts[p.employer_id] = (counts[p.employer_id] ?? 0) + 1; });
      return counts;
    },
  });
};

export const useSavePartner = () => {
  const queryClient = useQueryClient();
  const { organizationId } = useOrganizationContext();
  return useMutation({
    mutationFn: async (v: PartnerInput) => {
      const { id, ...values } = v;
      if (id) {
        const { error } = await db.from("employers").update(values).eq("id", id);
        if (error) throw error;
      } else {
        if (!organizationId) throw new Error("No organization ID");
        const { error } = await db.from("employers").insert([{ ...values, organization_id: organizationId }]);
        if (error) throw error;
      }
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["liaison-partners"] }); queryClient.invalidateQueries({ queryKey: ["employers"] }); toast.success("Partner saved"); },
    onError: (e: Error) => toast.error(e.message || "Could not save the partner"),
  });
};

export const useAddInteraction = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (v: InteractionInput) => {
      const { error } = await db.from("partner_interactions").insert([v]);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["partner-interactions"] }); toast.success("Contact logged"); },
    onError: (e: Error) => toast.error(e.message || "Could not log the contact"),
  });
};

export const useCompleteFollowUp = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from("partner_interactions").update({ follow_up_done: true }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["partner-interactions"] }); toast.success("Follow-up marked done"); },
    onError: (e: Error) => toast.error(e.message || "Could not update the follow-up"),
  });
};
