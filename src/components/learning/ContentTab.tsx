import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ArrowDown, ArrowUp, ExternalLink, FileText, Link as LinkIcon, Pencil, Plus, Trash2, Video, File } from "lucide-react";
import { LearningItem, useDeleteLearningItem, useLearningItems, useReorderLearningItems, useSaveLearningItem } from "@/hooks/useLearningSpace";

const TYPE_LABEL: Record<LearningItem["item_type"], string> = { page: "Page", link: "Link", document: "Document", recording: "Recording" };
const TypeIcon = ({ type }: { type: LearningItem["item_type"] }) =>
  type === "page" ? <FileText className="h-4 w-4" /> : type === "recording" ? <Video className="h-4 w-4" /> : type === "document" ? <File className="h-4 w-4" /> : <LinkIcon className="h-4 w-4" />;

interface Draft { id?: string; title: string; item_type: LearningItem["item_type"]; body: string; url: string; published: boolean }
const emptyDraft: Draft = { title: "", item_type: "page", body: "", url: "", published: false };

export function ContentTab({ classId, canManage }: { classId: string; canManage: boolean }) {
  const { data: items = [], isLoading } = useLearningItems(classId);
  const save = useSaveLearningItem();
  const remove = useDeleteLearningItem();
  const reorder = useReorderLearningItems();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [toDelete, setToDelete] = useState<LearningItem | null>(null);

  const visible = canManage ? items : items.filter((i) => i.published);

  const move = (index: number, dir: -1 | 1) => {
    const next = [...items];
    const j = index + dir;
    if (j < 0 || j >= next.length) return;
    [next[index], next[j]] = [next[j], next[index]];
    reorder.mutate(next);
  };

  const submit = () => {
    if (!draft) return;
    const isPage = draft.item_type === "page";
    save.mutate({
      id: draft.id, class_id: classId, title: draft.title.trim(), item_type: draft.item_type,
      body: isPage ? draft.body : null, url: isPage ? null : draft.url.trim(), published: draft.published,
      ...(draft.id ? {} : { position: items.length }),
    } as Partial<LearningItem>, { onSuccess: () => setDraft(null) });
  };

  const valid = !!draft && draft.title.trim() !== "" && (draft.item_type === "page" || /^https?:\/\//i.test(draft.url.trim()));

  return (
    <Card className="border-0 shadow-md">
      <CardHeader className="flex-row items-start justify-between space-y-0">
        <div>
          <CardTitle>Learning content</CardTitle>
          <CardDescription>
            {canManage
              ? "Documents and recordings are links to files hosted elsewhere (for example a shared drive or video site). There is no file upload here."
              : "Material shared by your trainer."}
          </CardDescription>
        </div>
        {canManage && <Button size="sm" onClick={() => setDraft(emptyDraft)}><Plus className="h-4 w-4 mr-2" />Add content</Button>}
      </CardHeader>
      <CardContent className="space-y-3">
        {visible.map((item, index) => (
          <div key={item.id} className="border rounded-md p-3 text-sm space-y-2">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2 font-medium"><TypeIcon type={item.item_type} />{item.title}</div>
              <div className="flex items-center gap-1">
                <Badge variant="secondary">{TYPE_LABEL[item.item_type]}</Badge>
                {canManage && (
                  <>
                    <Badge variant={item.published ? "default" : "outline"}>{item.published ? "Published" : "Draft"}</Badge>
                    <Button variant="ghost" size="icon" aria-label="Move up" disabled={index === 0 || reorder.isPending} onClick={() => move(index, -1)}><ArrowUp className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" aria-label="Move down" disabled={index === items.length - 1 || reorder.isPending} onClick={() => move(index, 1)}><ArrowDown className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" aria-label="Edit" onClick={() => setDraft({ id: item.id, title: item.title, item_type: item.item_type, body: item.body ?? "", url: item.url ?? "", published: item.published })}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" aria-label="Delete" onClick={() => setToDelete(item)}><Trash2 className="h-4 w-4" /></Button>
                  </>
                )}
              </div>
            </div>
            {item.item_type === "page"
              ? <p className="whitespace-pre-wrap">{item.body}</p>
              : item.url && (
                <a href={item.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary underline break-all">
                  Open {TYPE_LABEL[item.item_type].toLowerCase()} <ExternalLink className="h-3 w-3" />
                </a>
              )}
          </div>
        ))}
        {!isLoading && !visible.length && (
          <p className="text-sm text-muted-foreground text-center py-8">{canManage ? "No content yet. Add the first page or link." : "Nothing has been published yet."}</p>
        )}
      </CardContent>

      <Dialog open={!!draft} onOpenChange={(o) => !o && setDraft(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{draft?.id ? "Edit content" : "Add content"}</DialogTitle>
            <DialogDescription>Pages hold text. Links, documents and recordings point to a web address (https://...) where the file is hosted.</DialogDescription>
          </DialogHeader>
          {draft && (
            <div className="space-y-3">
              <div className="space-y-1"><Label>Title</Label><Input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} /></div>
              <div className="space-y-1">
                <Label>Type</Label>
                <Select value={draft.item_type} onValueChange={(v) => setDraft({ ...draft, item_type: v as Draft["item_type"] })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="page">Page (text)</SelectItem>
                    <SelectItem value="link">Link</SelectItem>
                    <SelectItem value="document">Document (link to a file)</SelectItem>
                    <SelectItem value="recording">Recording (link to a video)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {draft.item_type === "page"
                ? <div className="space-y-1"><Label>Text</Label><Textarea rows={8} value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })} /></div>
                : <div className="space-y-1"><Label>Web address</Label><Input placeholder="https://" value={draft.url} onChange={(e) => setDraft({ ...draft, url: e.target.value })} /></div>}
              <div className="flex items-center gap-2"><Switch checked={draft.published} onCheckedChange={(v) => setDraft({ ...draft, published: v })} /><Label>Published (visible to trainees)</Label></div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDraft(null)}>Cancel</Button>
            <Button disabled={!valid || save.isPending} onClick={submit}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)} title="Delete this item?"
        description={`"${toDelete?.title ?? ""}" will be removed for everyone.`} confirmText="Delete" variant="destructive"
        onConfirm={() => { if (toDelete) remove.mutate(toDelete.id); setToDelete(null); }} />
    </Card>
  );
}
