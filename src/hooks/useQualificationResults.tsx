import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useOrganizationContext } from "./useOrganizationContext";

// ─── Summative Results for a qualification/academic year ───
export const useSummativeResults = (qualificationId?: string, academicYear?: string) => {
  return useQuery({
    queryKey: ["summative-results", qualificationId, academicYear],
    queryFn: async () => {
      if (!qualificationId || !academicYear) return [];
      const { data, error } = await supabase
        .from("summative_results")
        .select(`
          *,
          template_component:template_component_id(id, component_name, component_type),
          trainees:trainee_id(id, trainee_id, first_name, last_name)
        `)
        .eq("qualification_id", qualificationId)
        .eq("academic_year", academicYear);
      if (error) throw error;
      return data || [];
    },
    enabled: !!qualificationId && !!academicYear,
  });
};

// ─── Qualification Results (final CA + SA + pass/fail) ───
export const useQualificationResults = (qualificationId?: string, academicYear?: string) => {
  return useQuery({
    queryKey: ["qualification-results", qualificationId, academicYear],
    queryFn: async () => {
      if (!qualificationId || !academicYear) return [];
      const { data, error } = await supabase
        .from("qualification_results")
        .select(`
          *,
          template_component:template_component_id(id, component_name, component_type),
          trainees:trainee_id(id, trainee_id, first_name, last_name)
        `)
        .eq("qualification_id", qualificationId)
        .eq("academic_year", academicYear)
        .order("created_at");
      if (error) throw error;
      return data || [];
    },
    enabled: !!qualificationId && !!academicYear,
  });
};

// ─── Save SA Mark (AC only) ───
export const useSaveSummativeMark = () => {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { organizationId } = useOrganizationContext();

  return useMutation({
    mutationFn: async (mark: {
      template_component_id: string;
      trainee_id: string;
      qualification_id: string;
      academic_year: string;
      marks_obtained: number;
      max_marks: number;
    }) => {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error("Not authenticated");
      if (!organizationId) throw new Error("No organization context");

      const percentage = (mark.marks_obtained / mark.max_marks) * 100;

      const { data, error } = await supabase
        .from("summative_results")
        .upsert([{
          ...mark,
          organization_id: organizationId,
          percentage: Math.round(percentage * 100) / 100,
          recorded_by: user.user.id,
          recorded_at: new Date().toISOString(),
          is_locked: true,
          locked_at: new Date().toISOString(),
          locked_by: user.user.id,
          updated_at: new Date().toISOString(),
        }], { onConflict: "template_component_id,trainee_id,academic_year" })
        .select()
        .single();

      if (error) throw error;

      // Trigger result calculation
      await supabase.rpc("calculate_qualification_result", {
        _template_component_id: mark.template_component_id,
        _trainee_id: mark.trainee_id,
        _qualification_id: mark.qualification_id,
        _academic_year: mark.academic_year,
        _org_id: organizationId,
      });

      return data;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["summative-results"] });
      qc.invalidateQueries({ queryKey: ["qualification-results"] });
      toast({ title: "SA Mark Saved", description: "Summative assessment mark recorded and results recalculated." });
    },
    onError: (e: Error) => {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    },
  });
};

// ─── Bulk SA import ───
export const useBulkSaveSummativeMarks = () => {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { organizationId } = useOrganizationContext();

  return useMutation({
    mutationFn: async (marks: Array<{
      template_component_id: string;
      trainee_id: string;
      qualification_id: string;
      academic_year: string;
      marks_obtained: number;
      max_marks: number;
    }>) => {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error("Not authenticated");
      if (!organizationId) throw new Error("No organization context");

      const rows = marks.map(m => ({
        ...m,
        organization_id: organizationId,
        percentage: Math.round(((m.marks_obtained / m.max_marks) * 100) * 100) / 100,
        recorded_by: user.user!.id,
        recorded_at: new Date().toISOString(),
        is_locked: true,
        locked_at: new Date().toISOString(),
        locked_by: user.user!.id,
        updated_at: new Date().toISOString(),
      }));

      const { error } = await supabase
        .from("summative_results")
        .upsert(rows, { onConflict: "template_component_id,trainee_id,academic_year" });

      if (error) throw error;

      // Calculate results for each
      for (const m of marks) {
        await supabase.rpc("calculate_qualification_result", {
          _template_component_id: m.template_component_id,
          _trainee_id: m.trainee_id,
          _qualification_id: m.qualification_id,
          _academic_year: m.academic_year,
          _org_id: organizationId,
        });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["summative-results"] });
      qc.invalidateQueries({ queryKey: ["qualification-results"] });
      toast({ title: "SA Marks Imported", description: "All summative marks saved and results calculated." });
    },
    onError: (e: Error) => {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    },
  });
};

// ─── HoT Approve Results ───
export const useApproveQualificationResults = () => {
  const { toast } = useToast();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (resultIds: string[]) => {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error("Not authenticated");

      const { error } = await supabase
        .from("qualification_results")
        .update({
          approved_by: user.user.id,
          approved_at: new Date().toISOString(),
          is_locked: true,
          updated_at: new Date().toISOString(),
        })
        .in("id", resultIds);

      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["qualification-results"] });
      toast({ title: "Results Approved", description: "Results are now locked and publishable." });
    },
    onError: (e: Error) => {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    },
  });
};

// ─── Trainees for a qualification (for SA entry) ───
export const useQualificationTrainees = (qualificationId?: string, level?: number) => {
  return useQuery({
    queryKey: ["qualification-trainees", qualificationId, level],
    queryFn: async () => {
      if (!qualificationId) return [];
      const { data: qual } = await supabase
        .from("qualifications")
        .select("trade_id")
        .eq("id", qualificationId)
        .single();
      if (!qual?.trade_id) return [];

      let query = supabase
        .from("trainees")
        .select("id, trainee_id, first_name, last_name, level")
        .eq("trade_id", qual.trade_id)
        .eq("status", "active");
      if (level) query = query.eq("level", level);
      const { data, error } = await query.order("last_name");
      if (error) throw error;
      return data || [];
    },
    enabled: !!qualificationId,
  });
};
