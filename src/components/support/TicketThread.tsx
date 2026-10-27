import { useState } from "react";
import { format, formatDistanceToNow } from "date-fns";
import { ArrowUpCircle, CheckCircle2, Lock, RotateCcw, Send } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LoadingIndicator } from "@/components/ui/loading-spinner";
import {
  SupportTicket, TicketMessage, useCentreAdmins, usePeopleNames, useTicketAssign, useTicketEscalate, useTicketMessages,
  useTicketReply, useTicketStatus, useTicketSuperAction,
} from "@/hooks/useSupportTickets";

export type TicketViewer = "requester" | "admin" | "super";

const statusLabel = (s: string) => s.replace(/_/g, " ");
export const StatusBadge = ({ status }: { status: string }) => (
  <Badge variant={status === "open" ? "destructive" : status === "in_progress" ? "secondary" : status === "resolved" ? "default" : "outline"}>{statusLabel(status)}</Badge>
);
export const PriorityBadge = ({ priority }: { priority: string }) => (
  <Badge variant={priority === "urgent" ? "destructive" : priority === "high" ? "default" : priority === "medium" ? "secondary" : "outline"}>{priority}</Badge>
);
export const EscalationBadge = ({ status }: { status: string }) =>
  status === "escalated" ? <Badge variant="destructive">With Super Admin</Badge>
  : status === "returned" ? <Badge variant="secondary">Returned with guidance</Badge>
  : status === "resolved" ? <Badge variant="outline">Resolved by Super Admin</Badge> : null;

const Message = ({ m }: { m: TicketMessage }) => {
  const system = ["status", "assignment"].includes(m.kind);
  if (system) return <p className="text-xs text-muted-foreground text-center">{m.body} · {formatDistanceToNow(new Date(m.created_at), { addSuffix: true })}</p>;
  return (
    <div className={`rounded-md border p-3 text-sm ${m.internal ? "border-dashed bg-muted/40" : m.author_role === "requester" ? "bg-background" : "bg-primary/5"}`}>
      <div className="mb-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span className="font-medium text-foreground">{m.author_name || "Someone"}</span>
        <span>{m.author_role === "super_admin" ? "Super Admin" : m.author_role === "organization_admin" ? "IT support" : "Requester"}</span>
        {m.internal && <Badge variant="outline" className="gap-1"><Lock className="h-3 w-3" />{m.kind === "escalation" ? "Escalation (internal)" : m.kind === "escalation_response" ? "Super Admin guidance (internal)" : "Internal note"}</Badge>}
        {m.kind === "resolution" && <Badge className="gap-1"><CheckCircle2 className="h-3 w-3" />Resolution</Badge>}
        <span className="ml-auto">{format(new Date(m.created_at), "d MMM yyyy, HH:mm")}</span>
      </div>
      <p className="whitespace-pre-wrap">{m.body}</p>
    </div>
  );
};

export function TicketThread({ ticket, viewer, onClose }: { ticket: SupportTicket; viewer: TicketViewer; onClose: () => void }) {
  const { data: messages, isLoading } = useTicketMessages(ticket.id);
  const { data: names } = usePeopleNames([ticket.user_id, ticket.assigned_to ?? ""]);
  const { data: admins } = useCentreAdmins(ticket.organization_id, viewer === "admin");
  const reply = useTicketReply(); const assign = useTicketAssign(); const setStatus = useTicketStatus();
  const escalate = useTicketEscalate(); const superAct = useTicketSuperAction();
  const [text, setText] = useState("");
  const [panel, setPanel] = useState<null | "resolve" | "escalate" | "reopen">(null);
  const [panelText, setPanelText] = useState("");

  const closed = ticket.status === "closed";
  const withSuper = ticket.escalation_status === "escalated";
  const busy = reply.isPending || assign.isPending || setStatus.isPending || escalate.isPending || superAct.isPending;
  const send = (internal: boolean) => { if (!text.trim()) return; reply.mutate({ ticket: ticket.id, body: text, internal }, { onSuccess: () => setText("") }); };
  const finishPanel = () => { setPanel(null); setPanelText(""); };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-sm text-muted-foreground">{ticket.reference ?? "Ticket"}</span>
            <span>{ticket.subject}</span>
          </DialogTitle>
          <DialogDescription asChild>
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={ticket.status} /><PriorityBadge priority={ticket.priority} /><EscalationBadge status={ticket.escalation_status} />
              {ticket.category && <Badge variant="outline">{ticket.category}</Badge>}
              <span className="text-xs">Raised by {names?.[ticket.user_id] ?? "…"} on {format(new Date(ticket.created_at), "d MMM yyyy")}</span>
              {ticket.assigned_to && <span className="text-xs">· Assigned to {names?.[ticket.assigned_to] ?? "…"}</span>}
            </div>
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-md bg-muted/40 p-3 text-sm"><p className="mb-1 text-xs font-medium text-muted-foreground">Problem reported</p><p className="whitespace-pre-wrap">{ticket.description}</p></div>
        {ticket.escalation_reason && viewer !== "requester" && (
          <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm"><p className="mb-1 text-xs font-medium text-destructive">Escalation reason</p><p className="whitespace-pre-wrap">{ticket.escalation_reason}</p></div>
        )}

        <div className="space-y-2">
          {isLoading ? <LoadingIndicator className="mx-auto h-6 w-6 text-muted-foreground" /> : (messages ?? []).length === 0
            ? <p className="py-2 text-center text-sm text-muted-foreground">No messages yet.</p> : (messages ?? []).map((m) => <Message key={m.id} m={m} />)}
        </div>

        {!closed && (
          <div className="space-y-2">
            <Label htmlFor="ticket-msg">{viewer === "requester" ? "Reply" : viewer === "super" ? "Your response" : "Reply to the requester or add a troubleshooting note"}</Label>
            <Textarea id="ticket-msg" rows={3} value={text} onChange={(e) => setText(e.target.value)} placeholder={viewer === "super" ? "Guidance for the centre, or how the problem was fixed (at least 10 characters)" : "Write a message"} />
            <div className="flex flex-wrap gap-2">
              {viewer !== "super" && <Button size="sm" disabled={busy || !text.trim()} onClick={() => send(false)}><Send className="mr-2 h-4 w-4" />{viewer === "requester" ? "Send reply" : "Reply to requester"}</Button>}
              {viewer === "admin" && <Button size="sm" variant="outline" disabled={busy || !text.trim()} onClick={() => send(true)}><Lock className="mr-2 h-4 w-4" />Add internal note</Button>}
              {viewer === "super" && withSuper && (<>
                <Button size="sm" disabled={busy || text.trim().length < 10} onClick={() => superAct.mutate({ ticket: ticket.id, action: "return", note: text }, { onSuccess: () => setText("") })}>Return with guidance</Button>
                <Button size="sm" variant="outline" disabled={busy || text.trim().length < 10} onClick={() => superAct.mutate({ ticket: ticket.id, action: "resolve", note: text }, { onSuccess: onClose })}><CheckCircle2 className="mr-2 h-4 w-4" />Resolve ticket</Button>
              </>)}
              {viewer === "super" && <Button size="sm" variant="ghost" disabled={busy || text.trim().length < 10} onClick={() => superAct.mutate({ ticket: ticket.id, action: "note", note: text }, { onSuccess: () => setText("") })}>Add internal note</Button>}
              {viewer === "requester" && <Button size="sm" variant="ghost" disabled={busy} onClick={() => setStatus.mutate({ ticket: ticket.id, status: "closed" }, { onSuccess: onClose })}>Close my ticket</Button>}
            </div>
          </div>
        )}

        {viewer === "admin" && (
          <div className="space-y-3 border-t pt-3">
            {withSuper && <p className="text-sm text-muted-foreground">This ticket is with the Super Admin. You can add notes; they will resolve it or return it with guidance.</p>}
            {!withSuper && !closed && (
              <div className="flex flex-wrap items-end gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Assigned to</Label>
                  <Select value={ticket.assigned_to ?? "none"} disabled={busy || ticket.status === "resolved"} onValueChange={(v) => assign.mutate({ ticket: ticket.id, assignee: v === "none" ? null : v })}>
                    <SelectTrigger className="w-52"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="none">Unassigned</SelectItem>{(admins ?? []).map((a) => <SelectItem key={a.user_id} value={a.user_id}>{a.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                {ticket.status === "open" && <Button size="sm" variant="outline" disabled={busy} onClick={() => setStatus.mutate({ ticket: ticket.id, status: "in_progress" })}>Start working</Button>}
                {ticket.status !== "resolved" && <Button size="sm" variant="outline" disabled={busy} onClick={() => { setPanel("resolve"); setPanelText(""); }}><CheckCircle2 className="mr-2 h-4 w-4" />Resolve…</Button>}
                {ticket.status !== "resolved" && <Button size="sm" variant="destructive" disabled={busy} onClick={() => { setPanel("escalate"); setPanelText(""); }}><ArrowUpCircle className="mr-2 h-4 w-4" />Escalate to Super Admin…</Button>}
              </div>
            )}
            {!withSuper && ticket.status === "resolved" && (
              <div className="flex gap-2">
                <Button size="sm" variant="outline" disabled={busy} onClick={() => setStatus.mutate({ ticket: ticket.id, status: "closed" }, { onSuccess: onClose })}>Close ticket</Button>
                <Button size="sm" variant="outline" disabled={busy} onClick={() => { setPanel("reopen"); setPanelText(""); }}><RotateCcw className="mr-2 h-4 w-4" />Reopen…</Button>
              </div>
            )}
            {closed && <Button size="sm" variant="outline" disabled={busy} onClick={() => { setPanel("reopen"); setPanelText(""); }}><RotateCcw className="mr-2 h-4 w-4" />Reopen…</Button>}

            {panel && (
              <div className="space-y-2 rounded-md border p-3">
                <Label>{panel === "resolve" ? "How was it resolved? (recorded and shown to the requester)" : panel === "escalate" ? "What did you try, and why does it need the Super Admin?" : "Why is this ticket being reopened?"}</Label>
                <Textarea rows={3} value={panelText} onChange={(e) => setPanelText(e.target.value)} />
                <div className="flex gap-2">
                  <Button size="sm" disabled={busy || panelText.trim().length < (panel === "resolve" ? 10 : panel === "escalate" ? 20 : 5)}
                    variant={panel === "escalate" ? "destructive" : "default"}
                    onClick={() => {
                      const done = { onSuccess: () => { finishPanel(); if (panel !== "reopen") onClose(); } };
                      if (panel === "escalate") escalate.mutate({ ticket: ticket.id, reason: panelText }, done);
                      else setStatus.mutate({ ticket: ticket.id, status: panel === "resolve" ? "resolved" : "open", note: panelText }, done);
                    }}>{panel === "resolve" ? "Resolve ticket" : panel === "escalate" ? "Escalate" : "Reopen ticket"}</Button>
                  <Button size="sm" variant="ghost" onClick={finishPanel}>Cancel</Button>
                </div>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
