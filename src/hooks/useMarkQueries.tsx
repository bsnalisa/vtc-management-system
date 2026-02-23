import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

// ─── Trainee's own queries ───
export const useMyMarkQueries = (traineeId: string | null | undefined) => {
  return useQuery({
    queryKey: ["my-mark-queries", traineeId],
    queryFn: async () => {
      if (!traineeId) return [];
      const { data, error } = await supabase
        .from("gradebook_mark_queries")
        .select(`
          *,
          gradebook_components:component_id (id, name, component_type, max_marks),
          gradebooks:gradebook_id (id, title, academic_year, level, status)
        `)
        .eq("trainee_id", traineeId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!traineeId,
  });
};

// ─── Submit a mark query (trainee) ───
export const useSubmitMarkQuery = () => {
  const { toast } = useToast();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (query: {
      gradebook_id: string;
      component_id: string;
      trainee_id: string;
      query_type: string;
      subject: string;
      description: string;
    }) => {
      const { data, error } = await supabase
        .from("gradebook_mark_queries")
        .insert([query])
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["my-mark-queries"] });
      qc.invalidateQueries({ queryKey: ["gradebook-queries"] });
      toast({ title: "Query Submitted", description: "Your marks query has been submitted to the trainer." });
      // Fire-and-forget notification to trainer
      (async () => {
        try {
          const { data: gb } = await supabase
            .from("gradebooks")
            .select("organization_id, trainer_id, trainers:trainer_id (user_id)")
            .eq("id", data.gradebook_id)
            .single();
          if (gb && (gb as any).trainers?.user_id) {
            await supabase.functions.invoke("create-notification", {
              body: {
                organization_id: gb.organization_id,
                user_id: (gb as any).trainers.user_id,
                type: "mark_query_received",
                title: "New Mark Query",
                message: `A trainee has raised a query: ${data.subject}`,
                priority: "medium",
                action_url: `/gradebooks/${data.gradebook_id}`,
              },
            });
          }
        } catch (e) { console.warn("Notification failed:", e); }
      })();
    },
    onError: (e: Error) => {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    },
  });
};

// ─── Queries for a specific gradebook (trainer/staff view) ───
export const useGradebookQueries = (gradebookId: string | undefined) => {
  return useQuery({
    queryKey: ["gradebook-queries", gradebookId],
    queryFn: async () => {
      if (!gradebookId) return [];
      const { data, error } = await supabase
        .from("gradebook_mark_queries")
        .select(`
          *,
          gradebook_components:component_id (id, name, component_type),
          trainees:trainee_id (id, trainee_id, first_name, last_name)
        `)
        .eq("gradebook_id", gradebookId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!gradebookId,
  });
};

// ─── Resolve/reject a query (trainer/staff) ───
export const useResolveMarkQuery = () => {
  const { toast } = useToast();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ queryId, status, resolution_notes }: { queryId: string; status: "resolved" | "rejected"; resolution_notes: string }) => {
      const { data: user } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("gradebook_mark_queries")
        .update({
          status,
          resolution_notes,
          resolved_by: user.user?.id,
          resolved_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", queryId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["gradebook-queries"] });
      qc.invalidateQueries({ queryKey: ["my-mark-queries"] });
      toast({ title: "Query Updated", description: "The mark query has been updated." });
      // Notification to trainee handled by realtime subscription on the table
    },
    onError: (e: Error) => {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    },
  });
};
