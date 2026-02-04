import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useOrganizationContext } from "./useOrganizationContext";

import { ComprehensiveApplicationData } from "@/types/application";

export type TraineeApplicationData = ComprehensiveApplicationData;

export const useTraineeApplications = (filters?: {
  intake?: string;
  trade_id?: string;
  qualification_status?: string;
  registration_status?: string;
  academic_year?: string;
}) => {
  const { organizationId } = useOrganizationContext();

  return useQuery({
    queryKey: ["trainee_applications", filters, organizationId],
    queryFn: async () => {
      let query = supabase
        .from("trainee_applications")
        .select(`
          *,
          trades:trades!trainee_applications_trade_id_fkey (
            id,
            name,
            code
          )
        `)
        .order("created_at", { ascending: false });

      if (organizationId) {
        query = query.eq("organization_id", organizationId);
      }

      if (filters?.intake) {
        query = query.eq("intake", filters.intake);
      }
      if (filters?.trade_id) {
        query = query.eq("trade_id", filters.trade_id);
      }
      if (filters?.qualification_status) {
        query = query.eq("qualification_status", filters.qualification_status);
      }
      if (filters?.registration_status) {
        query = query.eq("registration_status", filters.registration_status);
      }
      if (filters?.academic_year) {
        query = query.eq("academic_year", filters.academic_year);
      }

      const { data, error } = await query;

      if (error) throw error;
      
      // The account_provisioning_status is now included in the * selection
      return data;
    },
    enabled: !!organizationId,
  });
};

export const useCreateApplication = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { organizationId } = useOrganizationContext();

  return useMutation({
    mutationFn: async (applicationData: TraineeApplicationData) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      if (!organizationId) throw new Error("No organization selected");

      const { data, error } = await supabase
        .from("trainee_applications")
        .insert([{
          first_name: applicationData.first_name,
          last_name: applicationData.last_name,
          date_of_birth: applicationData.date_of_birth,
          gender: applicationData.gender,
          national_id: applicationData.national_id,
          phone: applicationData.phone,
          nationality: applicationData.nationality,
          address: applicationData.address,
          region: applicationData.region,
          trade_id: applicationData.trade_id,
          trade_id_choice2: applicationData.trade_id_choice2 || null,
          preferred_training_mode: applicationData.preferred_training_mode,
          preferred_level: applicationData.preferred_level,
          intake: applicationData.intake,
          academic_year: applicationData.academic_year,
          title: applicationData.title || null,
          marital_status: applicationData.marital_status || null,
          postal_address: applicationData.postal_address || null,
          email: applicationData.email || null,
          emergency_contact_name: applicationData.emergency_contact_name,
          emergency_contact_phone: applicationData.emergency_contact_phone,
          emergency_contact_relationship: applicationData.emergency_contact_relationship,
          emergency_contact_region: applicationData.emergency_contact_region || null,
          emergency_contact_email: applicationData.emergency_contact_email || null,
          emergency_contact_town: applicationData.emergency_contact_town,
          tertiary_institution: applicationData.tertiary_institution || null,
          tertiary_region: applicationData.tertiary_region || null,
          tertiary_address: applicationData.tertiary_address || null,
          tertiary_phone: applicationData.tertiary_phone || null,
          tertiary_fax: applicationData.tertiary_fax || null,
          tertiary_exam_year: applicationData.tertiary_exam_year || null,
          highest_grade_passed: applicationData.highest_grade_passed,
          school_subjects: applicationData.school_subjects as any,
          employer_name: applicationData.employer_name || null,
          employer_address: applicationData.employer_address || null,
          employer_phone: applicationData.employer_phone || null,
          employer_fax: applicationData.employer_fax || null,
          employer_town: applicationData.employer_town || null,
          employer_region: applicationData.employer_region || null,
          employer_position: applicationData.employer_position || null,
          employer_duration: applicationData.employer_duration || null,
          employer_email: applicationData.employer_email || null,
          needs_financial_assistance: applicationData.needs_financial_assistance,
          needs_hostel_accommodation: applicationData.needs_hostel_accommodation,
          hostel_application_data: applicationData.hostel_application_data as any || null,
          has_disability: applicationData.has_disability,
          disability_description: applicationData.disability_description || null,
          has_special_needs: applicationData.has_special_needs,
          special_needs_description: applicationData.special_needs_description || null,
          has_chronic_diseases: applicationData.has_chronic_diseases,
          chronic_diseases_description: applicationData.chronic_diseases_description || null,
          shoe_size: applicationData.shoe_size || null,
          overall_size: applicationData.overall_size || null,
          tshirt_size: applicationData.tshirt_size || null,
          skirt_trousers_size: applicationData.skirt_trousers_size || null,
          chef_trouser_size: applicationData.chef_trouser_size || null,
          chef_jacket_size: applicationData.chef_jacket_size || null,
          ict_access: applicationData.ict_access as any,
          declaration_accepted: applicationData.declaration_accepted,
          organization_id: organizationId,
          created_by: user.id,
          application_number: `APP-${Date.now()}`,
        }])
        .select()
        .single();

      if (error) {
        if (error.code === '23505' && error.message.includes('national_id')) {
          throw new Error('An application with this National ID already exists');
        }
        throw error;
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trainee_applications"] });
      toast({
        title: "Success",
        description: "Application submitted successfully!",
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

export const useScreenApplication = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      applicationId,
      qualificationStatus,
      remarks,
    }: {
      applicationId: string;
      qualificationStatus: string;
      remarks?: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Update the application with screening decision
      const { error } = await supabase
        .from("trainee_applications")
        .update({
          qualification_status: qualificationStatus,
          qualification_remarks: remarks,
          screened_by: user.id,
          screened_at: new Date().toISOString(),
          // Set initial registration status based on qualification
          registration_status: qualificationStatus === 'provisionally_qualified' 
            ? 'provisionally_admitted' 
            : 'applied',
        })
        .eq("id", applicationId);

      if (error) throw error;
      
      // If provisionally qualified, trigger auto-provisioning
      if (qualificationStatus === 'provisionally_qualified') {
        // Wait for database triggers to generate trainee_number and system_email
        await new Promise(resolve => setTimeout(resolve, 800));
        
        // Fetch the updated application to verify trigger-generated fields
        const { data: updatedApp, error: fetchError } = await supabase
          .from("trainee_applications")
          .select("trainee_number, system_email, account_provisioning_status")
          .eq("id", applicationId)
          .single();
        
        if (!fetchError && updatedApp?.trainee_number && updatedApp?.system_email) {
          // Auto-provision the trainee account
          try {
            const { data: provisionResult, error: provisionError } = await supabase.functions.invoke('provision-trainee-auth', {
              body: { 
                application_id: applicationId,
                trigger_type: 'auto'
              }
            });
            
            if (provisionError) {
              console.error('Auto-provisioning failed:', provisionError);
              // Don't fail the screening - just log the error
              // The manual "Create Account" button will be available
            } else {
              console.log('Auto-provisioning succeeded:', provisionResult);
            }
          } catch (provisionError) {
            console.error('Auto-provisioning exception:', provisionError);
          }
        } else {
          console.warn('Cannot auto-provision: missing trainee_number or system_email', updatedApp);
        }
      }
      
      // Fetch and return the final application data
      const { data: finalData } = await supabase
        .from("trainee_applications")
        .select("*")
        .eq("id", applicationId)
        .single();
      
      return finalData;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["trainee_applications"] });
      queryClient.invalidateQueries({ queryKey: ["application_stats"] });
      
      const message = variables.qualificationStatus === 'provisionally_qualified'
        ? "Application qualified! Trainee account will be created automatically."
        : "Application screened successfully!";
      
      toast({
        title: "Success",
        description: message,
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

export const useVerifyPayment = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ applicationId }: { applicationId: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("trainee_applications")
        .update({
          registration_status: "fully_registered",
          payment_verified_by: user.id,
          payment_verified_at: new Date().toISOString(),
          registered_at: new Date().toISOString(),
        })
        .eq("id", applicationId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trainee_applications"] });
      toast({
        title: "Success",
        description: "Payment verified and registration completed!",
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

export const useUpdateRegistrationStatus = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      applicationId,
      status,
    }: {
      applicationId: string;
      status: string;
    }) => {
      const { data, error } = await supabase
        .from("trainee_applications")
        .update({
          registration_status: status,
        })
        .eq("id", applicationId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trainee_applications"] });
      toast({
        title: "Success",
        description: "Registration status updated!",
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

export const useApplicationStats = () => {
  const { organizationId } = useOrganizationContext();

  return useQuery({
    queryKey: ["application_stats", organizationId],
    queryFn: async () => {
      if (!organizationId) return null;

      const { data: applications, error } = await supabase
        .from("trainee_applications")
        .select("*")
        .eq("organization_id", organizationId);

      if (error) throw error;

      const currentYear = new Date().getFullYear().toString();

      return {
        totalApplications: applications.length,
        pending: applications.filter(
          (a) => a.qualification_status === "pending"
        ).length,
        provisionallyQualified: applications.filter(
          (a) => a.qualification_status === "provisionally_qualified"
        ).length,
        doesNotQualify: applications.filter(
          (a) => a.qualification_status === "does_not_qualify"
        ).length,
        januaryRegistered: applications.filter(
          (a) =>
            a.registration_status === "fully_registered" &&
            a.intake === "january" &&
            a.academic_year === currentYear
        ).length,
        julyRegistered: applications.filter(
          (a) =>
            a.registration_status === "fully_registered" &&
            a.intake === "july" &&
            a.academic_year === currentYear
        ).length,
        pendingPayment: applications.filter(
          (a) => a.registration_status === "pending_payment"
        ).length,
        byTrade: applications.reduce((acc: any, app) => {
          const tradeId = app.trade_id;
          acc[tradeId] = (acc[tradeId] || 0) + 1;
          return acc;
        }, {}),
      };
    },
    enabled: !!organizationId,
  });
};

// Alias for backwards compatibility and clearer naming
export const useApplicationsData = () => {
  return useTraineeApplications();
};
