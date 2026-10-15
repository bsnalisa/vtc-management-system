import { useRef } from "react";
import { Paperclip, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { openAttachment, useAddAttachment, useRemoveAttachment, useSubmitRequest, useWorkflowAttachments } from "@/hooks/useFinance";

/** Supporting documents of a request. The submitter can add files while it is open (and remove them from a draft). */
export function WorkflowAttachments({ instanceId, canEdit, canRemove }: { instanceId: string; canEdit?: boolean; canRemove?: boolean }) {
  const { data } = useWorkflowAttachments(instanceId);
  const add = useAddAttachment(instanceId);
  const remove = useRemoveAttachment(instanceId);
  const input = useRef<HTMLInputElement>(null);
  return (
    <div className="space-y-2">
      <h4 className="font-medium text-sm">Supporting documents</h4>
      {!data?.length && <p className="text-sm text-muted-foreground">None attached.</p>}
      <ul className="space-y-1">
        {data?.map((a) => (
          <li key={a.id} className="flex items-center gap-2 text-sm">
            <Paperclip className="h-3.5 w-3.5 text-muted-foreground" />
            <button type="button" className="underline text-left" onClick={() => openAttachment(a.file_path)}>{a.file_name}</button>
            {canRemove && <Button type="button" size="icon" variant="ghost" aria-label={`Remove ${a.file_name}`} onClick={() => remove.mutate(a)}><Trash2 className="h-3.5 w-3.5" /></Button>}
          </li>
        ))}
      </ul>
      {canEdit && (
        <>
          <input ref={input} type="file" className="hidden" accept=".pdf,.png,.jpg,.jpeg,.doc,.docx,.xls,.xlsx,.csv"
            onChange={async (e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) await add.mutateAsync(f); }} />
          <Button type="button" size="sm" variant="outline" disabled={add.isPending} onClick={() => input.current?.click()}><Upload className="h-3.5 w-3.5 mr-1" />Attach a document</Button>
        </>
      )}
    </div>
  );
}

/** Step two of every finance request: attach the documents, then send it for approval (or keep it as a draft). */
export function SubmitRequestDialog({ instanceId, title, onClose }: { instanceId: string; title: string; onClose: () => void }) {
  const submit = useSubmitRequest();
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Send for approval</DialogTitle>
          <DialogDescription>{title}</DialogDescription>
        </DialogHeader>
        <WorkflowAttachments instanceId={instanceId} canEdit canRemove />
        <p className="text-xs text-muted-foreground">It goes to your direct supervisor. You can keep it as a draft and submit it later from My Approvals.</p>
        <div className="flex gap-2">
          <Button disabled={submit.isPending} onClick={async () => { await submit.mutateAsync(instanceId); onClose(); }}>Send for approval</Button>
          <Button variant="outline" onClick={onClose}>Keep as draft</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
