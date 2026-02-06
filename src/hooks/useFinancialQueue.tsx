 import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
 import { supabase } from "@/integrations/supabase/client";
 import { useToast } from "@/hooks/use-toast";
 import { useOrganizationContext } from "./useOrganizationContext";
 
 export interface FinancialQueueEntry {
   id: string;
   organization_id: string;
   entity_type: 'APPLICATION' | 'REGISTRATION' | 'HOSTEL';
   entity_id: string;
   fee_type_id: string | null;
   amount: number;
   amount_paid: number;
   balance: number;
   status: 'pending' | 'partial' | 'cleared';
   description: string | null;
   payment_method: string | null;
   requested_by: string | null;
   cleared_by: string | null;
   cleared_at: string | null;
   created_at: string;
   updated_at: string;
   // Joined data
   trainee_applications?: {
     id: string;
     first_name: string;
     last_name: string;
     trainee_number: string | null;
     system_email: string | null;
     phone: string | null;
     trade_id: string | null;
   } | null;
   trainees?: {
     id: string;
     first_name: string;
     last_name: string;
     trainee_id: string;
     phone: string | null;
   } | null;
   fee_types?: {
     name: string;
     category: string | null;
   } | null;
 }
 
 export const useFinancialQueue = (statusFilter?: string, entityTypeFilter?: string) => {
   const { organizationId } = useOrganizationContext();
 
   return useQuery({
     queryKey: ["financial_queue", organizationId, statusFilter, entityTypeFilter],
     queryFn: async () => {
       let query = supabase
         .from("financial_queue")
         .select(`
           *,
           fee_types (name, category)
         `)
         .order("created_at", { ascending: false });
 
       if (organizationId) {
         query = query.eq("organization_id", organizationId);
       }
 
       if (statusFilter && statusFilter !== "all") {
         query = query.eq("status", statusFilter);
       }
 
       if (entityTypeFilter && entityTypeFilter !== "all") {
         query = query.eq("entity_type", entityTypeFilter);
       }
 
       const { data, error } = await query;
       if (error) throw error;
 
       // Fetch related application/trainee data for each entry
       const enrichedData = await Promise.all(
         (data || []).map(async (entry) => {
           if (entry.entity_type === 'APPLICATION') {
             const { data: appData } = await supabase
               .from("trainee_applications")
               .select("id, first_name, last_name, trainee_number, system_email, phone, trade_id")
               .eq("id", entry.entity_id)
               .single();
             return { ...entry, trainee_applications: appData };
           } else if (entry.entity_type === 'REGISTRATION') {
             const { data: traineeData } = await supabase
               .from("trainees")
               .select("id, first_name, last_name, trainee_id, phone")
               .eq("id", entry.entity_id)
               .single();
             return { ...entry, trainees: traineeData };
           }
           return entry;
         })
       );
 
       return enrichedData as FinancialQueueEntry[];
     },
     enabled: !!organizationId,
   });
 };
 
export const useFinancialQueueStats = () => {
  const { organizationId } = useOrganizationContext();

  return useQuery({
    queryKey: ["financial_queue_stats", organizationId],
    queryFn: async () => {
      if (!organizationId) return null;

      const { data, error } = await supabase
        .from("financial_queue")
        .select("status, entity_type, amount, amount_paid, balance, cleared_at")
        .eq("organization_id", organizationId);

      if (error) throw error;

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const clearedToday = data?.filter(d => {
        if (d.status !== 'cleared' || !d.cleared_at) return false;
        const clearedDate = new Date(d.cleared_at);
        return clearedDate >= today;
      }) || [];

      const pendingEntries = data?.filter(d => d.status === 'pending' || d.status === 'partial') || [];

      const stats = {
        total: data?.length || 0,
        pending: data?.filter(d => d.status === 'pending').length || 0,
        partial: data?.filter(d => d.status === 'partial').length || 0,
        cleared: data?.filter(d => d.status === 'cleared').length || 0,
        // Pending counts by entity type
        applicationFeesPending: pendingEntries.filter(d => d.entity_type === 'APPLICATION').length,
        registrationFeesPending: pendingEntries.filter(d => d.entity_type === 'REGISTRATION').length,
        hostelFeesPending: pendingEntries.filter(d => d.entity_type === 'HOSTEL').length,
        // Total counts by entity type
        applicationFees: data?.filter(d => d.entity_type === 'APPLICATION').length || 0,
        registrationFees: data?.filter(d => d.entity_type === 'REGISTRATION').length || 0,
        hostelFees: data?.filter(d => d.entity_type === 'HOSTEL').length || 0,
        // Financial totals
        totalAmount: data?.reduce((sum, d) => sum + (Number(d.amount) || 0), 0) || 0,
        totalCollected: data?.reduce((sum, d) => sum + (Number(d.amount_paid) || 0), 0) || 0,
        totalOutstanding: pendingEntries.reduce((sum, d) => sum + (Number(d.balance) || 0), 0),
        // Today's stats
        clearedToday: clearedToday.length,
        collectedTodayAmount: clearedToday.reduce((sum, d) => sum + (Number(d.amount_paid) || 0), 0),
      };

      return stats;
    },
    enabled: !!organizationId,
  });
};
 
 export const useClearApplicationFee = () => {
   const { toast } = useToast();
   const queryClient = useQueryClient();
 
   return useMutation({
     mutationFn: async ({
       queue_id,
       amount,
       payment_method,
       notes,
     }: {
       queue_id: string;
       amount: number;
       payment_method: string;
       notes?: string;
     }) => {
       const { data, error } = await supabase.functions.invoke('clear-application-fee', {
         body: { queue_id, amount, payment_method, notes }
       });
 
       if (error) throw new Error(error.message);
       if (!data.success) throw new Error(data.error || 'Failed to clear payment');
 
       return data;
     },
     onSuccess: (data) => {
       queryClient.invalidateQueries({ queryKey: ["financial_queue"] });
       queryClient.invalidateQueries({ queryKey: ["financial_queue_stats"] });
       queryClient.invalidateQueries({ queryKey: ["trainee_applications"] });
       queryClient.invalidateQueries({ queryKey: ["trainees"] });
       
       const message = data.provisioning 
         ? `Payment cleared! Trainee account created: ${data.provisioning.system_email}`
         : `Payment recorded: ${data.payment_status}`;
       
       toast({
         title: "Payment Processed",
         description: message,
       });
     },
     onError: (error: Error) => {
       toast({
         title: "Payment Failed",
         description: error.message,
         variant: "destructive",
       });
     },
   });
 };
 
 export const useClearRegistrationFee = () => {
   const { toast } = useToast();
   const queryClient = useQueryClient();
 
   return useMutation({
     mutationFn: async ({
       queue_id,
       amount,
       payment_method,
       notes,
     }: {
       queue_id: string;
       amount: number;
       payment_method: string;
       notes?: string;
     }) => {
       const { data, error } = await supabase.functions.invoke('clear-registration-fee', {
         body: { queue_id, amount, payment_method, notes }
       });
 
       if (error) throw new Error(error.message);
       if (!data.success) throw new Error(data.error || 'Failed to clear payment');
 
       return data;
     },
     onSuccess: (data) => {
       queryClient.invalidateQueries({ queryKey: ["financial_queue"] });
       queryClient.invalidateQueries({ queryKey: ["financial_queue_stats"] });
       queryClient.invalidateQueries({ queryKey: ["registrations"] });
       queryClient.invalidateQueries({ queryKey: ["trainees"] });
       
       toast({
         title: "Registration Fee Processed",
         description: data.message,
       });
     },
     onError: (error: Error) => {
       toast({
         title: "Payment Failed",
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
       application_id,
       qualification_status,
       screening_remarks,
     }: {
       application_id: string;
       qualification_status: 'provisionally_qualified' | 'does_not_qualify';
       screening_remarks?: string;
     }) => {
       const { data, error } = await supabase.functions.invoke('screen-application', {
         body: { application_id, qualification_status, screening_remarks }
       });
 
       if (error) throw new Error(error.message);
       if (!data.success) throw new Error(data.error || 'Failed to screen application');
 
       return data;
     },
     onSuccess: (data, variables) => {
       queryClient.invalidateQueries({ queryKey: ["trainee_applications"] });
       queryClient.invalidateQueries({ queryKey: ["financial_queue"] });
       queryClient.invalidateQueries({ queryKey: ["application_stats"] });
       
       const message = variables.qualification_status === 'provisionally_qualified'
         ? `Application qualified! Trainee number: ${data.trainee_number}`
         : "Application marked as does not qualify";
       
       toast({
         title: "Application Screened",
         description: message,
       });
     },
     onError: (error: Error) => {
       toast({
         title: "Screening Failed",
         description: error.message,
         variant: "destructive",
       });
     },
   });
 };
 
 export const useRegisterTrainee = () => {
   const { toast } = useToast();
   const queryClient = useQueryClient();
 
   return useMutation({
     mutationFn: async ({
       application_id,
       qualification_id,
       academic_year,
     }: {
       application_id: string;
       qualification_id: string;
       academic_year?: string;
     }) => {
       const { data, error } = await supabase.functions.invoke('register-trainee', {
         body: { application_id, qualification_id, academic_year }
       });
 
       if (error) throw new Error(error.message);
       if (!data.success) throw new Error(data.error || 'Failed to register trainee');
 
       return data;
     },
     onSuccess: () => {
       queryClient.invalidateQueries({ queryKey: ["trainee_applications"] });
       queryClient.invalidateQueries({ queryKey: ["financial_queue"] });
       queryClient.invalidateQueries({ queryKey: ["registrations"] });
       queryClient.invalidateQueries({ queryKey: ["trainees"] });
       
       toast({
         title: "Trainee Registered",
         description: "Registration complete. Registration fee has been added to the financial queue.",
       });
     },
     onError: (error: Error) => {
       toast({
         title: "Registration Failed",
         description: error.message,
         variant: "destructive",
       });
     },
   });
 };