import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useOrganizationContext } from "./useOrganizationContext";

export type QualificationType = "nvc" | "diploma";
export type QualificationStatus = "draft" | "pending_approval" | "approved" | "rejected";
export type DurationUnit = "months" | "years";
export type ApprovalAction = "submitted" | "approved" | "rejected" | "returned";

export interface Qualification {
  id: string;
  organization_id: string;
  qualification_title: string;
  qualification_code: string;
  qualification_type: QualificationType;
  nqf_level: number;
  duration_value: number;
  duration_unit: DurationUnit;
  status: QualificationStatus;
  created_by: string;
  approved_by: string | null;
  approval_date: string | null;
  version_number: number;
  active: boolean;
  rejection_comments: string | null;
  trade_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface QualificationUnitStandard {
  id: string;
  qualification_id: string;
  unit_standard_id: string;
  unit_standard_title: string;
  credit_value: number | null;
  level: number;
  is_mandatory: boolean;
  created_at: string;
  updated_at: string;
}

export interface QualificationApproval {
  id: string;
  qualification_id: string;
  action: ApprovalAction;
  performed_by: string;
  comments: string | null;
  created_at: string;
}

export interface CreateQualificationData {
  qualification_title: string;
  qualification_code: string;
  qualification_type: QualificationType;
  nqf_level: number;
  duration_value: number;
  duration_unit: DurationUnit;
  trade_id?: string;
}

export interface CreateUnitStandardData {
  qualification_id: string;
  unit_standard_id: string;
  unit_standard_title: string;
  credit_value?: number;
  level: number;
  is_mandatory: boolean;
}

// Fetch all qualifications for the organization
export const useQualifications = (statusFilter?: QualificationStatus) => {
  const { organizationId } = useOrganizationContext();

  return useQuery({
    queryKey: ["qualifications", organizationId, statusFilter],
    queryFn: async () => {
      if (!organizationId) return [];

      let query = supabase
        .from("qualifications")
        .select("*")
        .eq("organization_id", organizationId)
        .order("created_at", { ascending: false });

      if (statusFilter) {
        query = query.eq("status", statusFilter);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as Qualification[];
    },
    enabled: !!organizationId,
  });
};

// Fetch approved qualifications only (for registration)
export const useApprovedQualifications = () => {
  const { organizationId } = useOrganizationContext();

  return useQuery({
    queryKey: ["qualifications", "approved", organizationId],
    queryFn: async () => {
      if (!organizationId) return [];

      const { data, error } = await supabase
        .from("qualifications")
        .select("*")
        .eq("organization_id", organizationId)
        .eq("status", "approved")
        .eq("active", true)
        .order("qualification_title");

      if (error) throw error;
      return data as Qualification[];
    },
    enabled: !!organizationId,
  });
};

// Fetch pending qualifications for approval
export const usePendingQualifications = () => {
  const { organizationId } = useOrganizationContext();

  return useQuery({
    queryKey: ["qualifications", "pending", organizationId],
    queryFn: async () => {
      if (!organizationId) return [];

      const { data, error } = await supabase
        .from("qualifications")
        .select("*")
        .eq("organization_id", organizationId)
        .eq("status", "pending_approval")
        .order("updated_at", { ascending: false });

      if (error) throw error;
      return data as Qualification[];
    },
    enabled: !!organizationId,
  });
};

// Fetch single qualification with unit standards
export const useQualificationDetail = (qualificationId?: string) => {
  return useQuery({
    queryKey: ["qualification", qualificationId],
    queryFn: async () => {
      if (!qualificationId) return null;

      const { data, error } = await supabase
        .from("qualifications")
        .select("*")
        .eq("id", qualificationId)
        .single();

      if (error) throw error;
      return data as Qualification;
    },
    enabled: !!qualificationId,
  });
};

// Fetch unit standards for a qualification
export const useQualificationUnitStandards = (qualificationId?: string) => {
  return useQuery({
    queryKey: ["qualification-unit-standards", qualificationId],
    queryFn: async () => {
      if (!qualificationId) return [];

      const { data, error } = await supabase
        .from("qualification_unit_standards")
        .select("*")
        .eq("qualification_id", qualificationId)
        .order("unit_standard_id");

      if (error) throw error;
      return data as QualificationUnitStandard[];
    },
    enabled: !!qualificationId,
  });
};

// Fetch approval history
export const useQualificationApprovals = (qualificationId?: string) => {
  return useQuery({
    queryKey: ["qualification-approvals", qualificationId],
    queryFn: async () => {
      if (!qualificationId) return [];

      const { data, error } = await supabase
        .from("qualification_approvals")
        .select("*")
        .eq("qualification_id", qualificationId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as QualificationApproval[];
    },
    enabled: !!qualificationId,
  });
};

// Create qualification mutation
export const useCreateQualification = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { organizationId } = useOrganizationContext();

  return useMutation({
    mutationFn: async (data: CreateQualificationData) => {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error("Not authenticated");
      if (!organizationId) throw new Error("No organization context");

      const { data: result, error } = await supabase
        .from("qualifications")
        .insert([{
          ...data,
          organization_id: organizationId,
          created_by: user.user.id,
        }])
        .select()
        .single();

      if (error) throw error;
      return result as Qualification;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["qualifications"] });
      toast({
        title: "Success",
        description: "Qualification created successfully",
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

// Update qualification mutation
export const useUpdateQualification = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, currentStatus, ...data }: Partial<Qualification> & { id: string; currentStatus?: string }) => {
      // If updating an approved qualification, automatically set status to draft for re-approval
      const updateData = { ...data };
      if (currentStatus === "approved") {
        updateData.status = "draft";
        updateData.approved_by = null;
        updateData.approval_date = null;
      }
      
      const { data: result, error } = await supabase
        .from("qualifications")
        .update(updateData)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return result as Qualification;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["qualifications"] });
      queryClient.invalidateQueries({ queryKey: ["qualification", data.id] });
      queryClient.invalidateQueries({ queryKey: ["qualification-unit-standards"] });
      queryClient.refetchQueries({ queryKey: ["qualifications"] });
      toast({
        title: "Success",
        description: "Qualification updated successfully",
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

// Submit for approval mutation
export const useSubmitForApproval = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (qualificationId: string) => {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error("Not authenticated");

      // Update status
      const { error: updateError } = await supabase
        .from("qualifications")
        .update({ status: "pending_approval" })
        .eq("id", qualificationId);

      if (updateError) throw updateError;

      // Create approval record
      const { error: auditError } = await supabase
        .from("qualification_approvals")
        .insert([{
          qualification_id: qualificationId,
          action: "submitted",
          performed_by: user.user.id,
        }]);

      if (auditError) throw auditError;

      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["qualifications"] });
      toast({
        title: "Submitted for Approval",
        description: "The qualification has been submitted for Head of Training approval",
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

// Approve qualification mutation
export const useApproveQualification = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ qualificationId, comments }: { qualificationId: string; comments?: string }) => {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error("Not authenticated");

      // Update status
      const { error: updateError } = await supabase
        .from("qualifications")
        .update({ 
          status: "approved",
          approved_by: user.user.id,
          approval_date: new Date().toISOString(),
        })
        .eq("id", qualificationId);

      if (updateError) throw updateError;

      // Create approval record
      const { error: auditError } = await supabase
        .from("qualification_approvals")
        .insert([{
          qualification_id: qualificationId,
          action: "approved",
          performed_by: user.user.id,
          comments,
        }]);

      if (auditError) throw auditError;

      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["qualifications"] });
      toast({
        title: "Qualification Approved",
        description: "The qualification is now visible system-wide",
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

// Reject qualification mutation
export const useRejectQualification = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ qualificationId, comments }: { qualificationId: string; comments: string }) => {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error("Not authenticated");

      // Update status
      const { error: updateError } = await supabase
        .from("qualifications")
        .update({ 
          status: "rejected",
          rejection_comments: comments,
        })
        .eq("id", qualificationId);

      if (updateError) throw updateError;

      // Create approval record
      const { error: auditError } = await supabase
        .from("qualification_approvals")
        .insert([{
          qualification_id: qualificationId,
          action: "rejected",
          performed_by: user.user.id,
          comments,
        }]);

      if (auditError) throw auditError;

      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["qualifications"] });
      toast({
        title: "Qualification Rejected",
        description: "The qualification has been returned with feedback",
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

// Add unit standard mutation
export const useAddUnitStandardToQualification = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateUnitStandardData) => {
      const { data: result, error } = await supabase
        .from("qualification_unit_standards")
        .insert([data])
        .select()
        .single();

      if (error) throw error;
      return result as QualificationUnitStandard;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["qualification-unit-standards", data.qualification_id] });
      toast({
        title: "Success",
        description: "Unit standard added successfully",
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

// Update unit standard mutation
export const useUpdateUnitStandard = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...data }: Partial<QualificationUnitStandard> & { id: string }) => {
      const { data: result, error } = await supabase
        .from("qualification_unit_standards")
        .update(data)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return result as QualificationUnitStandard;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["qualification-unit-standards", data.qualification_id] });
      toast({
        title: "Success",
        description: "Unit standard updated successfully",
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

// Delete unit standard mutation
export const useDeleteUnitStandard = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, qualificationId }: { id: string; qualificationId: string }) => {
      const { error } = await supabase
        .from("qualification_unit_standards")
        .delete()
        .eq("id", id);

      if (error) throw error;
      return { qualificationId };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["qualification-unit-standards", data.qualificationId] });
      toast({
        title: "Success",
        description: "Unit standard removed successfully",
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
