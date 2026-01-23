import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useOrganizationContext } from "@/hooks/useOrganizationContext";

export interface Transcript {
  id: string;
  organization_id: string;
  trainee_id: string;
  transcript_number: string;
  issue_date: string;
  academic_year: string;
  total_credits: number;
  completed_credits: number;
  gpa: number | null;
  status: string;
  generated_by: string;
  approved_by: string | null;
  approved_at: string | null;
  file_path: string | null;
  created_at: string;
  trainees?: { 
    trainee_id: string; 
    first_name: string; 
    last_name: string;
    trades?: { name: string };
  };
}

export const useTranscripts = () => {
  const { organizationId } = useOrganizationContext();

  return useQuery({
    queryKey: ["transcripts", organizationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transcripts")
        .select(`
          *,
          trainees (trainee_id, first_name, last_name, trades (name))
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as Transcript[];
    },
    enabled: !!organizationId,
  });
};

export const useGenerateTranscript = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { organizationId } = useOrganizationContext();

  return useMutation({
    mutationFn: async ({ traineeId, academicYear }: { traineeId: string; academicYear: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !organizationId) throw new Error("Not authenticated");

      // Get trainee's assessment results
      const { data: results } = await supabase
        .from("assessment_results")
        .select(`
          *,
          unit_standards (credit)
        `)
        .eq("trainee_id", traineeId);

      const totalCredits = results?.reduce((sum, r) => sum + (r.unit_standards?.credit || 0), 0) || 0;
      const completedCredits = results?.filter(r => r.competency_status === 'competent')
        .reduce((sum, r) => sum + (r.unit_standards?.credit || 0), 0) || 0;

      // Calculate GPA
      const { data: gpa } = await supabase
        .rpc("calculate_trainee_gpa", { _trainee_id: traineeId });

      // Generate transcript number
      const { data: transcriptNumber } = await supabase
        .rpc("generate_transcript_number", { _org_id: organizationId });

      const { data: transcript, error } = await supabase
        .from("transcripts")
        .insert({
          organization_id: organizationId,
          trainee_id: traineeId,
          transcript_number: transcriptNumber,
          academic_year: academicYear,
          total_credits: totalCredits,
          completed_credits: completedCredits,
          gpa: gpa || 0,
          status: 'draft',
          generated_by: user.id,
        })
        .select()
        .single();

      if (error) throw error;
      return transcript;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transcripts"] });
      toast({ title: "Transcript generated successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });
};

export const useApproveTranscript = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (transcriptId: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase
        .from("transcripts")
        .update({
          status: 'approved',
          approved_by: user.id,
          approved_at: new Date().toISOString(),
        })
        .eq("id", transcriptId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transcripts"] });
      toast({ title: "Transcript approved" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });
};
