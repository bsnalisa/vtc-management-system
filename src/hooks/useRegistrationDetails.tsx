import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganizationContext } from "./useOrganizationContext";

// Registration data is read across several tables that are newer than the generated types, so query untyped.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export interface RegistrationFee {
  id: string;
  entity_type: "REGISTRATION" | "HOSTEL";
  description: string | null;
  amount: number;
  amount_paid: number;
  balance: number;
  status: "pending" | "partial" | "cleared";
  cleared_at: string | null;
}

export interface RegistrationDetails {
  application: {
    id: string; first_name: string; last_name: string; application_number: string | null; trainee_number: string | null;
    trade_id: string | null; preferred_level: number | null; intake: string | null; academic_year: string | null;
    registration_status: string; qualification_status: string; needs_hostel_accommodation: boolean | null;
    trades?: { name: string } | null;
  };
  registration: { id: string; qualification_id: string | null; academic_year: string | null; registration_status: string; registered_at: string | null } | null;
  fees: RegistrationFee[];
  traineeId: string | null; // the trainees.id of the real trainee record, once it exists
}

export const useRegistrationDetails = (applicationId: string | undefined) => {
  const { organizationId } = useOrganizationContext();
  return useQuery({
    queryKey: ["registration-details", organizationId, applicationId],
    enabled: !!organizationId && !!applicationId,
    refetchInterval: 30_000,
    queryFn: async (): Promise<RegistrationDetails> => {
      const { data: application, error } = await db
        .from("trainee_applications")
        .select("id, first_name, last_name, application_number, trainee_number, trade_id, preferred_level, intake, academic_year, registration_status, qualification_status, needs_hostel_accommodation, trades:trade_id(name)")
        .eq("id", applicationId)
        .eq("organization_id", organizationId)
        .single();
      if (error) throw error;

      const { data: registration, error: regError } = await db
        .from("registrations")
        .select("id, qualification_id, academic_year, registration_status, registered_at")
        .eq("application_id", applicationId)
        .eq("organization_id", organizationId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (regError) throw regError;

      let fees: RegistrationFee[] = [];
      if (registration) {
        const { data, error: feeError } = await db
          .from("financial_queue")
          .select("id, entity_type, description, amount, amount_paid, balance, status, cleared_at")
          .eq("entity_id", registration.id)
          .in("entity_type", ["REGISTRATION", "HOSTEL"])
          .order("created_at");
        if (feeError) throw feeError;
        fees = (data ?? []) as RegistrationFee[];
      }

      let traineeId: string | null = null;
      if (application.trainee_number) {
        const { data: trainee } = await db
          .from("trainees")
          .select("id")
          .eq("trainee_id", application.trainee_number)
          .eq("organization_id", organizationId)
          .maybeSingle();
        traineeId = trainee?.id ?? null;
      }

      return { application, registration, fees, traineeId };
    },
  });
};
