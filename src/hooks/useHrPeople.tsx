import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useOrganizationContext } from "./useOrganizationContext";

// Newer than the generated Supabase types, so access untyped.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export type EmploymentType = "permanent" | "contract" | "part_time" | "temporary";
export type EmploymentStatus = "active" | "on_leave" | "suspended" | "resigned" | "terminated";

export interface StaffMember {
  user_id: string; full_name: string | null; email: string | null; roles: string | null; employee_number: string | null;
  job_title: string | null; department: string | null; employment_type: EmploymentType | null; employment_status: EmploymentStatus | null;
  start_date: string | null; on_leave_today: boolean;
}
export interface StaffRecord {
  id: string; organization_id: string; user_id: string; employee_number: string | null; job_title: string | null; department: string | null;
  employment_type: EmploymentType; employment_status: EmploymentStatus; start_date: string | null; end_date: string | null;
  phone: string | null; emergency_contact: string | null; notes: string | null;
}
export type StaffRecordInput = Omit<StaffRecord, "id" | "organization_id">;

export const useStaffDirectory = () =>
  useQuery({
    queryKey: ["hr-directory"],
    queryFn: async () => {
      const { data, error } = await db.rpc("hr_staff_directory");
      if (error) throw error;
      return (data ?? []) as StaffMember[];
    },
  });

/** Full HR record of one person, or null if none exists yet. */
export const useStaffRecord = (userId: string | undefined) => {
  const { organizationId } = useOrganizationContext();
  return useQuery({
    queryKey: ["hr-staff-record", organizationId, userId], enabled: !!organizationId && !!userId,
    queryFn: async () => {
      const { data, error } = await db.from("staff_records").select("*").eq("organization_id", organizationId).eq("user_id", userId).maybeSingle();
      if (error) throw error;
      return data as StaffRecord | null;
    },
  });
};

export const useMyStaffRecord = () =>
  useQuery({
    queryKey: ["my-staff-record"],
    queryFn: async () => {
      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!auth.user) return null;
      const { data, error } = await db.from("staff_records").select("*").eq("user_id", auth.user.id).maybeSingle();
      if (error) throw error;
      return data as StaffRecord | null;
    },
  });

export const useSaveStaffRecord = () => {
  const qc = useQueryClient();
  const { organizationId } = useOrganizationContext();
  return useMutation({
    mutationFn: async (v: StaffRecordInput) => {
      const { error } = await db.from("staff_records").upsert([{ ...v, organization_id: organizationId }], { onConflict: "organization_id,user_id" });
      if (error) throw error;
    },
    onSuccess: () => {
      for (const k of ["hr-directory", "hr-staff-record", "my-staff-record", "hr-dashboard"]) qc.invalidateQueries({ queryKey: [k] });
      toast.success("Staff record saved");
    },
    onError: (e: Error) => toast.error(e.message),
  });
};

/* ---------------- Performance reviews ---------------- */
export type ReviewStatus = "draft" | "submitted" | "acknowledged";
export interface PerformanceReview {
  id: string; organization_id: string; employee_user_id: string; period: string; reviewer_user_id: string | null; rating: number | null;
  goals: string | null; comments: string | null; status: ReviewStatus; acknowledged_at: string | null; created_at: string;
}

export const useAllReviews = () => {
  const { organizationId } = useOrganizationContext();
  return useQuery({
    queryKey: ["hr-reviews", organizationId], enabled: !!organizationId,
    queryFn: async () => {
      const { data, error } = await db.from("performance_reviews").select("*").eq("organization_id", organizationId).order("created_at", { ascending: false });
      if (error) throw error;
      return data as PerformanceReview[];
    },
  });
};

/** Reviews visible to the signed-in person as an employee (submitted and acknowledged only). */
export const useMyReviews = () =>
  useQuery({
    queryKey: ["my-reviews"],
    queryFn: async () => {
      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!auth.user) return [] as PerformanceReview[];
      const { data, error } = await db.from("performance_reviews").select("*").eq("employee_user_id", auth.user.id).order("created_at", { ascending: false });
      if (error) throw error;
      return data as PerformanceReview[];
    },
  });

const useInvalidateReviews = () => {
  const qc = useQueryClient();
  return () => { for (const k of ["hr-reviews", "my-reviews", "hr-dashboard"]) qc.invalidateQueries({ queryKey: [k] }); };
};

export const useSaveReview = () => {
  const invalidate = useInvalidateReviews();
  const { organizationId } = useOrganizationContext();
  return useMutation({
    mutationFn: async (v: { id?: string; employee_user_id: string; period: string; rating: number | null; goals: string; comments: string; status: ReviewStatus }) => {
      const { id, employee_user_id, ...fields } = v;
      const { error } = id
        ? await db.from("performance_reviews").update(fields).eq("id", id)
        : await db.from("performance_reviews").insert([{ ...fields, employee_user_id, organization_id: organizationId }]);
      if (error) throw error;
    },
    onSuccess: (_d, v) => { invalidate(); toast.success(v.status === "submitted" ? "Review submitted to the employee" : "Review saved"); },
    onError: (e: Error) => toast.error(/duplicate key|unique/.test(e.message) ? "That person already has a review for this period" : e.message),
  });
};

export const useAcknowledgeReview = () => {
  const invalidate = useInvalidateReviews();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.rpc("acknowledge_review", { _id: id });
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast.success("Review acknowledged"); },
    onError: (e: Error) => toast.error(e.message),
  });
};
