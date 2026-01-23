import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useOrganizationContext } from "./useOrganizationContext";
import { ComprehensiveApplicationData } from "@/types/application";
import { useCallback, useEffect, useRef } from "react";

interface ApplicationDraft {
  id: string;
  user_id: string;
  organization_id: string | null;
  form_data: ComprehensiveApplicationData;
  current_tab: string;
  progress_percentage: number;
  last_updated_at: string;
  created_at: string;
}

export const useApplicationDraft = () => {
  const { organizationId } = useOrganizationContext();
  const queryClient = useQueryClient();

  return useQuery({
    queryKey: ["application_draft", organizationId],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data, error } = await supabase
        .from("application_drafts")
        .select("*")
        .eq("user_id", user.id)
        .order("last_updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      if (!data) return null;
      
      return {
        ...data,
        form_data: data.form_data as unknown as ComprehensiveApplicationData,
      } as ApplicationDraft;
    },
  });
};

export const useSaveApplicationDraft = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { organizationId } = useOrganizationContext();

  return useMutation({
    mutationFn: async ({
      formData,
      currentTab,
      draftId,
    }: {
      formData: ComprehensiveApplicationData;
      currentTab: string;
      draftId?: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Calculate progress percentage
      const progress = calculateProgress(formData);

      if (draftId) {
        // Update existing draft
        const { data, error } = await supabase
          .from("application_drafts")
          .update({
            form_data: formData as any,
            current_tab: currentTab,
            progress_percentage: progress,
            last_updated_at: new Date().toISOString(),
          })
          .eq("id", draftId)
          .select()
          .single();

        if (error) throw error;
        return data;
      } else {
        // Create new draft
        const { data, error } = await supabase
          .from("application_drafts")
          .insert({
            user_id: user.id,
            organization_id: organizationId,
            form_data: formData as any,
            current_tab: currentTab,
            progress_percentage: progress,
          })
          .select()
          .single();

        if (error) throw error;
        return data;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["application_draft"] });
    },
    onError: (error: Error) => {
      console.error("Failed to save draft:", error);
    },
  });
};

export const useDeleteApplicationDraft = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (draftId: string) => {
      const { error } = await supabase
        .from("application_drafts")
        .delete()
        .eq("id", draftId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["application_draft"] });
      toast({
        title: "Draft deleted",
        description: "Your draft application has been discarded.",
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

// Hook for auto-saving with debounce
export const useAutoSaveDraft = (
  formData: ComprehensiveApplicationData,
  currentTab: string,
  draftId?: string,
  enabled: boolean = true
) => {
  const saveDraft = useSaveApplicationDraft();
  const timeoutRef = useRef<NodeJS.Timeout>();
  const lastSavedRef = useRef<string>("");

  const save = useCallback(() => {
    const currentData = JSON.stringify({ formData, currentTab });
    if (currentData !== lastSavedRef.current) {
      lastSavedRef.current = currentData;
      saveDraft.mutate({ formData, currentTab, draftId });
    }
  }, [formData, currentTab, draftId, saveDraft]);

  useEffect(() => {
    if (!enabled) return;

    // Clear existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Set new timeout for auto-save (2 seconds debounce)
    timeoutRef.current = setTimeout(() => {
      save();
    }, 2000);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [formData, currentTab, enabled, save]);

  return {
    isSaving: saveDraft.isPending,
    lastSaved: saveDraft.data?.last_updated_at,
    saveNow: save,
  };
};

// Calculate progress based on filled fields
function calculateProgress(formData: ComprehensiveApplicationData): number {
  const sections = [
    // Personal (weight: 25%)
    {
      weight: 25,
      fields: ['first_name', 'last_name', 'date_of_birth', 'gender', 'national_id', 'phone', 'address', 'region'],
    },
    // Emergency (weight: 15%)
    {
      weight: 15,
      fields: ['emergency_contact_name', 'emergency_contact_phone', 'emergency_contact_relationship', 'emergency_contact_town'],
    },
    // Training (weight: 20%)
    {
      weight: 20,
      fields: ['trade_id', 'preferred_training_mode', 'preferred_level', 'intake', 'academic_year'],
    },
    // Education (weight: 15%)
    {
      weight: 15,
      fields: ['highest_grade_passed'],
      arrayFields: ['school_subjects'],
    },
    // Health & PPE (weight: 10%)
    {
      weight: 10,
      booleanFields: ['has_disability', 'has_special_needs', 'has_chronic_diseases'],
    },
    // Declaration (weight: 15%)
    {
      weight: 15,
      booleanFields: ['declaration_accepted'],
    },
  ];

  let totalProgress = 0;

  for (const section of sections) {
    let filledCount = 0;
    let totalFields = 0;

    // Check regular fields
    if (section.fields) {
      totalFields += section.fields.length;
      for (const field of section.fields) {
        const value = formData[field as keyof ComprehensiveApplicationData];
        if (value && value !== '' && value !== 0) {
          filledCount++;
        }
      }
    }

    // Check array fields
    if (section.arrayFields) {
      totalFields += section.arrayFields.length;
      for (const field of section.arrayFields) {
        const value = formData[field as keyof ComprehensiveApplicationData] as any[];
        if (value && value.length > 0) {
          filledCount++;
        }
      }
    }

    // Check boolean fields (consider answered, not just true)
    if (section.booleanFields) {
      totalFields += section.booleanFields.length;
      for (const field of section.booleanFields) {
        const value = formData[field as keyof ComprehensiveApplicationData];
        if (value === true) {
          filledCount++;
        }
      }
    }

    if (totalFields > 0) {
      const sectionProgress = (filledCount / totalFields) * section.weight;
      totalProgress += sectionProgress;
    }
  }

  return Math.round(totalProgress);
}