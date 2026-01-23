import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface TrainingModule {
  id: string;
  title: string;
  description: string | null;
  content: string | null;
  duration_minutes: number | null;
  order_index: number;
  is_required: boolean;
  role_specific: string[] | null;
}

export interface OnboardingProgress {
  id: string;
  user_id: string;
  current_step: number;
  profile_completed: boolean;
  training_started: boolean;
  training_completed: boolean;
  completed_modules: string[];
  onboarding_completed: boolean;
  completed_at: string | null;
}

export interface ModuleCompletion {
  id: string;
  user_id: string;
  module_id: string;
  completed_at: string;
  score: number | null;
  feedback: string | null;
}

export const useTrainingModules = (roleFilter?: string) => {
  return useQuery({
    queryKey: ["training-modules", roleFilter],
    queryFn: async () => {
      let query = supabase
        .from("training_modules")
        .select("*")
        .order("order_index", { ascending: true });

      const { data, error } = await query;
      if (error) throw error;

      // Filter by role if specified
      if (roleFilter && data) {
        return data.filter(
          (module) =>
            !module.role_specific ||
            module.role_specific.length === 0 ||
            module.role_specific.includes(roleFilter)
        );
      }

      return data as TrainingModule[];
    },
  });
};

export const useOnboardingProgress = (userId?: string) => {
  return useQuery({
    queryKey: ["onboarding-progress", userId],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const targetUserId = userId || user?.id;

      if (!targetUserId) throw new Error("No user ID provided");

      const { data, error } = await supabase
        .from("onboarding_progress")
        .select("*")
        .eq("user_id", targetUserId)
        .single();

      if (error && error.code !== "PGRST116") throw error;

      return data as OnboardingProgress | null;
    },
  });
};

export const useModuleCompletions = (userId?: string) => {
  return useQuery({
    queryKey: ["module-completions", userId],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const targetUserId = userId || user?.id;

      if (!targetUserId) throw new Error("No user ID provided");

      const { data, error } = await supabase
        .from("module_completions")
        .select("*")
        .eq("user_id", targetUserId);

      if (error) throw error;

      return data as ModuleCompletion[];
    },
  });
};

export const useUpdateOnboardingProgress = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (updates: Partial<OnboardingProgress>) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("onboarding_progress")
        .upsert({
          user_id: user.id,
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["onboarding-progress"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });
};

export const useCompleteModule = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      moduleId,
      score,
      feedback,
    }: {
      moduleId: string;
      score?: number;
      feedback?: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Record module completion
      const { error: completionError } = await supabase
        .from("module_completions")
        .upsert({
          user_id: user.id,
          module_id: moduleId,
          score: score || null,
          feedback: feedback || null,
          completed_at: new Date().toISOString(),
        });

      if (completionError) throw completionError;

      // Update onboarding progress
      const { data: progress } = await supabase
        .from("onboarding_progress")
        .select("*")
        .eq("user_id", user.id)
        .single();

      const completedModules = progress?.completed_modules || [];
      if (!completedModules.includes(moduleId)) {
        completedModules.push(moduleId);
      }

      const { error: progressError } = await supabase
        .from("onboarding_progress")
        .upsert({
          user_id: user.id,
          completed_modules: completedModules,
          training_started: true,
          updated_at: new Date().toISOString(),
        });

      if (progressError) throw progressError;

      return { moduleId };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["module-completions"] });
      queryClient.invalidateQueries({ queryKey: ["onboarding-progress"] });
      toast({
        title: "Success",
        description: "Module completed successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });
};

export const useCreateTrainingModule = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (moduleData: Omit<TrainingModule, "id">) => {
      const { data, error } = await supabase
        .from("training_modules")
        .insert([moduleData])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["training-modules"] });
      toast({
        title: "Success",
        description: "Training module created successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });
};

export const useUpdateTrainingModule = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      updates,
    }: {
      id: string;
      updates: Partial<TrainingModule>;
    }) => {
      const { data, error } = await supabase
        .from("training_modules")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["training-modules"] });
      toast({
        title: "Success",
        description: "Training module updated successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });
};

export const useDeleteTrainingModule = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("training_modules")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["training-modules"] });
      toast({
        title: "Success",
        description: "Training module deleted successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });
};