import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Upload, X, FileText, Image, CheckCircle, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface DocumentUploadProps {
  label: string;
  description?: string;
  required?: boolean;
  accept?: string;
  maxSizeMB?: number;
  onUpload: (filePath: string) => void;
  currentPath?: string;
  bucket?: string;
  folder?: string;
}

export const DocumentUpload = ({
  label,
  description,
  required = false,
  accept = ".pdf,.jpg,.jpeg,.png",
  maxSizeMB = 5,
  onUpload,
  currentPath,
  bucket = "documents",
  folder = "applications",
}: DocumentUploadProps) => {
  const [uploading, setUploading] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file size
    const maxBytes = maxSizeMB * 1024 * 1024;
    if (file.size > maxBytes) {
      setError(`File size must be less than ${maxSizeMB}MB`);
      return;
    }

    // Validate file type
    const allowedTypes = accept.split(",").map(t => t.trim().toLowerCase());
    const fileExt = `.${file.name.split(".").pop()?.toLowerCase()}`;
    if (!allowedTypes.some(t => t === fileExt || t === file.type)) {
      setError(`File type not allowed. Accepted: ${accept}`);
      return;
    }

    setError(null);
    setUploading(true);

    try {
      // Generate unique file name
      const timestamp = Date.now();
      const uniqueName = `${folder}/${timestamp}_${file.name.replace(/\s+/g, "_")}`;

      const { data, error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(uniqueName, file, {
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadError) {
        throw uploadError;
      }

      setFileName(file.name);
      onUpload(data.path);
      
      toast({
        title: "Uploaded",
        description: `${file.name} uploaded successfully`,
      });
    } catch (err: any) {
      console.error("Upload error:", err);
      setError(err.message || "Failed to upload file");
      toast({
        title: "Upload Failed",
        description: err.message || "Failed to upload file",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = () => {
    setFileName(null);
    setError(null);
    onUpload("");
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  };

  const getFileIcon = () => {
    if (fileName?.match(/\.(jpg|jpeg|png|gif)$/i)) {
      return <Image className="h-4 w-4" />;
    }
    return <FileText className="h-4 w-4" />;
  };

  const displayName = fileName || (currentPath ? currentPath.split("/").pop() : null);

  return (
    <div className="space-y-2">
      <Label className="flex items-center gap-1">
        {label}
        {required && <span className="text-destructive">*</span>}
      </Label>
      {description && (
        <p className="text-sm text-muted-foreground">{description}</p>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={accept}
        onChange={handleFileChange}
        className="hidden"
        disabled={uploading}
      />

      {displayName ? (
        <Card className="border-green-200 bg-green-50">
          <CardContent className="p-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-600" />
              {getFileIcon()}
              <span className="text-sm font-medium truncate max-w-[200px]">
                {displayName}
              </span>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleRemove}
              className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
            >
              <X className="h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card
          className={`border-dashed cursor-pointer hover:border-primary transition-colors ${
            error ? "border-destructive" : ""
          }`}
          onClick={() => inputRef.current?.click()}
        >
          <CardContent className="p-4 flex flex-col items-center justify-center text-center">
            {uploading ? (
              <div className="flex items-center gap-2">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                <span className="text-sm text-muted-foreground">Uploading...</span>
              </div>
            ) : (
              <>
                <Upload className="h-8 w-8 text-muted-foreground mb-2" />
                <p className="text-sm font-medium">Click to upload</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {accept.replace(/\./g, "").toUpperCase()} up to {maxSizeMB}MB
                </p>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {error && (
        <div className="flex items-center gap-1 text-sm text-destructive">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      )}
    </div>
  );
};

interface MultipleDocumentUploadProps {
  label: string;
  description?: string;
  onUpload: (filePaths: string[]) => void;
  currentPaths?: string[];
  maxFiles?: number;
  bucket?: string;
  folder?: string;
}

export const MultipleDocumentUpload = ({
  label,
  description,
  onUpload,
  currentPaths = [],
  maxFiles = 5,
  bucket = "documents",
  folder = "applications",
}: MultipleDocumentUploadProps) => {
  const [paths, setPaths] = useState<string[]>(currentPaths);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    if (paths.length + files.length > maxFiles) {
      toast({
        title: "Too many files",
        description: `Maximum ${maxFiles} files allowed`,
        variant: "destructive",
      });
      return;
    }

    setUploading(true);
    const newPaths: string[] = [];

    try {
      for (const file of Array.from(files)) {
        const timestamp = Date.now();
        const uniqueName = `${folder}/${timestamp}_${file.name.replace(/\s+/g, "_")}`;

        const { data, error: uploadError } = await supabase.storage
          .from(bucket)
          .upload(uniqueName, file, {
            cacheControl: "3600",
            upsert: false,
          });

        if (uploadError) throw uploadError;
        newPaths.push(data.path);
      }

      const updated = [...paths, ...newPaths];
      setPaths(updated);
      onUpload(updated);

      toast({
        title: "Uploaded",
        description: `${newPaths.length} file(s) uploaded successfully`,
      });
    } catch (err: any) {
      toast({
        title: "Upload Failed",
        description: err.message || "Failed to upload files",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const handleRemove = (index: number) => {
    const updated = paths.filter((_, i) => i !== index);
    setPaths(updated);
    onUpload(updated);
  };

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {description && (
        <p className="text-sm text-muted-foreground">{description}</p>
      )}

      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.jpg,.jpeg,.png"
        onChange={handleFileChange}
        className="hidden"
        multiple
        disabled={uploading}
      />

      <div className="space-y-2">
        {paths.map((path, index) => (
          <Card key={index} className="border-green-200 bg-green-50">
            <CardContent className="p-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-green-600" />
                <span className="text-sm truncate max-w-[200px]">
                  {path.split("/").pop()}
                </span>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => handleRemove(index)}
                className="h-6 w-6 p-0"
              >
                <X className="h-3 w-3" />
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {paths.length < maxFiles && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? (
            <>
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent mr-2" />
              Uploading...
            </>
          ) : (
            <>
              <Upload className="h-4 w-4 mr-2" />
              Add Document ({paths.length}/{maxFiles})
            </>
          )}
        </Button>
      )}
    </div>
  );
};
