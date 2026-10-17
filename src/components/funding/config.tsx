import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// Status vocabularies for NSFAF funding administration. Application, eligibility, award, payment and registration
// are separate concepts and each has its own list; the VTC only records what NSFAF has decided.
type Tone = "success" | "error" | "warning" | "info" | "pending" | "neutral";
const TONES: Record<Tone, string> = {
  success: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 border-green-200 dark:border-green-800",
  error: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800",
  warning: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800",
  info: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200 dark:border-blue-800",
  pending: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400 border-orange-200 dark:border-orange-800",
  neutral: "bg-muted text-muted-foreground border-border",
};
interface Entry { label: string; tone: Tone }
type Vocabulary = Record<string, Entry>;

export const APPLICATION_STATUS: Vocabulary = {
  not_applied: { label: "Not applied", tone: "neutral" },
  in_progress: { label: "Application in progress", tone: "info" },
  submitted: { label: "Submitted", tone: "info" },
  pending_decision: { label: "Pending NSFAF decision", tone: "pending" },
  more_information: { label: "More information required", tone: "warning" },
  funding_not_confirmed: { label: "Funding not confirmed", tone: "error" },
  withdrawn: { label: "Withdrawn or cancelled", tone: "neutral" },
};
// Overall funding position used by the status overview: the award outcome when NSFAF has decided, otherwise the application stage
export const OVERALL_STATUS: Vocabulary = {
  ...APPLICATION_STATUS,
  award_confirmed: { label: "Award confirmed", tone: "success" },
  rejected: { label: "Rejected by NSFAF", tone: "error" },
};
export const ELIGIBILITY_STATUS: Vocabulary = {
  not_assessed: { label: "Not yet reported", tone: "neutral" },
  eligible: { label: "Eligible (per NSFAF)", tone: "success" },
  conditional: { label: "Conditional (per NSFAF)", tone: "warning" },
  not_eligible: { label: "Not eligible (per NSFAF)", tone: "error" },
};
export const AWARD_STATUS: Vocabulary = {
  none: { label: "No decision recorded", tone: "neutral" },
  confirmed: { label: "Award confirmed", tone: "success" },
  rejected: { label: "Rejected by NSFAF", tone: "error" },
};
export const REGISTRATION_STATUS: Vocabulary = {
  not_verified: { label: "Not verified", tone: "warning" },
  verified: { label: "Verified", tone: "success" },
  discrepancy: { label: "Discrepancy", tone: "error" },
};
export const PAYMENT_STATUS: Vocabulary = {
  not_applicable: { label: "No award to pay", tone: "neutral" },
  awaiting_payment_info: { label: "Awaiting payment information", tone: "warning" },
  payment_recorded: { label: "Payment recorded", tone: "info" },
  pending_finance: { label: "Pending Finance verification", tone: "pending" },
  reconciled: { label: "Reconciled", tone: "success" },
  discrepancy: { label: "Discrepancy identified", tone: "error" },
  follow_up: { label: "Follow-up required", tone: "warning" },
};
export const DOCUMENT_STATUS: Vocabulary = {
  received: { label: "Received", tone: "info" },
  under_review: { label: "Under review", tone: "pending" },
  verified: { label: "Verified", tone: "success" },
  requires_correction: { label: "Requires correction", tone: "error" },
};

export const CATEGORY_LABEL: Record<string, string> = {
  nsfaf_tuition: "NSFAF tuition support",
  nsfaf_non_tuition_loan: "NSFAF non-tuition loan",
  nsfaf_other: "Other NSFAF funding",
  other_sponsor: "Other sponsor",
  self_funded: "Self-funded",
};
export const DOC_TYPE_LABEL: Record<string, string> = {
  application_form: "Application form",
  identity_copy: "Identity document",
  registration_confirmation: "Registration confirmation",
  award_letter: "Award letter",
  funding_agreement: "Funding agreement",
  payment_evidence: "Payment evidence",
  nsfaf_correspondence: "NSFAF correspondence",
  other: "Other",
};
export const FOLLOWUP_KIND_LABEL: Record<string, string> = {
  nsfaf_followup: "NSFAF follow-up", document_chase: "Document chase", enquiry: "Trainee enquiry", appeal: "Appeal / exceptional case", discrepancy: "Discrepancy", other: "Other",
};
export const RECIPIENT_LABEL: Record<string, string> = { institution: "Paid to the VTC", trainee: "Paid to the trainee", other: "Other recipient" };
export const ATTENTION_LABEL: Record<string, { label: string; action: string }> = {
  documents_missing: { label: "Supporting documents outstanding", action: "Chase and verify the missing documents" },
  registration_not_verified: { label: "Registration not verified", action: "Verify registration for the academic year" },
  progression_discrepancy: { label: "Academic progression discrepancy", action: "Resolve the discrepancy with Registrations" },
  no_nsfaf_response: { label: "No recent NSFAF response", action: "Follow up with NSFAF" },
  award_not_filed: { label: "Award letter or agreement not filed", action: "File the award letter or agreement" },
  payment_awaiting_reconciliation: { label: "Payment awaiting reconciliation", action: "Agree the payment with Finance" },
  payment_info_outstanding: { label: "Payment information outstanding", action: "Obtain payment details from NSFAF or Finance" },
  enquiry_open: { label: "Unresolved trainee enquiry", action: "Respond to the trainee" },
  followup_overdue: { label: "Follow-up overdue", action: "Complete the overdue follow-up" },
  followup_due_soon: { label: "Follow-up due soon", action: "Prepare the follow-up" },
};
export const EVENT_LABEL: Record<string, string> = {
  created: "Record created", application_updated: "Application updated", document_received: "Document received", document_verified: "Document verified",
  document_requires_correction: "Document needs correction", document_under_review: "Document under review", document_received_again: "Document received",
  award_recorded: "Award recorded", registration_verified: "Registration verified", registration_discrepancy: "Registration discrepancy", registration_not_verified: "Registration reset",
  nsfaf_correspondence: "NSFAF correspondence", trainee_communication: "Trainee communication", note: "Case note", progression_note: "Progression note", contact: "Contact recorded",
  followup_added: "Follow-up added", followup_resolved: "Case resolved", payment_recorded: "Payment recorded", payment_sent_to_finance: "Sent to Finance",
  payment_reconciled: "Payment reconciled", payment_discrepancy: "Payment discrepancy", payment_follow_up: "Payment follow-up",
};

export function FundingBadge({ vocab, value, className }: { vocab: Vocabulary; value: string | null | undefined; className?: string }) {
  const entry = (value && vocab[value]) || { label: value ?? "—", tone: "neutral" as Tone };
  return <Badge variant="outline" className={cn("whitespace-nowrap font-medium", TONES[entry.tone], className)}>{entry.label}</Badge>;
}
export const label = (vocab: Vocabulary, value: string | null | undefined) => (value && vocab[value]?.label) || value || "—";

export const formatDate = (d: string | null | undefined) => (d ? new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—");
export const formatDateTime = (d: string | null | undefined) => (d ? new Date(d).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—");
export const daysSince = (d: string | null | undefined) => (d ? Math.floor((Date.now() - new Date(d).getTime()) / 86400000) : null);
export const isOverdue = (d: string | null | undefined) => !!d && new Date(d + "T23:59:59") < new Date();
