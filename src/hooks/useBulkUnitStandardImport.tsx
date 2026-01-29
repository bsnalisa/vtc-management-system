import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface UnitStandardImportRow {
  unit_standard_id: string;
  unit_standard_title: string;
  level: number;
  credit_value?: number;
  is_mandatory?: boolean;
}

export const useBulkUnitStandardImport = (qualificationId: string) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (rows: UnitStandardImportRow[]) => {
      if (rows.length === 0) {
        throw new Error("No valid rows to import");
      }

      // Check for duplicates within the batch
      const unitIds = rows.map(r => r.unit_standard_id);
      const duplicatesInBatch = unitIds.filter((id, index) => unitIds.indexOf(id) !== index);
      if (duplicatesInBatch.length > 0) {
        throw new Error(`Duplicate unit IDs in import: ${duplicatesInBatch.join(", ")}`);
      }

      // Check for existing unit standards in the qualification
      const { data: existing, error: fetchError } = await supabase
        .from("qualification_unit_standards")
        .select("unit_standard_id")
        .eq("qualification_id", qualificationId)
        .in("unit_standard_id", unitIds);

      if (fetchError) throw fetchError;

      if (existing && existing.length > 0) {
        const existingIds = existing.map(e => e.unit_standard_id);
        throw new Error(`Unit standards already exist: ${existingIds.join(", ")}`);
      }

      // Prepare data for insert
      const insertData = rows.map(row => ({
        qualification_id: qualificationId,
        unit_standard_id: row.unit_standard_id,
        unit_standard_title: row.unit_standard_title,
        level: row.level,
        credit_value: row.credit_value || null,
        is_mandatory: row.is_mandatory !== undefined ? row.is_mandatory : true,
      }));

      // Insert all rows
      const { data, error } = await supabase
        .from("qualification_unit_standards")
        .insert(insertData)
        .select();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["qualification-unit-standards", qualificationId] });
      toast({
        title: "Import Successful",
        description: `Successfully imported ${data.length} unit standards`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Import Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });
};
