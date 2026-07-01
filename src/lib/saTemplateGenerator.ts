import ExcelJS from "exceljs";

export interface SATemplateData {
  qualCode: string;
  academicYear: string;
  theoryComponents: Array<{ id: string; component_name: string }>;
  practicalComponents: Array<{ id: string; component_name: string }>;
  trainees: Array<{
    id: string;
    trainee_id: string;
    first_name: string;
    last_name: string;
    national_id?: string | null;
    gender?: string | null;
  }>;
  caResults: Array<{
    trainee_id: string;
    template_component_id: string;
    ca_average: number | null;
  }>;
}

// Convert 0-indexed column to Excel letter (A, B, ..., Z, AA, ...)
function colLetter(idx: number): string {
  let n = idx + 1;
  let s = "";
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

export async function generateSAExcelTemplate(data: SATemplateData): Promise<void> {
  const { qualCode, academicYear, theoryComponents, practicalComponents, trainees, caResults } = data;

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("SA Template");

  const FIXED = 10;
  const hasTheory = theoryComponents.length > 0;
  const numPrac = practicalComponents.length;
  const GRP = 5; // component name, CA, SA, Final Mark, Grade
  const totalCols = FIXED + (hasTheory ? GRP : 0) + numPrac * GRP + 1;

  const setVal = (r: number, c: number, v: string | number) => {
    // r, c are 0-indexed; ExcelJS is 1-indexed
    ws.getRow(r + 1).getCell(c + 1).value = v;
  };
  const setFormula = (r: number, c: number, f: string) => {
    ws.getRow(r + 1).getCell(c + 1).value = { formula: f } as ExcelJS.CellFormulaValue;
  };

  // ── Row 0: Headers ──
  ["Qualification ID/Code", "Level", "Month of Assessment", "Candidate Number",
    "Trainee ID", "Last Name", "First Name", "Middle Name", "ID Number", "Gender",
  ].forEach((h, i) => setVal(0, i, h));

  let col = FIXED;
  if (hasTheory) {
    const name = theoryComponents[0].component_name;
    setVal(0, col, name);
    setVal(0, col + 1, "CA");
    setVal(0, col + 2, "SA");
    setVal(0, col + 3, "Final Mark");
    setVal(0, col + 4, "Grade");
    col += GRP;
  }
  practicalComponents.forEach((p) => {
    setVal(0, col, p.component_name);
    setVal(0, col + 1, "CA");
    setVal(0, col + 2, "SA");
    setVal(0, col + 3, "Final Mark");
    setVal(0, col + 4, "Grade");
    col += GRP;
  });
  setVal(0, col, "Overall Outcome");

  // ── Helper: lookup CA average ──
  const getCA = (traineeId: string, componentId: string): number | null => {
    const r = caResults.find(
      (x) => x.trainee_id === traineeId && x.template_component_id === componentId
    );
    return r?.ca_average ?? null;
  };

  // ── Trainee data rows ──
  trainees.forEach((t, idx) => {
    const r = idx + 1;      // 0-indexed worksheet row
    const er = idx + 2;     // 1-indexed Excel row (for formulas)

    setVal(r, 0, qualCode);
    setVal(r, 1, "");
    setVal(r, 2, "");
    setVal(r, 3, idx + 1);
    setVal(r, 4, t.trainee_id || "");
    setVal(r, 5, t.last_name || "");
    setVal(r, 6, t.first_name || "");
    setVal(r, 7, "");
    setVal(r, 8, t.national_id || "");
    setVal(r, 9, t.gender || "");

    let c = FIXED;
    const fmCols: { col: number; passMark: number }[] = [];

    if (hasTheory) {
      const comp = theoryComponents[0];
      const ca = getCA(t.id, comp.id);

      setVal(r, c, comp.component_name);
      if (ca !== null) setVal(r, c + 1, Math.round(ca * 100) / 100);

      const caRef = `${colLetter(c + 1)}${er}`;
      const saRef = `${colLetter(c + 2)}${er}`;
      const fmRef = `${colLetter(c + 3)}${er}`;

      setFormula(r, c + 3, `IFERROR(${caRef}*0.4+${saRef}*0.6,"")`);
      setFormula(r, c + 4, `IF(${fmRef}="","",IF(${fmRef}>=80,"D",IF(${fmRef}>=60,"C",IF(${fmRef}>=50,"P","F"))))`);
      fmCols.push({ col: c + 3, passMark: 50 });
      c += GRP;
    }

    practicalComponents.forEach((comp) => {
      const ca = getCA(t.id, comp.id);

      setVal(r, c, comp.component_name);
      if (ca !== null) setVal(r, c + 1, Math.round(ca * 100) / 100);

      const caRef = `${colLetter(c + 1)}${er}`;
      const saRef = `${colLetter(c + 2)}${er}`;
      const fmRef = `${colLetter(c + 3)}${er}`;

      setFormula(r, c + 3, `IFERROR(${caRef}*0.4+${saRef}*0.6,"")`);
      setFormula(r, c + 4, `IF(${fmRef}="","",IF(${fmRef}>=80,"D",IF(${fmRef}>=60,"C",IF(${fmRef}>=50,"P","F"))))`);
      fmCols.push({ col: c + 3, passMark: 60 });
      c += GRP;
    });

    if (fmCols.length > 0) {
      const emptyChecks = fmCols.map((f) => `${colLetter(f.col)}${er}<>""`).join(",");
      const passChecks = fmCols.map((f) => `${colLetter(f.col)}${er}>=${f.passMark}`).join(",");
      setFormula(r, c, `IF(NOT(AND(${emptyChecks})),"",IF(AND(${passChecks}),"C","NYC"))`);
    }
  });

  // ── Grading Keys + Signatures section ──
  const gk = trainees.length + 3;

  setVal(gk, 0, "GRADING KEYS");
  const keys: [string, string, string][] = [
    ["49% and below", "F", "Fail"],
    ["50% to 59%", "P", "*Pass"],
    ["60% to 79%", "C", "Credit"],
    ["80% to 100%", "D", "Distinction"],
  ];
  keys.forEach(([range, code, label], i) => {
    setVal(gk + 1 + i, 0, range);
    setVal(gk + 1 + i, 1, code);
    setVal(gk + 1 + i, 2, label);
  });

  setVal(gk + 6, 0, "Disqualification - X");
  setVal(gk + 6, 1, "Exempted - E");
  setVal(gk + 6, 2, "Absent - A");
  setVal(gk + 6, 3, "DNQ - Did Not Qualify");

  const sigCol = 5;
  setVal(gk + 1, sigCol, "Confirmed by: ___________________________");
  setVal(gk + 3, sigCol, "Signature: ___________________________");
  setVal(gk + 5, sigCol, "Approved by: ___________________________");
  setVal(gk + 7, sigCol, "Signature: ___________________________");

  // Column widths
  for (let i = 0; i < totalCols; i++) {
    ws.getColumn(i + 1).width = i <= 2 ? 22 : i <= 9 ? 16 : 14;
  }

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `SA-Template-${qualCode}-${academicYear}.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
