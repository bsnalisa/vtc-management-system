import { esc } from "./printDocument";

/**
 * The one centre letterhead (logo, centre name, address and contacts) used by every official document the system prints:
 * proof of registration, purchase requisitions. Nothing centre-specific is coded here; it all comes from the centre's settings.
 */
export interface LetterheadSettings {
  logo_url: string | null; centre_name: string | null; physical_address: string | null; postal_address: string | null; telephone: string | null;
  fax: string | null; email: string | null; website: string | null; correspondence_note: string | null;
  primary_color: string | null; accent_color: string | null;
}

export const safeColour = (c: string | null | undefined, fallback: string) => (c && /^#[0-9a-fA-F]{6}$/.test(c) ? c : fallback);
export const safeUrl = (u: string | null | undefined) => (u && /^https:\/\//i.test(u) ? u : "");

/** Page size, margins, the repeating letterhead at the top of every page and the footer fixed at the bottom of every printed page. */
export const PAGE_FRAME_CSS = `  @page { size: A4; margin: 23mm 25mm 23mm 20mm; }
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
  .spacer { height: 28mm; }
  @media print { .foot { position: fixed; left: 0; right: 0; bottom: 0; } }
  @media screen { .spacer { display: none; } }`;

export function letterheadHtml(s: Partial<LetterheadSettings>, centreName: string): { header: string; footer: string } {
  const logo = safeUrl(s.logo_url);
  const header = `<div class="letterhead">${logo ? `<img src="${esc(logo)}" alt="${esc(centreName)}">` : `<div class="name">${esc(centreName)}</div>`}</div>`;
  // Only what the centre has configured is shown; each address field keeps its own line breaks.
  const multi = (v: string | null | undefined) => esc(v ?? "").replace(/\r?\n/g, "<br>");
  const contacts = [s.telephone && `Tel: ${esc(s.telephone)}`, s.fax && `Fax: ${esc(s.fax)}`, s.postal_address && multi(s.postal_address)].filter(Boolean).map((x) => `<p>${x}</p>`).join("");
  const online = [s.email && `<p><b>Email:</b> ${esc(s.email)}</p>`, s.website && `<p><b>Website:</b> ${esc(s.website)}</p>`].filter(Boolean).join("");
  const footer = `<div class="foot"><div><p class="cn">${esc(centreName)}</p>${s.physical_address ? `<p>${multi(s.physical_address)}</p>` : ""}</div>
    <div>${contacts}${online ? `<div class="gap"></div>${online}` : ""}</div>
    <div>${s.correspondence_note ? `<p>${multi(s.correspondence_note)}</p>` : ""}</div></div>`;
  return { header, footer };
}
