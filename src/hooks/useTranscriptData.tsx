import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { TranscriptData } from "@/lib/transcriptDocument";

// Newer than the generated Supabase types, so access untyped.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

/** Approved-result transcript for one trainee. `academicYear` null means all years. */
export const useTranscriptData = (traineeId: string | undefined | null, academicYear: string | null) =>
  useQuery({
    queryKey: ["transcript-data", traineeId, academicYear], enabled: !!traineeId,
    queryFn: async () => {
      const { data, error } = await db.rpc("transcript_data", { _trainee: traineeId, _academic_year: academicYear });
      if (error) throw error;
      return data as TranscriptData;
    },
  });

/** Academic years in which the trainee has approved results. */
export const useTranscriptYears = (traineeId: string | undefined | null) =>
  useQuery({
    queryKey: ["transcript-years", traineeId], enabled: !!traineeId,
    queryFn: async () => {
      const { data, error } = await db.from("qualification_results").select("academic_year")
        .eq("trainee_id", traineeId).not("approved_at", "is", null);
      if (error) throw error;
      const years = new Set<string>((data as { academic_year: string }[]).map((r) => r.academic_year).filter(Boolean));
      return Array.from(years).sort().reverse();
    },
  });

export const useIssueTranscript = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ traineeId, academicYear }: { traineeId: string; academicYear: string }) => {
      const { data, error } = await db.rpc("issue_transcript", { _trainee: traineeId, _academic_year: academicYear });
      if (error) throw error;
      return data as TranscriptData;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transcripts"] });
      toast.success("Transcript issued");
    },
    onError: (e: Error) => toast.error(e.message),
  });
};
