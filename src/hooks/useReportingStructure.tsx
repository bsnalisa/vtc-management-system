import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useOrganizationContext } from "@/hooks/useOrganizationContext";

// These functions are newer than the generated Supabase types.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export interface ChartPerson {
  user_id: string; name: string; roles: string[]; active: boolean; protected: boolean;
  supervisors: { user_id: string; name: string; active: boolean }[]; source: "named" | "role"; named_until: string | null;
  scheduled: { supervisor: string; from: string; to: string | null }[];
}
export interface OrgChart { people: ChartPerson[]; lines: { role: string; supervisor_role: string }[]; protected_roles: string[] }
export interface Gap { kind: string; message: string; user_id?: string; name?: string; role?: string }
export interface ChangeRequest {
  id: string; organization_id: string; centre: string; kind: "line" | "supervisor"; status: string; subject: string; subject_roles: string[] | null;
  current: string | null; proposed: string | null; effective_from: string | null; effective_to: string | null; note: string | null;
  requested_by: string | null; requested_at: string; decided_by: string | null; decided_at: string | null; decision_note: string | null;
}
export interface ReportingEvent { event: string; subject: string | null; details: Record<string, unknown>; by: string | null; role: string | null; at: string }
export interface Preview {
  problem: string | null; needs_super_admin: boolean; current: { user_id: string; name: string }[]; direct_reports: string[];
  pending_approvals: { instance_id: string; reference: string; title: string; task_id: string; step: string; approvers: { user_id: string; name: string }[] }[];
}
export interface ChangeResult { status: "applied" | "pending_confirmation"; request_id?: string }

export const useOrgChart = () => {
  const { organizationId } = useOrganizationContext();
  return useQuery({ queryKey: ["reporting", "chart", organizationId], enabled: !!organizationId, queryFn: async () => {
    const { data, error } = await db.rpc("reporting_org_chart", { _org: organizationId }); if (error) throw error; return data as OrgChart;
  } });
};
export const useReportingGaps = () => {
  const { organizationId } = useOrganizationContext();
  return useQuery({ queryKey: ["reporting", "gaps", organizationId], enabled: !!organizationId, queryFn: async () => {
    const { data, error } = await db.rpc("reporting_gaps", { _org: organizationId }); if (error) throw error; return data as Gap[];
  } });
};
export const useChangeRequests = (all = false, enabled = true) => {
  const { organizationId } = useOrganizationContext();
  return useQuery({ queryKey: ["reporting", "requests", all ? "all" : organizationId], enabled: enabled && (all || !!organizationId), queryFn: async () => {
    const { data, error } = await db.rpc("reporting_change_requests_list", { _org: all ? null : organizationId }); if (error) throw error; return data as ChangeRequest[];
  } });
};
export const useReportingEvents = () => {
  const { organizationId } = useOrganizationContext();
  return useQuery({ queryKey: ["reporting", "events", organizationId], enabled: !!organizationId, queryFn: async () => {
    const { data, error } = await db.rpc("reporting_events_list", { _org: organizationId, _limit: 100 }); if (error) throw error; return data as ReportingEvent[];
  } });
};
export const usePreview = (user: string, supervisor: string, from: string, to: string) => {
  const { organizationId } = useOrganizationContext();
  return useQuery({ queryKey: ["reporting", "preview", organizationId, user, supervisor, from, to], enabled: !!organizationId && !!user, queryFn: async () => {
    const { data, error } = await db.rpc("reporting_preview", { _org: organizationId, _user: user, _supervisor: supervisor || null, _from: from || null, _to: to || null });
    if (error) throw error; return data as Preview;
  } });
};

export const useReportingActions = () => {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { organizationId } = useOrganizationContext();
  const done = (msg: (r: unknown) => string) => (r: unknown) => { qc.invalidateQueries({ queryKey: ["reporting"] }); qc.invalidateQueries({ queryKey: ["reporting-lines"] }); toast({ title: msg(r) }); };
  const fail = (title: string) => (e: Error) => toast({ title, description: e.message, variant: "destructive" });
  const outcome = (r: unknown) => ((r as ChangeResult).status === "pending_confirmation" ? "Sent to the Super Admin for confirmation" : "Saved");
  const call = async (fn: string, args: Record<string, unknown>) => { const { data, error } = await db.rpc(fn, args); if (error) throw error; return data; };
  return {
    setSupervisor: useMutation({ mutationFn: (a: { user: string; supervisor: string; from?: string; to?: string; note?: string }) => call("reporting_set_supervisor", { _org: organizationId, _user: a.user, _supervisor: a.supervisor, _from: a.from || null, _to: a.to || null, _note: a.note || null }), onSuccess: done(outcome), onError: fail("The change was not saved") }),
    removeSupervisor: useMutation({ mutationFn: (a: { user: string; from?: string }) => call("reporting_remove_supervisor", { _org: organizationId, _user: a.user, _from: a.from || null }), onSuccess: done(outcome), onError: fail("The supervisor was not removed") }),
    setLine: useMutation({ mutationFn: (a: { role: string; supervisorRole: string }) => call("reporting_set_line", { _org: organizationId, _role: a.role, _supervisor_role: a.supervisorRole }), onSuccess: done(outcome), onError: fail("The line was not saved") }),
    removeLine: useMutation({ mutationFn: (role: string) => call("reporting_remove_line", { _org: organizationId, _role: role }), onSuccess: done(outcome), onError: fail("The line was not removed") }),
    withdraw: useMutation({ mutationFn: (id: string) => call("reporting_withdraw_change", { _id: id }), onSuccess: done(() => "Request withdrawn"), onError: fail("Could not withdraw the request") }),
    decide: useMutation({ mutationFn: (a: { id: string; approve: boolean; note?: string }) => call("reporting_decide_change", { _id: a.id, _approve: a.approve, _note: a.note || null }), onSuccess: done((r) => (r === "confirmed" ? "Change confirmed and applied" : "Change rejected")), onError: fail("The decision was not recorded") }),
    reassign: useMutation({ mutationFn: (a: { submitter: string; from: string; to: string; reason: string }) => call("reporting_reassign_pending", { _org: organizationId, _submitter: a.submitter, _from_user: a.from, _to_user: a.to, _reason: a.reason }), onSuccess: done((r) => `Moved ${(r as { moved: number }).moved} approval(s)${(r as { skipped: number }).skipped ? `, ${(r as { skipped: number }).skipped} skipped` : ""}`), onError: fail("The approvals were not moved") }),
  };
};
