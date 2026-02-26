import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useOrganizationContext } from "./useOrganizationContext";

export interface AssessmentTemplate {
  id: string;
  organization_id: string;
  qualification_id: string;
  status: "draft" | "pending_approval" | "approved" | "rejected";
  theory_pass_mark: number;
  practical_pass_mark: number;
  created_by: string;
  approved_by: string | null;
  approved_at: string | null;
  rejection_reason: string | null;
  version_number: number;
  created_at: string;
  updated_at: string;
  qualifications?: {
    qualification_title: string;
    qualification_code: string;
    nqf_level: number;
  };
}

export interface TemplateComponent {
  id: string;
  template_id: string;
  component_name: string;
  component_type: "theory" | "practical";
  sequence_order: number;
  description: string | null;
  created_at: string;
  updated_at: string;
}

// Fetch all assessment templates for the organization
export const useAssessmentTemplates = (statusFilter?: string) => {
  const { organizationId } = useOrganizationContext();

  return useQuery({
    queryKey: ["assessment-templates", organizationId, statusFilter],
    queryFn: async () => {
      if (!organizationId) return [];

      let query = supabase
        .from("assessment_templates")
        .select(`
          *,
          qualifications:qualification_id(qualification_title, qualification_code, nqf_level)
        `)
        .eq("organization_id", organizationId)
        .order("created_at", { ascending: false });

      if (statusFilter) {
        query = query.eq("status", statusFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as AssessmentTemplate[];
    },
    enabled: !!organizationId,
  });
};

// Fetch template components
export const useTemplateComponents = (templateId?: string) => {
  return useQuery({
    queryKey: ["template-components", templateId],
    queryFn: async () => {
      if (!templateId) return [];

      const { data, error } = await supabase
        .from("assessment_template_components")
        .select("*")
        .eq("template_id", templateId)
        .order("component_type")
        .order("sequence_order");

      if (error) throw error;
      return data as TemplateComponent[];
    },
    enabled: !!templateId,
  });
};

// Fetch template for a qualification
export const useTemplateForQualification = (qualificationId?: string) => {
  return useQuery({
    queryKey: ["assessment-template-by-qualification", qualificationId],
    queryFn: async () => {
      if (!qualificationId) return null;

      const { data, error } = await supabase
        .from("assessment_templates")
        .select(`
          *,
          qualifications:qualification_id(qualification_title, qualification_code, nqf_level)
        `)
        .eq("qualification_id", qualificationId)
        .maybeSingle();

      if (error) throw error;
      return data as AssessmentTemplate | null;
    },
    enabled: !!qualificationId,
  });
};

// Create template
export const useCreateAssessmentTemplate = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { organizationId } = useOrganizationContext();

  return useMutation({
    mutationFn: async (data: {
      qualification_id: string;
      theory_pass_mark?: number;
      practical_pass_mark?: number;
    }) => {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error("Not authenticated");
      if (!organizationId) throw new Error("No organization context");

      const { data: result, error } = await supabase
        .from("assessment_templates")
        .insert([{
          ...data,
          organization_id: organizationId,
          created_by: user.user.id,
        }])
        .select(`
          *,
          qualifications:qualification_id(qualification_title, qualification_code, nqf_level)
        `)
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assessment-templates"] });
      toast({ title: "Success", description: "Assessment template created" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });
};

// Add component to template
export const useAddTemplateComponent = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      template_id: string;
      component_name: string;
      component_type: "theory" | "practical";
      sequence_order?: number;
      description?: string;
    }) => {
      const { data: result, error } = await supabase
        .from("assessment_template_components")
        .insert([data])
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["template-components", data.template_id] });
      toast({ title: "Success", description: "Component added" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });
};

// Delete component
export const useDeleteTemplateComponent = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, templateId }: { id: string; templateId: string }) => {
      const { error } = await supabase
        .from("assessment_template_components")
        .delete()
        .eq("id", id);

      if (error) throw error;
      return { templateId };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["template-components", data.templateId] });
      toast({ title: "Component removed" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });
};

// Submit template for HoT approval
export const useSubmitTemplate = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (templateId: string) => {
      const { error } = await supabase
        .from("assessment_templates")
        .update({ status: "pending_approval" })
        .eq("id", templateId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assessment-templates"] });
      toast({ title: "Submitted", description: "Template submitted for HoT approval" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });
};

// HoT approve template
export const useApproveTemplate = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (templateId: string) => {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error("Not authenticated");

      const { error } = await supabase
        .from("assessment_templates")
        .update({
          status: "approved",
          approved_by: user.user.id,
          approved_at: new Date().toISOString(),
        })
        .eq("id", templateId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assessment-templates"] });
      toast({ title: "Approved", description: "Assessment template is now active" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });
};

// HoT reject template
export const useRejectTemplate = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ templateId, reason }: { templateId: string; reason: string }) => {
      const { error } = await supabase
        .from("assessment_templates")
        .update({
          status: "rejected",
          rejection_reason: reason,
        })
        .eq("id", templateId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assessment-templates"] });
      toast({ title: "Rejected", description: "Template returned with feedback" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });
};

// Update template thresholds
export const useUpdateTemplate = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...data }: { id: string; theory_pass_mark?: number; practical_pass_mark?: number }) => {
      const { error } = await supabase
        .from("assessment_templates")
        .update({ ...data, updated_at: new Date().toISOString() })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assessment-templates"] });
      toast({ title: "Updated", description: "Template thresholds updated" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });
};
