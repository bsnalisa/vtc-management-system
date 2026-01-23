import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganizationContext } from "./useOrganizationContext";
import { toast } from "sonner";

export interface AssetDocument {
  id: string;
  organization_id: string;
  asset_id: string;
  document_type: string;
  document_name: string;
  file_path: string;
  file_size: number | null;
  uploaded_by: string;
  created_at: string;
}

export const useAssetDocuments = (assetId: string | undefined) => {
  const { organizationId } = useOrganizationContext();

  return useQuery({
    queryKey: ["asset-documents", assetId],
    queryFn: async () => {
      if (!assetId) throw new Error("Asset ID required");

      const { data, error } = await supabase
        .from("asset_documents")
        .select("*")
        .eq("asset_id", assetId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as AssetDocument[];
    },
    enabled: !!assetId && !!organizationId,
  });
};

export const useUploadAssetDocument = () => {
  const queryClient = useQueryClient();
  const { organizationId } = useOrganizationContext();

  return useMutation({
    mutationFn: async ({
      assetId,
      file,
      documentType,
    }: {
      assetId: string;
      file: File;
      documentType: string;
    }) => {
      if (!organizationId) throw new Error("Organization ID required");

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      // Upload file to storage
      const fileName = `${organizationId}/${assetId}/${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from("asset-documents")
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      // Create document record
      const { data, error } = await supabase
        .from("asset_documents")
        .insert({
          organization_id: organizationId,
          asset_id: assetId,
          document_type: documentType,
          document_name: file.name,
          file_path: fileName,
          file_size: file.size,
          uploaded_by: user.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["asset-documents"] });
      toast.success("Document uploaded successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to upload document: ${error.message}`);
    },
  });
};

export const useDownloadAssetDocument = () => {
  return useMutation({
    mutationFn: async (filePath: string) => {
      const { data, error } = await supabase.storage
        .from("asset-documents")
        .download(filePath);

      if (error) throw error;
      return data;
    },
    onSuccess: (data, filePath) => {
      const url = URL.createObjectURL(data);
      const a = document.createElement("a");
      a.href = url;
      a.download = filePath.split("/").pop() || "document";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    },
    onError: (error: Error) => {
      toast.error(`Failed to download document: ${error.message}`);
    },
  });
};
