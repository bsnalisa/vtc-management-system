import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";

export const useTraineeUserId = () => {
  const [userId, setUserId] = useState<string | null>(null);
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id || null));
  }, []);
  return userId;
};

export const useTraineeRecord = (userId: string | null) => {
  return useQuery({
    queryKey: ["my-trainee-record", userId],
    queryFn: async () => {
      if (!userId) return null;
      const { data, error } = await supabase
        .from("trainees")
        .select(`
          *,
          trades:trade_id (id, name, code)
        `)
        .eq("user_id", userId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!userId,
  });
};

export const useTraineeApplication = (userId: string | null) => {
  return useQuery({
    queryKey: ["my-trainee-application", userId],
    queryFn: async () => {
      if (!userId) return null;
      const { data, error } = await supabase
        .from("trainee_applications")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!userId,
  });
};

export const useTraineeFinancialAccount = (traineeId: string | null | undefined, applicationId: string | null | undefined) => {
  return useQuery({
    queryKey: ["my-financial-account", traineeId, applicationId],
    queryFn: async () => {
      if (traineeId) {
        const { data } = await supabase
          .from("trainee_financial_accounts")
          .select("*")
          .eq("trainee_id", traineeId)
          .maybeSingle();
        if (data) return data;
      }
      if (applicationId) {
        const { data } = await supabase
          .from("trainee_financial_accounts")
          .select("*")
          .eq("application_id", applicationId)
          .maybeSingle();
        if (data) return data;
      }
      return null;
    },
    enabled: !!(traineeId || applicationId),
  });
};

export const useTraineeTransactions = (accountId: string | null | undefined, typeFilter?: string) => {
  return useQuery({
    queryKey: ["my-transactions", accountId, typeFilter],
    queryFn: async () => {
      if (!accountId) return [];
      let query = supabase
        .from("financial_transactions")
        .select(`id, transaction_type, amount, balance_after, description, payment_method, processed_at, fee_types (name)`)
        .eq("account_id", accountId)
        .order("processed_at", { ascending: false })
        .limit(50);
      if (typeFilter) query = query.eq("transaction_type", typeFilter);
      const { data, error } = await query;
      if (error) return [];
      return data || [];
    },
    enabled: !!accountId,
  });
};

export const useTraineeHostelAllocation = (traineeId: string | null | undefined) => {
  return useQuery({
    queryKey: ["my-hostel-allocation", traineeId],
    queryFn: async () => {
      if (!traineeId) return null;
      const { data, error } = await supabase
        .from("hostel_allocations")
        .select(`
          *,
          hostel_buildings (id, name, gender_type),
          hostel_rooms (id, room_number, floor, room_type, capacity, current_occupancy),
          hostel_beds (id, bed_number)
        `)
        .eq("trainee_id", traineeId)
        .eq("status", "active")
        .maybeSingle();
      if (error) return null;
      return data;
    },
    enabled: !!traineeId,
  });
};

export const useTraineeRoommates = (roomId: string | null | undefined, traineeId: string | null | undefined) => {
  return useQuery({
    queryKey: ["my-roommates", roomId, traineeId],
    queryFn: async () => {
      if (!roomId || !traineeId) return [];
      const { data, error } = await supabase
        .from("hostel_allocations")
        .select(`
          trainee_id,
          hostel_beds (bed_number),
          trainees (first_name, last_name, trainee_id, trades:trade_id (name))
        `)
        .eq("room_id", roomId)
        .eq("status", "active")
        .neq("trainee_id", traineeId);
      if (error) return [];
      return data || [];
    },
    enabled: !!(roomId && traineeId),
  });
};

export const useTraineeHostelFees = (traineeId: string | null | undefined) => {
  return useQuery({
    queryKey: ["my-hostel-fees", traineeId],
    queryFn: async () => {
      if (!traineeId) return [];
      const { data, error } = await supabase
        .from("hostel_fees")
        .select("*")
        .eq("trainee_id", traineeId)
        .order("created_at", { ascending: false });
      if (error) return [];
      return data || [];
    },
    enabled: !!traineeId,
  });
};

export const useTraineeAssessmentResults = (traineeId: string | null | undefined) => {
  return useQuery({
    queryKey: ["my-assessment-results", traineeId],
    queryFn: async () => {
      if (!traineeId) return [];
      const { data, error } = await supabase
        .from("assessment_results")
        .select(`
          id, marks_obtained, competency_status, assessment_date, remarks,
          unit_standards (id, title, unit_standard_id, credit, nqf_level)
        `)
        .eq("trainee_id", traineeId)
        .order("assessment_date", { ascending: false });
      if (error) return [];
      return data || [];
    },
    enabled: !!traineeId,
  });
};

export const useTraineeEnrollments = (traineeId: string | null | undefined) => {
  return useQuery({
    queryKey: ["my-enrollments", traineeId],
    queryFn: async () => {
      if (!traineeId) return [];
      const { data, error } = await supabase
        .from("trainee_enrollments")
        .select(`
          id, status, enrollment_date, academic_year,
          courses:course_id (id, name, code, level, trade_id, trades:trade_id (id, name, code))
        `)
        .eq("trainee_id", traineeId)
        .order("enrollment_date", { ascending: false });
      if (error) return [];
      return data || [];
    },
    enabled: !!traineeId,
  });
};

export const useTraineeAnnouncements = (orgId: string | null | undefined) => {
  return useQuery({
    queryKey: ["my-announcements", orgId],
    queryFn: async () => {
      if (!orgId) return [];
      const { data, error } = await supabase
        .from("announcements")
        .select("*")
        .eq("organization_id", orgId)
        .eq("active", true)
        .order("published_at", { ascending: false })
        .limit(5);
      if (error) return [];
      return data || [];
    },
    enabled: !!orgId,
  });
};
