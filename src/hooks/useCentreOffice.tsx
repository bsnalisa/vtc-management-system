import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganizationContext } from "./useOrganizationContext";
import { useRpc } from "./useFinance";

// These tables and functions are newer than the generated types, so they are called untyped.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export interface Correspondence {
  id: string; reference: string; direction: "incoming" | "outgoing"; subject: string; party: string; channel: string; item_date: string; due_on: string | null;
  status: "received" | "in_progress" | "replied" | "filed" | "closed"; handling_note: string | null; document_path: string | null;
}
export interface Meeting {
  id: string; title: string; meeting_date: string; start_time: string | null; end_time: string | null; location: string | null; attendees: string | null;
  agenda: string | null; minutes: string | null; status: "scheduled" | "held" | "cancelled";
}
export interface OfficeTask {
  id: string; title: string; detail: string | null; due_on: string | null; source: string; correspondence_id: string | null; meeting_id: string | null;
  status: "open" | "done" | "cancelled"; completed_at: string | null;
}
export interface Executive {
  escalated: { id: string; reference: string | null; title: string; process_type: string; submitter_role: string | null; next_action: string | null; started_at: string; days_open: number }[];
  departments: {
    code: string; name: string; staff: number; pending: number; overdue: number; escalated: number; approved_30d: number; rejected_30d: number;
    avg_days_to_decide: number | null; kpis: Record<string, number | null>;
  }[];
  office: { correspondence_open: number; correspondence_overdue: number; meetings_next_7_days: number; tasks_open: number; tasks_overdue: number };
}
export interface DelegationLog {
  delegations: { id: string; from: string | null; to: string | null; process_type: string | null; starts_at: string; ends_at: string; active: boolean }[];
  decisions: { reference: string | null; title: string; step: string; outcome: string; acted_at: string; by: string | null }[];
}

const useRegister = <T,>(table: string, order: string, ascending: boolean) => {
  const { organizationId } = useOrganizationContext();
  return useQuery({
    queryKey: ["office", table, organizationId], enabled: !!organizationId,
    queryFn: async () => {
      const { data, error } = await db.from(table).select("*").eq("organization_id", organizationId).order(order, { ascending }).limit(500);
      if (error) throw error;
      return data as T[];
    },
  });
};
export const useCorrespondence = () => useRegister<Correspondence>("office_correspondence", "item_date", false);
export const useMeetings = () => useRegister<Meeting>("office_meetings", "meeting_date", true);
export const useOfficeTasks = () => useRegister<OfficeTask>("office_tasks", "created_at", false);

export const useDelegationLog = () =>
  useQuery({ queryKey: ["office", "delegations"], queryFn: async () => { const { data, error } = await db.rpc("office_delegation_log"); if (error) throw error; return data as DelegationLog; } });
export const useCentreExecutive = () =>
  useQuery({ queryKey: ["office", "executive"], queryFn: async () => { const { data, error } = await db.rpc("centre_manager_executive"); if (error) throw error; return data as Executive; } });

const K = ["office"];
export const useLogCorrespondence = () =>
  useRpc<{ direction: string; subject: string; party: string; channel: string; date: string; due?: string }>(
    "office_log_correspondence", (v) => ({ _direction: v.direction, _subject: v.subject, _party: v.party, _channel: v.channel, _item_date: v.date, _due: v.due || null }), K, "Added to the register");
export const useSetCorrespondenceStatus = () =>
  useRpc<{ id: string; status: string; note?: string }>("office_set_correspondence_status", (v) => ({ _id: v.id, _status: v.status, _note: v.note ?? null }), K, "Status updated");
export const useAddMeeting = () =>
  useRpc<{ title: string; date: string; start?: string; end?: string; location?: string; attendees?: string; agenda?: string }>(
    "office_add_meeting", (v) => ({ _title: v.title, _date: v.date, _start: v.start || null, _end: v.end || null, _location: v.location ?? null, _attendees: v.attendees ?? null, _agenda: v.agenda ?? null }), K, "Meeting added");
export const useUpdateMeeting = () =>
  useRpc<{ id: string; status: string; minutes?: string }>("office_update_meeting", (v) => ({ _id: v.id, _status: v.status, _minutes: v.minutes ?? null }), K, "Meeting updated");
export const useAddOfficeTask = () =>
  useRpc<{ title: string; due?: string; detail?: string; source: string }>("office_add_task", (v) => ({ _title: v.title, _due: v.due || null, _detail: v.detail ?? null, _source: v.source }), K, "Task added");
export const useSetOfficeTaskStatus = () =>
  useRpc<{ id: string; status: string }>("office_set_task_status", (v) => ({ _id: v.id, _status: v.status }), K, "Task updated");
