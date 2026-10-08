// Checks for the pure TypeScript helpers (attendance statistics, print escaping, trainee document templates).
// Run from the repository root:  node scripts/check-libs.mjs
import ts from "typescript"; import fs from "fs";
let failures = 0;
const ok = (c, m) => { console.log(c ? "ok  " : "FAIL", m); if (!c) failures++; };
const url = (code) => "data:text/javascript;base64," + Buffer.from(code).toString("base64");
const compile = (p) => ts.transpileModule(fs.readFileSync(p, "utf8"), { compilerOptions: { module: "esnext", target: "es2022" } }).outputText;
const load = (p) => import(url(compile(p)));
{
const s = await load("src/lib/attendanceStats.ts");
const p = await load("src/lib/printDocument.ts");

const eq = (a, b, m) => { if (JSON.stringify(a) !== JSON.stringify(b)) { console.log("FAIL", m, JSON.stringify(a), "!=", JSON.stringify(b)); failures++; } else console.log("ok  ", m); };
// 2026-10-07 is a Wednesday
eq(s.periodRange("week", "2026-10-07"), { from: "2026-10-05", to: "2026-10-11" }, "week is Monday-Sunday");
eq(s.periodRange("week", "2026-10-11"), { from: "2026-10-05", to: "2026-10-11" }, "Sunday belongs to the week that started Monday");
eq(s.periodRange("week", "2026-10-05"), { from: "2026-10-05", to: "2026-10-11" }, "Monday starts the week");
eq(s.periodRange("week", "2026-01-01"), { from: "2025-12-29", to: "2026-01-04" }, "week crossing a year boundary");
eq(s.periodRange("month", "2026-02-10"), { from: "2026-02-01", to: "2026-02-28" }, "February (non-leap)");
eq(s.periodRange("month", "2028-02-10"), { from: "2028-02-01", to: "2028-02-29" }, "February (leap)");
eq(s.periodRange("year", "2026-10-07"), { from: "2026-01-01", to: "2026-12-31" }, "year");
const recs = [
  { trainee_id: "a", attendance_date: "2026-10-05", present: true }, { trainee_id: "b", attendance_date: "2026-10-05", present: false },
  { trainee_id: "a", attendance_date: "2026-10-06", present: true }, // b has no row on the 6th
  { trainee_id: "a", attendance_date: "2026-10-07", present: false }, { trainee_id: "b", attendance_date: "2026-10-07", present: true },
];
const r = s.summarise(["a", "b", "c"], recs);
eq(r.sessions, 3, "three session dates");
eq(r.rows[0], { trainee_id: "a", present: 2, absent: 1, notRecorded: 0, sessions: 3, rate: 66.7 }, "a: 2 of 3");
eq(r.rows[1], { trainee_id: "b", present: 1, absent: 1, notRecorded: 1, sessions: 3, rate: 33.3 }, "b: missing row is not-recorded, not present");
eq(r.rows[2], { trainee_id: "c", present: 0, absent: 0, notRecorded: 3, sessions: 3, rate: 0 }, "c: never recorded");
eq(s.summarise(["a"], []).rows[0].rate, null, "no sessions: no rate (not 0%)");
eq(s.summarise(["a"], [{ trainee_id: "a", attendance_date: "2026-10-05", present: null }]).rows[0].absent, 1, "null present counts as absent");
// escaping
eq(p.esc(`<script>alert("x")</script> & 'q'`), "&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; &#39;q&#39;", "esc neutralises markup");
eq(p.esc(null), "", "esc(null) is empty");
const t = p.htmlTable(["N<"], [["<b>x</b>"]]);
eq(t.includes("<b>x</b>"), false, "table cells are escaped");
const d = p.buildDocument("T", "<p>ok</p>", { name: "A<B", logoUrl: "javascript:alert(1)" });
eq(d.includes("javascript:"), false, "non-http logo is dropped");
eq(d.includes("A&lt;B"), true, "org name escaped");

}
{
const printUrl = url(compile("src/lib/printDocument.ts")), modesUrl = url(compile("src/lib/trainingModes.ts"));
const docsCode = compile("src/lib/traineeDocuments.ts").replace('"./printDocument"', `"${printUrl}"`).replace('"./trainingModes"', `"${modesUrl}"`);
const d = await import(url(docsCode));

const base = { qualification: "Welding L1", qualification_code: "WLD1", nqf_level: 1, academic_year: "2026", trainee_number: "062-26-12345", first_name: "Tina", last_name: "O'Neil <b>", national_id: "N1", last_approved: "2026-06-01T00:00:00Z" };
const complete = { ...base, results: [{ component: "Module A", ca_mark: 70, sa_mark: 65, pass_mark: 50, status: "competent" }, { component: "Module B", ca_mark: null, sa_mark: 80, pass_mark: 50, status: "pass" }] };
const partial = { ...base, results: [...complete.results, { component: "Module C", ca_mark: 30, sa_mark: 20, pass_mark: 50, status: "not_yet_competent" }] };
ok(d.resultsTitle(complete) === "Statement of Achievement", "all passed -> Statement of Achievement");
ok(d.resultsTitle(partial) === "Statement of Results", "any not-yet-competent -> Statement of Results (never an achievement)");
ok(d.resultsTitle({ ...base, results: [] }) === "Statement of Results", "no results -> not an achievement");
const h = d.statementOfResultsHtml(partial);
ok(h.includes("Not yet competent") && h.includes("not yet complete"), "outcomes shown, overall not complete");
ok(!h.includes("<b>") && h.includes("O&#39;Neil &lt;b&gt;"), "trainee name is escaped");
ok(h.includes('<td class="r">-</td>') , "missing mark shown as a dash, not 0 or blank");
const proof = d.proofOfRegistrationHtml({ reference_number: "POR-26-00001", issued_on: "2026-02-01T00:00:00Z", first_name: "Tina", last_name: "One", trainee_number: "062-26-12345", national_id: null, trade: "Welding", level: 1, training_mode: "apprenticeship", qualification: "Welding L1", qualification_code: "WLD1", academic_year: "2026", registered_on: "2026-01-20T00:00:00Z", hostel_required: false });
ok(proof.includes("POR-26-00001") && proof.includes("Apprenticeship"), "proof shows reference and the readable training mode");
const st = d.accountStatementHtml({ name: "Tina One", traineeNumber: "062-26-12345" }, { account_number: "ACC1", total_fees: 1500, total_paid: 500, balance: 1000 },
  [{ processed_at: "2026-01-10", transaction_type: "charge", amount: 1500, balance_after: 1500, description: "Tuition", payment_method: null, fee_type: null },
   { processed_at: "2026-02-10", transaction_type: "payment", amount: 500, balance_after: 1000, description: "Payment", payment_method: "EFT", fee_type: null }]);
ok(st.includes("N$ 1,000.00") || st.includes("N$ 1 000,00") || /N\$\s?1.000.00/.test(st), "balance shown with 2 decimals");
ok(st.indexOf("Tuition") < st.indexOf("EFT"), "transactions keep the order given (oldest first)");
ok(st.includes("Balance due"), "balance due line");


}
{
const printUrl = url(compile("src/lib/printDocument.ts"));
const tr = await import(url(compile("src/lib/transcriptDocument.ts").replace('"./printDocument"', `"${printUrl}"`)));
const blk = { qualification: "Weld <i>", qualification_code: "W1", nqf_level: 1, academic_year: "2026", credits: 40, completed_credits: 40, average_mark: "72.5",
  components: [{ component: "Mod A", ca_mark: 70, sa_mark: 75, final_mark: 72.5, pass_mark: 50, status: "pass" }, { component: "Mod B", ca_mark: null, sa_mark: null, final_mark: null, pass_mark: 50, status: "pending" }] };
const td = { trainee_number: "T1", first_name: "Tina <b>", last_name: "O'Neil", national_id: null, organization: "X", blocks: [blk], total_credits: 40, completed_credits: 40, average_mark: 72.5 };
const th = tr.transcriptHtml(td, "2026");
ok(!th.includes("<b>") && th.includes("Tina &lt;b&gt;") && th.includes("Weld &lt;i&gt;"), "transcript escapes HTML in names");
ok(th.includes("Total credits") && th.includes("<dd>40</dd>") && th.includes("Completed credits"), "transcript shows total and completed credits");
ok(th.includes('<td class="r">-</td>'), "transcript shows missing marks as a dash");
ok(th.includes("Final mark = average of CA and SA marks"), "transcript explains the rules");
const eh = tr.transcriptHtml({ ...td, blocks: [], total_credits: 0, completed_credits: 0, average_mark: null }, null);
ok(eh.includes("no approved results") && eh.includes("All years"), "transcript handles empty blocks");
const ih = tr.transcriptHtml({ ...td, transcript_number: "TR-26-00001", issue_date: "2026-10-01" }, "2026");
ok(ih.includes("TR-26-00001") && ih.includes("Date issued"), "issued transcript shows number and date");
}
{
const csv = await load("src/lib/bankStatementCsv.ts");
const eq = (a, b, m) => ok(JSON.stringify(a) === JSON.stringify(b), m + (JSON.stringify(a) === JSON.stringify(b) ? "" : " got " + JSON.stringify(a)));
let r = csv.parseBankCsv("Date,Description,Reference,Amount\n2026-10-01,Fees,062-26-12345,1500.00\n2026-10-02,Other,,-20.50\n");
eq(r.lines, [{ date: "2026-10-01", description: "Fees", reference: "062-26-12345", amount: 1500 }, { date: "2026-10-02", description: "Other", reference: "", amount: -20.5 }], "comma delimited, ISO dates");
r = csv.parseBankCsv("Date;Narrative;Reference;Amount\n05/10/2026;Pay;REF1;\"1 500,00\"\n");
eq(r.lines.length, 1, "semicolon delimited line read"); eq(r.lines[0]?.date, "2026-10-05", "DD/MM/YYYY converted");
r = csv.parseBankCsv("Date,Details,Reference,Amount\n01-10-2026,\"Smith, J \"\"Tina\"\"\",R,\"1,234.50\"\n");
eq(r.lines[0]?.description, 'Smith, J "Tina"', "quoted commas and doubled quotes"); eq(r.lines[0]?.amount, 1234.5, "thousands separator removed"); eq(r.lines[0]?.date, "2026-10-01", "DD-MM-YYYY converted");
r = csv.parseBankCsv("Date,Description,Amount\n2026-10-01,Fee,(250.00)\n");
eq(r.lines[0]?.amount, -250, "parentheses mean negative");
r = csv.parseBankCsv("Date,Description,Debit,Credit\n2026-10-01,Out,100.00,\n2026-10-02,In,,300.00\n");
eq(r.lines.map((l) => l.amount), [-100, 300], "credit/debit columns give signed amounts");
r = csv.parseBankCsv("Date,Description,Amount\nnot a date,X,5\n2026-10-01,Y,abc\n2026-10-01,Z,5\n");
eq([r.lines.length, r.errors.length], [1, 2], "unreadable rows are reported, not dropped silently");
eq(csv.parseBankCsv("Foo,Bar\n1,2\n").needsMapping, true, "unrecognised headers ask for column mapping");
}
process.exitCode = failures ? 1 : 0;
console.log(failures ? `${failures} FAILED` : "all passed");
