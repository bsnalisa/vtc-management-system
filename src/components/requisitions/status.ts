export const REQUISITION_STATUS: Record<string, { label: string; tone: "muted" | "info" | "warn" | "good" | "bad" }> = {
  draft: { label: "Draft", tone: "muted" },
  submitted: { label: "Submitted", tone: "info" },
  pending_line_supervisor: { label: "Pending Line Supervisor Recommendation", tone: "info" },
  returned_for_correction: { label: "Returned for Correction", tone: "warn" },
  not_recommended: { label: "Not Recommended", tone: "bad" },
  pending_accountant: { label: "Pending Accountant Review", tone: "info" },
  funding_not_available: { label: "Funding Not Available", tone: "bad" },
  pending_head_finance: { label: "Pending Head of Finance and Administration", tone: "info" },
  pending_centre_manager: { label: "Pending Centre Manager Approval", tone: "info" },
  not_approved: { label: "Not Approved", tone: "bad" },
  approved_awaiting_procurement: { label: "Approved — Awaiting Procurement", tone: "good" },
  procurement_in_progress: { label: "Procurement in Progress", tone: "info" },
  order_placed: { label: "Order Placed", tone: "info" },
  delivery_outstanding: { label: "Delivery Outstanding", tone: "warn" },
  partially_received: { label: "Partially Received", tone: "warn" },
  fully_received: { label: "Fully Received", tone: "good" },
  closed: { label: "Closed", tone: "muted" },
  cancelled: { label: "Cancelled", tone: "muted" },
};

export const STAGE_LABEL: Record<string, string> = {
  line_supervisor: "Requester's Line Supervisor",
  accountant: "Accountant",
  head_finance: "Head of Finance and Administration",
  centre_manager: "Centre Manager",
};

// What each stage may decide, with the wording used on screen and on the printed form
export const STAGE_DECISIONS: Record<string, { value: string; label: string; negative?: boolean; ret?: boolean }[]> = {
  line_supervisor: [{ value: "recommend", label: "Recommend" }, { value: "not_recommend", label: "Do Not Recommend", negative: true }, { value: "return", label: "Return for Correction", ret: true }],
  accountant: [{ value: "fund_available", label: "Fund Available" }, { value: "fund_not_available", label: "Fund Not Available", negative: true }, { value: "return", label: "Return for Correction", ret: true }],
  head_finance: [{ value: "recommend", label: "Recommend" }, { value: "not_recommend", label: "Do Not Recommend", negative: true }, { value: "return", label: "Return for Correction", ret: true }],
  centre_manager: [{ value: "approve", label: "Approve" }, { value: "not_approve", label: "Do Not Approve", negative: true }, { value: "return", label: "Return for Correction", ret: true }],
};

export const DECISION_LABEL: Record<string, string> = {
  recommend: "Recommended", not_recommend: "Not recommended", fund_available: "Fund available", fund_not_available: "Fund not available",
  approve: "Approved", not_approve: "Not approved", return: "Returned for correction",
};

export interface ReqPerson { user_id: string; name: string; role: string | null }
export interface ReqStage {
  stage_no: number; stage_key: string; state: "decided" | "returned" | "current" | "upcoming"; people: ReqPerson[];
  decision: { decision: string; comments: string | null; gl_code: string | null; at: string; by: string; role: string | null } | null;
}
export interface ReqItem { no: number; quantity: number; description: string; specifications: string | null }
export interface RequisitionView {
  id: string; organization_id: string; requisition_number: string; status: string; round: number; purpose: string | null; department: string | null; template_version: number;
  submitted_at: string | null; created_at: string; requester: ReqPerson; is_requester: boolean; next_action: string | null; items: ReqItem[]; stages: ReqStage[];
  can_decide: boolean; task_id: string | null; can_edit: boolean; can_reopen: boolean; can_cancel: boolean;
  decisions: { round: number; stage_key: string; stage_no: number; decision: string; gl_code: string | null; comments: string | null; by: string; role: string | null; at: string }[];
  history: { from: string | null; to: string; reason: string | null; at: string; by: string | null }[];
  rounds: { round: number; submitted_at: string; purpose: string; items: ReqItem[]; supervisor: string | null }[];
}
export interface RequisitionRow {
  id: string; requisition_number: string; purpose: string | null; department: string | null; status: string; requester_name: string | null; submitted_at: string | null; created_at: string;
  round: number; item_count: number; next_action: string | null; task_id: string | null; total_count: number;
}

export interface FulfilmentItem { item_id: string; no: number; description: string; requested: number; cancelled: number; ordered: number; accepted: number; outstanding: number; damaged: number; incorrect: number; missing: number }
export interface Fulfilment {
  procurement: { supplier_id: string | null; supplier_name: string | null; quotation_reference: string | null; order_reference: string | null; order_date: string | null; expected_delivery: string | null; notes: string | null; order_value?: number | null } | null;
  overdue: boolean; items: FulfilmentItem[];
  receipts: { id: string; receipt_no: string; delivery_date: string; comments: string | null; by: string; role: string | null; at: string;
    lines: { item_id: string; no: number; description: string; accepted: number; damaged: number; incorrect: number; missing: number; note: string | null }[] }[];
  discrepancies: { id: string; item_no: number; description: string; kind: string; quantity: number; note: string | null; status: string; resolution: string | null; resolution_note: string | null; raised_at: string; resolved_at: string | null }[];
  events: { event: string; comment: string | null; details: Record<string, string>; by: string; role: string | null; at: string }[];
  documents: { id: string; kind: string; file_path: string; file_name: string; at: string }[];
  closed_at: string | null;
  can_procure: boolean; can_place_order: boolean; can_delay: boolean; can_receive: boolean; can_resolve: boolean; can_close: boolean; can_cancel_order: boolean; can_add_documents: boolean;
}
