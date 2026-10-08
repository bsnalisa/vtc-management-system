import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useOrganizationContext } from "./useOrganizationContext";

// Newer than the generated Supabase types, so access untyped.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export type VacancyStatus = "draft" | "open" | "closed" | "filled";
export const APPLICANT_STAGES = ["received", "shortlisted", "interview", "offer", "hired", "rejected"] as const;
export type ApplicantStage = (typeof APPLICANT_STAGES)[number];

export interface Vacancy { id: string; title: string; department: string | null; description: string | null; closes_on: string | null; status: VacancyStatus; created_at: string }
export interface Applicant { id: string; vacancy_id: string; full_name: string; email: string | null; phone: string | null; stage: ApplicantStage; notes: string | null; created_at: string }

export const useVacancies = () => {
  const { organizationId } = useOrganizationContext();
  return useQuery({
    queryKey: ["hr-vacancies", organizationId], enabled: !!organizationId,
    queryFn: async () => {
      const { data, error } = await db.from("vacancies").select("*").eq("organization_id", organizationId).order("created_at", { ascending: false });
      if (error) throw error;
      return data as Vacancy[];
    },
  });
};

export const useApplicants = (vacancyId?: string) => {
  const { organizationId } = useOrganizationContext();
  return useQuery({
    queryKey: ["hr-applicants", organizationId, vacancyId ?? "all"], enabled: !!organizationId,
    queryFn: async () => {
      let q = db.from("vacancy_applicants").select("*").eq("organization_id", organizationId).order("created_at", { ascending: false });
      if (vacancyId) q = q.eq("vacancy_id", vacancyId);
      const { data, error } = await q;
      if (error) throw error;
      return data as Applicant[];
    },
  });
};

const useInvalidate = () => {
  const qc = useQueryClient();
  return () => { for (const k of ["hr-vacancies", "hr-applicants", "hr-dashboard"]) qc.invalidateQueries({ queryKey: [k] }); };
};

export const useSaveVacancy = () => {
  const invalidate = useInvalidate();
  const { organizationId } = useOrganizationContext();
  return useMutation({
    mutationFn: async (v: { id?: string; title: string; department: string | null; description: string | null; closes_on: string | null; status: VacancyStatus }) => {
      const { id, ...fields } = v;
      const { error } = id
        ? await db.from("vacancies").update(fields).eq("id", id)
        : await db.from("vacancies").insert([{ ...fields, organization_id: organizationId }]);
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast.success("Vacancy saved"); },
    onError: (e: Error) => toast.error(e.message),
  });
};

export const useDeleteVacancy = () => {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from("vacancies").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast.success("Vacancy deleted"); },
    onError: (e: Error) => toast.error(e.message),
  });
};

export const useSaveApplicant = () => {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (v: { id?: string; vacancy_id: string; full_name: string; email: string | null; phone: string | null; stage?: ApplicantStage; notes: string | null }) => {
      const { id, ...fields } = v;
      const { error } = id
        ? await db.from("vacancy_applicants").update(fields).eq("id", id)
        : await db.from("vacancy_applicants").insert([fields]);
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast.success("Applicant saved"); },
    onError: (e: Error) => toast.error(e.message),
  });
};

export const useMoveApplicant = () => {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (v: { id: string; stage: ApplicantStage }) => {
      const { error } = await db.from("vacancy_applicants").update({ stage: v.stage }).eq("id", v.id);
      if (error) throw error;
    },
    onSuccess: (_d, v) => { invalidate(); toast.success(`Moved to ${v.stage}`); },
    onError: (e: Error) => toast.error(e.message),
  });
};

export const useDeleteApplicant = () => {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from("vacancy_applicants").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast.success("Applicant removed"); },
    onError: (e: Error) => toast.error(e.message),
  });
};
