import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useOrganizationContext } from "./useOrganizationContext";

// Newer than the generated Supabase types, so access untyped.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export interface RplUnitStandard {
  id: string; unit_standard_id: string; unit_standard_title: string; credit_value: number | null; is_mandatory: boolean; level: number;
}
export interface RplCreditMapping {
  id: string; request_id: string; unit_standard_code: string; unit_standard_title: string | null; credits: number;
  decision: "granted" | "not_granted"; evidence_note: string | null; decided_at: string;
}

/** Unit standards that make up a qualification. */
export const useQualificationUnitStandards = (qualificationId: string | null | undefined) =>
  useQuery({
    queryKey: ["qualification-unit-standards", qualificationId], enabled: !!qualificationId,
    queryFn: async () => {
      const { data, error } = await db.from("qualification_unit_standards").select("*")
        .eq("qualification_id", qualificationId).order("unit_standard_id");
      if (error) throw error;
      return data as RplUnitStandard[];
    },
  });

/** Credit decisions for one RPL request. */
export const useRplCreditMappings = (requestId: string | null | undefined) =>
  useQuery({
    queryKey: ["rpl-credit-mappings", requestId], enabled: !!requestId,
    queryFn: async () => {
      const { data, error } = await db.from("rpl_credit_mappings").select("*").eq("request_id", requestId);
      if (error) throw error;
      return data as RplCreditMapping[];
    },
  });

/** Every credit decision in the centre (dashboard figures). */
export const useAllRplCreditMappings = () => {
  const { organizationId } = useOrganizationContext();
  return useQuery({
    queryKey: ["rpl-credit-mappings", "all", organizationId], enabled: !!organizationId,
    queryFn: async () => {
      const { data, error } = await db.from("rpl_credit_mappings").select("id, request_id, credits, decision, decided_at")
        .eq("organization_id", organizationId);
      if (error) throw error;
      return data as Pick<RplCreditMapping, "id" | "request_id" | "credits" | "decision" | "decided_at">[];
    },
  });
};

/** Public applications that nobody has picked up yet. */
export const usePublicRplWaitingCount = () => {
  const { organizationId } = useOrganizationContext();
  return useQuery({
    queryKey: ["public-rpl-applications", "waiting-count", organizationId], enabled: !!organizationId,
    queryFn: async () => {
      const { count, error } = await db.from("public_rpl_applications").select("id", { count: "exact", head: true })
        .eq("organization_id", organizationId).eq("status", "new");
      if (error) throw error;
      return (count ?? 0) as number;
    },
  });
};

export interface CreditRow { unit_standard_code: string; unit_standard_title: string; credits: number; decision: "granted" | "not_granted"; evidence_note: string | null }

/** Save the credit decisions of a request (one row per unit standard, replaced on conflict). */
export const useSaveRplCredits = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ requestId, rows }: { requestId: string; rows: CreditRow[] }) => {
      if (!rows.length) return;
      const payload = rows.map((r) => ({ ...r, request_id: requestId }));
      const { error } = await db.from("rpl_credit_mappings").upsert(payload, { onConflict: "request_id,unit_standard_code" });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rpl-credit-mappings"] });
      toast.success("Credit decisions saved");
    },
    onError: (e: Error) => toast.error(e.message || "Could not save the credit decisions"),
  });
};
