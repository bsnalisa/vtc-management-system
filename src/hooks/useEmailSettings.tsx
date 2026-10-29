import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

// These functions are newer than the generated Supabase types.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export interface EmailSettings {
  tenant_id: string; client_id: string; sender_address: string; sender_name: string | null; reply_to: string | null; enabled: boolean;
  has_secret: boolean; secret_saved_at: string | null; last_test_at: string | null; last_test_ok: boolean | null; last_test_error: string | null; last_test_to: string | null; updated_at: string;
}
export interface EmailOverview {
  configured: boolean; settings: EmailSettings | null;
  queue: { queued: number; sent: number; failed: number; last_error: string | null };
  events: { event: string; note: string | null; by: string | null; at: string }[];
}
export interface EmailForm { tenant: string; client: string; secret: string; sender: string; senderName: string; replyTo: string; enabled: boolean }

export const useEmailOverview = (orgId: string | null | undefined) =>
  useQuery({
    queryKey: ["email-settings", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await db.rpc("email_settings_get", { _org: orgId });
      if (error) throw error;
      return data as EmailOverview;
    },
  });

export const useEmailActions = (orgId: string | null | undefined) => {
  const qc = useQueryClient();
  const { toast } = useToast();
  const refresh = () => qc.invalidateQueries({ queryKey: ["email-settings", orgId] });
  const fail = (e: Error) => toast({ title: "Not saved", description: e.message, variant: "destructive" });
  return {
    save: useMutation({
      mutationFn: async (f: EmailForm) => {
        const { error } = await db.rpc("email_settings_save", { _org: orgId, _tenant: f.tenant, _client: f.client, _secret: f.secret || null, _sender: f.sender, _sender_name: f.senderName || null, _reply_to: f.replyTo || null, _enabled: f.enabled });
        if (error) throw error;
      },
      onSuccess: () => { refresh(); toast({ title: "Email settings saved" }); }, onError: fail,
    }),
    test: useMutation({
      mutationFn: async () => {
        const { data, error } = await supabase.functions.invoke("send-test-email", { body: { organization_id: orgId } });
        if (error) throw new Error(error.message);
        return data as { ok: boolean; to?: string; error?: string };
      },
      onSuccess: (r) => { refresh(); toast(r.ok ? { title: "Test email sent", description: `Check the inbox of ${r.to}.` } : { title: "Test email failed", description: r.error, variant: "destructive" }); },
      onError: fail,
    }),
    requeue: useMutation({
      mutationFn: async () => { const { data, error } = await db.rpc("email_requeue_failed", { _org: orgId }); if (error) throw error; return data as number; },
      onSuccess: (n) => { refresh(); toast({ title: `${n} message${n === 1 ? "" : "s"} put back in the queue` }); }, onError: fail,
    }),
  };
};
