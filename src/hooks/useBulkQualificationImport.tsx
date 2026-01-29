import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useOrganizationContext } from "./useOrganizationContext";
import type { QualificationType, DurationUnit } from "./useQualifications";

export interface BulkQualificationData {
  qualification_title: string;
  qualification_code: string;
  qualification_type: QualificationType;
  nqf_level: number;
  duration_value: number;
  duration_unit: DurationUnit;
}

export interface BulkImportResult {
  success: number;
  failed: number;
  errors: Array<{ code: string; error: string }>;
}

export const useBulkImportQualifications = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { organizationId } = useOrganizationContext();

  return useMutation({
    mutationFn: async (qualifications: BulkQualificationData[]): Promise<BulkImportResult> => {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error("Not authenticated");
      if (!organizationId) throw new Error("No organization context");

      const result: BulkImportResult = {
        success: 0,
        failed: 0,
        errors: [],
      };

      // Check for duplicate codes in the batch
      const codes = qualifications.map(q => q.qualification_code);
      const duplicateCodes = codes.filter((code, index) => codes.indexOf(code) !== index);
      
      if (duplicateCodes.length > 0) {
        throw new Error(`Duplicate codes found in import: ${[...new Set(duplicateCodes)].join(", ")}`);
      }

      // Check for existing codes in database
      const { data: existingQualifications } = await supabase
        .from("qualifications")
        .select("qualification_code")
        .eq("organization_id", organizationId)
        .in("qualification_code", codes);

      const existingCodes = new Set(existingQualifications?.map(q => q.qualification_code) || []);

      // Prepare records for insertion
      const recordsToInsert = qualifications
        .filter(q => {
          if (existingCodes.has(q.qualification_code)) {
            result.failed++;
            result.errors.push({ 
              code: q.qualification_code, 
              error: "Code already exists" 
            });
            return false;
          }
          return true;
        })
        .map(q => ({
          ...q,
          organization_id: organizationId,
          created_by: user.user.id,
          status: "draft" as const,
        }));

      if (recordsToInsert.length === 0) {
        return result;
      }

      // Batch insert
      const { data, error } = await supabase
        .from("qualifications")
        .insert(recordsToInsert)
        .select();

      if (error) {
        throw error;
      }

      result.success = data?.length || 0;

      return result;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["qualifications"] });
      
      if (result.failed > 0) {
        toast({
          title: "Partial Import Success",
          description: `Imported ${result.success} qualifications. ${result.failed} failed (duplicate codes).`,
          variant: "default",
        });
      } else {
        toast({
          title: "Import Successful",
          description: `Successfully imported ${result.success} qualifications`,
        });
      }
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
