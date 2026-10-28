import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

// These functions are newer than the generated Supabase types.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export interface Capability { code: string; area: string; label: string; description: string; sensitive: boolean }
export interface FactoryVersion {
  id: string; version: number; status: "draft" | "pending_review" | "approved" | "rejected" | "superseded"; job_description: string; reports_to_role: string | null;
  proposal_method: "ai" | "rules" | "manual" | null; proposal_capabilities: string[]; proposal_note: string | null; selected_capabilities: string[]; approved_capabilities: string[] | null; dashboard_widgets: string[]; approved_widgets: string[] | null;
  sensitive: boolean; created_by: string | null; created_by_me: boolean; created_at: string; reviewed_by: string | null; reviewed_at: string | null; review_note: string | null;
}
export interface FactoryRole { id: string; role_code: string; role_name: string; status: "draft" | "active" | "retired"; active_version_id: string | null; assigned: number; versions: FactoryVersion[] }
export interface Assignable {
  roles: { id: string; role_name: string; role_code: string; capabilities: string[]; sensitive: boolean; can_assign: boolean }[];
  assignments: { id: string; user_id: string; name: string; role_id: string; role_name: string; assigned_at: string }[];
  staff: { user_id: string; name: string }[];
}
export interface FactoryEvent { event: string; role: string | null; details: Record<string, unknown>; by: string | null; at: string }

export interface WidgetDef { code: string; title: string; description: string; capability: string; kind: "stats" | "bars" | "table"; sensitive: boolean }
export interface MyWidget { code: string; title: string; description: string; kind: "stats" | "bars" | "table" }
export interface WidgetData {
  stats?: { label: string; value: string | number | null; unit?: string }[];
  bars?: { label: string; value: number }[];
  columns?: string[]; rows?: (string | number | null)[][];
}
export const useWidgetCatalogue = () => useQuery({ queryKey: ["role-factory", "widgets"], queryFn: async () => { const { data, error } = await db.rpc("dashboard_widget_catalogue_list"); if (error) throw error; return data as WidgetDef[]; } });
export const useMyDashboard = (org: string | null | undefined) => useQuery({ queryKey: ["my-dashboard", org], enabled: !!org, staleTime: 60_000, queryFn: async () => { const { data, error } = await db.rpc("my_dashboard", { _org: org }); if (error) throw error; return data as { roles: string[]; widgets: MyWidget[] }; } });
export const useWidgetData = (org: string | null | undefined, code: string) => useQuery({ queryKey: ["my-dashboard", org, code], enabled: !!org, queryFn: async () => { const { data, error } = await db.rpc("dashboard_widget_data", { _org: org, _widget: code }); if (error) throw error; return data as WidgetData; } });
export const useCatalogue = () => useQuery({ queryKey: ["role-factory", "catalogue"], queryFn: async () => { const { data, error } = await db.rpc("role_factory_catalogue"); if (error) throw error; return data as Capability[]; } });
export const useFactoryOverview = () => useQuery({ queryKey: ["role-factory", "overview"], queryFn: async () => { const { data, error } = await db.rpc("role_factory_overview"); if (error) throw error; return data as FactoryRole[]; } });
export const useFactoryEvents = () => useQuery({ queryKey: ["role-factory", "events"], queryFn: async () => { const { data, error } = await db.rpc("role_factory_events_list", { _role: null }); if (error) throw error; return data as FactoryEvent[]; } });
export const useAssignable = (org: string | null | undefined) => useQuery({ queryKey: ["role-factory", "assignable", org], enabled: !!org, queryFn: async () => { const { data, error } = await db.rpc("role_factory_assignable", { _org: org }); if (error) throw error; return data as Assignable; } });
export const useOrganizations = (enabled: boolean) => useQuery({ queryKey: ["role-factory", "orgs"], enabled, queryFn: async () => { const { data, error } = await supabase.from("organizations").select("id, name").order("name"); if (error) throw error; return data as { id: string; name: string }[]; } });
export const useRoleOptionsForFactory = () => useQuery({ queryKey: ["role-factory", "role-options"], queryFn: async () => { const { data, error } = await supabase.from("custom_roles").select("role_code, role_name").eq("active", true).order("role_name"); if (error) throw error; return data.filter((r) => r.role_code !== "super_admin"); } });

export const useFactoryActions = () => {
  const qc = useQueryClient();
  const { toast } = useToast();
  const done = (msg: string) => () => { qc.invalidateQueries({ queryKey: ["role-factory"] }); toast({ title: msg }); };
  const fail = (title: string) => (e: Error) => toast({ title, description: e.message, variant: "destructive" });
  const call = async (fn: string, args: Record<string, unknown>) => { const { data, error } = await db.rpc(fn, args); if (error) throw error; return data; };
  return {
    create: useMutation({ mutationFn: (a: { code: string; name: string; description: string; reportsTo?: string }) => call("role_factory_create", { _code: a.code, _name: a.name, _job_description: a.description, _reports_to_role: a.reportsTo || null }), onSuccess: done("Role created as a draft"), onError: fail("The role was not created") }),
    newVersion: useMutation({ mutationFn: (role: string) => call("role_factory_new_version", { _role: role }), onSuccess: done("New version started"), onError: fail("Could not start a new version") }),
    save: useMutation({ mutationFn: (a: { version: string; description: string; reportsTo: string | null; capabilities: string[] }) => call("role_factory_save_draft", { _version: a.version, _job_description: a.description, _reports_to_role: a.reportsTo, _capabilities: a.capabilities }), onSuccess: done("Draft saved"), onError: fail("The draft was not saved") }),
    rules: useMutation({ mutationFn: (version: string) => call("role_factory_run_rules", { _version: version }), onSuccess: done("Proposal made by the built-in rules"), onError: fail("Could not analyse the description") }),
    saveWidgets: useMutation({ mutationFn: (a: { version: string; widgets: string[] }) => call("role_factory_save_widgets", { _version: a.version, _widgets: a.widgets }), onSuccess: done("Dashboard widgets saved"), onError: fail("The widgets were not saved") }),
    submit: useMutation({ mutationFn: (version: string) => call("role_factory_submit", { _version: version }), onSuccess: done("Sent for review"), onError: fail("Could not send for review") }),
    withdraw: useMutation({ mutationFn: (version: string) => call("role_factory_withdraw", { _version: version }), onSuccess: done("Taken back to draft"), onError: fail("Could not take it back") }),
    decide: useMutation({ mutationFn: (a: { version: string; approve: boolean; note: string; ack: boolean }) => call("role_factory_decide", { _version: a.version, _approve: a.approve, _note: a.note || null, _ack_sensitive: a.ack }), onSuccess: (r) => done(r === "approved" ? "Approved: the role is active" : "Rejected")(), onError: fail("The decision was not recorded") }),
    retire: useMutation({ mutationFn: (a: { role: string; note: string }) => call("role_factory_retire", { _role: a.role, _note: a.note }), onSuccess: done("Role retired"), onError: fail("Could not retire the role") }),
    assign: useMutation({ mutationFn: (a: { org: string; user: string; role: string }) => call("role_factory_assign", { _org: a.org, _user: a.user, _role: a.role }), onSuccess: done("Role assigned"), onError: fail("The role was not assigned") }),
    unassign: useMutation({ mutationFn: (id: string) => call("role_factory_unassign", { _assignment: id }), onSuccess: done("Role removed from the person"), onError: fail("Could not remove the role") }),
    // the AI function; when it is unavailable the caller falls back to the rules and the proposal is never labelled AI
    ai: useMutation({
      mutationFn: async (version: string) => {
        const { data, error } = await supabase.functions.invoke("analyse-job-description", { body: { version_id: version } });
        if (error) return { ok: false, fallback: "rules", reason: error.message } as { ok: boolean; fallback?: string; reason?: string };
        return data as { ok: boolean; fallback?: string; reason?: string };
      },
      onSuccess: (r) => { qc.invalidateQueries({ queryKey: ["role-factory"] }); toast(r.ok ? { title: "Proposal made by AI" } : { title: "AI is not available", description: `${r.reason ?? ""} Use the built-in rules or choose capabilities yourself.`, variant: "destructive" }); },
    }),
  };
};
