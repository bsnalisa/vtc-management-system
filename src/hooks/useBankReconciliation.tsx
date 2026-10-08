import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useOrganizationContext } from "./useOrganizationContext";
import type { BankLine } from "@/lib/bankStatementCsv";

// Newer than the generated Supabase types, so access untyped.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export type BankLineStatus = "unmatched" | "matched" | "applied" | "ignored";
export interface BankImport { id: string; file_name: string; bank_name: string | null; line_count: number; duplicate_count: number; imported_at: string }
export interface BankStatementLine {
  id: string; import_id: string; txn_date: string; description: string | null; reference: string | null; amount: number;
  status: BankLineStatus; matched_trainee_id: string | null; matched_fee_record_id: string | null; payment_id: string | null;
  trainees?: { first_name: string; last_name: string; trainee_id: string } | null;
}
export interface OpenFeeRecord { id: string; academic_year: string; total_fee: number; amount_paid: number; balance: number }
export interface ImportResult { imported: number; duplicates: number; matched: number; importIds: string[] }

const IMPORT_SINGLE_CALL_MAX = 5000; // the database accepts at most 5000 lines per call
const CHUNK = 1000;

export const useBankImports = () => {
  const { organizationId } = useOrganizationContext();
  return useQuery({
    queryKey: ["bank-imports", organizationId], enabled: !!organizationId,
    queryFn: async () => {
      const { data, error } = await db.from("bank_statement_imports").select("*").order("imported_at", { ascending: false }).limit(100);
      if (error) throw error;
      return data as BankImport[];
    },
  });
};

/** Lines of one import (or all imports when importId is null). Status filtering is done by the caller so totals stay complete. */
export const useBankLines = (importId: string | null) => {
  const { organizationId } = useOrganizationContext();
  return useQuery({
    queryKey: ["bank-lines", organizationId, importId], enabled: !!organizationId,
    queryFn: async () => {
      let q = db.from("bank_statement_lines").select("*, trainees:matched_trainee_id(first_name,last_name,trainee_id)")
        .order("txn_date", { ascending: false }).limit(5000);
      if (importId) q = q.eq("import_id", importId);
      const { data, error } = await q;
      if (error) throw error;
      return data as BankStatementLine[];
    },
  });
};

export const useOpenFeeRecords = (traineeId: string | null | undefined) =>
  useQuery({
    queryKey: ["open-fee-records", traineeId], enabled: !!traineeId,
    queryFn: async () => {
      const { data, error } = await db.from("fee_records").select("id,academic_year,total_fee,amount_paid,balance")
        .eq("trainee_id", traineeId).gt("balance", 0).order("academic_year", { ascending: false });
      if (error) throw error;
      return data as OpenFeeRecord[];
    },
  });

const refresh = (queryClient: ReturnType<typeof useQueryClient>) => {
  queryClient.invalidateQueries({ queryKey: ["bank-lines"] });
  queryClient.invalidateQueries({ queryKey: ["bank-imports"] });
  queryClient.invalidateQueries({ queryKey: ["open-fee-records"] });
};

export const useImportBankStatement = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ fileName, bank, lines }: { fileName: string; bank: string; lines: BankLine[] }): Promise<ImportResult> => {
      const size = lines.length <= IMPORT_SINGLE_CALL_MAX ? lines.length : CHUNK;
      const total: ImportResult = { imported: 0, duplicates: 0, matched: 0, importIds: [] };
      for (let i = 0; i < lines.length; i += size) {
        const { data, error } = await db.rpc("bank_import_lines", { _file_name: fileName, _bank: bank || null, _lines: lines.slice(i, i + size) });
        if (error) throw new Error(`${error.message}${total.imported ? ` (${total.imported} lines were already imported before this failed)` : ""}`);
        total.imported += data.imported; total.duplicates += data.duplicates; total.matched += data.matched; total.importIds.push(data.import_id);
      }
      return total;
    },
    onSuccess: (r) => {
      refresh(queryClient);
      toast.success(`Imported ${r.imported} lines (${r.matched} matched, ${r.duplicates} duplicates skipped)`);
    },
    onError: (e: Error) => { refresh(queryClient); toast.error(e.message); },
  });
};

export const useApplyBankLine = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ lineId, feeRecordId }: { lineId: string; feeRecordId?: string | null }) => {
      const { error } = await db.rpc("bank_apply_line", { _line: lineId, _fee_record: feeRecordId ?? null });
      if (error) throw error;
    },
    onSuccess: () => {
      refresh(queryClient);
      queryClient.invalidateQueries({ queryKey: ["fee-records"] });
      queryClient.invalidateQueries({ queryKey: ["payments"] });
      toast.success("Payment recorded");
    },
    onError: (e: Error) => toast.error(e.message),
  });
};

export const useSetBankLineStatus = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ lineId, ignore }: { lineId: string; ignore: boolean }) => {
      const { error } = await db.rpc("bank_set_line_status", { _line: lineId, _ignore: ignore });
      if (error) throw error;
    },
    onSuccess: () => refresh(queryClient),
    onError: (e: Error) => toast.error(e.message),
  });
};
