import { detailList, esc, htmlTable } from "./printDocument";

export interface TranscriptComponent {
  component: string; ca_mark: number | null; sa_mark: number | null; final_mark: number | null; pass_mark: number | null; status: string;
}
export interface TranscriptBlock {
  qualification: string; qualification_code: string | null; nqf_level: number | null; academic_year: string;
  credits: number; completed_credits: number; average_mark: string | number | null; components: TranscriptComponent[];
}
export interface TranscriptData {
  trainee_number: string; first_name: string; last_name: string; national_id: string | null; organization: string | null;
  blocks: TranscriptBlock[]; total_credits: number; completed_credits: number; average_mark: number | string | null;
  transcript_number?: string; issue_date?: string;
}

export const TRANSCRIPT_RULES =
  "Final mark = average of CA and SA marks. Credits count as completed when every approved component passes. Average mark = mean of final marks. Only approved results are listed.";

const mark = (n: unknown) => (n === null || n === undefined || n === "" ? "-" : String(n));
const statusLabel = (s: string) =>
  ({ pass: "Pass", fail: "Fail", competent: "Competent", not_yet_competent: "Not yet competent", pending: "Pending" } as Record<string, string>)[s] ?? s;
const longDate = (d: string) => {
  const x = new Date(d);
  return Number.isNaN(x.getTime()) ? d : x.toLocaleDateString("en-ZA", { year: "numeric", month: "long", day: "numeric" });
};

/** Printable transcript body (the page title and organisation header are added by printHtml). */
export function transcriptHtml(t: TranscriptData, academicYear?: string | null): string {
  const blocks = t.blocks ?? [];
  const pairs: [string, unknown][] = [
    ["Trainee", `${t.first_name} ${t.last_name}`], ["Trainee number", t.trainee_number], ["National ID", t.national_id],
    ["Academic year", academicYear || "All years"],
  ];
  if (t.transcript_number) pairs.push(["Transcript number", t.transcript_number]);
  if (t.issue_date) pairs.push(["Date issued", longDate(t.issue_date)]);

  const body = blocks.length === 0
    ? `<p>There are no approved results to show.</p>`
    : blocks.map((b) =>
      `<h3>${esc(b.qualification)}${b.qualification_code ? ` (${esc(b.qualification_code)})` : ""} - ${esc(b.academic_year)}${b.nqf_level != null ? `, NQF level ${esc(b.nqf_level)}` : ""}</h3>` +
      htmlTable(["Component", "CA mark", "SA mark", "Final mark", "Pass mark", "Outcome"],
        (b.components ?? []).map((c) => [c.component, mark(c.ca_mark), mark(c.sa_mark), mark(c.final_mark), mark(c.pass_mark), statusLabel(c.status)]),
        { rightAlign: [1, 2, 3, 4] }) +
      `<p class="note">Credits completed: ${esc(b.completed_credits)} of ${esc(b.credits)}. Average mark: ${esc(mark(b.average_mark))}.</p>`).join("");

  return detailList(pairs) + body +
    detailList([
      ["Total credits", t.total_credits ?? 0], ["Completed credits", t.completed_credits ?? 0], ["Average mark", mark(t.average_mark)],
    ]) +
    `<p class="note">${esc(TRANSCRIPT_RULES)}</p>` +
    `<div class="sign"><div>Registrar</div><div>Stamp</div></div>`;
}
