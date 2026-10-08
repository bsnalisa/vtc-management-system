/**
 * Print a branded document (proof of registration, statements, registers...).
 * The content is rendered in a hidden iframe and sent to the browser's print dialog, from where it can be saved as PDF.
 * Every dynamic value MUST go through esc()/htmlTable() so user data can never inject markup.
 */

export const esc = (value: unknown): string =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

export function htmlTable(headers: string[], rows: unknown[][], opts: { rightAlign?: number[] } = {}): string {
  const right = new Set(opts.rightAlign ?? []);
  const head = headers.map((h, i) => `<th${right.has(i) ? ' class="r"' : ""}>${esc(h)}</th>`).join("");
  const body = rows
    .map((r) => `<tr>${r.map((c, i) => `<td${right.has(i) ? ' class="r"' : ""}>${esc(c)}</td>`).join("")}</tr>`)
    .join("");
  return `<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
}

/** Label / value pairs shown as a two-column block. */
export function detailList(pairs: [string, unknown][]): string {
  return `<dl>${pairs.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v) || "&nbsp;"}</dd></div>`).join("")}</dl>`;
}

const CSS = `
  @page { size: A4; margin: 16mm; }
  * { box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 11pt; color: #111; margin: 0; }
  header { display: flex; align-items: center; gap: 16px; border-bottom: 2px solid #111; padding-bottom: 10px; margin-bottom: 18px; }
  header img { max-height: 64px; max-width: 160px; }
  header h1 { font-size: 16pt; margin: 0; }
  header p { margin: 2px 0 0; font-size: 10pt; color: #444; }
  h2 { font-size: 14pt; margin: 18px 0 8px; }
  h3 { font-size: 11pt; margin: 16px 0 6px; }
  dl { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 24px; margin: 0 0 12px; }
  dt { font-size: 9pt; color: #555; }
  dd { margin: 0; font-weight: bold; }
  table { width: 100%; border-collapse: collapse; margin: 8px 0 14px; font-size: 10pt; }
  th, td { border: 1px solid #888; padding: 5px 7px; text-align: left; vertical-align: top; }
  th { background: #eee; }
  .r { text-align: right; }
  .sign { display: flex; gap: 48px; margin-top: 36px; }
  .sign div { flex: 1; border-top: 1px solid #111; padding-top: 4px; font-size: 9pt; }
  footer { margin-top: 24px; font-size: 8pt; color: #666; border-top: 1px solid #ccc; padding-top: 6px; }
  .note { font-size: 9pt; color: #444; }
  .pb { page-break-after: always; }
`;

export function buildDocument(
  title: string,
  bodyHtml: string,
  org: { name?: string | null; logoUrl?: string | null; subtitle?: string | null } = {},
): string {
  const logo = org.logoUrl && /^https?:\/\//i.test(org.logoUrl) ? `<img src="${esc(org.logoUrl)}" alt="">` : "";
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title><style>${CSS}</style></head><body>
  <header>${logo}<div><h1>${esc(org.name ?? "")}</h1>${org.subtitle ? `<p>${esc(org.subtitle)}</p>` : ""}</div></header>
  <h2>${esc(title)}</h2>${bodyHtml}
  <footer>Printed ${esc(new Date().toLocaleString())}</footer></body></html>`;
}

export function printHtml(
  title: string,
  bodyHtml: string,
  org: { name?: string | null; logoUrl?: string | null; subtitle?: string | null } = {},
): void {
  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;";
  document.body.appendChild(iframe);
  const doc = iframe.contentDocument;
  const win = iframe.contentWindow;
  if (!doc || !win) {
    document.body.removeChild(iframe);
    throw new Error("Could not open the print view");
  }
  doc.open();
  doc.write(buildDocument(title, bodyHtml, org));
  doc.close();

  let done = false;
  const go = () => {
    if (done) return;
    done = true;
    win.focus();
    win.print();
    // remove after the dialog has had time to use the frame
    setTimeout(() => iframe.parentNode?.removeChild(iframe), 60_000);
  };
  // wait for the logo (if any) so it appears in the print; never wait more than 2 seconds
  const imgs = Array.from(doc.images);
  if (!imgs.length || imgs.every((i) => i.complete)) go();
  else {
    let pending = imgs.filter((i) => !i.complete).length;
    const one = () => { if (--pending <= 0) go(); };
    imgs.filter((i) => !i.complete).forEach((i) => { i.onload = one; i.onerror = one; });
    setTimeout(go, 2000);
  }
}
