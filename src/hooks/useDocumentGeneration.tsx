import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useOrganizationContext } from "./useOrganizationContext";

export interface GenerateDocumentRequest {
  documentType: "invoice" | "report" | "certificate" | "form" | "letter";
  templateName: string;
  data: Record<string, any>;
}

export interface GeneratedDocument {
  id: string;
  organization_id: string;
  document_type: string;
  template_name: string;
  file_path: string;
  file_name: string;
  generated_by: string;
  metadata: Record<string, any>;
  created_at: string;
}

export const useGenerateDocument = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { organizationId } = useOrganizationContext();

  return useMutation({
    mutationFn: async (request: GenerateDocumentRequest) => {
      if (!organizationId) {
        throw new Error("No organization ID available");
      }

      const { data, error } = await supabase.functions.invoke(
        "generate-pdf-document",
        {
          body: {
            ...request,
            organizationId,
          },
        }
      );

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["generated-documents"] });
      toast({
        title: "Success",
        description: "Document generated successfully",
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

export const useGeneratedDocuments = (documentType?: string) => {
  const { organizationId } = useOrganizationContext();

  return useQuery({
    queryKey: ["generated-documents", organizationId, documentType],
    queryFn: async () => {
      if (!organizationId) return [];

      let query = supabase
        .from("generated_documents")
        .select("*")
        .eq("organization_id", organizationId);

      if (documentType) {
        query = query.eq("document_type", documentType);
      }

      const { data, error } = await query.order("created_at", { ascending: false });

      if (error) throw error;
      return data as GeneratedDocument[];
    },
    enabled: !!organizationId,
  });
};

export const useDownloadDocument = () => {
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (filePath: string) => {
      const { data, error } = await supabase.storage
        .from("documents")
        .createSignedUrl(filePath, 3600); // 1 hour expiry

      if (error) throw error;
      
      if (data?.signedUrl) {
        // Open in new tab
        window.open(data.signedUrl, "_blank");
      }

      return data;
    },
    onError: (error: Error) => {
      toast({
        title: "Download Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });
};
