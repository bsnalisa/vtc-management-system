/**
 * Export utilities for CSV and Excel exports
 */

export function exportToCSV(data: any[], filename: string): void {
  if (!data || data.length === 0) {
    console.warn("No data to export");
    return;
  }

  // Get headers from the first object
  const headers = Object.keys(data[0]);
  
  // Create CSV content
  const csvContent = [
    // Header row
    headers.join(","),
    // Data rows
    ...data.map((row) =>
      headers
        .map((header) => {
          const value = row[header];
          // Handle different value types
          if (value === null || value === undefined) return "";
          if (typeof value === "object") return `"${JSON.stringify(value).replace(/"/g, '""')}"`;
          if (typeof value === "string" && (value.includes(",") || value.includes('"') || value.includes("\n"))) {
            return `"${value.replace(/"/g, '""')}"`;
          }
          return value;
        })
        .join(",")
    ),
  ].join("\n");

  // Create and trigger download
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  
  link.setAttribute("href", url);
  link.setAttribute("download", `${filename}.csv`);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function download(blob: Blob, filename: string): void {
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

const cellText = (value: unknown): string => {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
};

/** Real .xlsx workbook (bold header row, frozen header, sized columns). */
export async function exportToExcel(data: any[], filename: string, sheetName = "Export"): Promise<void> {
  if (!data || data.length === 0) {
    console.warn("No data to export");
    return;
  }
  // Loaded on demand so exceljs stays out of the main bundle
  const ExcelJS = (await import("exceljs")).default;
  const workbook = new ExcelJS.Workbook();
  // Excel limits sheet names to 31 characters and forbids : \ / ? * [ ]
  const sheet = workbook.addWorksheet(sheetName.replace(/[:\\/?*[\]]/g, " ").slice(0, 31) || "Export");
  const headers = Object.keys(data[0]);
  sheet.columns = headers.map((h) => ({
    header: h,
    key: h,
    width: Math.min(
      50,
      Math.max(h.length, ...data.slice(0, 200).map((row) => cellText(row[h]).length)) + 2,
    ),
  }));
  data.forEach((row) =>
    sheet.addRow(
      Object.fromEntries(
        headers.map((h) => {
          const v = row[h];
          return [h, v !== null && typeof v === "object" && !(v instanceof Date) ? JSON.stringify(v) : v ?? null];
        }),
      ),
    ),
  );
  sheet.getRow(1).font = { bold: true };
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  const buffer = await workbook.xlsx.writeBuffer();
  download(
    new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
    `${filename}.xlsx`,
  );
}

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Word-compatible document (HTML table saved as .doc, which Word opens natively). */
export function exportToWord(data: any[], filename: string, title?: string): void {
  if (!data || data.length === 0) {
    console.warn("No data to export");
    return;
  }
  const headers = Object.keys(data[0]);
  const head = headers.map((h) => `<th style="border:1px solid #999;padding:4px;background:#eee">${escapeHtml(h)}</th>`).join("");
  const rows = data
    .map((row) => `<tr>${headers.map((h) => `<td style="border:1px solid #999;padding:4px">${escapeHtml(cellText(row[h]))}</td>`).join("")}</tr>`)
    .join("");
  const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"><title>${escapeHtml(title ?? filename)}</title></head><body>${title ? `<h2>${escapeHtml(title)}</h2>` : ""}<table style="border-collapse:collapse;font-family:Calibri,Arial,sans-serif;font-size:10pt"><thead><tr>${head}</tr></thead><tbody>${rows}</tbody></table></body></html>`;
  download(new Blob(["\ufeff", html], { type: "application/msword" }), `${filename}.doc`);
}

/** Tab-separated plain text. */
export function exportToText(data: any[], filename: string): void {
  if (!data || data.length === 0) {
    console.warn("No data to export");
    return;
  }
  const headers = Object.keys(data[0]);
  const clean = (v: unknown) => cellText(v).replace(/[\t\r\n]+/g, " ");
  const text = [headers.join("\t"), ...data.map((row) => headers.map((h) => clean(row[h])).join("\t"))].join("\n");
  download(new Blob([text], { type: "text/plain;charset=utf-8;" }), `${filename}.txt`);
}

/**
 * Prepare data for export by flattening nested objects
 */
export function prepareDataForExport(data: any[]): any[] {
  return data.map((item) => {
    const flatItem: Record<string, any> = {};
    
    Object.entries(item).forEach(([key, value]) => {
      if (value && typeof value === "object" && !Array.isArray(value)) {
        // Flatten nested objects
        Object.entries(value).forEach(([nestedKey, nestedValue]) => {
          flatItem[`${key}_${nestedKey}`] = nestedValue;
        });
      } else if (Array.isArray(value)) {
        // Convert arrays to comma-separated strings
        flatItem[key] = value.join(", ");
      } else {
        flatItem[key] = value;
      }
    });
    
    return flatItem;
  });
}

/**
 * Format date for export
 */
export function formatDateForExport(date: string | Date | null | undefined): string {
  if (!date) return "";
  const d = new Date(date);
  return d.toLocaleDateString("en-ZA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

/**
 * Format currency for export
 */
export function formatCurrencyForExport(amount: number | null | undefined, currency = "USD"): string {
  if (amount === null || amount === undefined) return "";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(amount);
}
