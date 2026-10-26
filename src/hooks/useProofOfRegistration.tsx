import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useRpc } from "./useFinance";
import type { ProofData, ProofSettings } from "@/lib/proofOfRegistration";

// These functions are newer than the generated types, so they are called untyped.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export const useProofData = (registrationId: string | null | undefined) =>
  useQuery({
    queryKey: ["proof-of-registration", registrationId], enabled: !!registrationId, retry: false,
    queryFn: async () => { const { data, error } = await db.rpc("proof_of_registration_data", { _registration: registrationId }); if (error) throw error; return data as ProofData; },
  });

/** A trainee's registrations (one per academic year / qualification), newest first. */
export const useTraineeRegistrations = (traineeId: string | null | undefined) =>
  useQuery({
    queryKey: ["proof-registrations", traineeId], enabled: !!traineeId,
    queryFn: async () => {
      const { data, error } = await db.from("registrations").select("id, academic_year, registration_status, created_at").eq("trainee_id", traineeId).order("created_at", { ascending: false });
      if (error) throw error;
      return data as { id: string; academic_year: string; registration_status: string; created_at: string }[];
    },
  });

export const logProofPrint = async (registrationId: string, action: "print" | "download") => {
  const { error } = await db.rpc("log_proof_print", { _registration: registrationId, _action: action });
  if (error) console.warn("Could not log the print", error.message);
};

export interface ProofCentre { organization_id: string; name: string; configured: boolean }
export const useProofCentres = () =>
  useQuery({ queryKey: ["proof-settings", "centres"], queryFn: async () => { const { data, error } = await db.rpc("proof_settings_overview"); if (error) throw error; return data as ProofCentre[]; } });
export const useProofSettings = (org: string | null) =>
  useQuery({
    queryKey: ["proof-settings", org], enabled: !!org,
    queryFn: async () => { const { data, error } = await db.rpc("proof_settings_get", { _org: org }); if (error) throw error; return data as { settings: ProofSettings | null; centre_name: string | null; configured: boolean }; },
  });

const K = ["proof-settings", "proof-of-registration"];
export const useSaveProofSettings = () =>
  useRpc<{ org: string; settings: Record<string, unknown> }>("save_proof_settings", (v) => ({ _org: v.org, _s: v.settings }), K, "Settings saved");
export const useCopyProofSettings = () =>
  useRpc<{ from: string; to: string }>("copy_proof_settings", (v) => ({ _from: v.from, _to: v.to }), K, "Settings copied");
