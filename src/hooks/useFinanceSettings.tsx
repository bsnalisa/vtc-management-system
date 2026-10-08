import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useOrganizationContext } from "./useOrganizationContext";

// Newer than the generated Supabase types, so access untyped.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export interface FinanceSettings {
  auto_draft_invoices: boolean;
  invoice_due_days: number;
}

export const DEFAULT_FINANCE_SETTINGS: FinanceSettings = { auto_draft_invoices: true, invoice_due_days: 30 };

export const useFinanceSettings = () => {
  const { organizationId } = useOrganizationContext();
  return useQuery({
    queryKey: ["finance_settings", organizationId],
    queryFn: async (): Promise<FinanceSettings> => {
      const { data, error } = await db
        .from("finance_settings")
        .select("auto_draft_invoices, invoice_due_days")
        .eq("organization_id", organizationId)
        .maybeSingle();
      if (error) throw error;
      return data ?? DEFAULT_FINANCE_SETTINGS;
    },
    enabled: !!organizationId,
  });
};

export const useSaveFinanceSettings = () => {
  const queryClient = useQueryClient();
  const { organizationId } = useOrganizationContext();
  return useMutation({
    mutationFn: async (settings: FinanceSettings) => {
      if (!organizationId) throw new Error("No organization selected");
      const { error } = await db.from("finance_settings").upsert(
        { organization_id: organizationId, ...settings, updated_at: new Date().toISOString() },
        { onConflict: "organization_id" },
      );
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["finance_settings"] });
      toast.success("Invoice settings saved");
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
};
