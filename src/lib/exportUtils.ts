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

export function exportToExcel(data: any[], filename: string): void {
  // For now, use CSV export as a fallback
  // A proper implementation would use a library like xlsx
  exportToCSV(data, filename);
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
