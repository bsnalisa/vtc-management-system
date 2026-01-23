import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganizationContext } from "./useOrganizationContext";
import { toast } from "sonner";

// Employers Hook
export const useEmployers = () => {
  const { organizationId } = useOrganizationContext();
  const queryClient = useQueryClient();

  const { data: employers, isLoading } = useQuery({
    queryKey: ["employers", organizationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employers")
        .select("*")
        .eq("organization_id", organizationId)
        .order("name");
      
      if (error) throw error;
      return data;
    },
    enabled: !!organizationId,
  });

  const createEmployer = useMutation({
    mutationFn: async (values: any) => {
      const { error } = await supabase.from("employers").insert({
        ...values,
        organization_id: organizationId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employers"] });
      toast.success("Employer created successfully");
    },
    onError: (error: any) => {
      toast.error(error.message);
    },
  });

  const updateEmployer = useMutation({
    mutationFn: async ({ id, ...values }: any) => {
      const { error } = await supabase
        .from("employers")
        .update(values)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employers"] });
      toast.success("Employer updated successfully");
    },
    onError: (error: any) => {
      toast.error(error.message);
    },
  });

  return { employers, isLoading, createEmployer, updateEmployer };
};

// Job Postings Hook
export const useJobPostings = () => {
  const { organizationId } = useOrganizationContext();
  const queryClient = useQueryClient();

  const { data: jobPostings, isLoading } = useQuery({
    queryKey: ["job_postings", organizationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("job_postings")
        .select(`
          *,
          employers(name),
          trades(name)
        `)
        .eq("organization_id", organizationId)
        .order("posted_date", { ascending: false });
      
      if (error) throw error;
      return data;
    },
    enabled: !!organizationId,
  });

  const createJobPosting = useMutation({
    mutationFn: async (values: any) => {
      const { data: userData } = await supabase.auth.getUser();
      const { error } = await supabase.from("job_postings").insert({
        ...values,
        organization_id: organizationId,
        posted_by: userData?.user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["job_postings"] });
      toast.success("Job posting created successfully");
    },
    onError: (error: any) => {
      toast.error(error.message);
    },
  });

  const updateJobPosting = useMutation({
    mutationFn: async ({ id, ...values }: any) => {
      const { error } = await supabase
        .from("job_postings")
        .update(values)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["job_postings"] });
      toast.success("Job posting updated successfully");
    },
    onError: (error: any) => {
      toast.error(error.message);
    },
  });

  return { jobPostings, isLoading, createJobPosting, updateJobPosting };
};

// Job Applications Hook
export const useJobApplications = (jobId?: string) => {
  const { organizationId } = useOrganizationContext();
  const queryClient = useQueryClient();

  const { data: applications, isLoading } = useQuery({
    queryKey: ["job_applications", organizationId, jobId],
    queryFn: async () => {
      let query = supabase
        .from("job_applications")
        .select(`
          *,
          job_postings(title, employer_id),
          trainees(trainee_id, first_name, last_name, email, phone)
        `)
        .eq("organization_id", organizationId);
      
      if (jobId) {
        query = query.eq("job_id", jobId);
      }
      
      const { data, error } = await query.order("application_date", { ascending: false });
      
      if (error) throw error;
      return data;
    },
    enabled: !!organizationId,
  });

  const updateApplicationStatus = useMutation({
    mutationFn: async ({ id, status, remarks }: any) => {
      const { error } = await supabase
        .from("job_applications")
        .update({ status, remarks })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["job_applications"] });
      toast.success("Application status updated");
    },
    onError: (error: any) => {
      toast.error(error.message);
    },
  });

  return { applications, isLoading, updateApplicationStatus };
};

// Internship Placements Hook
export const useInternshipPlacements = () => {
  const { organizationId } = useOrganizationContext();
  const queryClient = useQueryClient();

  const { data: placements, isLoading } = useQuery({
    queryKey: ["internship_placements", organizationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("internship_placements")
        .select(`
          *,
          trainees(trainee_id, first_name, last_name, email, phone),
          employers(name, contact_person, contact_phone)
        `)
        .eq("organization_id", organizationId)
        .order("start_date", { ascending: false });
      
      if (error) throw error;
      return data;
    },
    enabled: !!organizationId,
  });

  const createPlacement = useMutation({
    mutationFn: async (values: any) => {
      const { data: userData } = await supabase.auth.getUser();
      const placementNumber = `INT-${Date.now()}`;
      const { error } = await supabase.from("internship_placements").insert({
        ...values,
        organization_id: organizationId,
        placement_number: placementNumber,
        approved_by: userData?.user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["internship_placements"] });
      toast.success("Internship placement created successfully");
    },
    onError: (error: any) => {
      toast.error(error.message);
    },
  });

  const updatePlacement = useMutation({
    mutationFn: async ({ id, ...values }: any) => {
      const { error } = await supabase
        .from("internship_placements")
        .update(values)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["internship_placements"] });
      toast.success("Placement updated successfully");
    },
    onError: (error: any) => {
      toast.error(error.message);
    },
  });

  return { placements, isLoading, createPlacement, updatePlacement };
};

// Employer Interactions Hook
export const useEmployerInteractions = (employerId?: string) => {
  const { organizationId } = useOrganizationContext();
  const queryClient = useQueryClient();

  const { data: interactions, isLoading } = useQuery({
    queryKey: ["employer_interactions", organizationId, employerId],
    queryFn: async () => {
      let query = supabase
        .from("employer_interactions")
        .select("*, employers(name)")
        .eq("organization_id", organizationId);
      
      if (employerId) {
        query = query.eq("employer_id", employerId);
      }
      
      const { data, error } = await query.order("interaction_date", { ascending: false });
      
      if (error) throw error;
      return data;
    },
    enabled: !!organizationId,
  });

  const createInteraction = useMutation({
    mutationFn: async (values: any) => {
      const { data: userData } = await supabase.auth.getUser();
      const { error } = await supabase.from("employer_interactions").insert({
        ...values,
        organization_id: organizationId,
        conducted_by: userData?.user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employer_interactions"] });
      toast.success("Interaction recorded successfully");
    },
    onError: (error: any) => {
      toast.error(error.message);
    },
  });

  return { interactions, isLoading, createInteraction };
};
