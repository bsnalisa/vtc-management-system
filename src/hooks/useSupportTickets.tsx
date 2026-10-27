import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useOrganizationContext } from "./useOrganizationContext";

// The ticket thread and the ticket functions are newer than the generated Supabase types.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export type TicketStatus = "open" | "in_progress" | "resolved" | "closed";
export type EscalationStatus = "none" | "escalated" | "returned" | "resolved";

export interface SupportTicket {
  id: string;
  reference: string | null;
  organization_id: string;
  user_id: string;
  subject: string;
  description: string;
  status: TicketStatus;
  priority: "low" | "medium" | "high" | "urgent";
  category: string | null;
  assigned_to: string | null;
  resolution_notes: string | null;
  escalation_status: EscalationStatus;
  escalated_at: string | null;
  escalated_by: string | null;
  escalation_reason: string | null;
  last_requester_reply_at: string | null;
  last_staff_reply_at: string | null;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
}

export interface TicketMessage {
  id: string;
  ticket_id: string;
  author_id: string | null;
  author_name: string | null;
  author_role: "requester" | "organization_admin" | "super_admin" | null;
  kind: "reply" | "note" | "status" | "assignment" | "escalation" | "escalation_response" | "resolution";
  internal: boolean;
  body: string;
  created_at: string;
}

export interface CreateTicketData {
  subject: string;
  description: string;
  priority: "low" | "medium" | "high" | "urgent";
  category?: string;
}

/** True while the requester's last message is newer than the last staff reply. */
export const isAwaitingResponse = (t: SupportTicket) =>
  (t.status === "open" || t.status === "in_progress") && t.escalation_status !== "escalated" &&
  !!t.last_requester_reply_at && (!t.last_staff_reply_at || t.last_requester_reply_at > t.last_staff_reply_at);

const invalidate = (qc: ReturnType<typeof useQueryClient>) => {
  qc.invalidateQueries({ queryKey: ["support-tickets"] });
  qc.invalidateQueries({ queryKey: ["ticket-messages"] });
  qc.invalidateQueries({ queryKey: ["escalated-tickets"] });
  qc.invalidateQueries({ queryKey: ["it-dashboard"] });
};

export const useSupportTickets = () => {
  const { organizationId } = useOrganizationContext();
  return useQuery({
    queryKey: ["support-tickets", organizationId],
    queryFn: async () => {
      if (!organizationId) return [];
      const { data, error } = await db.from("support_tickets").select("*").eq("organization_id", organizationId).order("created_at", { ascending: false });
      if (error) throw error;
      return data as SupportTicket[];
    },
    enabled: !!organizationId,
  });
};

/** Names for the people on a set of tickets (requesters and assignees). */
export const usePeopleNames = (ids: string[]) => {
  const key = [...new Set(ids.filter(Boolean))].sort();
  return useQuery({
    queryKey: ["people-names", key],
    enabled: key.length > 0,
    queryFn: async () => {
      const { data, error } = await db.from("profiles").select("user_id, full_name, email").in("user_id", key);
      if (error) throw error;
      return Object.fromEntries((data ?? []).map((p: { user_id: string; full_name: string | null; email: string | null }) => [p.user_id, p.full_name || p.email || "Unknown"])) as Record<string, string>;
    },
  });
};

/** The Organization Admins of the centre, who a ticket can be assigned to. */
export const useCentreAdmins = (organizationId: string | null | undefined, enabled = true) =>
  useQuery({
    queryKey: ["centre-admins", organizationId],
    enabled: !!organizationId && enabled,
    queryFn: async () => {
      const { data: roles, error } = await db.from("user_roles").select("user_id").eq("organization_id", organizationId).in("role", ["organization_admin", "admin"]);
      if (error) throw error;
      const ids = [...new Set((roles ?? []).map((r: { user_id: string }) => r.user_id))];
      if (!ids.length) return [] as { user_id: string; name: string }[];
      const { data: profiles, error: pe } = await db.from("profiles").select("user_id, full_name, email").in("user_id", ids);
      if (pe) throw pe;
      return (profiles ?? []).map((p: { user_id: string; full_name: string | null; email: string | null }) => ({ user_id: p.user_id, name: p.full_name || p.email || "Administrator" }));
    },
  });

export const useTicketMessages = (ticketId: string | null) =>
  useQuery({
    queryKey: ["ticket-messages", ticketId],
    enabled: !!ticketId,
    queryFn: async () => {
      const { data, error } = await db.from("support_ticket_messages").select("*").eq("ticket_id", ticketId).order("created_at", { ascending: true });
      if (error) throw error;
      return data as TicketMessage[];
    },
  });

export const useCreateSupportTicket = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { organizationId } = useOrganizationContext();
  return useMutation({
    mutationFn: async (ticketData: CreateTicketData) => {
      if (!organizationId) throw new Error("No organization ID");
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      const { data, error } = await db.from("support_tickets").insert([{ organization_id: organizationId, user_id: user.id, ...ticketData }]).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => { invalidate(queryClient); toast({ title: "Ticket created", description: "Your request was sent to your centre's IT support." }); },
    onError: (error: Error) => toast({ title: "Error", description: error.message, variant: "destructive" }),
  });
};

/** One mutation per ticket function; each runs on the server, which checks who is asking. */
const useTicketRpc = <T,>(fn: string, toArgs: (v: T) => Record<string, unknown>, success: string) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (v: T) => {
      const { error } = await db.rpc(fn, toArgs(v));
      if (error) throw error;
    },
    onSuccess: () => { invalidate(queryClient); toast({ title: success }); },
    onError: (error: Error) => toast({ title: "Could not complete that", description: error.message, variant: "destructive" }),
  });
};

export const useTicketReply = () => useTicketRpc<{ ticket: string; body: string; internal?: boolean }>("support_ticket_add_message", (v) => ({ _ticket: v.ticket, _body: v.body, _internal: !!v.internal }), "Message added");
export const useTicketAssign = () => useTicketRpc<{ ticket: string; assignee: string | null }>("support_ticket_assign", (v) => ({ _ticket: v.ticket, _assignee: v.assignee }), "Assignment updated");
export const useTicketStatus = () => useTicketRpc<{ ticket: string; status: TicketStatus; note?: string }>("support_ticket_set_status", (v) => ({ _ticket: v.ticket, _status: v.status, _note: v.note ?? null }), "Ticket updated");
export const useTicketEscalate = () => useTicketRpc<{ ticket: string; reason: string }>("support_ticket_escalate", (v) => ({ _ticket: v.ticket, _reason: v.reason }), "Escalated to the Super Admin");
export const useTicketSuperAction = () => useTicketRpc<{ ticket: string; action: "return" | "resolve" | "note"; note: string }>("support_ticket_super_action", (v) => ({ _ticket: v.ticket, _action: v.action, _note: v.note }), "Response recorded");

/** Super Admin: escalated tickets from every centre. */
export const useEscalatedTickets = () =>
  useQuery({
    queryKey: ["escalated-tickets"],
    queryFn: async () => {
      const { data, error } = await db.from("support_tickets").select("*, organizations(name)").neq("escalation_status", "none").order("escalated_at", { ascending: false });
      if (error) throw error;
      return data as (SupportTicket & { organizations: { name: string } | null })[];
    },
  });
