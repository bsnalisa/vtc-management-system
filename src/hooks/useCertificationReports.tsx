import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganizationContext } from "./useOrganizationContext";

// Report RPCs are newer than the generated Supabase types, so access untyped.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export interface CertifiedTraineeRow {
  trainee_number: string;
  first_name: string;
  last_name: string;
  trade: string | null;
  level: number | null;
  qualification: string;
  qualification_code: string;
  nqf_level: number | null;
  academic_year: string;
  certified_on: string | null;
}

export interface AssessmentCertificationRow {
  qualification: string;
  qualification_code: string;
  academic_year: string;
  candidates: number;
  certified: number;
  not_yet_certified: number;
  certification_rate: number | null;
}

/** Trainees whose results for a qualification are all approved passes. Pass null for every year. */
export const useCertifiedTrainees = (academicYear: string | null) => {
  const { organizationId } = useOrganizationContext();
  return useQuery({
    queryKey: ["certified-trainees-report", organizationId, academicYear],
    enabled: !!organizationId,
    queryFn: async () => {
      const { data, error } = await db.rpc("certified_trainees_report", { _academic_year: academicYear });
      if (error) throw error;
      return (data ?? []) as CertifiedTraineeRow[];
    },
  });
};

export const useAssessmentCertificationSummary = (academicYear: string | null) => {
  const { organizationId } = useOrganizationContext();
  return useQuery({
    queryKey: ["assessment-certification-summary", organizationId, academicYear],
    enabled: !!organizationId,
    queryFn: async () => {
      const { data, error } = await db.rpc("assessment_certification_summary", { _academic_year: academicYear });
      if (error) throw error;
      // bigint columns can arrive as strings; normalise to numbers
      return ((data ?? []) as AssessmentCertificationRow[]).map((r) => ({
        ...r,
        candidates: Number(r.candidates),
        certified: Number(r.certified),
        not_yet_certified: Number(r.not_yet_certified),
        certification_rate: r.certification_rate == null ? null : Number(r.certification_rate),
      }));
    },
  });
};
