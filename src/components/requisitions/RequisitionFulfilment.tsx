import { useRef, useState } from "react";
import { Paperclip, Upload } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ButtonSpinner, LoadingSpinner } from "@/components/ui/loading-spinner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useFulfilment, useFulfilmentAction } from "@/hooks/useRequisitions";
import { useToast } from "@/hooks/use-toast";
import { openAttachment } from "@/hooks/useFinance";
import { supabase } from "@/integrations/supabase/client";
import type { Fulfilment, RequisitionView } from "./status";

const day = (d: string | null | undefined) => (d ? new Date(d).toLocaleDateString(undefined, { dateStyle: "medium" }) : "-");
const stamp = (d: string) => new Date(d).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
const today = () => new Date().toISOString().slice(0, 10);
const EVENT: Record<string, string> = { started: "Procurement started", quotation: "Supplier / quotation recorded", order_placed: "Order placed", delay: "Delivery delay", note: "Note", receipt: "Delivery received",
  discrepancy_raised: "Discrepancy raised", discrepancy_resolved: "Discrepancy resolved", closed: "Closed", cancelled: "Order cancelled", document: "Document added" };

function Field({ id, label, children }: { id: string; label: string; children: React.ReactNode }) {
  return <div className="space-y-1"><Label htmlFor={id}>{label}</Label>{children}</div>;
}

// ---- procurement: supplier, quotation, order ----
function OrderDialog({ v, f, onClose }: { v: RequisitionView; f: Fulfilment; onClose: () => void }) {
  const act = useFulfilmentAction(v.id);
  const p = f.procurement;
  const [supplier, setSupplier] = useState(p?.supplier_name ?? "");
  const [quote, setQuote] = useState(p?.quotation_reference ?? "");
  const [notes, setNotes] = useState(p?.notes ?? "");
  const [ref, setRef] = useState(p?.order_reference ?? "");
  const [orderDate, setOrderDate] = useState(p?.order_date ?? today());
  const [expected, setExpected] = useState(p?.expected_delivery ?? "");
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto">
        <DialogHeader><DialogTitle>Supplier and order</DialogTitle><DialogDescription>Recording an order does not mean the goods have arrived; deliveries are recorded separately.</DialogDescription></DialogHeader>
        <div className="space-y-3">
          <Field id="sup" label="Supplier"><Input id="sup" value={supplier} onChange={(e) => setSupplier(e.target.value)} maxLength={200} /></Field>
          <Field id="quo" label="Quotation reference"><Input id="quo" value={quote} onChange={(e) => setQuote(e.target.value)} maxLength={100} /></Field>
          <Field id="pn" label="Procurement notes"><Textarea id="pn" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" disabled={act.isPending} onClick={async () => { await act.mutateAsync({ fn: "requisition_procurement_save", args: { _id: v.id, _supplier_id: null, _supplier_name: supplier, _quotation_reference: quote, _notes: notes }, done: "Procurement details saved" }); }}>Save supplier details</Button>
          </div>
          {f.can_place_order && (
            <div className="space-y-3 border-t pt-3">
              <div className="font-medium">Place the order</div>
              <Field id="ref" label="Order or purchase order reference"><Input id="ref" value={ref} onChange={(e) => setRef(e.target.value)} maxLength={100} /></Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field id="od" label="Order date"><Input id="od" type="date" max={today()} value={orderDate} onChange={(e) => setOrderDate(e.target.value)} /></Field>
                <Field id="ed" label="Expected delivery"><Input id="ed" type="date" min={orderDate} value={expected} onChange={(e) => setExpected(e.target.value)} /></Field>
              </div>
              <Button disabled={act.isPending || !ref.trim() || !expected} onClick={async () => {
                await act.mutateAsync({ fn: "requisition_place_order", args: { _id: v.id, _supplier_name: supplier, _order_reference: ref, _order_date: orderDate, _expected_delivery: expected, _purchase_order: null }, done: "Order placed" }); onClose();
              }}>{act.isPending && <ButtonSpinner />}Place order</Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ---- receiving: one delivery against the item rows ----
function ReceiptDialog({ v, f, onClose }: { v: RequisitionView; f: Fulfilment; onClose: () => void }) {
  const act = useFulfilmentAction(v.id);
  const { toast } = useToast();
  const [date, setDate] = useState(today());
  const [comments, setComments] = useState("");
  const [rows, setRows] = useState(() => f.items.map((i) => ({ item_id: i.item_id, accepted: "", damaged: "", incorrect: "", missing: "", note: "" })));
  const set = (n: number, patch: Partial<(typeof rows)[number]>) => setRows((r) => r.map((x, i) => (i === n ? { ...x, ...patch } : x)));
  const num = (s: string) => (s.trim() === "" ? 0 : Number(s));
  const submit = async () => {
    for (let i = 0; i < rows.length; i++) {
      const x = rows[i]; const it = f.items[i];
      if ([x.accepted, x.damaged, x.incorrect, x.missing].some((q) => q.trim() !== "" && !/^[0-9]+$/.test(q.trim()))) { toast({ title: "Check the quantities", description: "Use whole numbers only.", variant: "destructive" }); return; }
      if (num(x.accepted) > it.outstanding) { toast({ title: `Item ${it.no}`, description: `Only ${it.outstanding} are still outstanding.`, variant: "destructive" }); return; }
    }
    const lines = rows.filter((x) => num(x.accepted) + num(x.damaged) + num(x.incorrect) + num(x.missing) > 0).map((x) => ({ item_id: x.item_id, accepted: num(x.accepted), damaged: num(x.damaged), incorrect: num(x.incorrect), missing: num(x.missing), note: x.note }));
    if (!lines.length) { toast({ title: "Enter what was delivered", variant: "destructive" }); return; }
    await act.mutateAsync({ fn: "requisition_record_receipt", args: { _id: v.id, _delivery_date: date, _comments: comments, _lines: lines }, done: "Delivery recorded" });
    onClose();
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader><DialogTitle>Record a delivery</DialogTitle><DialogDescription>Count what arrived. "Received" counts only goods in good condition; damaged, incorrect and missing goods open a discrepancy.</DialogDescription></DialogHeader>
        <div className="space-y-4">
          <Field id="dd" label="Delivery date"><Input id="dd" className="max-w-[12rem]" type="date" max={today()} value={date} onChange={(e) => setDate(e.target.value)} /></Field>
          {f.items.map((it, i) => (
            <div key={it.item_id} className="rounded border p-3">
              <div className="mb-2 text-sm font-medium">{it.no}. {it.description} <span className="font-normal text-muted-foreground">· ordered {it.ordered} · received so far {it.accepted} · outstanding {it.outstanding}</span></div>
              <div className="grid gap-2 sm:grid-cols-4">
                {(["accepted", "damaged", "incorrect", "missing"] as const).map((k) => (
                  <Field key={k} id={`${k}${i}`} label={k === "accepted" ? "Received (good)" : k[0].toUpperCase() + k.slice(1)}>
                    <Input id={`${k}${i}`} inputMode="numeric" disabled={it.outstanding === 0 && k === "accepted"} value={rows[i][k]} onChange={(e) => set(i, { [k]: e.target.value })} />
                  </Field>
                ))}
              </div>
              <Input className="mt-2" aria-label={`Note for item ${it.no}`} placeholder="Condition or discrepancy details" value={rows[i].note} onChange={(e) => set(i, { note: e.target.value })} />
            </div>
          ))}
          <Field id="rc" label="Comments"><Textarea id="rc" rows={2} value={comments} onChange={(e) => setComments(e.target.value)} /></Field>
          <Button disabled={act.isPending} onClick={submit}>{act.isPending && <ButtonSpinner />}Save delivery</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function TextDialog({ title, description, label, cta, extra, onSubmit, onClose }: { title: string; description?: string; label: string; cta: string; extra?: React.ReactNode; onSubmit: (text: string) => Promise<void>; onClose: () => void }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{title}</DialogTitle>{description && <DialogDescription>{description}</DialogDescription>}</DialogHeader>
        <div className="space-y-3">
          {extra}
          <Field id="txt" label={label}><Textarea id="txt" rows={3} value={text} onChange={(e) => setText(e.target.value)} /></Field>
          <Button disabled={busy || !text.trim()} onClick={async () => { setBusy(true); try { await onSubmit(text.trim()); onClose(); } finally { setBusy(false); } }}>{busy && <ButtonSpinner />}{cta}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Procurement progress, delivery tracking, discrepancies and closure for an approved requisition
export function RequisitionFulfilment({ v }: { v: RequisitionView }) {
  const open = !["draft", "submitted", "pending_line_supervisor", "returned_for_correction", "not_recommended", "pending_accountant", "funding_not_available", "pending_head_finance", "pending_centre_manager", "not_approved"].includes(v.status);
  const { data: f, isLoading, error } = useFulfilment(v.id, open);
  const act = useFulfilmentAction(v.id);
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [dlg, setDlg] = useState<null | "order" | "receipt" | "delay" | "note" | "close" | "cancel" | { resolve: string }>(null);
  const [delayDate, setDelayDate] = useState("");
  const [resolution, setResolution] = useState("replaced");
  const [uploading, setUploading] = useState(false);
  if (!open) return null;
  if (isLoading) return <LoadingSpinner text="Loading..." className="py-4" />;
  if (error || !f) return <Alert variant="destructive"><AlertDescription>{(error as Error)?.message ?? "Could not load procurement details"}</AlertDescription></Alert>;

  const upload = async (file: File) => {
    if (file.size > 10 * 1024 * 1024) { toast({ title: "Files can be at most 10 MB", variant: "destructive" }); return; }
    setUploading(true);
    try {
      const path = `${v.organization_id}/requisitions/${v.id}/${Date.now()}-${file.name.replace(/[^A-Za-z0-9._-]+/g, "_")}`;
      const up = await supabase.storage.from("documents").upload(path, file, { upsert: false });
      if (up.error) throw up.error;
      const kind = v.status === "approved_awaiting_procurement" || v.status === "procurement_in_progress" ? "quotation" : "delivery";
      await act.mutateAsync({ fn: "requisition_add_document", args: { _id: v.id, _kind: kind, _path: path, _name: file.name }, done: "Document added" });
    } catch (e) { toast({ title: "Upload failed", description: (e as Error).message, variant: "destructive" }); } finally { setUploading(false); }
  };

  const p = f.procurement;
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div><CardTitle>Procurement and delivery</CardTitle><CardDescription>{p?.order_reference ? `Order ${p.order_reference}${p.supplier_name ? ` with ${p.supplier_name}` : ""}` : "No order has been placed yet."}</CardDescription></div>
            {f.overdue && <Badge variant="destructive">Delivery overdue</Badge>}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {p && <div className="grid gap-2 text-sm sm:grid-cols-3">
            <div><span className="text-muted-foreground">Supplier:</span> {p.supplier_name ?? "-"}</div><div><span className="text-muted-foreground">Quotation:</span> {p.quotation_reference ?? "-"}</div>
            <div><span className="text-muted-foreground">Order date:</span> {day(p.order_date)}</div><div><span className="text-muted-foreground">Expected delivery:</span> {day(p.expected_delivery)}</div>
          </div>}
          <div className="overflow-x-auto">
            <Table>
              <TableHeader><TableRow><TableHead>No.</TableHead><TableHead>Item</TableHead><TableHead className="text-right">Ordered</TableHead><TableHead className="text-right">Received</TableHead><TableHead className="text-right">Outstanding</TableHead><TableHead className="text-right">Damaged</TableHead><TableHead className="text-right">Incorrect</TableHead><TableHead className="text-right">Missing</TableHead></TableRow></TableHeader>
              <TableBody>{f.items.map((i) => (
                <TableRow key={i.item_id}><TableCell>{i.no}</TableCell><TableCell className="whitespace-normal">{i.description}{i.cancelled > 0 && <span className="text-xs text-muted-foreground"> ({i.cancelled} cancelled)</span>}</TableCell>
                  <TableCell className="text-right">{i.ordered}</TableCell><TableCell className="text-right">{i.accepted}</TableCell><TableCell className="text-right font-medium">{i.outstanding}</TableCell>
                  <TableCell className="text-right">{i.damaged}</TableCell><TableCell className="text-right">{i.incorrect}</TableCell><TableCell className="text-right">{i.missing}</TableCell></TableRow>
              ))}</TableBody>
            </Table>
          </div>
          <div className="flex flex-wrap gap-2">
            {f.can_procure && <Button onClick={() => setDlg("order")}>{f.can_place_order ? "Supplier and order" : "Supplier details"}</Button>}
            {f.can_delay && <Button variant="outline" onClick={() => setDlg("delay")}>Record a delay</Button>}
            {f.can_receive && <Button onClick={() => setDlg("receipt")}>Record a delivery</Button>}
            {(f.can_procure || f.can_receive) && <Button variant="outline" onClick={() => setDlg("note")}>Add a note</Button>}
            {f.can_close && <Button onClick={() => setDlg("close")}>Close requisition</Button>}
            {f.can_cancel_order && <Button variant="destructive" onClick={() => setDlg("cancel")}>Cancel order</Button>}
          </div>
          {v.status === "fully_received" && !f.can_close && f.discrepancies.some((d) => d.status === "open") && <Alert><AlertDescription>Everything is received, but open discrepancies must be resolved before the requisition can be closed.</AlertDescription></Alert>}
        </CardContent>
      </Card>

      {f.discrepancies.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Delivery discrepancies</CardTitle><CardDescription>Damaged, incorrect and missing goods. Closure needs every one resolved.</CardDescription></CardHeader>
          <CardContent className="space-y-2">
            {f.discrepancies.map((d) => (
              <div key={d.id} className="flex flex-wrap items-start justify-between gap-2 rounded border p-3 text-sm">
                <div><strong>Item {d.item_no}: {d.quantity} {d.kind}</strong> · {d.description}{d.note && <div className="text-muted-foreground">{d.note}</div>}
                  {d.status === "resolved" && <div className="mt-1">Resolved ({d.resolution}) {day(d.resolved_at)}: {d.resolution_note}</div>}</div>
                {d.status === "open" ? (f.can_resolve ? <Button size="sm" onClick={() => setDlg({ resolve: d.id })}>Resolve</Button> : <Badge variant="outline">Open</Badge>) : <Badge variant="outline">Resolved</Badge>}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {f.receipts.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Deliveries received</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {f.receipts.map((r) => (
              <div key={r.id} className="rounded border p-3 text-sm">
                <div className="font-medium">{r.receipt_no} · delivered {day(r.delivery_date)} · recorded by {r.by}{r.role ? ` (${r.role.replace(/_/g, " ")})` : ""}</div>
                <ul className="mt-1 list-disc pl-5">{r.lines.map((l) => <li key={l.item_id}>Item {l.no} {l.description}: {l.accepted} received{l.damaged ? `, ${l.damaged} damaged` : ""}{l.incorrect ? `, ${l.incorrect} incorrect` : ""}{l.missing ? `, ${l.missing} missing` : ""}{l.note ? ` (${l.note})` : ""}</li>)}</ul>
                {r.comments && <div className="mt-1 text-muted-foreground">{r.comments}</div>}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle>Documents</CardTitle><CardDescription>Quotations, order confirmations and delivery notes.</CardDescription></CardHeader>
        <CardContent className="space-y-2">
          {f.documents.length === 0 && <p className="text-sm text-muted-foreground">None attached.</p>}
          <ul className="space-y-1">{f.documents.map((d) => <li key={d.id} className="flex items-center gap-2 text-sm"><Paperclip className="h-3.5 w-3.5 text-muted-foreground" /><button type="button" className="text-left underline" onClick={() => openAttachment(d.file_path)}>{d.file_name}</button><span className="text-muted-foreground">({d.kind})</span></li>)}</ul>
          {f.can_add_documents && <>
            <input ref={fileRef} type="file" className="hidden" accept=".pdf,.png,.jpg,.jpeg,.doc,.docx,.xls,.xlsx,.csv" onChange={async (e) => { const file = e.target.files?.[0]; e.target.value = ""; if (file) await upload(file); }} />
            <Button size="sm" variant="outline" disabled={uploading} onClick={() => fileRef.current?.click()}>{uploading ? <ButtonSpinner /> : <Upload className="mr-1 h-3.5 w-3.5" />}Attach a document</Button>
          </>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Procurement log</CardTitle></CardHeader>
        <CardContent>
          <ol className="space-y-2 text-sm">{f.events.map((e, i) => (
            <li key={i} className="flex flex-wrap gap-x-3 border-b pb-2 last:border-0"><span className="text-muted-foreground">{stamp(e.at)}</span><span className="font-medium">{EVENT[e.event] ?? e.event}</span><span className="text-muted-foreground">by {e.by}</span>{e.comment && <span className="w-full whitespace-pre-wrap">{e.comment}</span>}</li>
          ))}{f.events.length === 0 && <li className="text-muted-foreground">Nothing recorded yet.</li>}</ol>
        </CardContent>
      </Card>

      {dlg === "order" && <OrderDialog v={v} f={f} onClose={() => setDlg(null)} />}
      {dlg === "receipt" && <ReceiptDialog v={v} f={f} onClose={() => setDlg(null)} />}
      {dlg === "delay" && <TextDialog title="Record a delay" label="Reason for the delay" cta="Record delay" extra={<Field id="nd" label="New expected delivery"><Input id="nd" type="date" min={today()} value={delayDate} onChange={(e) => setDelayDate(e.target.value)} /></Field>}
        onSubmit={async (t) => { await act.mutateAsync({ fn: "requisition_record_delay", args: { _id: v.id, _new_expected: delayDate || null, _reason: t }, done: "Delay recorded" }); }} onClose={() => setDlg(null)} />}
      {dlg === "note" && <TextDialog title="Add a note" label="Note" cta="Add note" onSubmit={async (t) => { await act.mutateAsync({ fn: "requisition_add_note", args: { _id: v.id, _comment: t }, done: "Note added" }); }} onClose={() => setDlg(null)} />}
      {dlg === "close" && <TextDialog title="Close requisition" description="Everything is received and every discrepancy is resolved." label="Closing note" cta="Close requisition" onSubmit={async (t) => { await act.mutateAsync({ fn: "requisition_close", args: { _id: v.id, _note: t }, done: "Requisition closed" }); }} onClose={() => setDlg(null)} />}
      {dlg === "cancel" && <TextDialog title="Cancel the order" description="Only possible before anything has been received." label="Reason" cta="Cancel order" onSubmit={async (t) => { await act.mutateAsync({ fn: "requisition_cancel_order", args: { _id: v.id, _reason: t }, done: "Order cancelled" }); }} onClose={() => setDlg(null)} />}
      {dlg && typeof dlg === "object" && "resolve" in dlg && <TextDialog title="Resolve the discrepancy" label="How was it resolved?" cta="Mark resolved"
        extra={<Field id="res" label="Resolution"><select id="res" className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={resolution} onChange={(e) => setResolution(e.target.value)}><option value="replaced">Replaced by the supplier</option><option value="credited">Credited</option><option value="cancelled">Cancelled (no longer needed)</option><option value="other">Other</option></select></Field>}
        onSubmit={async (t) => { await act.mutateAsync({ fn: "requisition_resolve_discrepancy", args: { _disc: dlg.resolve, _resolution: resolution, _note: t }, done: "Discrepancy resolved" }); }} onClose={() => setDlg(null)} />}
    </div>
  );
}
