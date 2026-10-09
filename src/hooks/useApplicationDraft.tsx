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
      organizationId: orgOverride,
    }: {
      formData: ComprehensiveApplicationData;
      currentTab: string;
      draftId?: string;
      organizationId?: string;
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
            ...(orgOverride ? { organization_id: orgOverride } : {}),
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
            organization_id: orgOverride || organizationId,
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

// Hook for auto-saving with debounce. Remembers the draft it created so later saves update the same draft.
export const useAutoSaveDraft = (
  formData: ComprehensiveApplicationData,
  currentTab: string,
  draftId?: string,
  enabled: boolean = true,
  organizationId?: string
) => {
  const saveDraft = useSaveApplicationDraft();
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const lastSavedRef = useRef<string>("");
  const draftIdRef = useRef<string | undefined>(draftId);

  useEffect(() => { draftIdRef.current = draftId; }, [draftId]);

  const save = useCallback(() => {
    const currentData = JSON.stringify({ formData, currentTab, organizationId });
    if (currentData === lastSavedRef.current || saveDraft.isPending) return;
    lastSavedRef.current = currentData;
    saveDraft.mutate(
      { formData, currentTab, draftId: draftIdRef.current, organizationId },
      {
        onSuccess: (d: any) => { if (d?.id) draftIdRef.current = d.id; },
        onError: () => { lastSavedRef.current = ""; },
      }
    );
  }, [formData, currentTab, organizationId, saveDraft]);

  useEffect(() => {
    if (!enabled) return;
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(save, 2000);
    return () => { if (timeoutRef.current) clearTimeout(timeoutRef.current); };
  }, [formData, currentTab, enabled, save]);

  // Save immediately if the applicant closes or leaves the page
  useEffect(() => {
    if (!enabled) return;
    const flush = () => save();
    const onVis = () => { if (document.visibilityState === "hidden") save(); };
    window.addEventListener("beforeunload", flush);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.removeEventListener("beforeunload", flush);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [enabled, save]);

  return {
    isSaving: saveDraft.isPending,
    lastSaved: saveDraft.data?.last_updated_at,
    error: saveDraft.isError,
    saveNow: save,
  };
};

/** Mandatory fields an applicant must complete; progress reaches 100% only when all are done. */
export const MANDATORY_FIELDS: { key: keyof ComprehensiveApplicationData; label: string }[] = [
  { key: "photo_path", label: "Passport photo" },
  { key: "last_name", label: "Surname" },
  { key: "first_name", label: "First name" },
  { key: "date_of_birth", label: "Date of birth" },
  { key: "gender", label: "Gender" },
  { key: "national_id", label: "Identity number" },
  { key: "phone", label: "Contact number" },
  { key: "nationality", label: "Nationality" },
  { key: "region", label: "Region" },
  { key: "address", label: "Residential address" },
  { key: "emergency_contact_name", label: "Emergency contact name" },
  { key: "emergency_contact_phone", label: "Emergency contact number" },
  { key: "emergency_contact_relationship", label: "Emergency contact relationship" },
  { key: "emergency_contact_town", label: "Emergency contact town" },
  { key: "trade_id", label: "Trade (choice 1)" },
  { key: "preferred_training_mode", label: "Training mode" },
  { key: "preferred_level", label: "Level" },
  { key: "intake", label: "Intake" },
  { key: "academic_year", label: "Academic year" },
  { key: "highest_grade_passed", label: "Highest grade passed" },
  { key: "id_document_path", label: "ID / birth certificate" },
  { key: "school_leaving_cert_path", label: "School leaving certificate" },
  { key: "academic_qualifications_path", label: "Academic qualifications" },
  { key: "declaration_accepted", label: "Declaration" },
];

export const missingMandatoryFields = (formData: ComprehensiveApplicationData) =>
  MANDATORY_FIELDS.filter(({ key }) => {
    const v = formData[key] as unknown;
    if (typeof v === "string") return v.trim() === "";
    if (typeof v === "boolean") return v !== true;
    return v === undefined || v === null;
  });

// Progress = share of mandatory fields completed (0–100)
export function calculateProgress(formData: ComprehensiveApplicationData): number {
  const missing = missingMandatoryFields(formData).length;
  return Math.round(((MANDATORY_FIELDS.length - missing) / MANDATORY_FIELDS.length) * 100);
}
