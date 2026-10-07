import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useOrganizationContext } from "./useOrganizationContext";

// Newer than the generated Supabase types, so access untyped.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export interface LogbookEntry {
  id: string; placement_id: string; trainee_id: string; entry_date: string; hours: number;
  activities: string; skills_learned: string | null; challenges: string | null;
  status: "draft" | "submitted" | "returned" | "supervisor_signed" | "approved";
  reviewer_comment: string | null; supervisor_signed_by: string | null; supervisor_signed_on: string | null;
  trainees?: { first_name: string; last_name: string; trainee_id: string } | null;
}
export interface LogbookPlacement {
  id: string; trainee_id: string; placement_number: string; start_date: string; end_date: string | null;
  status: string; employer_name: string | null; supervisor_name: string | null;
}

export const useMyLogbookPlacements = () =>
  useQuery({
    queryKey: ["my-logbook-placements"],
    queryFn: async () => {
      const { data, error } = await db.rpc("my_logbook_placements");
      if (error) throw error;
      return data as LogbookPlacement[];
    },
  });

export const useLogbookEntries = (placementId: string | undefined) =>
  useQuery({
    queryKey: ["logbook-entries", placementId], enabled: !!placementId,
    queryFn: async () => {
      const { data, error } = await db.from("logbook_entries").select("*").eq("placement_id", placementId).order("entry_date", { ascending: false });
      if (error) throw error;
      return data as LogbookEntry[];
    },
  });

/** Entries awaiting action across the centre (reviewers only; row-level security limits the rest). */
export const useReviewQueue = () => {
  const { organizationId } = useOrganizationContext();
  return useQuery({
    queryKey: ["logbook-review", organizationId], enabled: !!organizationId,
    queryFn: async () => {
      const { data, error } = await db.from("logbook_entries").select("*, trainees(first_name,last_name,trainee_id)")
        .eq("organization_id", organizationId).in("status", ["submitted", "supervisor_signed"]).order("entry_date");
      if (error) throw error;
      return data as LogbookEntry[];
    },
  });
};

export const useSaveLogbookEntry = () => {
  const queryClient = useQueryClient();
  const { organizationId } = useOrganizationContext();
  return useMutation({
    mutationFn: async (e: Partial<LogbookEntry>) => {
      if (e.id) {
        const { id, ...patch } = e;
        const { error } = await db.from("logbook_entries").update(patch).eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await db.from("logbook_entries").insert([{ ...e, organization_id: organizationId }]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["logbook-entries"] });
      queryClient.invalidateQueries({ queryKey: ["logbook-review"] });
      toast.success("Logbook updated");
    },
    onError: (e: Error) => toast.error(
      /duplicate key/.test(e.message) ? "You already have an entry for that date" : e.message),
  });
};

export const useDeleteLogbookDraft = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from("logbook_entries").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["logbook-entries"] }),
    onError: (e: Error) => toast.error(e.message),
  });
};
