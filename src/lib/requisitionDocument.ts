import { esc } from "./printDocument";
import { PAGE_FRAME_CSS, letterheadHtml, safeColour, type LetterheadSettings } from "./letterhead";
import type { RequisitionView, ReqStage } from "@/components/requisitions/status";
import { DECISION_LABEL, DEFAULT_TEMPLATE, STAGE_LABEL } from "@/components/requisitions/status";

/**
 * The printed Internal Quotation Request Form. Centre-specific content (letterhead) comes from the centre's settings through the shared
 * letterhead; the people and roles on each stage come from the requisition itself, never from this file.
 */
const dmy = (d: string | Date) => { const x = new Date(d); return `${String(x.getDate()).padStart(2, "0")}/${String(x.getMonth() + 1).padStart(2, "0")}/${x.getFullYear()}`; };
const multi = (v: string | null | undefined) => esc(v ?? "").replace(/\r?\n/g, "<br>");

const OPTIONS: Record<string, [string, string][]> = {
  line_supervisor: [["recommend", "Recommended"], ["not_recommend", "Not recommended"]],
  accountant: [["fund_available", "Fund available"], ["fund_not_available", "Fund not available"]],
  head_finance: [["recommend", "Recommended"], ["not_recommend", "Not recommended"]],
  centre_manager: [["approve", "Approved"], ["not_approve", "Not approved"]],
};

const CSS = `
  h1 { font-size: 16pt; margin: 0 0 2mm; text-align: center; color: var(--primary); letter-spacing: .3px; }
  .purpose { margin: 0 0 3mm; font-size: 10.5pt; }
  .ref { text-align: right; font-size: 8.5pt; color: #444; margin-bottom: 2mm; }
  table.items { width: 100%; border-collapse: collapse; font-size: 10pt; margin-bottom: 4mm; }
  table.items thead { display: table-header-group; }
  table.items th { border: 1px solid #222; background: #eef3fa; text-transform: uppercase; font-size: 9pt; padding: 1.8mm 2mm; text-align: left; }
  table.items td { border: 1px solid #222; padding: 1.8mm 2mm; vertical-align: top; overflow-wrap: anywhere; white-space: pre-wrap; }
  table.items tr { break-inside: avoid; page-break-inside: avoid; }
  table.items .no { width: 10mm; text-align: center; } table.items .qty { width: 20mm; text-align: center; }
  .req { margin: 0 0 4mm; break-inside: avoid; }
  .sec { margin: 0 0 3.2mm; break-inside: avoid; page-break-inside: avoid; }
  .opts { font-weight: bold; margin-bottom: 1.5mm; }
  .opts .on { text-decoration: underline; }
  .line { display: flex; gap: 8mm; align-items: flex-end; margin: 1mm 0; }
  .line .sig { flex: 1.6; border-bottom: 1px dotted #222; min-height: 6mm; padding-bottom: 0.3mm; font-size: 8.5pt; color: #1b3a6b; }
  .line .dt { flex: 1; border-bottom: 1px dotted #222; min-height: 6mm; padding-bottom: 0.3mm; font-size: 9pt; }
  .line .lbl { font-size: 9pt; white-space: nowrap; }
  .who { font-weight: bold; }
  .role { color: #333; }
  .cmt { font-size: 9pt; margin: 1mm 0; font-style: italic; }
  .gl { margin: 1.5mm 0; }
  .note { font-size: 7.5pt; color: #555; margin-top: 2mm; }
`;

function stageBlock(st: ReqStage): string {
  const opts = (OPTIONS[st.stage_key] ?? []).map(([v, label]) => {
    const chosen = st.decision?.decision === v;
    return `<span class="${chosen ? "on" : ""}">${chosen ? "&#9746;" : "&#9744;"} ${esc(label)}</span>`;
  }).join(" &nbsp;/&nbsp; ");
  const d = st.decision;
  const people = st.people.length ? st.people : [];
  const who = d ? { name: d.by, role: d.role } : people[0] ? { name: people[0].name, role: people[0].role } : { name: "", role: null };
  const roleLabel = STAGE_LABEL[st.stage_key] ?? "";
  const returned = d?.decision === "return";
  const sig = d && !returned ? `Electronically recorded: ${esc(DECISION_LABEL[d.decision] ?? d.decision)} by ${esc(d.by)}` : "";
  return `<div class="sec">
    <div class="opts">${opts}${returned ? ` &nbsp;|&nbsp; <span class="on">Returned for correction</span>` : ""}</div>
    ${st.stage_key === "accountant" ? `<div class="gl">GL: <b>${esc(d?.gl_code ?? "")}</b>${d?.gl_code ? "" : " ____________________"}</div>` : ""}
    ${d?.comments ? `<div class="cmt">Comments: ${multi(d.comments)}</div>` : ""}
    <div class="line"><span class="lbl">Signature:</span><span class="sig">${sig}</span><span class="lbl">Date:</span><span class="dt">${d ? esc(dmy(d.at)) : ""}</span></div>
    <div class="who">${esc(who.name) || "&nbsp;"}</div>
    <div class="role">${esc(roleLabel)}${who.role ? ` (${esc(who.role.replace(/_/g, " "))})` : ""}</div>
  </div>`;
}

export function requisitionDocumentHtml(v: RequisitionView, letterhead: { centre_name: string | null; settings: Partial<LetterheadSettings> }, opts: { now?: Date } = {}): string {
  const s = letterhead.settings ?? {};
  const centreName = s.centre_name || letterhead.centre_name || "";
  const primary = safeColour(s.primary_color, "#034EA1");
  const accent = safeColour(s.accent_color, "#EE4023");
  const { header, footer } = letterheadHtml(s, centreName);
  // labels, extra fields and item columns come from the template the requisition was made on
  const tpl = v.template ?? DEFAULT_TEMPLATE;
  const lb = { ...DEFAULT_TEMPLATE.labels, ...(tpl.labels ?? {}) };
  const cols = tpl.columns ?? [];
  const extras = (tpl.fields ?? []).filter((f) => (v.fields ?? {})[f.key]);
  const items = v.items.length
    ? v.items.map((i, n) => `<tr><td class="no">${n + 1}.</td><td class="qty">${esc(i.quantity)}</td><td>${esc(i.description)}</td><td>${esc(i.specifications ?? "")}</td>${cols.map((c) => `<td>${esc(i.extra?.[c.key] ?? "")}</td>`).join("")}</tr>`).join("")
    : `<tr><td colspan="${4 + cols.length}">No items listed.</td></tr>`;
  const extraBlock = extras.length ? `<div class="req">${extras.map((f) => `<div>${esc(f.label)}: <b>${esc((v.fields ?? {})[f.key])}</b></div>`).join("")}</div>` : "";
  const submitted = v.submitted_at ? `Submitted electronically on ${dmy(v.submitted_at)}` : "Not yet submitted";
  const body = `<h1>Internal Quotation Request Form</h1>
    <div class="ref">Reference: <b>${esc(v.requisition_number)}</b> &nbsp;|&nbsp; Form version ${esc(v.template_version)}${v.round > 1 ? ` &nbsp;|&nbsp; Round ${esc(v.round)}` : ""}</div>
    <p class="purpose">${multi(v.purpose)}</p>
    ${extraBlock}
    <table class="items"><thead><tr><th class="no">No</th><th class="qty">${esc(lb.quantity)}</th><th>${esc(lb.description)}</th><th>${esc(lb.specifications)}</th>${cols.map((c) => `<th>${esc(c.label)}</th>`).join("")}</tr></thead><tbody>${items}</tbody></table>
    <div class="req">
      <div>Requested by: <b>${esc(v.requester.name)}</b></div>
      <div class="line"><span class="lbl">Signature:</span><span class="sig">${v.submitted_at ? esc(submitted) : ""}</span><span class="lbl">Date:</span><span class="dt">${v.submitted_at ? esc(dmy(v.submitted_at)) : ""}</span></div>
      <div>${esc(lb.department)}: <b>${esc(v.department ?? "")}</b></div>
    </div>
    ${v.stages.map(stageBlock).join("")}
    <div class="note">Printed ${esc(dmy(opts.now ?? new Date()))}. Approval decisions above are the recorded electronic decisions for this requisition (status: ${esc(v.status.replace(/_/g, " "))}).</div>`;
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(v.requisition_number)} – Internal Quotation Request Form</title>
    <style>:root{--primary:${primary};--accent:${accent}}\n${PAGE_FRAME_CSS}\n${CSS}</style></head><body>
    <table class="page"><thead><tr><td>${header}</td></tr></thead><tbody><tr><td>${body}</td></tr></tbody><tfoot><tr><td><div class="spacer"></div></td></tr></tfoot></table>${footer}</body></html>`;
}
