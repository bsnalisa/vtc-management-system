import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useOrganizationContext } from "./useOrganizationContext";

// Resource-centre tables are newer than the generated Supabase types, so access them untyped.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export interface LibraryMember {
  id: string;
  member_number: string;
  member_type: "trainee" | "trainer" | "staff" | "community" | "partner_library";
  user_id: string | null;
  trainee_id: string | null;
  full_name: string;
  email: string | null;
  phone: string | null;
  id_number: string | null;
  barcode: string | null;
  rfid_tag: string | null;
  status: "pending" | "active" | "suspended" | "expired";
  expiry_date: string | null;
}

export interface LibraryReservation {
  id: string;
  library_item_id: string;
  member_id: string;
  status: "waiting" | "ready" | "fulfilled" | "cancelled" | "expired";
  reserved_at: string;
  expires_at: string | null;
  library_items?: { title: string } | null;
  library_members?: { full_name: string; member_number: string } | null;
}

export interface InterlibraryLoan {
  id: string;
  direction: "incoming" | "outgoing";
  partner_library: string;
  title: string;
  author: string | null;
  isbn: string | null;
  status: "requested" | "approved" | "in_transit" | "received" | "returned" | "declined" | "cancelled";
  requested_date: string;
  due_date: string | null;
  notes: string | null;
}

export interface LibrarySettings {
  loan_days: number;
  fine_per_day: number;
  max_active_loans: number;
  reservation_hold_days: number;
  reminder_days_before: number;
}

export const DEFAULT_LIBRARY_SETTINGS: LibrarySettings = {
  loan_days: 14,
  fine_per_day: 1,
  max_active_loans: 3,
  reservation_hold_days: 3,
  reminder_days_before: 1,
};

function useOrgMutation<T>(
  fn: (v: T, orgId: string) => Promise<unknown>,
  keys: string[],
  success: string,
) {
  const queryClient = useQueryClient();
  const { organizationId } = useOrganizationContext();
  return useMutation({
    mutationFn: async (v: T) => {
      if (!organizationId) throw new Error("No organization ID");
      return fn(v, organizationId);
    },
    onSuccess: () => {
      keys.forEach((k) => queryClient.invalidateQueries({ queryKey: [k] }));
      toast.success(success);
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export const useLibraryMembers = () => {
  const { organizationId } = useOrganizationContext();
  return useQuery({
    queryKey: ["library-members", organizationId],
    enabled: !!organizationId,
    queryFn: async () => {
      const { data, error } = await db.from("library_members").select("*")
        .eq("organization_id", organizationId).order("full_name");
      if (error) throw error;
      return data as LibraryMember[];
    },
  });
};

export const useCreateLibraryMember = () =>
  useOrgMutation(async (m: Partial<LibraryMember>, orgId) => {
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await db.from("library_members")
      .insert([{ status: "active", ...m, organization_id: orgId, registered_by: user?.id }]);
    if (error) throw error;
  }, ["library-members"], "Member registered");

export const useUpdateLibraryMember = () =>
  useOrgMutation(async ({ id, ...patch }: Partial<LibraryMember> & { id: string }) => {
    const { error } = await db.from("library_members").update(patch).eq("id", id);
    if (error) throw error;
  }, ["library-members"], "Member updated");

export const useLibraryReservations = () => {
  const { organizationId } = useOrganizationContext();
  return useQuery({
    queryKey: ["library-reservations", organizationId],
    enabled: !!organizationId,
    queryFn: async () => {
      const { data, error } = await db.from("library_reservations")
        .select("*, library_items(title), library_members(full_name, member_number)")
        .eq("organization_id", organizationId).order("reserved_at", { ascending: false });
      if (error) throw error;
      return data as LibraryReservation[];
    },
  });
};

export const useCreateReservation = () =>
  useOrgMutation(async ({ library_item_id, member_id }: { library_item_id: string; member_id: string }, orgId) => {
    const { error } = await db.from("library_reservations")
      .insert([{ library_item_id, member_id, organization_id: orgId }]);
    if (error) throw error;
  }, ["library-reservations"], "Item reserved. You will be notified when it is available.");

export const useUpdateReservation = () =>
  useOrgMutation(async ({ id, status }: { id: string; status: LibraryReservation["status"] }) => {
    const { error } = await db.from("library_reservations").update({ status }).eq("id", id);
    if (error) throw error;
  }, ["library-reservations"], "Reservation updated");

export const useInterlibraryLoans = () => {
  const { organizationId } = useOrganizationContext();
  return useQuery({
    queryKey: ["interlibrary-loans", organizationId],
    enabled: !!organizationId,
    queryFn: async () => {
      const { data, error } = await db.from("interlibrary_loans").select("*")
        .eq("organization_id", organizationId).order("requested_date", { ascending: false });
      if (error) throw error;
      return data as InterlibraryLoan[];
    },
  });
};

export const useCreateInterlibraryLoan = () =>
  useOrgMutation(async (l: Partial<InterlibraryLoan>, orgId) => {
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await db.from("interlibrary_loans")
      .insert([{ ...l, organization_id: orgId, created_by: user?.id }]);
    if (error) throw error;
  }, ["interlibrary-loans"], "Interlibrary request saved");

export const useUpdateInterlibraryLoan = () =>
  useOrgMutation(async ({ id, ...patch }: Partial<InterlibraryLoan> & { id: string }) => {
    const { error } = await db.from("interlibrary_loans").update(patch).eq("id", id);
    if (error) throw error;
  }, ["interlibrary-loans"], "Interlibrary loan updated");

export const useLibrarySettings = () => {
  const { organizationId } = useOrganizationContext();
  return useQuery({
    queryKey: ["library-settings", organizationId],
    enabled: !!organizationId,
    queryFn: async () => {
      const { data, error } = await db.from("library_settings").select("*")
        .eq("organization_id", organizationId).maybeSingle();
      if (error) throw error;
      return (data ?? DEFAULT_LIBRARY_SETTINGS) as LibrarySettings;
    },
  });
};

export const useSaveLibrarySettings = () =>
  useOrgMutation(async (s: LibrarySettings, orgId) => {
    const { error } = await db.from("library_settings").upsert({ ...s, organization_id: orgId, updated_at: new Date().toISOString() });
    if (error) throw error;
  }, ["library-settings"], "Settings saved");

/** Flags overdue loans, accrues fines and sends reminders. */
export const useProcessOverdue = () =>
  useOrgMutation(async (_: void, orgId) => {
    const { data, error } = await db.rpc("library_process_overdue", { _org: orgId });
    if (error) throw error;
    return data as number;
  }, ["library-borrowing", "library-fines", "library-items", "library-reservations"], "Overdue sweep completed");

export const useSendLibraryAnnouncement = () =>
  useOrgMutation(async ({ title, message }: { title: string; message: string }, orgId) => {
    const { error } = await db.rpc("library_send_announcement", { _org: orgId, _title: title, _message: message });
    if (error) throw error;
  }, [], "Announcement sent to library members");

/** Bill a member for a lost or damaged item. */
export const useBillLostItem = () =>
  useOrgMutation(async (v: { borrowing_id: string; borrower_id: string; amount: number; fine_type: "lost" | "damaged" }, orgId) => {
    const { error } = await db.from("library_fines").insert([{
      organization_id: orgId, borrowing_id: v.borrowing_id, borrower_id: v.borrower_id,
      fine_amount: v.amount, fine_type: v.fine_type, notes: `Billed for ${v.fine_type} item`,
    }]);
    if (error) throw error;
  }, ["library-fines"], "Member billed");
