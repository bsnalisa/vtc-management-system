import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useOrganizationContext } from "./useOrganizationContext";

// These tables are newer than the generated Supabase types, so access them untyped.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export type AffairsRecordType =
  | "incident" | "counselling" | "discipline" | "career_guidance" | "health" | "grievance" | "feedback";

export interface AffairsRecord {
  id: string;
  organization_id: string;
  trainee_id: string | null;
  record_type: AffairsRecordType;
  title: string;
  description: string;
  record_date: string;
  severity: "low" | "medium" | "high" | "critical" | null;
  status: "open" | "in_progress" | "resolved" | "closed";
  action_taken: string | null;
  follow_up_date: string | null;
  created_at: string;
  trainees?: { first_name: string; last_name: string; trainee_id: string } | null;
}

export interface ExtracurricularEvent {
  id: string;
  title: string;
  category: string;
  description: string | null;
  location: string | null;
  start_date: string;
  end_date: string | null;
  reminder_days_before: number;
  reminder_sent: boolean;
}

export interface AnonymousSubmission {
  id: string;
  kind: "suggestion" | "trainer_evaluation";
  trainer_id: string | null;
  rating: number | null;
  message: string;
  status: "new" | "reviewed" | "actioned";
  created_at: string;
}

const useMutationWithToast = <T,>(
  fn: (v: T) => Promise<unknown>,
  keys: string[],
  successMessage: string,
) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      keys.forEach((k) => queryClient.invalidateQueries({ queryKey: [k] }));
      toast({ title: "Success", description: successMessage });
    },
    onError: (error: Error) =>
      toast({ title: "Error", description: error.message, variant: "destructive" }),
  });
};

export const useAffairsRecords = (type: AffairsRecordType) => {
  const { organizationId } = useOrganizationContext();
  return useQuery({
    queryKey: ["affairs-records", organizationId, type],
    enabled: !!organizationId,
    queryFn: async () => {
      const { data, error } = await db
        .from("trainee_affairs_records")
        .select("*, trainees(first_name,last_name,trainee_id)")
        .eq("organization_id", organizationId)
        .eq("record_type", type)
        .order("record_date", { ascending: false });
      if (error) throw error;
      return data as AffairsRecord[];
    },
  });
};

export const useCreateAffairsRecord = () => {
  const { organizationId } = useOrganizationContext();
  return useMutationWithToast(
    async (rec: Partial<AffairsRecord>) => {
      if (!organizationId) throw new Error("No organization ID");
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await db
        .from("trainee_affairs_records")
        .insert([{ ...rec, organization_id: organizationId, recorded_by: user?.id }]);
      if (error) throw error;
    },
    ["affairs-records"],
    "Record saved",
  );
};

export const useUpdateAffairsRecord = () =>
  useMutationWithToast(
    async ({ id, ...patch }: Partial<AffairsRecord> & { id: string }) => {
      const { error } = await db.from("trainee_affairs_records").update(patch).eq("id", id);
      if (error) throw error;
    },
    ["affairs-records"],
    "Record updated",
  );

export const useExtracurricularEvents = () => {
  const { organizationId } = useOrganizationContext();
  return useQuery({
    queryKey: ["extracurricular-events", organizationId],
    enabled: !!organizationId,
    queryFn: async () => {
      const { data, error } = await db
        .from("extracurricular_events")
        .select("*")
        .eq("organization_id", organizationId)
        .order("start_date", { ascending: true });
      if (error) throw error;
      return data as ExtracurricularEvent[];
    },
  });
};

export const useCreateExtracurricularEvent = () => {
  const { organizationId } = useOrganizationContext();
  return useMutationWithToast(
    async (ev: Partial<ExtracurricularEvent>) => {
      if (!organizationId) throw new Error("No organization ID");
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await db
        .from("extracurricular_events")
        .insert([{ ...ev, organization_id: organizationId, created_by: user?.id }]);
      if (error) throw error;
    },
    ["extracurricular-events"],
    "Event scheduled",
  );
};

export const useAnonymousSubmissions = () => {
  const { organizationId } = useOrganizationContext();
  return useQuery({
    queryKey: ["anonymous-submissions", organizationId],
    enabled: !!organizationId,
    queryFn: async () => {
      const { data, error } = await db
        .from("anonymous_submissions")
        .select("*")
        .eq("organization_id", organizationId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as AnonymousSubmission[];
    },
  });
};

/** Inserts without any user reference so authorship cannot be traced. */
export const useSubmitAnonymously = () => {
  const { organizationId } = useOrganizationContext();
  return useMutationWithToast(
    async (s: Pick<AnonymousSubmission, "kind" | "message"> & { trainer_id?: string; rating?: number }) => {
      if (!organizationId) throw new Error("No organization ID");
      const { error } = await db
        .from("anonymous_submissions")
        .insert([{ ...s, organization_id: organizationId }]);
      if (error) throw error;
    },
    ["anonymous-submissions"],
    "Submitted anonymously. Thank you.",
  );
};

export const useUpdateAnonymousSubmission = () =>
  useMutationWithToast(
    async ({ id, status }: { id: string; status: AnonymousSubmission["status"] }) => {
      const { error } = await db.from("anonymous_submissions").update({ status }).eq("id", id);
      if (error) throw error;
    },
    ["anonymous-submissions"],
    "Status updated",
  );

/** Sends the reminders that are due. Each event is reminded once; the same function also runs on a schedule. */
export const useSendEventReminders = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { organizationId } = useOrganizationContext();
  return useMutation({
    mutationFn: async () => {
      if (!organizationId) throw new Error("No organization ID");
      const { data, error } = await db.rpc("extracurricular_send_reminders", { _org: organizationId });
      if (error) throw error;
      return data as number;
    },
    onSuccess: (n) => {
      queryClient.invalidateQueries({ queryKey: ["extracurricular-events"] });
      toast({ title: n ? "Reminders sent" : "Nothing to send", description: n ? `Reminders went out for ${n} event${n === 1 ? "" : "s"}.` : "No event is inside its reminder window, or its reminder was already sent." });
    },
    onError: (error: Error) => toast({ title: "Error", description: error.message, variant: "destructive" }),
  });
};
