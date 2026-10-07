/** Small, dependency-free parser for bank statement CSV files. Runs in the browser; nothing is sent anywhere until the user imports. */

export interface BankLine { date: string; description: string; reference: string; amount: number }
export interface BankParseError { row: number; message: string; raw: string }
/** Zero-based column indexes; -1 (or undefined) means "not present". Use amount, or credit and/or debit. */
export interface ColumnMapping { date: number; description: number; reference: number; amount: number; credit: number; debit: number }
export interface BankParseResult {
  lines: BankLine[]; errors: BankParseError[]; headers: string[]; mapping: ColumnMapping; needsMapping: boolean; rowCount: number;
}

export function detectDelimiter(text: string): string {
  const first = text.split(/\r?\n/).find((l) => l.trim() !== "") ?? "";
  let inQ = false, c = 0, s = 0, t = 0;
  for (const ch of first) {
    if (ch === '"') inQ = !inQ;
    else if (!inQ) { if (ch === ",") c++; else if (ch === ";") s++; else if (ch === "\u0009") t++; }
  }
  if (t > c && t > s) return "\u0009";
  return s > c ? ";" : ",";
}

/** RFC 4180 style: quoted fields, doubled quotes, newlines inside quotes. Blank lines are skipped. */
export function parseCsvText(text: string, delimiter = detectDelimiter(text)): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], field = "", inQ = false;
  const src = text.replace(/^\uFEFF/, "");
  const endRow = () => { row.push(field); field = ""; if (row.some((f) => f.trim() !== "")) rows.push(row); row = []; };
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQ) {
      if (ch === '"') { if (src[i + 1] === '"') { field += '"'; i++; } else inQ = false; }
      else field += ch;
    } else if (ch === '"') inQ = true;
    else if (ch === delimiter) { row.push(field); field = ""; }
    else if (ch === "\n" || ch === "\r") { if (ch === "\r" && src[i + 1] === "\n") i++; endRow(); }
    else field += ch;
  }
  if (field !== "" || row.length) endRow();
  return rows;
}

const norm = (h: string) => h.toLowerCase().replace(/[^a-z]/g, "");
const NAMES: Record<keyof ColumnMapping, string[]> = {
  date: ["date", "transactiondate", "txndate", "postingdate", "valuedate", "bookingdate", "postdate"],
  description: ["description", "details", "narrative", "narration", "transactiondetails", "particulars", "memo", "remarks"],
  reference: ["reference", "ref", "referenceno", "referencenumber", "paymentreference", "yourreference", "customerreference"],
  amount: ["amount", "transactionamount", "value", "amt"],
  credit: ["credit", "credits", "moneyin", "deposit", "deposits", "cr", "creditamount"],
  debit: ["debit", "debits", "moneyout", "withdrawal", "withdrawals", "dr", "debitamount"],
};

export function detectMapping(headers: string[]): ColumnMapping {
  const m: ColumnMapping = { date: -1, description: -1, reference: -1, amount: -1, credit: -1, debit: -1 };
  const hs = headers.map(norm);
  (Object.keys(NAMES) as (keyof ColumnMapping)[]).forEach((k) => { m[k] = hs.findIndex((h) => NAMES[k].includes(h)); });
  return m;
}
export const mappingUsable = (m: ColumnMapping) => m.date >= 0 && (m.amount >= 0 || m.credit >= 0 || m.debit >= 0);

const isRealDate = (y: number, mo: number, d: number) => {
  const x = new Date(Date.UTC(y, mo - 1, d));
  return x.getUTCFullYear() === y && x.getUTCMonth() === mo - 1 && x.getUTCDate() === d;
};
const iso = (y: number, mo: number, d: number) => `${String(y).padStart(4, "0")}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

/** YYYY-MM-DD, DD/MM/YYYY or DD-MM-YYYY (also with dots, and 2-digit years). Returns null when unreadable. */
export function parseBankDate(raw: string): string | null {
  const s = raw.trim().replace(/[T ]\d{1,2}:\d{2}(:\d{2})?.*$/, "");
  let m = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/.exec(s);
  if (m) { const [y, mo, d] = [+m[1], +m[2], +m[3]]; return isRealDate(y, mo, d) ? iso(y, mo, d) : null; }
  m = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2}|\d{4})$/.exec(s);
  if (m) {
    const d = +m[1], mo = +m[2]; const y = m[3].length === 2 ? 2000 + +m[3] : +m[3];
    return isRealDate(y, mo, d) ? iso(y, mo, d) : null;
  }
  return null;
}

/** Handles "1,234.50", "1 234,50", "1.234,50", "(250.00)", "-250", "250.00-", "N$ 10", "250.00 CR/DR". Returns null when unreadable. */
export function parseBankAmount(raw: string): number | null {
  let s = raw.trim();
  if (s === "") return null;
  let neg = false;
  if (/^\(.*\)$/.test(s)) { neg = true; s = s.slice(1, -1); }
  if (/dr\.?$/i.test(s)) { neg = true; s = s.replace(/dr\.?$/i, ""); } else s = s.replace(/cr\.?$/i, "");
  s = s.replace(/[^\d.,+-]/g, "");
  if (s.endsWith("-")) { neg = true; s = s.slice(0, -1); }
  if (s.startsWith("-")) { neg = true; s = s.slice(1); }
  s = s.replace(/^\+/, "");
  if (!/\d/.test(s) || /[+-]/.test(s)) return null;
  const lastC = s.lastIndexOf(","), lastD = s.lastIndexOf(".");
  if (lastC >= 0 && lastD >= 0) {
    const dec = lastC > lastD ? "," : ".";
    s = dec === "," ? s.replace(/\./g, "").replace(",", ".") : s.replace(/,/g, "");
  } else if (lastC >= 0) {
    s = /^\d+,\d{1,2}$/.test(s) ? s.replace(",", ".") : s.replace(/,/g, "");
  }
  if ((s.match(/\./g) ?? []).length > 1) return null;
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return Math.round((neg ? -n : n) * 100) / 100;
}

/**
 * Parse statement text. Without `mapping` the first row is the header row and columns are recognised by name;
 * when that fails `needsMapping` is true and no lines are returned, so the page can ask the user to map columns
 * and call again with `mapping` (the first row is then still treated as the header row).
 */
export function parseBankCsv(text: string, mapping?: ColumnMapping): BankParseResult {
  const rows = parseCsvText(text);
  const headers = rows[0] ?? [];
  const detected = detectMapping(headers);
  const m = mapping ?? detected;
  const empty: BankParseResult = { lines: [], errors: [], headers, mapping: m, needsMapping: true, rowCount: Math.max(rows.length - 1, 0) };
  if (!mappingUsable(m)) return empty;
  const lines: BankLine[] = [], errors: BankParseError[] = [];
  const cell = (r: string[], i: number) => (i >= 0 && i < r.length ? r[i].trim() : "");
  rows.slice(1).forEach((r, idx) => {
    const row = idx + 2; // 1-based row number in the file, header is row 1
    const raw = r.join(",");
    const date = parseBankDate(cell(r, m.date));
    if (!date) { errors.push({ row, message: `Date "${cell(r, m.date)}" cannot be read`, raw }); return; }
    let amount: number | null = null;
    if (m.amount >= 0) {
      amount = parseBankAmount(cell(r, m.amount));
    } else {
      const cr = parseBankAmount(cell(r, m.credit)), dr = parseBankAmount(cell(r, m.debit));
      if (cr !== null || dr !== null) amount = Math.round(((cr ?? 0) - Math.abs(dr ?? 0)) * 100) / 100;
    }
    if (amount === null) { errors.push({ row, message: "Amount cannot be read", raw }); return; }
    lines.push({ date, description: cell(r, m.description), reference: cell(r, m.reference), amount });
  });
  return { lines, errors, headers, mapping: m, needsMapping: false, rowCount: rows.length - 1 };
}
