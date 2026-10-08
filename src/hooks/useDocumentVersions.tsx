import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useOrganizationContext } from "./useOrganizationContext";

// Newer than the generated Supabase types, so access untyped.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export type DocumentEntityType = "application" | "assessment_request" | "trainee";

export const DOCUMENT_ENTITY_LABELS: Record<DocumentEntityType, string> = {
  application: "Application",
  assessment_request: "Assessment request",
  trainee: "Trainee",
};

export interface DocumentVersion {
  id: string; entity_type: DocumentEntityType; entity_id: string; slot: string; version_no: number;
  storage_path: string; file_name: string; mime_type: string | null; size_bytes: number | null;
  note: string | null; metadata: Record<string, string>; is_current: boolean;
  uploaded_by: string | null; uploaded_at: string;
}
export interface DocumentMetadataField {
  id: string; entity_type: DocumentEntityType; field_key: string; label: string; required: boolean;
}

// Matches the allowed mime types of the private 'documents' bucket (pdf, jpg, png, doc, docx, xls, xlsx).
export const ALLOWED_DOCUMENT_TYPES: Record<string, string> = {
  "application/pdf": "PDF",
  "image/jpeg": "JPG",
  "image/png": "PNG",
  "application/msword": "DOC",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "DOCX",
  "application/vnd.ms-excel": "XLS",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "XLSX",
};
export const DOCUMENT_ACCEPT = ".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx";
export const DEFAULT_MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;

export const validateDocumentFile = (file: File, maxBytes = DEFAULT_MAX_DOCUMENT_BYTES): string | null => {
  if (!ALLOWED_DOCUMENT_TYPES[file.type]) return "Unsupported file type. Use PDF, JPG, PNG, DOC, DOCX, XLS or XLSX.";
  if (file.size > maxBytes) return `File is too large. The maximum is ${Math.round(maxBytes / 1024 / 1024)} MB.`;
  if (file.size === 0) return "The file is empty.";
  return null;
};

export const useDocumentVersions = (entityType: DocumentEntityType, entityId: string | undefined, slot: string) =>
  useQuery({
    queryKey: ["document-versions", entityType, entityId, slot],
    enabled: !!entityId,
    queryFn: async () => {
      const { data, error } = await db.from("document_versions").select("*")
        .eq("entity_type", entityType).eq("entity_id", entityId).eq("slot", slot)
        .order("version_no", { ascending: false });
      if (error) throw error;
      return (data ?? []) as DocumentVersion[];
    },
  });

export const useDocumentMetadataFields = (entityType: DocumentEntityType) =>
  useQuery({
    queryKey: ["document-metadata-fields", entityType],
    queryFn: async () => {
      const { data, error } = await db.from("document_metadata_fields").select("*")
        .eq("entity_type", entityType).order("label");
      if (error) throw error;
      return (data ?? []) as DocumentMetadataField[];
    },
  });

export const useAllDocumentMetadataFields = () =>
  useQuery({
    queryKey: ["document-metadata-fields", "all"],
    queryFn: async () => {
      const { data, error } = await db.from("document_metadata_fields").select("*").order("entity_type").order("label");
      if (error) throw error;
      return (data ?? []) as DocumentMetadataField[];
    },
  });

export const useSaveDocumentMetadataField = () => {
  const qc = useQueryClient();
  const { organizationId } = useOrganizationContext();
  return useMutation({
    mutationFn: async (f: { entity_type: DocumentEntityType; field_key: string; label: string; required: boolean }) => {
      if (!organizationId) throw new Error("No centre found for your account");
      const { error } = await db.from("document_metadata_fields").insert({ ...f, organization_id: organizationId });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["document-metadata-fields"] }); toast.success("Field added"); },
    onError: (e: Error) => toast.error(e.message),
  });
};

export const useDeleteDocumentMetadataField = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from("document_metadata_fields").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["document-metadata-fields"] }); toast.success("Field removed"); },
    onError: (e: Error) => toast.error(e.message),
  });
};

export interface UploadDocumentInput {
  entityType: DocumentEntityType; entityId: string; slot: string; file: File;
  note?: string; metadata?: Record<string, string>; maxBytes?: number;
}

export const useUploadDocumentVersion = () => {
  const qc = useQueryClient();
  const { organizationId } = useOrganizationContext();
  return useMutation({
    mutationFn: async (i: UploadDocumentInput) => {
      if (!organizationId) throw new Error("No centre found for your account");
      const problem = validateDocumentFile(i.file, i.maxBytes);
      if (problem) throw new Error(problem);
      const safeName = i.file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `${organizationId}/documents/${i.entityType}/${i.entityId}/${i.slot}/${Date.now()}_${safeName}`;
      const { error: upErr } = await supabase.storage.from("documents").upload(path, i.file, { contentType: i.file.type });
      if (upErr) throw upErr;
      const { error } = await db.rpc("add_document_version", {
        _entity_type: i.entityType, _entity: i.entityId, _slot: i.slot, _path: path,
        _file_name: i.file.name, _mime: i.file.type, _size: i.file.size,
        _note: i.note?.trim() || null, _metadata: i.metadata ?? {},
      });
      if (error) {
        // Do not leave an orphan file behind when the database rejects the version.
        const { error: rmErr } = await supabase.storage.from("documents").remove([path]);
        if (rmErr) console.error("Could not remove orphaned upload", rmErr);
        throw error;
      }
    },
    onSuccess: (_d, i) => {
      qc.invalidateQueries({ queryKey: ["document-versions", i.entityType, i.entityId, i.slot] });
      toast.success("New version uploaded");
    },
    onError: (e: Error) => toast.error(e.message),
  });
};

export const useRestoreDocumentVersion = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: DocumentVersion) => {
      const { error } = await db.rpc("restore_document_version", { _version: v.id });
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["document-versions", v.entity_type, v.entity_id, v.slot] });
      toast.success(`Version ${v.version_no} is now current`);
    },
    onError: (e: Error) => toast.error(e.message),
  });
};

export const getDocumentUrl = async (path: string) => {
  const { data, error } = await supabase.storage.from("documents").createSignedUrl(path, 3600);
  if (error) throw error;
  return data.signedUrl;
};

export const downloadDocumentVersion = async (v: DocumentVersion) => {
  try {
    window.open(await getDocumentUrl(v.storage_path), "_blank", "noopener");
  } catch (e) {
    toast.error(e instanceof Error ? e.message : "Could not open the document");
  }
};
