import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useOrganizationContext } from "./useOrganizationContext";

// Newer than the generated Supabase types, so access untyped.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export interface ProcessType { code: string; label: string; description: string | null }
export interface WorkflowStep {
  id?: string; step_no: number; name: string; approver_role: string | null; approver_user: string | null;
  sla_hours: number | null; escalate_to_role: string | null; escalate_to_user: string | null; allow_self_approval: boolean;
}
export interface WorkflowDefinition {
  id: string; process_type: string; name: string; active: boolean; created_at: string; workflow_steps: WorkflowStep[];
}
export type InstanceStatus = "in_progress" | "awaiting_info" | "approved" | "rejected" | "cancelled";
export interface WorkflowInstance {
  id: string; process_type: string; title: string; summary: Record<string, string>; status: InstanceStatus;
  current_step: number; started_by: string | null; started_at: string; completed_at: string | null; outcome_comment: string | null;
}
export interface MyTask {
  task_id: string; instance_id: string; process_type: string; title: string; summary: Record<string, string>;
  step_no: number; step_name: string; due_at: string | null; escalated: boolean; delegated: boolean;
  requested_by: string | null; started_at: string;
}
export interface WorkflowEvent {
  id: number; event: string; actor: string | null; via: string | null; comment: string | null; created_at: string;
}
export interface Delegation {
  id: string; from_user: string; to_user: string; process_type: string | null; starts_at: string; ends_at: string; active: boolean;
}
export interface OrgUser { user_id: string; full_name: string; email: string | null }

export const ALERT_EVENTS: { event: "task_assigned" | "task_escalated" | "info_requested" | "completed"; label: string }[] = [
  { event: "task_assigned", label: "An approval is assigned to someone" },
  { event: "task_escalated", label: "An overdue approval is escalated" },
  { event: "info_requested", label: "An approver asks the requester for information" },
  { event: "completed", label: "A request is approved, rejected or cancelled" },
];

function useOrgMutation<T, R = unknown>(fn: (v: T, orgId: string) => Promise<R>, keys: string[], success: string | ((r: R) => string)) {
  const queryClient = useQueryClient();
  const { organizationId } = useOrganizationContext();
  return useMutation({
    mutationFn: async (v: T) => {
      if (!organizationId) throw new Error("No organization ID");
      return fn(v, organizationId);
    },
    onSuccess: (r) => {
      keys.forEach((k) => queryClient.invalidateQueries({ queryKey: [k] }));
      toast.success(typeof success === "function" ? success(r) : success);
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export const useProcessTypes = () =>
  useQuery({
    queryKey: ["workflow-process-types"],
    queryFn: async () => {
      const { data, error } = await db.from("workflow_process_types").select("*").order("label");
      if (error) throw error;
      return data as ProcessType[];
    },
  });

export const useRoleOptions = () =>
  useQuery({
    queryKey: ["workflow-role-options"],
    queryFn: async () => {
      const { data, error } = await supabase.from("custom_roles").select("role_code, role_name").eq("active", true).order("role_name");
      if (error) throw error;
      return data.filter((r) => r.role_code !== "super_admin");
    },
  });

export const useOrgUsers = () =>
  useQuery({
    queryKey: ["workflow-org-users"],
    queryFn: async () => {
      const { data, error } = await db.rpc("workflow_list_users");
      if (error) throw error;
      return data as OrgUser[];
    },
  });

// ---- definitions (admins) ----
export const useWorkflowDefinitions = () => {
  const { organizationId } = useOrganizationContext();
  return useQuery({
    queryKey: ["workflow-definitions", organizationId], enabled: !!organizationId,
    queryFn: async () => {
      const { data, error } = await db.from("workflow_definitions").select("*, workflow_steps(*)")
        .eq("organization_id", organizationId).order("created_at", { ascending: false });
      if (error) throw error;
      return (data as WorkflowDefinition[]).map((d) => ({ ...d, workflow_steps: [...d.workflow_steps].sort((a, b) => a.step_no - b.step_no) }));
    },
  });
};

export const useSaveDefinition = () =>
  useOrgMutation(async (v: { id?: string; process_type: string; name: string; steps: WorkflowStep[] }, orgId) => {
    let id = v.id;
    if (id) {
      const { error } = await db.from("workflow_definitions").update({ name: v.name }).eq("id", id);
      if (error) throw error;
    } else {
      const { data, error } = await db.from("workflow_definitions").insert([{ organization_id: orgId, process_type: v.process_type, name: v.name }]).select("id").single();
      if (error) throw error;
      id = data.id as string;
    }
    // steps are replaced atomically on the server, which also refuses edits while requests are running
    const { error } = await db.rpc("workflow_save_steps", {
      _definition: id,
      _steps: v.steps.map((s) => ({
        name: s.name, approver_role: s.approver_role, approver_user: s.approver_user, sla_hours: s.sla_hours,
        escalate_to_role: s.escalate_to_role, escalate_to_user: s.escalate_to_user, allow_self_approval: s.allow_self_approval,
      })),
    });
    if (error) throw error;
  }, ["workflow-definitions"], "Workflow saved");

export const useSetDefinitionActive = () =>
  useOrgMutation(async (v: { id: string; active: boolean }) => {
    const { error } = await db.from("workflow_definitions").update({ active: v.active }).eq("id", v.id);
    if (error) throw new Error(/duplicate key/.test(error.message) ? "Another workflow is already active for this process. Deactivate it first." : error.message);
  }, ["workflow-definitions"], "Workflow updated");

export const useDeleteDefinition = () =>
  useOrgMutation(async (id: string) => {
    const { error } = await db.from("workflow_definitions").delete().eq("id", id);
    if (error) throw new Error(/foreign key|violates/.test(error.message) ? "This workflow has request history and cannot be deleted. Deactivate it instead." : error.message);
  }, ["workflow-definitions"], "Workflow deleted");

// ---- settings ----
export const useWorkflowSettings = () => {
  const { organizationId } = useOrganizationContext();
  return useQuery({
    queryKey: ["workflow-settings", organizationId], enabled: !!organizationId,
    queryFn: async () => {
      const [s, a] = await Promise.all([
        db.from("workflow_settings").select("*").eq("organization_id", organizationId).maybeSingle(),
        db.from("workflow_alert_settings").select("*").eq("organization_id", organizationId),
      ]);
      if (s.error) throw s.error;
      if (a.error) throw a.error;
      return {
        app_base_url: (s.data?.app_base_url ?? "") as string,
        alerts: a.data as { event: string; in_app: boolean; email: boolean }[],
      };
    },
  });
};
export const useSaveWorkflowSettings = () =>
  useOrgMutation(async (v: { app_base_url: string; alerts: { event: string; in_app: boolean; email: boolean }[] }, orgId) => {
    const url = v.app_base_url.trim().replace(/\/+$/, "");
    if (url && !/^https?:\/\//.test(url)) throw new Error("The website address must start with https://");
    const { error } = await db.from("workflow_settings").upsert({ organization_id: orgId, app_base_url: url || null });
    if (error) throw error;
    const { error: aErr } = await db.from("workflow_alert_settings").upsert(v.alerts.map((a) => ({ ...a, organization_id: orgId })));
    if (aErr) throw aErr;
  }, ["workflow-settings"], "Settings saved");

export const useRunEscalation = () =>
  useOrgMutation(async (_: void, orgId) => {
    const { data, error } = await db.rpc("workflow_escalate_overdue", { _org: orgId });
    if (error) throw error;
    return data as number;
  }, ["workflow-instances", "workflow-my-tasks"], (n) => (n ? `${n} overdue approval(s) escalated` : "Nothing is overdue"));

// ---- instances ----
export const useWorkflowInstances = (mine: boolean) => {
  const { organizationId } = useOrganizationContext();
  return useQuery({
    queryKey: ["workflow-instances", organizationId, mine ? "mine" : "all"], enabled: !!organizationId,
    queryFn: async () => {
      let q = db.from("workflow_instances").select("*").eq("organization_id", organizationId).order("started_at", { ascending: false }).limit(200);
      if (mine) {
        const { data: { user } } = await supabase.auth.getUser();
        q = q.eq("started_by", user?.id ?? "");
      }
      const { data, error } = await q;
      if (error) throw error;
      return data as WorkflowInstance[];
    },
  });
};

export const useInstanceEvents = (instanceId: string | undefined) =>
  useQuery({
    queryKey: ["workflow-events", instanceId], enabled: !!instanceId,
    queryFn: async () => {
      const { data, error } = await db.from("workflow_events").select("*").eq("instance_id", instanceId).order("created_at");
      if (error) throw error;
      return data as WorkflowEvent[];
    },
  });

export const useCancelInstance = () =>
  useOrgMutation(async (v: { id: string; reason: string }) => {
    const { error } = await db.rpc("workflow_cancel", { _instance: v.id, _reason: v.reason || null });
    if (error) throw error;
  }, ["workflow-instances", "workflow-my-tasks"], "Request cancelled");

export const useStartRequest = () =>
  useOrgMutation(async (v: { title: string; description: string }) => {
    const { error } = await db.rpc("workflow_start_request", { _title: v.title, _description: v.description });
    if (error) throw error;
  }, ["workflow-instances"], "Request sent for approval");

export const useProvideInfo = () =>
  useOrgMutation(async (v: { id: string; comment: string }) => {
    const { error } = await db.rpc("workflow_provide_info", { _instance: v.id, _comment: v.comment });
    if (error) throw error;
  }, ["workflow-instances"], "Reply sent to the approver");

// ---- tasks ----
export const useMyTasks = () =>
  useQuery({
    queryKey: ["workflow-my-tasks"], refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await db.rpc("workflow_my_tasks");
      if (error) throw error;
      return data as MyTask[];
    },
  });

export const useActOnTask = () =>
  useOrgMutation(async (v: { task: string; action: "approve" | "reject" | "request_info"; comment: string }) => {
    const { data, error } = await db.rpc("workflow_act", { _task: v.task, _action: v.action, _comment: v.comment || null });
    if (error) throw error;
    return data as string;
  }, ["workflow-my-tasks", "workflow-instances"], (r) =>
    r === "approved" ? "Approved. The request is complete." : r === "rejected" ? "Rejected" : r === "awaiting_info" ? "Information requested" : "Approved. Sent to the next step.");

// ---- delegation ----
export const useDelegations = () => {
  const { organizationId } = useOrganizationContext();
  return useQuery({
    queryKey: ["workflow-delegations", organizationId], enabled: !!organizationId,
    queryFn: async () => {
      const { data, error } = await db.from("workflow_delegations").select("*").eq("organization_id", organizationId).order("starts_at", { ascending: false });
      if (error) throw error;
      return data as Delegation[];
    },
  });
};
export const useSaveDelegation = () =>
  useOrgMutation(async (v: { to_user: string; process_type: string | null; starts_at: string; ends_at: string }, orgId) => {
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await db.from("workflow_delegations").insert([{ ...v, organization_id: orgId, from_user: user?.id }]);
    if (error) throw error;
  }, ["workflow-delegations", "workflow-my-tasks"], "Delegation scheduled");
export const useEndDelegation = () =>
  useOrgMutation(async (id: string) => {
    const { error } = await db.from("workflow_delegations").delete().eq("id", id);
    if (error) throw error;
  }, ["workflow-delegations", "workflow-my-tasks"], "Delegation removed");

// ---- public email-link page (no login) ----
export interface TokenTask {
  title: string; summary: Record<string, string>; step_no: number; step_name: string; due_at: string | null;
  instance_status: string; task_status: string; usable: boolean;
}
export const fetchTaskByToken = async (token: string) => {
  const { data, error } = await db.rpc("workflow_get_task_by_token", { _token: token });
  if (error) throw error;
  return data as TokenTask | null;
};
export const actByToken = async (token: string, action: "approve" | "reject" | "request_info", comment: string) => {
  const { data, error } = await db.rpc("workflow_act_by_token", { _token: token, _action: action, _comment: comment || null });
  if (error) throw error;
  return data as string;
};
