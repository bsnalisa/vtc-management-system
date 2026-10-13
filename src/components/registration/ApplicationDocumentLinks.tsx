import { useQuery } from "@tanstack/react-query";
import { ExternalLink, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { resolvePhotoUrl } from "@/hooks/usePhotoUrl";

const isImage = (path: string) => /\.(png|jpe?g|gif|webp)$/i.test(path.split("?")[0]);
const fileLabel = (path: string) => decodeURIComponent(path.split("/").pop() || path).replace(/^\d+[-_]/, "");

/** One uploaded file: shows the missing state, or a preview and an "Open" link using a signed URL. */
export const DocumentLink = ({ label, path }: { label: string; path?: string | null }) => {
  const { data: url, isLoading, isError } = useQuery({
    queryKey: ["application-doc-url", path],
    enabled: !!path,
    staleTime: 30 * 60 * 1000,
    queryFn: () => resolvePhotoUrl(path as string),
  });

  return (
    <div className="flex items-center gap-3 rounded-md border p-3">
      {path && url && isImage(path) ? (
        <a href={url} target="_blank" rel="noreferrer">
          <img src={url} alt={label} className="h-14 w-14 rounded object-cover border" />
        </a>
      ) : (
        <FileText className="h-8 w-8 shrink-0 text-muted-foreground" />
      )}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{label}</p>
        {!path ? (
          <p className="text-xs text-destructive">Not uploaded</p>
        ) : (
          <p className="truncate text-xs text-muted-foreground">
            {isError ? "Could not open this file" : fileLabel(path)}
          </p>
        )}
      </div>
      {path && (
        <Button size="sm" variant="outline" asChild={!!url} disabled={!url || isLoading}>
          {url ? (
            <a href={url} target="_blank" rel="noreferrer">
              <ExternalLink className="h-3.5 w-3.5 mr-1" />
              Open
            </a>
          ) : (
            <span>{isLoading ? "Loading…" : "Unavailable"}</span>
          )}
        </Button>
      )}
    </div>
  );
};

/** Every document attached to an application, each opening through a short-lived signed link. */
export const ApplicationDocumentLinks = ({ application }: { application: any }) => {
  const additional: string[] = Array.isArray(application.additional_documents_paths)
    ? application.additional_documents_paths.filter(Boolean)
    : [];
  return (
    <div className="col-span-full grid gap-2 sm:grid-cols-2">
      <DocumentLink label="Passport photo" path={application.photo_path} />
      <DocumentLink label="ID document" path={application.id_document_path} />
      <DocumentLink label="School leaving certificate" path={application.school_leaving_cert_path} />
      <DocumentLink label="Academic qualifications" path={application.academic_qualifications_path} />
      {additional.map((p, i) => (
        <DocumentLink key={p} label={`Additional document ${i + 1}`} path={p} />
      ))}
    </div>
  );
};
