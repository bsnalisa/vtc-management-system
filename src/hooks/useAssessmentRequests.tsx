import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useOrganizationContext } from "./useOrganizationContext";

// Newer than the generated Supabase types, so access untyped.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export type RequestType = "rpl" | "exemption" | "external_assessment";
export type RequestStatus = "submitted" | "more_info_needed" | "under_review" | "assessment_scheduled" | "approved" | "rejected";

export interface EvidenceFile { name: string; path: string }

export interface AssessmentRequest {
  id: string;
  request_type: RequestType;
  reference_number: string;
  trainee_id: string | null;
  applicant_name: string;
  national_id: string | null;
  phone: string | null;
  email: string | null;
  qualification_id: string | null;
  unit_standard_id: string | null;
  nqf_level: number | null;
  motivation: string;
  evidence: EvidenceFile[];
  status: RequestStatus;
  assessor_name: string | null;
  scheduled_at: string | null;
  venue: string | null;
  outcome: "competent" | "not_yet_competent" | null;
  decision_notes: string | null;
  decided_at: string | null;
  created_at: string;
  qualifications?: { qualification_title: string } | null;
  unit_standards?: { unit_no: string; module_title: string } | null;
}

const SELECT = "*, qualifications(qualification_title), unit_standards(unit_no, module_title)";

export const REQUEST_LABELS: Record<RequestType, string> = {
  rpl: "RPL",
  exemption: "Exemption",
  external_assessment: "External assessment",
};

/** Staff see every request in the organisation; applicants see only their own (row-level security). */
export const useAssessmentRequests = (type?: RequestType) => {
  const { organizationId } = useOrganizationContext();
  return useQuery({
    queryKey: ["assessment-requests", organizationId, type ?? "all"],
    enabled: !!organizationId,
    queryFn: async () => {
      let q = db.from("assessment_requests").select(SELECT).eq("organization_id", organizationId)
        .order("created_at", { ascending: false });
      if (type) q = q.eq("request_type", type);
      const { data, error } = await q;
      if (error) throw error;
      return data as AssessmentRequest[];
    },
  });
};

export const useSubmitAssessmentRequest = () => {
  const queryClient = useQueryClient();
  const { organizationId } = useOrganizationContext();
  return useMutation({
    mutationFn: async (r: Partial<AssessmentRequest>) => {
      if (!organizationId) throw new Error("No organization ID");
      const { error } = await db.from("assessment_requests").insert([{ ...r, organization_id: organizationId }]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assessment-requests"] });
      toast.success("Request submitted");
    },
    onError: (e: Error) => toast.error(e.message),
  });
};

export const useUpdateAssessmentRequest = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...patch }: Partial<AssessmentRequest> & { id: string }) => {
      const { error } = await db.from("assessment_requests").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assessment-requests"] });
      toast.success("Request updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });
};

export const useUnitStandardOptions = () =>
  useQuery({
    queryKey: ["unit-standard-options"],
    queryFn: async () => {
      const { data, error } = await supabase.from("unit_standards").select("id, unit_no, module_title, level").eq("active", true).order("unit_no");
      if (error) throw error;
      return data;
    },
  });

export const useQualificationOptions = () => {
  const { organizationId } = useOrganizationContext();
  return useQuery({
    queryKey: ["qualification-options", organizationId],
    enabled: !!organizationId,
    queryFn: async () => {
      const { data, error } = await supabase.from("qualifications").select("id, qualification_title, qualification_code, nqf_level").eq("organization_id", organizationId!).eq("active", true).order("qualification_title");
      if (error) throw error;
      return data;
    },
  });
};

/** Evidence lives in a private bucket, so open it through a short-lived signed link. */
export const openEvidence = async (path: string) => {
  const { data, error } = await supabase.storage.from("documents").createSignedUrl(path, 3600);
  if (error || !data) {
    toast.error("Could not open the file");
    return;
  }
  window.open(data.signedUrl, "_blank", "noopener,noreferrer");
};
