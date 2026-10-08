import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useOrganizationContext } from "./useOrganizationContext";
import { printHtml } from "@/lib/printDocument";
import {
  ProofOfRegistration, ResultsGroup, StatementTransaction, accountStatementHtml, proofOfRegistrationHtml, resultsTitle, statementOfResultsHtml,
} from "@/lib/traineeDocuments";

// The functions below are newer than the generated Supabase types, so call them untyped.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

/** The trainee's registrations (row-level security limits this to their own). */
export const useMyRegistrations = (traineeId: string | null | undefined) =>
  useQuery({
    queryKey: ["my-registrations", traineeId],
    enabled: !!traineeId,
    queryFn: async () => {
      const { data, error } = await db.from("registrations").select("id, registration_status, academic_year, registered_at, created_at")
        .eq("trainee_id", traineeId).order("created_at", { ascending: false });
      if (error) throw error;
      return data as { id: string; registration_status: string; academic_year: string; registered_at: string | null; created_at: string }[];
    },
  });

/** Print actions for the trainee portal. Each one reports problems with a message instead of failing silently. */
export function useTraineeDocumentActions() {
  const { organizationName, settings } = useOrganizationContext();
  const [busy, setBusy] = useState<string | null>(null);
  const org = { name: organizationName, logoUrl: settings?.logo_url };

  const run = async (name: string, fn: () => Promise<void>) => {
    setBusy(name);
    try {
      await fn();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not prepare the document");
    } finally {
      setBusy(null);
    }
  };

  return {
    busy,
    printProof: (registrationId: string) =>
      run("proof", async () => {
        const { data, error } = await db.rpc("issue_proof_of_registration", { _registration: registrationId });
        if (error) throw new Error(error.message);
        printHtml("Proof of Registration", proofOfRegistrationHtml(data as ProofOfRegistration), org);
      }),

    printResults: () =>
      run("results", async () => {
        const { data, error } = await db.rpc("my_statement_of_results");
        if (error) throw new Error(error.message);
        const groups = data as ResultsGroup[];
        if (!groups.length) throw new Error("There are no approved results to print yet.");
        const html = groups.map((g) => (groups.length > 1 ? `<h3>${g.qualification} · ${g.academic_year}</h3>` : "") + statementOfResultsHtml(g)).join('<div class="pb"></div>');
        printHtml(groups.length === 1 ? resultsTitle(groups[0]) : "Statement of Results", html, org);
      }),

    printStatement: (account: { id: string; account_number: string; total_fees: number | string; total_paid: number | string; balance: number | string },
                     who: { name: string; traineeNumber?: string | null }) =>
      run("statement", async () => {
        // the page shows only the latest transactions; the statement must have all of them, oldest first
        const { data, error } = await db.from("financial_transactions")
          .select("processed_at, transaction_type, amount, balance_after, description, payment_method, fee_types(name)")
          .eq("account_id", account.id).order("processed_at", { ascending: true }).limit(5000);
        if (error) throw new Error(error.message);
        const rows: StatementTransaction[] = (data as (Omit<StatementTransaction, "fee_type"> & { fee_types: { name: string } | null })[])
          .map(({ fee_types, ...t }) => ({ ...t, fee_type: fee_types?.name ?? null }));
        printHtml("Statement of Account", accountStatementHtml(who, account, rows), org);
      }),
  };
}
