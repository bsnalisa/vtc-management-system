import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Camera, RefreshCw, Trash2, Upload, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LoadingIndicator } from "@/components/ui/loading-spinner";
import { supabase } from "@/integrations/supabase/client";
import { useOrganizationContext } from "@/hooks/useOrganizationContext";
import { usePhotoUrl } from "@/hooks/usePhotoUrl";

const MAX_BYTES = 2 * 1024 * 1024;
const TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png" };

interface PhotoUploadProps {
  /** Stored path in the "documents" bucket ('' or undefined when none). */
  value?: string;
  /** Called with the storage path after upload, or '' after removal. */
  onChange: (path: string) => void;
  /** Centre to upload under; falls back to the signed-in user's centre. */
  organizationId?: string | null;
  disabled?: boolean;
}

export const PhotoUpload = ({ value, onChange, organizationId: orgOverride, disabled }: PhotoUploadProps) => {
  const { organizationId: ctxOrg } = useOrganizationContext();
  const organizationId = orgOverride || ctxOrg;
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [localUrl, setLocalUrl] = useState<string | null>(null);
  const { data: storedUrl, error: previewError } = usePhotoUrl(value);

  // Release the object URL when it is replaced or the component unmounts.
  useEffect(() => () => { if (localUrl) URL.revokeObjectURL(localUrl); }, [localUrl]);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (inputRef.current) inputRef.current.value = "";
    if (!file) return;

    const ext = TYPES[file.type];
    if (!ext) { setError("Only JPG or PNG images are allowed."); return; }
    if (file.size > MAX_BYTES) { setError("The photo must be 2MB or smaller."); return; }
    if (!organizationId) {
      const msg = "Cannot upload the photo: no training centre is selected.";
      setError(msg); toast.error(msg); return;
    }

    setError(null);
    setUploading(true);
    const preview = URL.createObjectURL(file);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Sign in to upload the photo");
      const path = `${organizationId}/applications/${user.id}/photo_${Date.now()}_${crypto.randomUUID()}.${ext}`;
      const { data, error: uploadError } = await supabase.storage
        .from("documents").upload(path, file, { cacheControl: "3600", upsert: false, contentType: file.type });
      if (uploadError) throw uploadError;
      setLocalUrl(preview);
      onChange(data.path);
      toast.success("Photo uploaded");
    } catch (err) {
      URL.revokeObjectURL(preview);
      const msg = err instanceof Error ? err.message : "Failed to upload photo";
      console.error("Photo upload error:", err);
      setError(msg);
      toast.error(`Photo upload failed: ${msg}`);
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = () => {
    setLocalUrl(null);
    setError(null);
    onChange("");
  };

  const src = value ? (localUrl ?? storedUrl ?? null) : null;

  return (
    <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
      <div className="w-32 h-40 border-2 border-dashed rounded-lg flex items-center justify-center bg-muted overflow-hidden">
        {uploading ? <LoadingIndicator className="h-6 w-6" />
          : src ? <img src={src} alt="Applicant passport photo" className="h-full w-full object-cover" />
          : <Camera className="h-8 w-8 text-muted-foreground" />}
      </div>
      <div className="space-y-2">
        <input ref={inputRef} type="file" accept="image/jpeg,image/png" className="hidden" onChange={handleFile} disabled={disabled || uploading} />
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" disabled={disabled || uploading} onClick={() => inputRef.current?.click()}>
            {value ? <RefreshCw className="h-4 w-4 mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
            {value ? "Replace" : "Upload Photo"}
          </Button>
          {value && (
            <Button type="button" variant="ghost" size="sm" disabled={disabled || uploading} onClick={handleRemove} className="text-destructive hover:text-destructive">
              <Trash2 className="h-4 w-4 mr-2" />Remove
            </Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">Passport photo required. Max 2MB, JPG/PNG format.</p>
        {previewError && value && !localUrl && (
          <p className="text-xs text-muted-foreground">Photo saved, but a preview is not available.</p>
        )}
        {error && (
          <div className="flex items-center gap-1 text-sm text-destructive"><AlertCircle className="h-4 w-4" />{error}</div>
        )}
      </div>
    </div>
  );
};
