import { detailList, esc, htmlTable } from "./printDocument";
import { trainingModeLabel } from "./trainingModes";

export interface ResultsGroup {
  qualification: string; qualification_code: string | null; nqf_level: number | null; academic_year: string;
  trainee_number: string; first_name: string; last_name: string; national_id: string | null; last_approved: string | null;
  results: { component: string; ca_mark: number | null; sa_mark: number | null; pass_mark: number; status: string }[];
}

export interface StatementTransaction {
  processed_at: string; transaction_type: string; amount: number; balance_after: number;
  description: string | null; payment_method: string | null; fee_type: string | null;
}

const date = (d: string | Date) => new Date(d).toLocaleDateString("en-ZA", { year: "numeric", month: "long", day: "numeric" });
const money = (n: number | string | null | undefined) => `N$ ${Number(n ?? 0).toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const mark = (n: number | null) => (n === null || n === undefined ? "-" : String(n));

/** "Statement of Achievement" only when every module is passed/competent; otherwise it is a statement of results. */
export const isComplete = (g: ResultsGroup) => g.results.length > 0 && g.results.every((r) => r.status === "pass" || r.status === "competent");
export const resultsTitle = (g: ResultsGroup) => (isComplete(g) ? "Statement of Achievement" : "Statement of Results");

const statusLabel = (s: string) => ({ pass: "Pass", fail: "Fail", competent: "Competent", not_yet_competent: "Not yet competent", pending: "Pending" } as Record<string, string>)[s] ?? s;

export function statementOfResultsHtml(g: ResultsGroup): string {
  const name = `${g.first_name} ${g.last_name}`;
  return detailList([
    ["Trainee", name], ["Trainee number", g.trainee_number], ["National ID", g.national_id],
    ["Qualification", g.qualification], ["Qualification code", g.qualification_code], ["NQF level", g.nqf_level], ["Academic year", g.academic_year],
  ]) +
    htmlTable(["Module / component", "Continuous assessment", "Summative", "Pass mark", "Outcome"],
      g.results.map((r) => [r.component, mark(r.ca_mark), mark(r.sa_mark), r.pass_mark, statusLabel(r.status)]), { rightAlign: [1, 2, 3] }) +
    `<p><strong>Overall: ${isComplete(g) ? "all modules passed / competent" : "not yet complete"}</strong></p>` +
    `<p class="note">Only results that have been approved are shown${g.last_approved ? `; latest approval ${esc(date(g.last_approved))}` : ""}. This is a statement of results, not a certificate.</p>` +
    `<div class="sign"><div>Assessment coordinator</div><div>Stamp</div></div>`;
}

export function accountStatementHtml(
  who: { name: string; traineeNumber?: string | null },
  account: { account_number: string; total_fees: number | string; total_paid: number | string; balance: number | string },
  transactions: StatementTransaction[],
): string {
  const rows = transactions.map((t) => {
    const isCharge = t.transaction_type === "charge";
    return [date(t.processed_at), t.fee_type ?? t.description ?? t.transaction_type, t.payment_method ?? "", isCharge ? money(t.amount) : "", isCharge ? "" : money(t.amount), money(t.balance_after)];
  });
  return detailList([
    ["Account holder", who.name], ["Trainee number", who.traineeNumber], ["Account number", account.account_number], ["Statement date", date(new Date())],
  ]) +
    htmlTable(["Date", "Description", "Method", "Charges", "Payments / credits", "Balance"], rows, { rightAlign: [3, 4, 5] }) +
    detailList([["Total charged", money(account.total_fees)], ["Total paid", money(account.total_paid)], ["Balance due", money(account.balance)]]) +
    `<p class="note">Please use your trainee number as the payment reference.</p>`;
}
