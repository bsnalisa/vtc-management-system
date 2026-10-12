import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useOrganizationContext } from "./useOrganizationContext";

export interface EntryRequirementData {
  /** Empty for a general rule that applies to every trade */
  trade_id: string | null;
  /** Empty for a rule that applies to every level */
  level: number | null;
  requirement_name: string;
  min_grade?: number;
  min_points?: number;
  english_symbol?: string;
  maths_symbol?: string;
  science_symbol?: string;
  prevocational_symbol?: string;
  requires_previous_level?: boolean;
  previous_level_required?: number;
  mature_age_entry?: boolean;
  mature_min_age?: number;
  mature_min_experience_years?: number;
  additional_requirements?: string;
  required_subjects?: { subject: string; symbol: string }[];
}

export const useEntryRequirements = (tradeId?: string, level?: number) => {
  const { organizationId } = useOrganizationContext();

  return useQuery({
    queryKey: ["entry_requirements", organizationId, tradeId, level],
    queryFn: async () => {
      let query = supabase
        .from("entry_requirements")
        .select(`
          *,
          trades:trade_id (
            id,
            name,
            code
          )
        `)
        .eq("organization_id", organizationId!)
        .eq("active", true)
        .order("trade_id", { nullsFirst: true })
        .order("level");

      if (tradeId) {
        query = query.eq("trade_id", tradeId);
      }
      if (level !== undefined) {
        query = query.eq("level", level);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!organizationId,
  });
};

export const useCreateEntryRequirement = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { organizationId } = useOrganizationContext();

  return useMutation({
    mutationFn: async (data: EntryRequirementData) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      if (!organizationId) throw new Error("No organization selected");

      const { data: result, error } = await supabase
        .from("entry_requirements")
        .insert({
          ...data,
          organization_id: organizationId,
          created_by: user.id,
        })
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["entry_requirements"] });
      toast({
        title: "Success",
        description: "Entry requirement created successfully!",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });
};

export const useUpdateEntryRequirement = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<EntryRequirementData> }) => {
      const { data: result, error } = await supabase
        .from("entry_requirements")
        .update(data)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["entry_requirements"] });
      toast({
        title: "Success",
        description: "Entry requirement updated successfully!",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });
};

export const useSymbolPoints = (organizationOverride?: string) => {
  const { organizationId: ctxOrg } = useOrganizationContext();
  const organizationId = organizationOverride || ctxOrg;

  return useQuery({
    queryKey: ["symbol_points", organizationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("symbol_points")
        .select("*")
        .eq("organization_id", organizationId!)
        .eq("active", true)
        .order("exam_level")
        .order("points", { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!organizationId,
  });
};

// Applicants have no centre of their own, so the centre they are applying to is passed in.
export const useCalculatePoints = (organizationOverride?: string) => {
  const { data: symbolPoints } = useSymbolPoints(organizationOverride);

  const calculatePoints = (subjects: { exam_level: string; symbol: string }[]) => {
    if (!symbolPoints || subjects.length === 0) return 0;

    let totalPoints = 0;
    for (const subject of subjects) {
      const point = symbolPoints.find(
        sp => sp.exam_level === subject.exam_level && sp.symbol === subject.symbol
      );
      totalPoints += point?.points || 0;
    }
    return totalPoints;
  };

  return { calculatePoints, symbolPoints };
};

export interface AdmissionRule {
  id: string;
  trade_id: string | null;
  level: number | null;
  requirement_name: string;
  min_grade: number | null;
  min_points: number | null;
  required_subjects: { subject: string; symbol: string }[] | null;
  english_symbol: string | null;
  maths_symbol: string | null;
  science_symbol: string | null;
  prevocational_symbol: string | null;
  requires_previous_level: boolean | null;
  previous_level_required: number | null;
  mature_age_entry: boolean | null;
  mature_min_age: number | null;
  mature_min_experience_years: number | null;
}

/** The rules that apply to a trade and level: the trade's own rules, plus the centre's general minimums. */
export const useAdmissionRules = (tradeId: string, level: number, organizationOverride?: string) => {
  const { organizationId: ctxOrg } = useOrganizationContext();
  const organizationId = organizationOverride || ctxOrg;

  return useQuery({
    queryKey: ["admission_rules", organizationId, tradeId, level],
    enabled: !!organizationId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("entry_requirements")
        .select("*")
        .eq("organization_id", organizationId!)
        .eq("active", true);
      if (error) throw error;
      const rules = (data ?? []) as unknown as AdmissionRule[];
      const own = rules.filter((r) => r.trade_id === tradeId && (r.level === level || r.level == null));
      return own.length > 0 ? own : rules.filter((r) => r.trade_id == null);
    },
  });
};

export interface RequirementChangeRequest {
  id: string;
  entry_requirement_id: string | null;
  request_type: "create" | "update" | "deactivate";
  proposed_changes: Partial<EntryRequirementData>;
  requested_by: string;
  requested_at: string;
  status: "pending" | "approved" | "rejected";
  review_notes: string | null;
  reviewed_at: string | null;
}

// The change-request functions are newer than the generated Supabase types, so call them untyped.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

/** Approvers change a rule at once; a registration officer's change is sent for approval. */
export const useSaveEntryRequirement = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (v: { type: "create" | "update" | "deactivate"; id?: string; changes?: Partial<EntryRequirementData> }) => {
      const { data, error } = await db.rpc("save_entry_requirement", { _type: v.type, _requirement: v.id ?? null, _changes: v.changes ?? {} });
      if (error) throw error;
      return data as { status: "applied" | "pending"; id: string };
    },
    onSuccess: (r) => {
      queryClient.invalidateQueries({ queryKey: ["entry_requirements"] });
      queryClient.invalidateQueries({ queryKey: ["admission_rules"] });
      queryClient.invalidateQueries({ queryKey: ["requirement_change_requests"] });
      toast({
        title: r.status === "applied" ? "Saved" : "Sent for approval",
        description: r.status === "applied" ? "The entry requirement has been updated." : "The Head of Trainee Support will review this change.",
      });
    },
    onError: (error: Error) => toast({ title: "Could not save", description: error.message, variant: "destructive" }),
  });
};

export const useRequirementChangeRequests = (status: "pending" | "all" = "pending") => {
  const { organizationId } = useOrganizationContext();
  return useQuery({
    queryKey: ["requirement_change_requests", organizationId, status],
    enabled: !!organizationId,
    refetchInterval: 60_000,
    queryFn: async () => {
      let q = db.from("requirement_change_requests").select("*").eq("organization_id", organizationId).order("requested_at", { ascending: false });
      if (status === "pending") q = q.eq("status", "pending");
      else q = q.limit(30);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as RequirementChangeRequest[];
    },
  });
};

export const useReviewRequirementChange = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (v: { id: string; approve: boolean; notes?: string }) => {
      const { error } = await db.rpc("review_requirement_change", { _request: v.id, _approve: v.approve, _notes: v.notes ?? null });
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      queryClient.invalidateQueries({ queryKey: ["entry_requirements"] });
      queryClient.invalidateQueries({ queryKey: ["admission_rules"] });
      queryClient.invalidateQueries({ queryKey: ["requirement_change_requests"] });
      toast({ title: v.approve ? "Change approved" : "Change declined" });
    },
    onError: (error: Error) => toast({ title: "Could not record the decision", description: error.message, variant: "destructive" }),
  });
};
