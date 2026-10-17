import { ReactNode, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SearchInput } from "@/components/ui/search-input";
import { ButtonSpinner } from "@/components/ui/loading-spinner";
import {
  FundingCase, useAddFollowup, useAddFundingDocument, useAddFundingNote, useCreateFundingRecord, useFundingSearch, useReconcilePayment, useRecordNsfafDecision,
  useRecordPayment, useResolveFollowup, useSetDocumentStatus, useSetRegistration, useUpdateFundingApplication,
} from "@/hooks/useFunding";
import { APPLICATION_STATUS, CATEGORY_LABEL, DOC_TYPE_LABEL, ELIGIBILITY_STATUS, FOLLOWUP_KIND_LABEL, RECIPIENT_LABEL } from "./config";

const today = () => new Date().toISOString().slice(0, 10);
const plusDays = (n: number) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);

function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return <div className="space-y-1.5"><Label>{label}</Label>{children}{hint && <p className="text-xs text-muted-foreground">{hint}</p>}</div>;
}
function Modal({ open, onClose, title, description, children, footer }: { open: boolean; onClose: () => void; title: string; description?: string; children: ReactNode; footer: ReactNode }) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader><DialogTitle>{title}</DialogTitle>{description && <DialogDescription>{description}</DialogDescription>}</DialogHeader>
        <div className="space-y-4">{children}</div>
        <DialogFooter className="gap-2 sm:gap-0"><Button type="button" variant="outline" onClick={onClose}>Cancel</Button>{footer}</DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
const Submit = ({ pending, disabled, children }: { pending: boolean; disabled?: boolean; children: ReactNode }) => (
  <Button type="submit" disabled={pending || disabled}>{pending && <ButtonSpinner />}{children}</Button>
);

/** Starts a funding record for a trainee found by number, name or programme. */
export function NewRecordDialog({ open, onClose, year, onCreated, initialQuery = "" }: { open: boolean; onClose: () => void; year: string | null; onCreated: (id: string) => void; initialQuery?: string }) {
  const [q, setQ] = useState(initialQuery);
  const [pick, setPick] = useState<string>("");
  const [category, setCategory] = useState("nsfaf_tuition");
  const [intake, setIntake] = useState("");
  const { data: matches, isFetching } = useFundingSearch(q, year);
  const create = useCreateFundingRecord();
  const chosen = matches?.find((m) => m.trainee_uuid === pick);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const id = await create.mutateAsync({ trainee: pick, year, category, intake });
    onClose(); setQ(""); setPick(""); setIntake(""); onCreated(id);
  };
  return (
    <form onSubmit={submit}>
      <Modal open={open} onClose={onClose} title="New funding record" description={`Link a trainee to an NSFAF funding record${year ? ` for ${year}` : ""}. Each trainee has one record per academic year.`}
        footer={<Submit pending={create.isPending} disabled={!pick || !!chosen?.record_id}>Create record</Submit>}>
        <Field label="Find the trainee" hint="Search by trainee number, name or programme">
          <SearchInput value={q} onChange={setQ} placeholder="e.g. 062-26-00001 or Tina" />
        </Field>
        <div role="listbox" aria-label="Matching trainees" className="max-h-44 overflow-y-auto rounded-md border">
          {q.trim().length < 2 ? <p className="p-3 text-sm text-muted-foreground">Type at least two characters.</p>
            : isFetching ? <p className="p-3 text-sm text-muted-foreground">Searching…</p>
            : !matches?.length ? <p className="p-3 text-sm text-muted-foreground">No trainees match.</p>
            : matches.map((m) => (
              <button type="button" role="option" aria-selected={pick === m.trainee_uuid} key={m.trainee_uuid} onClick={() => setPick(m.trainee_uuid)}
                className={`flex w-full items-center justify-between gap-2 border-b px-3 py-2 text-left text-sm last:border-0 hover:bg-muted ${pick === m.trainee_uuid ? "bg-muted" : ""}`}>
                <span><span className="font-medium">{m.trainee_name}</span><span className="block text-xs text-muted-foreground">{m.trainee_number} · {m.programme ?? "No programme"} · Level {m.level}</span></span>
                {m.record_id && <span className="text-xs text-muted-foreground">Already recorded</span>}
              </button>
            ))}
        </div>
        {chosen?.record_id && <Alert><AlertDescription>This trainee already has a funding record for {chosen.academic_year}.</AlertDescription></Alert>}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Funding category">
            <Select value={category} onValueChange={setCategory}><SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{Object.entries(CATEGORY_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent></Select>
          </Field>
          <Field label="Intake"><Input value={intake} onChange={(e) => setIntake(e.target.value)} placeholder="e.g. January 2026" /></Field>
        </div>
      </Modal>
    </form>
  );
}

/** Application details as reported by NSFAF. The award is recorded separately and cannot be set here. */
export function ApplicationDialog({ c, open, onClose }: { c: FundingCase; open: boolean; onClose: () => void }) {
  const save = useUpdateFundingApplication();
  const [f, setF] = useState({ reference: c.nsfaf_reference ?? "", status: c.application_status, submittedOn: "", eligibility: c.eligibility_status, response: "", responseOn: "", category: c.funding_category, intake: c.intake ?? "", nextAction: c.next_action ?? "", due: c.follow_up_due ?? "" });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });
  const submit = async (e: React.FormEvent) => { e.preventDefault(); await save.mutateAsync({ id: c.id, ...f }); onClose(); };
  return (
    <form onSubmit={submit}>
      <Modal open={open} onClose={onClose} title="Update funding application" description={`${c.trainee_name} · ${c.trainee_number}`} footer={<Submit pending={save.isPending}>Save</Submit>}>
        <Alert><AlertDescription>Record what NSFAF has told the centre. Approvals are NSFAF decisions and are recorded separately under Funding award.</AlertDescription></Alert>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="NSFAF reference"><Input value={f.reference} onChange={set("reference")} /></Field>
          <Field label="Application status">
            <Select value={f.status} onValueChange={(v) => setF({ ...f, status: v })}><SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{Object.entries(APPLICATION_STATUS).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}</SelectContent></Select>
          </Field>
          <Field label="Submission date"><Input type="date" max={today()} value={f.submittedOn} onChange={set("submittedOn")} /></Field>
          <Field label="Eligibility (as reported by NSFAF)">
            <Select value={f.eligibility} onValueChange={(v) => setF({ ...f, eligibility: v })}><SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{Object.entries(ELIGIBILITY_STATUS).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}</SelectContent></Select>
          </Field>
          <Field label="Funding category">
            <Select value={f.category} onValueChange={(v) => setF({ ...f, category: v })}><SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{Object.entries(CATEGORY_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent></Select>
          </Field>
          <Field label="Intake"><Input value={f.intake} onChange={set("intake")} /></Field>
        </div>
        <Field label="Latest NSFAF response"><Textarea rows={2} value={f.response} onChange={set("response")} placeholder="Summarise what NSFAF last communicated" /></Field>
        <Field label="Date of response"><Input type="date" max={today()} value={f.responseOn} onChange={set("responseOn")} /></Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Next action"><Input value={f.nextAction} onChange={set("nextAction")} /></Field>
          <Field label="Follow-up deadline"><Input type="date" value={f.due} onChange={set("due")} /></Field>
        </div>
      </Modal>
    </form>
  );
}

/** Records a decision NSFAF has already made. It needs the NSFAF reference, the source and the letter on file. */
export function DecisionDialog({ c, open, onClose }: { c: FundingCase; open: boolean; onClose: () => void }) {
  const save = useRecordNsfafDecision();
  const [f, setF] = useState({ decision: "confirmed", date: "", source: "", amount: "", start: "", end: "", conditions: "" });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    await save.mutateAsync({ id: c.id, decision: f.decision, date: f.date, source: f.source, amount: f.amount ? Number(f.amount) : null, start: f.start, end: f.end, conditions: f.conditions });
    onClose();
  };
  return (
    <form onSubmit={submit}>
      <Modal open={open} onClose={onClose} title="Record NSFAF decision" description={`${c.trainee_name} · ${c.nsfaf_reference ?? "no NSFAF reference yet"}`} footer={<Submit pending={save.isPending}>Record decision</Submit>}>
        <Alert><AlertDescription>The VTC does not approve funding. Only record a decision NSFAF has issued, with the NSFAF reference on the record and the award letter or correspondence filed under Documents.</AlertDescription></Alert>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="NSFAF decision">
            <Select value={f.decision} onValueChange={(v) => setF({ ...f, decision: v })}><SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="confirmed">Award confirmed by NSFAF</SelectItem><SelectItem value="rejected">Rejected by NSFAF</SelectItem></SelectContent></Select>
          </Field>
          <Field label="Date NSFAF issued the decision"><Input type="date" required max={today()} value={f.date} onChange={set("date")} /></Field>
        </div>
        <Field label="Source of the decision" hint="For example: award letter dated…, NSFAF email, NSFAF portal"><Input required value={f.source} onChange={set("source")} /></Field>
        {f.decision === "confirmed" && (<>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Confirmed amount (N$)" hint="If stated"><Input type="number" min="0" step="0.01" value={f.amount} onChange={set("amount")} /></Field>
            <Field label="Funding from"><Input type="date" value={f.start} onChange={set("start")} /></Field>
            <Field label="Funding to"><Input type="date" min={f.start} value={f.end} onChange={set("end")} /></Field>
          </div>
          <Field label="Conditions"><Textarea rows={2} value={f.conditions} onChange={set("conditions")} /></Field>
        </>)}
      </Modal>
    </form>
  );
}

export function DocumentUploadDialog({ id, open, onClose }: { id: string; open: boolean; onClose: () => void }) {
  const add = useAddFundingDocument();
  const [type, setType] = useState("application_form");
  const [file, setFile] = useState<File | null>(null);
  const submit = async (e: React.FormEvent) => { e.preventDefault(); if (!file) return; await add.mutateAsync({ id, type, file }); setFile(null); onClose(); };
  return (
    <form onSubmit={submit}>
      <Modal open={open} onClose={onClose} title="File a document" footer={<Submit pending={add.isPending} disabled={!file}>Upload</Submit>}>
        <Field label="Document type">
          <Select value={type} onValueChange={setType}><SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{Object.entries(DOC_TYPE_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent></Select>
        </Field>
        <Field label="File" hint="PDF or image, up to 10 MB"><Input type="file" accept=".pdf,image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></Field>
      </Modal>
    </form>
  );
}

export function DocumentStatusDialog({ doc, onClose }: { doc: { id: string; file_name: string; status: string }; onClose: () => void }) {
  const save = useSetDocumentStatus();
  const [status, setStatus] = useState(doc.status === "received" ? "verified" : doc.status);
  const [note, setNote] = useState("");
  const submit = async (e: React.FormEvent) => { e.preventDefault(); await save.mutateAsync({ doc: doc.id, status, note }); onClose(); };
  return (
    <form onSubmit={submit}>
      <Modal open onClose={onClose} title="Document verification" description={doc.file_name} footer={<Submit pending={save.isPending} disabled={status === "requires_correction" && !note.trim()}>Save</Submit>}>
        <Field label="Outcome">
          <Select value={status} onValueChange={setStatus}><SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="under_review">Under review</SelectItem><SelectItem value="verified">Verified</SelectItem><SelectItem value="requires_correction">Rejected / requires correction</SelectItem></SelectContent></Select>
        </Field>
        <Field label={status === "requires_correction" ? "What needs to be corrected" : "Note (optional)"}><Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} /></Field>
        <p className="text-xs text-muted-foreground">Your name and the time are recorded as the verifier.</p>
      </Modal>
    </form>
  );
}

export function RegistrationDialog({ c, open, onClose }: { c: FundingCase; open: boolean; onClose: () => void }) {
  const save = useSetRegistration();
  const [status, setStatus] = useState(c.registration_status === "verified" ? "verified" : "verified");
  const [note, setNote] = useState("");
  const submit = async (e: React.FormEvent) => { e.preventDefault(); await save.mutateAsync({ id: c.id, status, note }); onClose(); };
  return (
    <form onSubmit={submit}>
      <Modal open={open} onClose={onClose} title="Registration verification" description={`${c.trainee_name} · ${c.academic_year}`} footer={<Submit pending={save.isPending} disabled={status === "discrepancy" && !note.trim()}>Save</Submit>}>
        <Field label="Outcome">
          <Select value={status} onValueChange={setStatus}><SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="verified">Registration confirmed for the year</SelectItem><SelectItem value="discrepancy">Discrepancy found</SelectItem><SelectItem value="not_verified">Reset to not verified</SelectItem></SelectContent></Select>
        </Field>
        <Field label={status === "discrepancy" ? "Describe the discrepancy" : "Note (optional)"}><Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} /></Field>
      </Modal>
    </form>
  );
}

const NOTE_TYPES: Record<string, string> = { note: "Case note", contact: "Contact made", nsfaf_correspondence: "NSFAF correspondence", trainee_communication: "Trainee communication", progression_note: "Academic progression note" };
export function NoteDialog({ id, open, onClose, initialType = "note", title = "Add note" }: { id: string; open: boolean; onClose: () => void; initialType?: string; title?: string }) {
  const save = useAddFundingNote();
  const [type, setType] = useState(initialType);
  const [summary, setSummary] = useState("");
  const submit = async (e: React.FormEvent) => { e.preventDefault(); await save.mutateAsync({ id, type, summary }); setSummary(""); onClose(); };
  return (
    <form onSubmit={submit}>
      <Modal open={open} onClose={onClose} title={title} footer={<Submit pending={save.isPending} disabled={!summary.trim()}>Save</Submit>}>
        <Field label="Type"><Select value={type} onValueChange={setType}><SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>{Object.entries(NOTE_TYPES).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent></Select></Field>
        <Field label="Details" hint="Do not enter identity numbers or bank details"><Textarea rows={4} value={summary} onChange={(e) => setSummary(e.target.value)} /></Field>
      </Modal>
    </form>
  );
}

export function FollowupDialog({ id, open, onClose, initialKind = "nsfaf_followup" }: { id: string; open: boolean; onClose: () => void; initialKind?: string }) {
  const save = useAddFollowup();
  const [kind, setKind] = useState(initialKind);
  const [description, setDescription] = useState("");
  const [due, setDue] = useState(plusDays(7));
  const submit = async (e: React.FormEvent) => { e.preventDefault(); await save.mutateAsync({ id, kind, description, due }); setDescription(""); onClose(); };
  return (
    <form onSubmit={submit}>
      <Modal open={open} onClose={onClose} title="Add follow-up" footer={<Submit pending={save.isPending} disabled={!description.trim() || !due}>Add follow-up</Submit>}>
        <Field label="Type"><Select value={kind} onValueChange={setKind}><SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>{Object.entries(FOLLOWUP_KIND_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent></Select></Field>
        <Field label="What needs to happen"><Textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} /></Field>
        <Field label="Due date"><Input type="date" min={today()} value={due} onChange={(e) => setDue(e.target.value)} /></Field>
      </Modal>
    </form>
  );
}

export function ResolveDialog({ followup, onClose }: { followup: { id: string; description: string }; onClose: () => void }) {
  const save = useResolveFollowup();
  const [note, setNote] = useState("");
  const submit = async (e: React.FormEvent) => { e.preventDefault(); await save.mutateAsync({ id: followup.id, note }); onClose(); };
  return (
    <form onSubmit={submit}>
      <Modal open onClose={onClose} title="Mark as resolved" description={followup.description} footer={<Submit pending={save.isPending} disabled={!note.trim()}>Mark resolved</Submit>}>
        <Field label="Resolution note"><Textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} /></Field>
      </Modal>
    </form>
  );
}

export function PaymentDialog({ id, open, onClose }: { id: string; open: boolean; onClose: () => void }) {
  const save = useRecordPayment();
  const [f, setF] = useState({ amount: "", date: today(), reference: "", recipient: "institution", recipientNote: "", period: "", expected: "", type: "tuition" });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    await save.mutateAsync({ id, amount: Number(f.amount), date: f.date, reference: f.reference, recipient: f.recipient, recipientNote: f.recipientNote, period: f.period, expected: f.expected ? Number(f.expected) : null, type: f.type });
    onClose();
  };
  return (
    <form onSubmit={submit}>
      <Modal open={open} onClose={onClose} title="Record funding payment" description="Record a payment as shown on the NSFAF advice or bank statement. Finance reconciles it afterwards." footer={<Submit pending={save.isPending}>Record payment</Submit>}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Amount received or recorded (N$)"><Input type="number" required min="0.01" step="0.01" value={f.amount} onChange={set("amount")} /></Field>
          <Field label="Payment date"><Input type="date" required max={today()} value={f.date} onChange={set("date")} /></Field>
          <Field label="Transaction reference"><Input required value={f.reference} onChange={set("reference")} /></Field>
          <Field label="Funding period"><Input value={f.period} onChange={set("period")} placeholder="e.g. Semester 1 2026" /></Field>
          <Field label="Payment type">
            <Select value={f.type} onValueChange={(v) => setF({ ...f, type: v })}><SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="tuition">Tuition</SelectItem><SelectItem value="non_tuition">Non-tuition</SelectItem><SelectItem value="other">Other</SelectItem></SelectContent></Select>
          </Field>
          <Field label="Expected amount (N$)" hint="Only if stated in the award documents"><Input type="number" min="0" step="0.01" value={f.expected} onChange={set("expected")} /></Field>
        </div>
        <Field label="Who was paid">
          <Select value={f.recipient} onValueChange={(v) => setF({ ...f, recipient: v })}><SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{Object.entries(RECIPIENT_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent></Select>
        </Field>
        <Field label="Recipient or arrangement notes" hint="As stated in the award documentation. Do not enter account numbers."><Input value={f.recipientNote} onChange={set("recipientNote")} /></Field>
      </Modal>
    </form>
  );
}

export function ReconcileDialog({ payment, onClose }: { payment: { id: string; transaction_reference: string | null; amount: number }; onClose: () => void }) {
  const save = useReconcilePayment();
  const [outcome, setOutcome] = useState("reconciled");
  const [note, setNote] = useState("");
  const submit = async (e: React.FormEvent) => { e.preventDefault(); await save.mutateAsync({ id: payment.id, outcome, note }); onClose(); };
  return (
    <form onSubmit={submit}>
      <Modal open onClose={onClose} title="Finance verification" description={`Reference ${payment.transaction_reference ?? "—"}`} footer={<Submit pending={save.isPending} disabled={outcome !== "reconciled" && !note.trim()}>Save</Submit>}>
        <Field label="Outcome">
          <Select value={outcome} onValueChange={setOutcome}><SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="reconciled">Matches the Finance records: reconciled</SelectItem><SelectItem value="discrepancy">Discrepancy identified</SelectItem><SelectItem value="follow_up">Follow-up required</SelectItem></SelectContent></Select>
        </Field>
        <Field label={outcome === "reconciled" ? "Verification note (optional)" : "What is outstanding"}><Textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} /></Field>
        <p className="text-xs text-muted-foreground">A reconciled payment is final. The officer who recorded the payment cannot reconcile it.</p>
      </Modal>
    </form>
  );
}
