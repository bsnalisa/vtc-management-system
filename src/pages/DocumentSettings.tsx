import { useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useRoleNavigation } from "@/hooks/useRoleNavigation";
import { withRoleAccess } from "@/components/withRoleAccess";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Trash2 } from "lucide-react";
import {
  DOCUMENT_ENTITY_LABELS, DocumentEntityType, useAllDocumentMetadataFields, useDeleteDocumentMetadataField, useSaveDocumentMetadataField,
} from "@/hooks/useDocumentVersions";

const KEY_RE = /^[a-z][a-z0-9_]*$/;

const DocumentSettings = () => {
  const { navItems, groupLabel } = useRoleNavigation();
  const { data: fields = [], isLoading, error } = useAllDocumentMetadataFields();
  const save = useSaveDocumentMetadataField();
  const del = useDeleteDocumentMetadataField();
  const [entityType, setEntityType] = useState<DocumentEntityType>("application");
  const [fieldKey, setFieldKey] = useState("");
  const [label, setLabel] = useState("");
  const [required, setRequired] = useState(false);
  const keyInvalid = fieldKey !== "" && !KEY_RE.test(fieldKey);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (keyInvalid || !fieldKey || !label.trim()) return;
    try {
      await save.mutateAsync({ entity_type: entityType, field_key: fieldKey, label: label.trim(), required });
      setFieldKey(""); setLabel(""); setRequired(false);
    } catch { /* error toast shown by the hook */ }
  };

  return (
    <DashboardLayout title="Document Settings" subtitle="Information asked for on every document upload" navItems={navItems} groupLabel={groupLabel}>
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Document metadata fields</CardTitle>
            <CardDescription>
              Fields you add here are asked on every upload of that kind of record (for example every ID document uploaded to an application)
              and are stored with each version of the document. A required field must be filled in before the upload is accepted.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={add} className="grid gap-3 md:grid-cols-5 items-end">
              <div className="space-y-1"><Label>Record type</Label>
                <Select value={entityType} onValueChange={(v) => setEntityType(v as DocumentEntityType)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{(Object.keys(DOCUMENT_ENTITY_LABELS) as DocumentEntityType[]).map((t) => <SelectItem key={t} value={t}>{DOCUMENT_ENTITY_LABELS[t]}</SelectItem>)}</SelectContent>
                </Select></div>
              <div className="space-y-1"><Label htmlFor="fk">Field key</Label>
                <Input id="fk" placeholder="issue_date" value={fieldKey} onChange={(e) => setFieldKey(e.target.value)} aria-invalid={keyInvalid} />
                {keyInvalid && <p className="text-xs text-destructive">Lowercase letters, digits and underscores; start with a letter.</p>}</div>
              <div className="space-y-1"><Label htmlFor="fl">Label</Label>
                <Input id="fl" placeholder="Date of issue" value={label} onChange={(e) => setLabel(e.target.value)} /></div>
              <label className="flex items-center gap-2 text-sm pb-2"><Checkbox checked={required} onCheckedChange={(c) => setRequired(c === true)} />Required</label>
              <Button type="submit" disabled={save.isPending || keyInvalid || !fieldKey || !label.trim()}>Add field</Button>
            </form>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            {error && <p role="alert" className="text-sm text-destructive">{(error as Error).message}</p>}
            {isLoading ? <p className="text-sm text-muted-foreground">Loading...</p> : !fields.length ? (
              <p className="text-sm text-muted-foreground text-center py-6">No fields configured.</p>
            ) : (
              <Table>
                <TableHeader><TableRow><TableHead>Record type</TableHead><TableHead>Key</TableHead><TableHead>Label</TableHead><TableHead>Required</TableHead><TableHead /></TableRow></TableHeader>
                <TableBody>
                  {fields.map((f) => (
                    <TableRow key={f.id}>
                      <TableCell>{DOCUMENT_ENTITY_LABELS[f.entity_type]}</TableCell>
                      <TableCell className="font-mono">{f.field_key}</TableCell>
                      <TableCell>{f.label}</TableCell>
                      <TableCell>{f.required ? <Badge>Required</Badge> : <Badge variant="secondary">Optional</Badge>}</TableCell>
                      <TableCell className="text-right">
                        <Button size="icon" variant="ghost" aria-label={`Delete ${f.label}`} disabled={del.isPending} onClick={() => del.mutate(f.id)}><Trash2 className="h-4 w-4" /></Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default withRoleAccess(DocumentSettings, { requiredRoles: ["admin", "organization_admin"] });
