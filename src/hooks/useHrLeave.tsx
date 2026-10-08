import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useOrganizationContext } from "./useOrganizationContext";

// Newer than the generated Supabase types, so access untyped.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export type LeaveStatus = "pending" | "approved" | "rejected" | "cancelled";

export interface LeaveType { id: string; organization_id: string; name: string; days_per_year: number; paid: boolean; active: boolean }
export interface LeaveRequest {
  id: string; organization_id: string; user_id: string; leave_type_id: string; start_date: string; end_date: string;
  days: number; reason: string | null; status: LeaveStatus; decision_notes: string | null; decided_at: string | null; created_at: string;
  leave_types?: { name: string; paid: boolean } | null;
}
export interface LeaveBalance { leave_type_id: string; leave_type: string; days_per_year: number; taken: number; pending: number; remaining: number }

/** Working days (Monday to Friday) between two ISO dates, matching request_leave(). */
export const countWorkingDays = (start: string, end: string) => {
  if (!start || !end) return 0;
  const s = new Date(`${start}T00:00:00`); const e = new Date(`${end}T00:00:00`);
  let n = 0;
  for (const d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) if (d.getDay() !== 0 && d.getDay() !== 6) n++;
  return n;
};

export const useLeaveTypes = () => {
  const { organizationId } = useOrganizationContext();
  return useQuery({
    queryKey: ["hr-leave-types", organizationId], enabled: !!organizationId,
    queryFn: async () => {
      const { data, error } = await db.from("leave_types").select("*").eq("organization_id", organizationId).order("name");
      if (error) throw error;
      return data as LeaveType[];
    },
  });
};

/** All leave requests of the centre (HR only; row-level security enforces it). */
export const useAllLeaveRequests = () => {
  const { organizationId } = useOrganizationContext();
  return useQuery({
    queryKey: ["hr-leave-requests", organizationId], enabled: !!organizationId,
    queryFn: async () => {
      const { data, error } = await db.from("leave_requests").select("*, leave_types(name,paid)")
        .eq("organization_id", organizationId).order("start_date", { ascending: false });
      if (error) throw error;
      return data as LeaveRequest[];
    },
  });
};

export const useMyLeaveRequests = () =>
  useQuery({
    queryKey: ["my-leave-requests"],
    queryFn: async () => {
      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!auth.user) return [] as LeaveRequest[];
      const { data, error } = await db.from("leave_requests").select("*, leave_types(name,paid)")
        .eq("user_id", auth.user.id).order("start_date", { ascending: false });
      if (error) throw error;
      return data as LeaveRequest[];
    },
  });

export const useMyLeaveBalances = () =>
  useQuery({
    queryKey: ["my-leave-balances"],
    queryFn: async () => {
      const { data, error } = await db.rpc("leave_balances", { _user: null, _year: null });
      if (error) throw error;
      return (data ?? []) as LeaveBalance[];
    },
  });

const useInvalidateLeave = () => {
  const qc = useQueryClient();
  return () => {
    for (const k of ["hr-leave-requests", "hr-leave-types", "my-leave-requests", "my-leave-balances", "hr-directory", "hr-dashboard"]) qc.invalidateQueries({ queryKey: [k] });
  };
};

export const useRequestLeave = () => {
  const invalidate = useInvalidateLeave();
  return useMutation({
    mutationFn: async (v: { leave_type: string; start: string; end: string; reason: string }) => {
      const { error } = await db.rpc("request_leave", { _leave_type: v.leave_type, _start: v.start, _end: v.end, _reason: v.reason || null });
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast.success("Leave request sent to HR"); },
    onError: (e: Error) => toast.error(e.message),
  });
};

export const useDecideLeave = () => {
  const invalidate = useInvalidateLeave();
  return useMutation({
    mutationFn: async (v: { id: string; approve: boolean; notes: string }) => {
      const { error } = await db.rpc("decide_leave", { _id: v.id, _approve: v.approve, _notes: v.notes || null });
      if (error) throw error;
    },
    onSuccess: (_d, v) => { invalidate(); toast.success(v.approve ? "Leave approved" : "Leave declined"); },
    onError: (e: Error) => toast.error(e.message),
  });
};

export const useCancelLeave = () => {
  const invalidate = useInvalidateLeave();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.rpc("cancel_leave", { _id: id });
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast.success("Leave request cancelled"); },
    onError: (e: Error) => toast.error(e.message),
  });
};

export const useSaveLeaveType = () => {
  const invalidate = useInvalidateLeave();
  const { organizationId } = useOrganizationContext();
  return useMutation({
    mutationFn: async (v: { id?: string; name: string; days_per_year: number; paid: boolean; active: boolean }) => {
      const { id, ...fields } = v;
      const { error } = id
        ? await db.from("leave_types").update(fields).eq("id", id)
        : await db.from("leave_types").insert([{ ...fields, organization_id: organizationId }]);
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast.success("Leave type saved"); },
    onError: (e: Error) => toast.error(/duplicate key/.test(e.message) ? "A leave type with that name already exists" : e.message),
  });
};

export const useDeleteLeaveType = () => {
  const invalidate = useInvalidateLeave();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from("leave_types").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast.success("Leave type deleted"); },
    onError: (e: Error) => toast.error(/foreign key|violates/.test(e.message) ? "This leave type has requests; mark it inactive instead" : e.message),
  });
};
