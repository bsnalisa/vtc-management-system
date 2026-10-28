import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { TemplateDefinition } from "@/components/requisitions/status";

// These functions are newer than the generated Supabase types.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export interface TemplateVersion {
  id: string; version: number; status: string; change_note: string | null; decision_note: string | null; proposed_by: string | null; decided_by: string | null;
  proposed_at: string | null; decided_at: string | null; published_at: string | null; used_by: number; definition: TemplateDefinition;
}
export interface TemplateOverview {
  current: { template_id: string | null; version: number; definition: TemplateDefinition };
  default: TemplateDefinition;
  open: { id: string; version: number; status: "draft" | "pending_confirmation"; definition: TemplateDefinition; change_note: string | null; proposed_by: string | null; proposed_at: string | null; proposed_by_me: boolean } | null;
  history: TemplateVersion[];
  events: { event: string; note: string | null; by: string | null; role: string | null; at: string; template_id: string }[];
  can_edit: boolean; can_confirm: boolean;
}

// The form a staff member fills in: the published version, or the version a requisition was made on
export const useRequisitionTemplate = (orgId: string | null | undefined, requisitionId?: string) =>
  useQuery({
    queryKey: ["requisition-template", orgId, requisitionId ?? "current"],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await db.rpc("requisition_template_current", { _org: orgId, _requisition: requisitionId ?? null });
      if (error) throw error;
      return data as { template_id: string | null; version: number; definition: TemplateDefinition; pinned: boolean };
    },
  });

export const useTemplateOverview = (orgId: string | null | undefined) =>
  useQuery({
    queryKey: ["requisition-template-overview", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await db.rpc("requisition_template_overview", { _org: orgId });
      if (error) throw error;
      return data as TemplateOverview;
    },
  });

export const useTemplateActions = (orgId: string | null | undefined) => {
  const qc = useQueryClient();
  const { toast } = useToast();
  const refresh = () => { qc.invalidateQueries({ queryKey: ["requisition-template-overview"] }); qc.invalidateQueries({ queryKey: ["requisition-template"] }); };
  const fail = (title: string) => (e: Error) => toast({ title, description: e.message, variant: "destructive" });
  const saveDraft = useMutation({
    mutationFn: async (a: { definition: TemplateDefinition; note: string }) => {
      const { data, error } = await db.rpc("requisition_template_save_draft", { _org: orgId, _definition: a.definition, _note: a.note || null });
      if (error) throw error;
      return data as string;
    },
    onSuccess: refresh, onError: fail("The draft was not saved"),
  });
  const submit = useMutation({
    mutationFn: async (id: string) => { const { error } = await db.rpc("requisition_template_submit", { _id: id }); if (error) throw error; },
    onSuccess: refresh, onError: fail("The proposal was not sent"),
  });
  const withdraw = useMutation({
    mutationFn: async (id: string) => { const { error } = await db.rpc("requisition_template_withdraw", { _id: id }); if (error) throw error; },
    onSuccess: refresh, onError: fail("Could not withdraw the proposal"),
  });
  const decide = useMutation({
    mutationFn: async (a: { id: string; approve: boolean; note: string }) => {
      const { data, error } = await db.rpc("requisition_template_decide", { _id: a.id, _approve: a.approve, _note: a.note || null });
      if (error) throw error;
      return data as number;
    },
    onSuccess: refresh, onError: fail("The decision was not recorded"),
  });
  return { saveDraft, submit, withdraw, decide };
};
