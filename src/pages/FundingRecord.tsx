import { useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, ExternalLink, Plus } from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useRoleNavigation } from "@/hooks/useRoleNavigation";
import { useUserRole } from "@/hooks/useUserRole";
import { money, openAttachment } from "@/hooks/useFinance";
import { FundingDocument, FundingPayment, useFundingDetail, useSendPaymentToFinance } from "@/hooks/useFunding";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { withRoleAccess } from "@/components/withRoleAccess";
import {
  APPLICATION_STATUS, ATTENTION_LABEL, AWARD_STATUS, CATEGORY_LABEL, DOCUMENT_STATUS, DOC_TYPE_LABEL, ELIGIBILITY_STATUS, EVENT_LABEL, FOLLOWUP_KIND_LABEL, FundingBadge,
  PAYMENT_STATUS, RECIPIENT_LABEL, REGISTRATION_STATUS, formatDate, formatDateTime, isOverdue,
} from "@/components/funding/config";
import {
  ApplicationDialog, DecisionDialog, DocumentStatusDialog, DocumentUploadDialog, FollowupDialog, NoteDialog, PaymentDialog, ReconcileDialog, RegistrationDialog, ResolveDialog,
} from "@/components/funding/FundingDialogs";

const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="grid gap-1 py-2 sm:grid-cols-3"><dt className="text-sm text-muted-foreground">{label}</dt><dd className="text-sm sm:col-span-2">{children ?? "—"}</dd></div>
);
const DOCS_BY_TAB: Record<string, string[]> = {
  application: ["application_form", "identity_copy", "registration_confirmation", "other"],
  award: ["award_letter", "funding_agreement"],
  payment: ["payment_evidence"],
  correspondence: ["nsfaf_correspondence"],
};

function DocumentTable({ docs, types, canEdit, onVerify, onUpload }: { docs: FundingDocument[]; types?: string[]; canEdit: boolean; onVerify: (d: FundingDocument) => void; onUpload?: () => void }) {
  const rows = types ? docs.filter((d) => types.includes(d.doc_type)) : docs;
  return (
    <div className="space-y-3">
      {canEdit && onUpload && <Button size="sm" variant="outline" onClick={onUpload}><Plus className="mr-2 h-4 w-4" />File a document</Button>}
      {!rows.length ? <EmptyState title="No documents filed" description="Documents filed against this record appear here." /> : (
        <Table>
          <TableHeader><TableRow><TableHead>Document</TableHead><TableHead>Status</TableHead><TableHead>Verified by</TableHead><TableHead>Filed</TableHead><TableHead><span className="sr-only">Actions</span></TableHead></TableRow></TableHeader>
          <TableBody>
            {rows.map((d) => (
              <TableRow key={d.id}>
                <TableCell><span className="font-medium">{DOC_TYPE_LABEL[d.doc_type] ?? d.doc_type}</span><span className="block text-xs text-muted-foreground">{d.file_name}</span>{d.note && <span className="block text-xs text-muted-foreground">Note: {d.note}</span>}</TableCell>
                <TableCell><FundingBadge vocab={DOCUMENT_STATUS} value={d.status} /></TableCell>
                <TableCell>{d.verified_by_name ? `${d.verified_by_name}, ${formatDateTime(d.verified_at)}` : "—"}</TableCell>
                <TableCell>{formatDate(d.created_at)}</TableCell>
                <TableCell className="space-x-1 whitespace-nowrap">
                  <Button size="sm" variant="ghost" onClick={() => openAttachment(d.file_path)}><ExternalLink className="mr-1 h-3 w-3" />Open</Button>
                  {canEdit && <Button size="sm" variant="outline" onClick={() => onVerify(d)}>Verify</Button>}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

function PaymentTable({ payments, canEdit, canReconcile, onReconcile }: { payments: FundingPayment[]; canEdit: boolean; canReconcile: boolean; onReconcile: (p: FundingPayment) => void }) {
  const send = useSendPaymentToFinance();
  if (!payments.length) return <EmptyState title="No payments recorded" description="Payments are recorded here once NSFAF has confirmed an award and money has been received." />;
  return (
    <Table>
      <TableHeader><TableRow><TableHead>Date / reference</TableHead><TableHead>Period</TableHead><TableHead className="text-right">Expected</TableHead><TableHead className="text-right">Amount</TableHead><TableHead>Recipient</TableHead><TableHead>Status</TableHead><TableHead>Finance notes</TableHead><TableHead><span className="sr-only">Actions</span></TableHead></TableRow></TableHeader>
      <TableBody>
        {payments.map((p) => (
          <TableRow key={p.id}>
            <TableCell>{formatDate(p.payment_date)}<span className="block text-xs text-muted-foreground">{p.transaction_reference}</span></TableCell>
            <TableCell>{p.funding_period ?? "—"}</TableCell>
            <TableCell className="text-right">{p.expected_amount != null ? money(p.expected_amount) : "—"}</TableCell>
            <TableCell className="text-right font-medium">{money(p.amount)}</TableCell>
            <TableCell>{RECIPIENT_LABEL[p.recipient] ?? p.recipient}{p.recipient_note && <span className="block text-xs text-muted-foreground">{p.recipient_note}</span>}</TableCell>
            <TableCell><FundingBadge vocab={PAYMENT_STATUS} value={p.reconciliation_status} /></TableCell>
            <TableCell className="min-w-40 whitespace-normal">{p.finance_note ?? "—"}</TableCell>
            <TableCell className="space-x-1 whitespace-nowrap">
              {canEdit && ["payment_recorded", "discrepancy", "follow_up"].includes(p.reconciliation_status) && <Button size="sm" variant="outline" disabled={send.isPending} onClick={() => send.mutate(p.id)}>Send to Finance</Button>}
              {canReconcile && p.reconciliation_status === "pending_finance" && <Button size="sm" onClick={() => onReconcile(p)}>Verify</Button>}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function FundingRecord() {
  const { id } = useParams();
  const [params, setParams] = useSearchParams();
  const { navItems, groupLabel } = useRoleNavigation();
  const { role } = useUserRole();
  const { data, isLoading, error } = useFundingDetail(id);
  const canEdit = role === "loan_officer";
  const canReconcile = role === "accountant" || role === "head_of_finance_admin" || role === "debtor_officer";
  const [dlg, setDlg] = useState<null | "decision" | "upload" | "registration" | "note" | "followup" | "payment" | "progression" | "enquiry">(null);
  const [verifyDoc, setVerifyDoc] = useState<FundingDocument | null>(null);
  const [reconcile, setReconcile] = useState<FundingPayment | null>(null);
  const [resolve, setResolve] = useState<{ id: string; description: string } | null>(null);
  const editApplication = params.get("edit") === "application";
  const closeEdit = () => { const n = new URLSearchParams(params); n.delete("edit"); setParams(n, { replace: true }); };

  const c = data?.case;
  const r = data?.record;
  const events = data?.events ?? [];
  const notes = events.filter((e) => ["note", "contact", "nsfaf_correspondence", "trainee_communication"].includes(e.event_type));
  const progression = events.filter((e) => e.event_type === "progression_note" || e.event_type.startsWith("registration_"));
  const openFollowups = data?.followups.filter((f) => f.status === "open") ?? [];

  return (
    <DashboardLayout navItems={navItems} groupLabel={groupLabel} title={c ? `${c.trainee_name} · funding` : "Funding record"} subtitle="NSFAF funding administration record">
      <div className="space-y-6">
        <Button asChild variant="ghost" size="sm" className="-ml-2"><Link to="/loan-officer-dashboard?tab=register"><ArrowLeft className="mr-2 h-4 w-4" />Funding register</Link></Button>
        {error ? <Alert variant="destructive"><AlertDescription>{(error as Error).message}</AlertDescription></Alert> : isLoading || !c || !r || !data ? (
          <div className="space-y-3" aria-busy="true"><Skeleton className="h-24" /><Skeleton className="h-72" /></div>
        ) : (<>
          <Card>
            <CardContent className="space-y-4 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold">{c.trainee_name}</h2>
                  <p className="text-sm text-muted-foreground">{c.trainee_number} · {c.programme ?? "No programme"}{c.level ? ` · Level ${c.level}` : ""} · {c.intake ?? "Intake not set"} · {c.academic_year}</p>
                </div>
                {canEdit && (
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={() => setParams({ edit: "application" })}>Update application</Button>
                    <Button size="sm" variant="outline" onClick={() => setDlg("note")}>Add note / contact</Button>
                    <Button size="sm" variant="outline" onClick={() => setDlg("followup")}>Add follow-up</Button>
                  </div>
                )}
              </div>
              <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                {[
                  ["Application", <FundingBadge key="a" vocab={APPLICATION_STATUS} value={c.application_status} />],
                  ["Eligibility", <FundingBadge key="e" vocab={ELIGIBILITY_STATUS} value={c.eligibility_status} />],
                  ["Award", <FundingBadge key="w" vocab={AWARD_STATUS} value={c.award_status} />],
                  ["Registration", <FundingBadge key="r" vocab={REGISTRATION_STATUS} value={c.registration_status} />],
                  ["Payment", <FundingBadge key="p" vocab={PAYMENT_STATUS} value={c.payment_status} />],
                ].map(([k, v]) => <div key={k as string}><dt className="mb-1 text-xs text-muted-foreground">{k}</dt><dd>{v}</dd></div>)}
              </dl>
              {c.attention.length > 0 && (
                <div className="flex flex-wrap items-center gap-2 text-sm"><span className="text-muted-foreground">Needs attention:</span>
                  {c.attention.map((a) => <Badge key={a} variant={a === "followup_overdue" ? "destructive" : "secondary"} className="font-normal">{ATTENTION_LABEL[a]?.label ?? a}</Badge>)}</div>
              )}
            </CardContent>
          </Card>

          <Tabs defaultValue="application">
            <TabsList className="flex h-auto w-full flex-wrap justify-start">
              <TabsTrigger value="details">Details</TabsTrigger><TabsTrigger value="application">Application</TabsTrigger><TabsTrigger value="award">Award</TabsTrigger>
              <TabsTrigger value="payments">Payments</TabsTrigger><TabsTrigger value="notes">Case notes</TabsTrigger><TabsTrigger value="progression">Progression</TabsTrigger>
              <TabsTrigger value="documents">Documents</TabsTrigger><TabsTrigger value="history">History</TabsTrigger>
            </TabsList>

            <TabsContent value="details"><Card><CardContent className="p-4"><dl className="divide-y">
              <Row label="Trainee number">{c.trainee_number}</Row><Row label="Programme">{c.programme}</Row><Row label="Qualification">{c.qualification}</Row>
              <Row label="Qualification level">{c.level ? `Level ${c.level}` : null}</Row><Row label="Intake / academic year">{`${c.intake ?? "—"} · ${c.academic_year}`}</Row>
              <Row label="Training mode">{data.trainee.training_mode}</Row><Row label="Trainee status">{data.trainee.status}</Row>
              <Row label="Phone">{data.trainee.phone}</Row><Row label="Email">{data.trainee.email}</Row>
              <Row label="Funding category">{CATEGORY_LABEL[c.funding_category]}</Row>
            </dl></CardContent></Card></TabsContent>

            <TabsContent value="application"><Card><CardContent className="space-y-4 p-4">
              <dl className="divide-y">
                <Row label="NSFAF reference">{c.nsfaf_reference}</Row><Row label="Submission date">{formatDate(r.submission_date)}</Row>
                <Row label="Application status"><FundingBadge vocab={APPLICATION_STATUS} value={c.application_status} /></Row>
                <Row label="Eligibility (per NSFAF)"><FundingBadge vocab={ELIGIBILITY_STATUS} value={c.eligibility_status} /></Row>
                <Row label="Latest NSFAF response">{r.last_nsfaf_response ? `${r.last_nsfaf_response} (${formatDate(r.last_nsfaf_response_at)})` : "None recorded"}</Row>
                <Row label="Outstanding documents">{c.missing_documents.length ? c.missing_documents.map((d) => DOC_TYPE_LABEL[d] ?? d).join(", ") : "None outstanding"}</Row>
                <Row label="Next action">{c.next_action}{c.follow_up_due ? ` · due ${formatDate(c.follow_up_due)}` : ""}</Row>
              </dl>
              <h3 className="font-medium">Follow-up history</h3>
              {!data.followups.length ? <p className="text-sm text-muted-foreground">No follow-ups recorded.</p> : (
                <ul className="divide-y rounded-md border">
                  {data.followups.map((f) => (
                    <li key={f.id} className="flex flex-wrap items-start justify-between gap-2 p-3 text-sm">
                      <div><span className="font-medium">{FOLLOWUP_KIND_LABEL[f.kind] ?? f.kind}</span> · {f.description}
                        <p className={`text-xs ${f.status === "open" && isOverdue(f.due_date) ? "text-destructive" : "text-muted-foreground"}`}>Due {formatDate(f.due_date)}{f.status === "resolved" ? ` · resolved: ${f.resolution_note}` : isOverdue(f.due_date) ? " · overdue" : ""}</p></div>
                      {canEdit && f.status === "open" && <Button size="sm" variant="outline" onClick={() => setResolve({ id: f.id, description: f.description })}>Mark resolved</Button>}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent></Card></TabsContent>

            <TabsContent value="award"><Card><CardContent className="space-y-4 p-4">
              {canEdit && <Button size="sm" onClick={() => setDlg("decision")}>Record NSFAF decision</Button>}
              <dl className="divide-y">
                <Row label="Award status"><FundingBadge vocab={AWARD_STATUS} value={c.award_status} /></Row>
                <Row label="Decision date">{formatDate(r.award_decision_date)}</Row><Row label="Source of decision">{r.award_source}</Row>
                <Row label="Confirmed amount">{r.awarded_amount != null ? money(r.awarded_amount) : "Not stated"}</Row>
                <Row label="Funding period">{r.funding_period_start ? `${formatDate(r.funding_period_start)} to ${formatDate(r.funding_period_end)}` : null}</Row>
                <Row label="Conditions">{r.award_conditions}</Row>
              </dl>
              <h3 className="font-medium">Award letter and agreement</h3>
              <DocumentTable docs={data.documents} types={DOCS_BY_TAB.award} canEdit={canEdit} onVerify={setVerifyDoc} onUpload={() => setDlg("upload")} />
            </CardContent></Card></TabsContent>

            <TabsContent value="payments"><Card><CardContent className="space-y-4 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm text-muted-foreground">Confirmed {c.awarded_amount != null ? money(c.awarded_amount) : "amount not stated"} · reconciled so far {money(c.amount_paid)}</p>
                {canEdit && <Button size="sm" disabled={c.award_status !== "confirmed"} onClick={() => setDlg("payment")}>Record payment</Button>}
              </div>
              {c.award_status !== "confirmed" && <Alert><AlertDescription>Payments can be recorded once NSFAF has confirmed an award.</AlertDescription></Alert>}
              <PaymentTable payments={data.payments} canEdit={canEdit} canReconcile={canReconcile} onReconcile={setReconcile} />
              <h3 className="font-medium">Transaction documents</h3>
              <DocumentTable docs={data.documents} types={DOCS_BY_TAB.payment} canEdit={canEdit} onVerify={setVerifyDoc} onUpload={() => setDlg("upload")} />
            </CardContent></Card></TabsContent>

            <TabsContent value="notes"><Card><CardContent className="space-y-4 p-4">
              {canEdit && <div className="flex flex-wrap gap-2"><Button size="sm" onClick={() => setDlg("note")}>Add note or correspondence</Button><Button size="sm" variant="outline" onClick={() => setDlg("enquiry")}>Log trainee enquiry</Button></div>}
              {openFollowups.length > 0 && <Alert><AlertDescription>{openFollowups.length} open follow-up{openFollowups.length === 1 ? "" : "s"}: {openFollowups.map((f) => f.description).join("; ")}</AlertDescription></Alert>}
              {!notes.length ? <EmptyState title="No case notes" description="Notes, contacts and NSFAF correspondence you record appear here." /> : (
                <ul className="divide-y rounded-md border">{notes.map((n) => <li key={n.id} className="p-3 text-sm"><div className="flex justify-between gap-2"><span className="font-medium">{EVENT_LABEL[n.event_type] ?? n.event_type}</span><span className="text-xs text-muted-foreground">{formatDateTime(n.created_at)} · {n.actor ?? "System"}</span></div><p className="mt-1 whitespace-pre-wrap">{n.summary}</p></li>)}</ul>
              )}
              <h3 className="font-medium">Correspondence on file</h3>
              <DocumentTable docs={data.documents} types={DOCS_BY_TAB.correspondence} canEdit={canEdit} onVerify={setVerifyDoc} onUpload={() => setDlg("upload")} />
            </CardContent></Card></TabsContent>

            <TabsContent value="progression"><Card><CardContent className="space-y-4 p-4">
              <dl className="divide-y">
                <Row label="Annual registration verification"><FundingBadge vocab={REGISTRATION_STATUS} value={c.registration_status} /></Row>
                <Row label="Verified">{r.registration_verified_at ? formatDateTime(r.registration_verified_at) : null}</Row><Row label="Registration note">{r.registration_note}</Row>
                <Row label="Trainee status">{data.trainee.status}</Row>
              </dl>
              {canEdit && <div className="flex gap-2"><Button size="sm" onClick={() => setDlg("registration")}>Verify registration</Button><Button size="sm" variant="outline" onClick={() => setDlg("progression")}>Add progression note</Button></div>}
              <p className="text-xs text-muted-foreground">Trainee results are not shown here. Programme changes, deferrals, withdrawals and repetitions are recorded as progression notes until they are linked from the academic modules.</p>
              {progression.length > 0 && <ul className="divide-y rounded-md border">{progression.map((n) => <li key={n.id} className="p-3 text-sm"><span className="font-medium">{EVENT_LABEL[n.event_type] ?? n.event_type}</span> <span className="text-xs text-muted-foreground">· {formatDateTime(n.created_at)} · {n.actor ?? "System"}</span><p className="mt-1">{n.summary}</p></li>)}</ul>}
            </CardContent></Card></TabsContent>

            <TabsContent value="documents"><Card><CardContent className="p-4">
              <DocumentTable docs={data.documents} canEdit={canEdit} onVerify={setVerifyDoc} onUpload={() => setDlg("upload")} />
            </CardContent></Card></TabsContent>

            <TabsContent value="history"><Card>
              <CardHeader><CardTitle className="text-base">History</CardTitle><CardDescription>Every significant change, newest first. This record cannot be edited.</CardDescription></CardHeader>
              <CardContent>
                <ul className="divide-y">{events.map((e) => {
                  const d = e.details as { before?: Record<string, unknown>; after?: Record<string, unknown> } | null | undefined;
                  return (
                    <li key={e.id} className="py-3 text-sm">
                      <div className="flex flex-wrap justify-between gap-2"><span className="font-medium">{EVENT_LABEL[e.event_type] ?? e.event_type}</span><span className="text-xs text-muted-foreground">{formatDateTime(e.created_at)} · {e.actor ?? "System"}</span></div>
                      <p className="text-muted-foreground">{e.summary}</p>
                      {d?.after && typeof d.after === "object" && (
                        <p className="mt-1 break-words text-xs text-muted-foreground">{Object.keys(d.after).filter((k) => !["created_at"].includes(k)).map((k) => `${k.replace(/_/g, " ")}: ${d.before && typeof d.before === "object" ? String((d.before as Record<string, unknown>)[k] ?? "—") : "—"} → ${String((d.after as Record<string, unknown>)[k] ?? "—")}`).join(" · ")}</p>
                      )}
                    </li>
                  );
                })}</ul>
              </CardContent>
            </Card></TabsContent>
          </Tabs>

          {editApplication && canEdit && <ApplicationDialog c={c} open onClose={closeEdit} />}
          {dlg === "decision" && <DecisionDialog c={c} open onClose={() => setDlg(null)} />}
          {dlg === "upload" && <DocumentUploadDialog id={c.id} open onClose={() => setDlg(null)} />}
          {dlg === "registration" && <RegistrationDialog c={c} open onClose={() => setDlg(null)} />}
          {dlg === "note" && <NoteDialog id={c.id} open onClose={() => setDlg(null)} />}
          {dlg === "progression" && <NoteDialog id={c.id} open onClose={() => setDlg(null)} initialType="progression_note" title="Add progression note" />}
          {dlg === "followup" && <FollowupDialog id={c.id} open onClose={() => setDlg(null)} />}
          {dlg === "enquiry" && <FollowupDialog id={c.id} open onClose={() => setDlg(null)} initialKind="enquiry" />}
          {dlg === "payment" && <PaymentDialog id={c.id} open onClose={() => setDlg(null)} />}
          {verifyDoc && <DocumentStatusDialog doc={verifyDoc} onClose={() => setVerifyDoc(null)} />}
          {reconcile && <ReconcileDialog payment={reconcile} onClose={() => setReconcile(null)} />}
          {resolve && <ResolveDialog followup={resolve} onClose={() => setResolve(null)} />}
        </>)}
      </div>
    </DashboardLayout>
  );
}

export default withRoleAccess(FundingRecord, { requiredRoles: ["loan_officer", "accountant", "head_of_finance_admin", "debtor_officer", "centre_manager", "organization_admin", "admin"] });
