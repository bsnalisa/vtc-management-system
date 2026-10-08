import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Download, History, Upload } from "lucide-react";
import { toast } from "sonner";
import {
  DOCUMENT_ACCEPT, DocumentEntityType, DocumentMetadataField, DocumentVersion, downloadDocumentVersion,
  useDocumentMetadataFields, useDocumentVersions, useRestoreDocumentVersion, useUploadDocumentVersion, validateDocumentFile,
} from "@/hooks/useDocumentVersions";

interface Props {
  entityType: DocumentEntityType; entityId: string; slot: string; label: string;
  canUpload?: boolean; canRestore?: boolean;
}

const fmtDate = (s: string) => new Date(s).toLocaleString();
const fmtSize = (b: number | null) => (b == null ? "" : b > 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);

function MetaValues({ v, fields }: { v: DocumentVersion; fields: DocumentMetadataField[] }) {
  const keys = Object.keys(v.metadata ?? {}).filter((k) => v.metadata[k]);
  if (!keys.length) return null;
  return (
    <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-sm">
      {keys.map((k) => (
        <div key={k}><dt className="inline text-muted-foreground">{fields.find((f) => f.field_key === k)?.label ?? k}: </dt><dd className="inline">{v.metadata[k]}</dd></div>
      ))}
    </dl>
  );
}

function UploadDialog({ open, onOpenChange, ...p }: Props & { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { data: fields = [] } = useDocumentMetadataFields(p.entityType);
  const upload = useUploadDocumentVersion();
  const [file, setFile] = useState<File | null>(null);
  const [note, setNote] = useState("");
  const [meta, setMeta] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) { setError("Choose a file first"); return; }
    try {
      await upload.mutateAsync({ entityType: p.entityType, entityId: p.entityId, slot: p.slot, file, note, metadata: meta });
      setFile(null); setNote(""); setMeta({}); setError(null); onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed"); // toast is shown by the hook too
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Upload new version: {p.label}</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor={`file-${p.slot}`}>File (PDF, JPG, PNG, DOC, DOCX, XLS, XLSX; max 10 MB)</Label>
            <Input id={`file-${p.slot}`} type="file" accept={DOCUMENT_ACCEPT}
              onChange={(e) => {
                const f = e.target.files?.[0] ?? null;
                const problem = f ? validateDocumentFile(f) : null;
                if (problem) { toast.error(problem); setError(problem); e.target.value = ""; setFile(null); return; }
                setError(null); setFile(f);
              }} />
          </div>
          {fields.map((f) => (
            <div key={f.id} className="space-y-1">
              <Label htmlFor={`m-${f.field_key}`}>{f.label}{f.required && <span className="text-destructive"> *</span>}</Label>
              <Input id={`m-${f.field_key}`} value={meta[f.field_key] ?? ""} onChange={(e) => setMeta((m) => ({ ...m, [f.field_key]: e.target.value }))} />
            </div>
          ))}
          <div className="space-y-1">
            <Label htmlFor={`note-${p.slot}`}>Note (optional)</Label>
            <Textarea id={`note-${p.slot}`} rows={2} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={upload.isPending}>{upload.isPending ? "Uploading..." : "Upload"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function DocumentVersions(props: Props) {
  const { entityType, entityId, label, slot, canUpload, canRestore } = props;
  const { data: versions = [], isLoading, error } = useDocumentVersions(entityType, entityId, slot);
  const { data: fields = [] } = useDocumentMetadataFields(entityType);
  const restore = useRestoreDocumentVersion();
  const [uploading, setUploading] = useState(false);
  const current = versions.find((v) => v.is_current);

  return (
    <div className="border rounded-md p-3 space-y-2">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="font-medium">{label}</div>
        {canUpload && <Button size="sm" variant="outline" onClick={() => setUploading(true)}><Upload className="h-4 w-4 mr-1" />Upload new version</Button>}
      </div>
      {isLoading && <p className="text-sm text-muted-foreground">Loading...</p>}
      {error && <p role="alert" className="text-sm text-destructive">{(error as Error).message}</p>}
      {!isLoading && !error && !current && <p className="text-sm text-muted-foreground">No document uploaded yet.</p>}
      {current && (
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium break-all">{current.file_name}</span>
            <Badge>Version {current.version_no}</Badge>
            <Button size="sm" variant="secondary" onClick={() => downloadDocumentVersion(current)}><Download className="h-4 w-4 mr-1" />Download</Button>
          </div>
          <div className="text-xs text-muted-foreground">Uploaded {fmtDate(current.uploaded_at)} {fmtSize(current.size_bytes)}</div>
          {current.note && <p className="text-sm">Note: {current.note}</p>}
          <MetaValues v={current} fields={fields} />
        </div>
      )}
      {versions.length > 0 && (
        <Collapsible>
          <CollapsibleTrigger asChild><Button size="sm" variant="ghost" className="px-1"><History className="h-4 w-4 mr-1" />Version history ({versions.length})</Button></CollapsibleTrigger>
          <CollapsibleContent className="space-y-2 pt-2">
            {versions.map((v) => (
              <div key={v.id} className="border-t pt-2 text-sm space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant={v.is_current ? "default" : "secondary"}>v{v.version_no}{v.is_current ? " (current)" : ""}</Badge>
                  <span className="break-all">{v.file_name}</span>
                  <span className="text-xs text-muted-foreground">{fmtDate(v.uploaded_at)} {fmtSize(v.size_bytes)}</span>
                  <Button size="sm" variant="outline" onClick={() => downloadDocumentVersion(v)}><Download className="h-4 w-4 mr-1" />Download</Button>
                  {canRestore && !v.is_current && (
                    <Button size="sm" variant="outline" disabled={restore.isPending} onClick={() => restore.mutate(v)}>Make current</Button>
                  )}
                </div>
                {v.note && <p className="text-muted-foreground">Note: {v.note}</p>}
                <MetaValues v={v} fields={fields} />
              </div>
            ))}
          </CollapsibleContent>
        </Collapsible>
      )}
      {canUpload && <UploadDialog {...props} open={uploading} onOpenChange={setUploading} />}
    </div>
  );
}

export default DocumentVersions;
