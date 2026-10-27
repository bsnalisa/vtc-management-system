import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// These functions are newer than the generated Supabase types.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export interface AccountHelp { name: string | null; email: string; roles: string; reason: "failed_logins" | "deactivated" | "never_signed_in"; detail: string }
export interface AccountOverview { total: number; never_signed_in: number; deactivated: number; failed_logins: number; needs_help: AccountHelp[] }
export interface SystemCounts { messages_waiting: number; messages_failed_7d: number; account_setup_failures_14d: number; modules_enabled: number }

export interface ItDashboard {
  tickets: { open: number; in_progress: number; awaiting_response: number; assigned_to_me: number; escalated: number; returned: number; resolved_14d: number; unassigned: number };
  queue: { id: string; reference: string | null; subject: string; priority: string; status: string; escalation_status: string; created_at: string; requester: string | null; assignee: string | null; mine: boolean; awaiting_response: boolean }[];
  recently_resolved: { id: string; reference: string | null; subject: string; resolved_at: string | null; escalated: boolean }[];
  accounts: AccountOverview;
  system: SystemCounts;
  activity: { at: string; actor: string | null; action: string; summary: string | null }[];
}

export interface SystemStatus {
  counts: SystemCounts;
  waiting_messages: { channel: string; recipient: string; subject: string | null; created_at: string; attempts: number }[];
  failed_messages: { channel: string; recipient: string; subject: string | null; error: string | null; created_at: string; attempts: number }[];
  account_setup_failures: { email: string | null; trigger: string | null; error: string | null; created_at: string }[];
  accounts: AccountOverview;
}

/** Real figures for the centre's IT administrator, computed on the server for their own centre. */
export const useItDashboard = () =>
  useQuery({
    queryKey: ["it-dashboard"],
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await db.rpc("it_dashboard");
      if (error) throw error;
      return data as ItDashboard;
    },
  });

export const useItSystemStatus = () =>
  useQuery({
    queryKey: ["it-system-status"],
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await db.rpc("it_system_status");
      if (error) throw error;
      return data as SystemStatus;
    },
  });
