import { esc } from "./printDocument";

/**
 * The one proof-of-registration template. Every place that shows or prints it (trainee portal, registration pages,
 * reports, the settings preview) goes through proofDocumentHtml(), so the layout exists exactly once.
 * Nothing centre-specific lives here: logo, names, addresses, contacts and colours all come from the centre's settings.
 */
export interface ProofSettings {
  logo_url: string | null; centre_name: string | null; physical_address: string | null; postal_address: string | null; telephone: string | null;
  fax: string | null; email: string | null; website: string | null; correspondence_note: string;
  clerk_title: string | null; clerk_name: string | null; clerk_role_label: string; clerk_phone: string | null; clerk_email: string | null;
  signatory_title: string | null; signatory_name: string | null; signatory_job_title: string; signature_url: string | null;
  stamp_label: string; currency_label: string; footer_disclaimer: string; primary_color: string; accent_color: string;
}

export interface FeeLine { date: string; reference: string | null; description: string; debit: number; credit: number }
export interface ProofData {
  registration_id: string; organization_id: string; reference_number: string | null; issued_on: string; academic_year: string; registration_status: string; year_of_study: number | null;
  trainee: { name: string; trainee_number: string; national_id: string | null; level: number | null; training_mode: string; occupational_area: string | null };
  qualification: { code: string; title: string; nqf_level: number | null; duration: string } | null;
  units: { unit_id: string; title: string; level: number | null; credits: number | null }[];
  fees: { lines: FeeLine[]; total_debit: number; total_credit: number; balance: number };
  settings: ProofSettings | null; settings_complete: boolean; centre_name: string | null;
}

export const DEFAULT_PROOF_SETTINGS: ProofSettings = {
  logo_url: null, centre_name: null, physical_address: null, postal_address: null, telephone: null, fax: null, email: null, website: null,
  correspondence_note: "All Correspondence must be addressed to the Centre Manager",
  clerk_title: null, clerk_name: null, clerk_role_label: "Registration Clerk", clerk_phone: null, clerk_email: null,
  signatory_title: null, signatory_name: null, signatory_job_title: "Head of Trainee Support", signature_url: null,
  stamp_label: "OFFICIAL STAMP", currency_label: "N$",
  footer_disclaimer: "This document is generated from the centre's records. A copy without the official stamp is not valid.",
  primary_color: "#034EA1", accent_color: "#EE4023",
};

const num = (n: number | string | null | undefined) => Number(n ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const dmy = (d: string | Date) => { const x = new Date(d); return `${String(x.getDate()).padStart(2, "0")}/${String(x.getMonth() + 1).padStart(2, "0")}/${x.getFullYear()}`; };
const longDate = (d: string | Date) => new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
const safeColour = (c: string | null | undefined, fallback: string) => (c && /^#[0-9a-fA-F]{6}$/.test(c) ? c : fallback);
const safeUrl = (u: string | null | undefined) => (u && /^https:\/\//i.test(u) ? u : "");
const ordinal = (n: number) => { const v = n % 100; return `${n}${v >= 11 && v <= 13 ? "th" : ({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[n % 10] ?? "th"}`; };
const MODE: Record<string, string> = { fulltime: "Full-Time", bdl: "Blended / Distance Learning", shortcourse: "Short Course", apprenticeship: "Apprenticeship", rpl: "Recognition of Prior Learning" };
const line = (...parts: (string | null | undefined)[]) => parts.map((p) => (p ?? "").trim()).filter(Boolean).join(" ");

export const PROOF_CSS = `
  @page { size: A4; margin: 23mm 25mm 23mm 20mm; }
  * { box-sizing: border-box; }
  html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 10pt; color: #222; margin: 0; line-height: 1.35; }
  @media screen { body { padding: 23mm 25mm 23mm 20mm; background: #fff; } }
  table.page { width: 100%; border-collapse: collapse; }
  table.page > thead > tr > td, table.page > tfoot > tr > td, table.page > tbody > tr > td { padding: 0; border: 0; }
  .letterhead { text-align: right; padding-bottom: 6mm; min-height: 14mm; }
  .letterhead img { max-height: 20mm; max-width: 70mm; object-fit: contain; }
  .letterhead .name { font-size: 14pt; font-weight: bold; color: var(--primary); }
  .foot { display: grid; grid-template-columns: 1.1fr 1.2fr 1fr; gap: 6mm; padding-top: 3mm; margin-top: 6mm; font-size: 7.5pt; color: #222; background: #fff; }
  .foot .cn { font-weight: bold; color: var(--primary); font-size: 8.5pt; }
  .foot p { margin: 0 0 1px; }
  .foot .gap { height: 4mm; }
  .spacer { height: 32mm; }
  @media print { .foot { position: fixed; left: 0; right: 0; bottom: 0; } }
  @media screen { .spacer { display: none; } }
  h1 { font-size: 20pt; margin: 0; color: var(--primary); letter-spacing: .3px; padding-bottom: 2mm; border-bottom: 1.5pt solid var(--accent); }
  .sub { color: #595959; margin: 2mm 0 5mm; }
  .grid { display: grid; gap: 1.5mm; margin-bottom: 6mm; }
  .grid .row { display: grid; gap: 1.5mm; }
  .cell { background: #eef3fa; border-left: 3px solid var(--primary); padding: 1.6mm 2.4mm; min-width: 0; overflow-wrap: anywhere; }
  .cell .l { font-size: 7pt; text-transform: uppercase; color: #595959; letter-spacing: .4px; }
  .cell .v { font-weight: bold; }
  .bar { background: var(--primary); color: #fff; font-weight: bold; text-transform: uppercase; letter-spacing: .4px; padding: 1.8mm 3mm; border-left: 3px solid var(--accent); margin: 5mm 0 0; break-after: avoid; page-break-after: avoid; }
  table.data { width: 100%; border-collapse: collapse; font-size: 9pt; }
  table.data thead { display: table-header-group; }
  table.data tr { break-inside: avoid; page-break-inside: avoid; }
  table.data th { background: #d9e4f3; color: var(--primary); text-transform: uppercase; font-size: 8pt; text-align: left; padding: 1.6mm 2mm; border-bottom: 1px solid var(--primary); }
  table.data td { padding: 1.5mm 2mm; border-bottom: 1px solid #d0d7e2; vertical-align: top; overflow-wrap: anywhere; }
  table.data tbody tr:nth-child(even) td { background: #eef3fa; }
  table.data .c { text-align: center; } table.data .r { text-align: right; white-space: nowrap; }
  table.data tr.total td { background: #d9e4f3 !important; font-weight: bold; border-bottom: 0; }
  .asat { font-size: 8pt; color: #595959; font-style: italic; margin: 1.5mm 0 4mm; }
  .boxes { display: grid; grid-template-columns: repeat(3, 1fr); gap: 2mm; margin: 4mm 0 6mm; break-inside: avoid; }
  .box { background: #eef3fa; padding: 2.5mm 3mm; text-align: center; }
  .box .l { font-size: 7.5pt; text-transform: uppercase; color: #595959; font-weight: bold; }
  .box .v { font-size: 15pt; font-weight: bold; color: var(--primary); }
  .box.due { background: var(--accent); } .box.due .l, .box.due .v { color: #fff; }
  .box.ok { background: #2e7d32; } .box.ok .l, .box.ok .v { color: #fff; }
  p.enq { text-align: justify; margin: 0 0 6mm; }
  .sign { display: grid; grid-template-columns: 1fr 1fr; gap: 12mm; align-items: end; break-inside: avoid; margin-top: 4mm; }
  .sign .sig { height: 18mm; display: flex; align-items: flex-end; } .sign .sig img { max-height: 17mm; max-width: 60mm; }
  .sign .line { border-top: 1px solid #000; padding-top: 1mm; }
  .stamp { border: 1px dashed #999; height: 32mm; display: flex; align-items: center; justify-content: center; color: #8a8a8a; font-size: 8pt; text-transform: uppercase; letter-spacing: .6px; }
  .fine { font-size: 7.5pt; color: #595959; font-style: italic; margin-top: 5mm; }
  .samplebanner { color: #c00000; font-weight: bold; font-size: 7.5pt; margin: 0 0 3mm; }
  .sample { position: fixed; top: 38%; left: 0; right: 0; text-align: center; font-size: 80pt; font-weight: bold; color: rgba(150,150,150,.18); transform: rotate(-24deg); pointer-events: none; letter-spacing: 8px; }
`;

function cell(label: string, value: string, extra = "") {
  return `<div class="cell"${extra}><div class="l">${esc(label)}</div><div class="v">${esc(value) || "&nbsp;"}</div></div>`;
}

/** The whole document as a standalone HTML page. `sample` adds a SAMPLE watermark (settings preview). */
export function proofDocumentHtml(d: ProofData, opts: { sample?: boolean; now?: Date } = {}): string {
  const s = { ...DEFAULT_PROOF_SETTINGS, ...(d.settings ?? {}) } as ProofSettings;
  const now = opts.now ?? new Date();
  const primary = safeColour(s.primary_color, DEFAULT_PROOF_SETTINGS.primary_color);
  const accent = safeColour(s.accent_color, DEFAULT_PROOF_SETTINGS.accent_color);
  const centreName = s.centre_name || d.centre_name || "";
  const logo = safeUrl(s.logo_url);
  const cur = s.currency_label || "N$";
  const balance = Number(d.fees.balance);

  const header = `<div class="letterhead">${logo ? `<img src="${esc(logo)}" alt="${esc(centreName)}">` : `<div class="name">${esc(centreName)}</div>`}</div>`;
  // Only what the centre has configured is shown; each address field keeps its own line breaks.
  const multi = (v: string | null | undefined) => esc(v ?? "").replace(/\r?\n/g, "<br>");
  const contacts = [s.telephone && `Tel: ${esc(s.telephone)}`, s.fax && `Fax: ${esc(s.fax)}`, s.postal_address && multi(s.postal_address)].filter(Boolean).map((x) => `<p>${x}</p>`).join("");
  const online = [s.email && `<p><b>Email:</b> ${esc(s.email)}</p>`, s.website && `<p><b>Website:</b> ${esc(s.website)}</p>`].filter(Boolean).join("");
  const footer = `<div class="foot"><div><p class="cn">${esc(centreName)}</p>${s.physical_address ? `<p>${multi(s.physical_address)}</p>` : ""}</div>
    <div>${contacts}${online ? `<div class="gap"></div>${online}` : ""}</div>
    <div>${s.correspondence_note ? `<p>${multi(s.correspondence_note)}</p>` : ""}</div></div>`;

  const q = d.qualification;
  const yearOfStudy = d.year_of_study ? `${ordinal(d.year_of_study)} year` : "";
  const totalCredits = d.units.reduce((n, u) => n + Number(u.credits ?? 0), 0);

  const trainee = `<div class="grid">
    <div class="row" style="grid-template-columns:2fr 1fr">${cell("Name", d.trainee.name)}${cell("Trainee Number", d.trainee.trainee_number)}</div>
    <div class="row" style="grid-template-columns:1fr 2fr">${cell("ID Number", d.trainee.national_id ?? "")}${cell("Occupational Area", d.trainee.occupational_area ?? "")}</div>
    <div class="row">${cell("Qualification", q ? line(q.code, q.code ? "–" : "", q.title) : "")}</div>
    <div class="row" style="grid-template-columns:1fr 1fr 1fr">${cell("Level", String(q?.nqf_level ?? d.trainee.level ?? ""))}${cell("Current Year of Study", yearOfStudy)}${cell("Study Mode", MODE[d.trainee.training_mode] ?? d.trainee.training_mode)}</div>
    <div class="row" style="grid-template-columns:1fr 1fr">${cell("Duration", (q?.duration ?? "").replace(/^(\d+) (\w+?)s$/, (m, n, u) => (n === "1" ? `1 ${u[0].toUpperCase()}${u.slice(1)}` : `${n} ${u[0].toUpperCase()}${u.slice(1)}s`)))}${cell("Registration Status", d.registration_status.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase()))}</div>
  </div>`;

  const unitRows = d.units.length
    ? d.units.map((u, i) => `<tr><td class="c">${i + 1}</td><td><b>${esc(u.unit_id)}</b></td><td>${esc(u.title)}</td><td class="c">${esc(u.level ?? "")}</td><td class="c">${esc(u.credits ?? "")}</td></tr>`).join("")
    : `<tr><td colspan="5" class="c">No unit standards are recorded for this qualification.</td></tr>`;
  const units = `<div class="bar">Registered Unit Standards</div>
    <table class="data"><thead><tr><th class="c" style="width:9mm">No.</th><th style="width:28mm">Unit ID</th><th>Unit Standard Title</th><th class="c" style="width:14mm">Level</th><th class="c" style="width:16mm">Credits</th></tr></thead>
    <tbody>${unitRows}<tr class="total"><td colspan="4" class="r">Total credits</td><td class="c">${totalCredits}</td></tr></tbody></table>`;

  const feeRows = d.fees.lines.length
    ? d.fees.lines.map((l) => `<tr><td style="white-space:nowrap">${dmy(l.date)}</td><td>${esc(l.reference ?? "")}</td><td>${esc(l.description)}</td><td class="r">${Number(l.debit) ? num(l.debit) : ""}</td><td class="r">${Number(l.credit) ? num(l.credit) : ""}</td></tr>`).join("")
    : `<tr><td colspan="5" class="c">No fee transactions are recorded for ${esc(d.academic_year)}.</td></tr>`;
  const fees = `<div class="bar">Fees Statement</div>
    <table class="data"><thead><tr><th style="width:22mm">Date</th><th style="width:28mm">Reference No.</th><th>Description</th><th class="r" style="width:26mm">Debit (${esc(cur)})</th><th class="r" style="width:26mm">Credit (${esc(cur)})</th></tr></thead>
    <tbody>${feeRows}<tr class="total"><td colspan="3" class="r">Totals</td><td class="r">${num(d.fees.total_debit)}</td><td class="r">${num(d.fees.total_credit)}</td></tr></tbody></table>
    <div class="asat">Transactions included up to: ${dmy(now)}</div>`;

  const label = balance > 0 ? "Outstanding balance" : balance === 0 ? "Account settled" : "Credit balance";
  const boxes = `<div class="boxes">
    <div class="box"><div class="l">Total fees charged</div><div class="v">${esc(cur)} ${num(d.fees.total_debit)}</div></div>
    <div class="box"><div class="l">Total paid to date</div><div class="v">${esc(cur)} ${num(d.fees.total_credit)}</div></div>
    <div class="box ${balance > 0 ? "due" : "ok"}"><div class="l">${label}</div><div class="v">${esc(cur)} ${num(Math.abs(balance))}</div></div></div>`;

  const clerkName = line(s.clerk_title, s.clerk_name);
  const enquiries = clerkName
    ? `Should you have any enquiries, please do not hesitate to contact ${esc(clerkName)}, the ${esc(s.clerk_role_label)}, at: (T) ${esc(s.clerk_phone || s.telephone || "")}${(s.clerk_email || s.email) ? `, or email at ${esc(s.clerk_email || s.email)}` : ""}`
    : `Should you have any enquiries, please do not hesitate to contact the centre at: (T) ${esc(s.telephone ?? "")}${s.email ? `, or email at ${esc(s.email)}` : ""}`;
  const sig = safeUrl(s.signature_url);
  const sign = `<p class="enq">${enquiries}</p>
    <div class="sign"><div><div>Sincerely,</div><div class="sig">${sig ? `<img src="${esc(sig)}" alt="">` : ""}</div><div class="line">${esc(line(s.signatory_title, s.signatory_name))}<br><b>${esc(s.signatory_job_title)}</b></div></div>
    <div class="stamp">${esc(s.stamp_label)}</div></div>
    <div class="fine">${esc(s.footer_disclaimer)}</div>`;

  const body = `${opts.sample ? '<div class="samplebanner">SAMPLE FOR DEMONSTRATION ONLY – all trainee, reference and fee details are illustrative. Not an official document.</div>' : ""}<h1>PROOF OF REGISTRATION</h1>
    <div class="sub">Academic Year ${esc(d.academic_year)} &nbsp;|&nbsp; Date issued: ${esc(longDate(now))}${d.reference_number ? ` &nbsp;|&nbsp; Reference: ${esc(d.reference_number)}` : ""}</div>${trainee}${units}${fees}${boxes}${sign}`;

  return `<!doctype html><html><head><meta charset="utf-8"><title>Proof of Registration – ${esc(d.trainee.name)}</title>
    <style>:root{--primary:${primary};--accent:${accent}}${PROOF_CSS}</style></head><body>
    <table class="page"><thead><tr><td>${header}</td></tr></thead><tbody><tr><td>${body}</td></tr></tbody><tfoot><tr><td><div class="spacer"></div></td></tr></tfoot></table>${footer}</body></html>`;
}

/** Plausible example data for the settings preview, so an admin can see the letterhead before any trainee exists. */
export function sampleProofData(settings: Partial<ProofSettings> | null, centreName: string | null): ProofData {
  return {
    registration_id: "sample", organization_id: "sample", reference_number: "POR-26-00001", issued_on: new Date().toISOString(), academic_year: String(new Date().getFullYear()),
    registration_status: "registered", year_of_study: 1,
    trainee: { name: "Sample Trainee", trainee_number: "000-26-00001", national_id: "00000000000", level: 1, training_mode: "fulltime", occupational_area: "Electrical" },
    qualification: { code: "QUAL-0000", title: "National Certificate in Sample Trade", nqf_level: 2, duration: "1 years" },
    units: [
      { unit_id: "US-0001", title: "Apply workplace health and safety", level: 2, credits: 6 },
      { unit_id: "US-0002", title: "Use hand tools safely", level: 2, credits: 10 },
      { unit_id: "US-0003", title: "Read and interpret technical drawings", level: 2, credits: 8 },
    ],
    fees: {
      lines: [
        { date: `${new Date().getFullYear()}-01-10`, reference: "INV-0001", description: "Tuition and registration fees", debit: 7250, credit: 0 },
        { date: `${new Date().getFullYear()}-01-20`, reference: "RCP-0001", description: "Payment received – EFT", debit: 0, credit: 5000 },
      ],
      total_debit: 7250, total_credit: 5000, balance: 2250,
    },
    settings: { ...DEFAULT_PROOF_SETTINGS, ...(settings ?? {}) } as ProofSettings, settings_complete: true, centre_name: centreName,
  };
}
