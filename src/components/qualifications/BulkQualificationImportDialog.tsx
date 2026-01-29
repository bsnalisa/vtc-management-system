import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle, Download, X } from "lucide-react";
import { useBulkImportQualifications, type BulkQualificationData } from "@/hooks/useBulkQualificationImport";
import { ScrollArea } from "@/components/ui/scroll-area";

interface BulkQualificationImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ParsedRow extends BulkQualificationData {
  rowNumber: number;
  errors: string[];
  isValid: boolean;
}

const VALID_TYPES = ["nvc", "diploma"];
const VALID_DURATION_UNITS = ["months", "years"];

export const BulkQualificationImportDialog = ({ open, onOpenChange }: BulkQualificationImportDialogProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [parsedData, setParsedData] = useState<ParsedRow[]>([]);
  const [fileName, setFileName] = useState<string>("");
  const [parseError, setParseError] = useState<string>("");
  
  const bulkImportMutation = useBulkImportQualifications();

  const downloadTemplate = () => {
    const headers = ["qualification_title", "qualification_code", "qualification_type", "nqf_level", "duration_value", "duration_unit"];
    const exampleRows = [
      ["National Vocational Certificate in Information Technology", "Q2034", "nvc", "2", "12", "months"],
      ["Diploma in Business Administration", "Q3045", "diploma", "5", "2", "years"],
    ];
    
    const csvContent = [
      headers.join(","),
      ...exampleRows.map(row => row.map(cell => `"${cell}"`).join(","))
    ].join("\n");
    
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "qualifications_import_template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const parseCSV = (text: string): ParsedRow[] => {
    const lines = text.trim().split("\n");
    if (lines.length < 2) {
      throw new Error("CSV must have a header row and at least one data row");
    }

    const headers = lines[0].split(",").map(h => h.trim().toLowerCase().replace(/"/g, ""));
    const requiredHeaders = ["qualification_title", "qualification_code", "qualification_type", "nqf_level", "duration_value", "duration_unit"];
    
    const missingHeaders = requiredHeaders.filter(h => !headers.includes(h));
    if (missingHeaders.length > 0) {
      throw new Error(`Missing required columns: ${missingHeaders.join(", ")}`);
    }

    const results: ParsedRow[] = [];
    
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      // Parse CSV line handling quoted values
      const values: string[] = [];
      let current = "";
      let inQuotes = false;
      
      for (const char of line) {
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === "," && !inQuotes) {
          values.push(current.trim());
          current = "";
        } else {
          current += char;
        }
      }
      values.push(current.trim());

      const row: Record<string, string> = {};
      headers.forEach((header, idx) => {
        row[header] = values[idx] || "";
      });

      const errors: string[] = [];
      
      // Validate required fields
      if (!row.qualification_title) errors.push("Title is required");
      if (!row.qualification_code) errors.push("Code is required");
      
      // Validate type
      const type = row.qualification_type?.toLowerCase();
      if (!VALID_TYPES.includes(type)) {
        errors.push(`Invalid type: must be 'nvc' or 'diploma'`);
      }
      
      // Validate NQF level
      const nqfLevel = parseInt(row.nqf_level);
      if (isNaN(nqfLevel) || nqfLevel < 1 || nqfLevel > 10) {
        errors.push("NQF level must be between 1 and 10");
      }
      
      // Validate duration
      const durationValue = parseInt(row.duration_value);
      if (isNaN(durationValue) || durationValue < 1) {
        errors.push("Duration must be a positive number");
      }
      
      // Validate duration unit
      const durationUnit = row.duration_unit?.toLowerCase();
      if (!VALID_DURATION_UNITS.includes(durationUnit)) {
        errors.push(`Invalid duration unit: must be 'months' or 'years'`);
      }

      results.push({
        rowNumber: i + 1,
        qualification_title: row.qualification_title,
        qualification_code: row.qualification_code?.toUpperCase(),
        qualification_type: type as "nvc" | "diploma",
        nqf_level: nqfLevel || 1,
        duration_value: durationValue || 12,
        duration_unit: durationUnit as "months" | "years",
        errors,
        isValid: errors.length === 0,
      });
    }

    return results;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setParseError("");
    setParsedData([]);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = parseCSV(text);
        setParsedData(parsed);
      } catch (error) {
        setParseError(error instanceof Error ? error.message : "Failed to parse file");
      }
    };
    reader.onerror = () => setParseError("Failed to read file");
    reader.readAsText(file);
  };

  const handleImport = async () => {
    const validRows = parsedData.filter(row => row.isValid);
    if (validRows.length === 0) return;

    const dataToImport: BulkQualificationData[] = validRows.map(({ rowNumber, errors, isValid, ...data }) => data);
    
    await bulkImportMutation.mutateAsync(dataToImport);
    handleClose();
  };

  const handleClose = () => {
    setParsedData([]);
    setFileName("");
    setParseError("");
    if (fileInputRef.current) fileInputRef.current.value = "";
    onOpenChange(false);
  };

  const validCount = parsedData.filter(r => r.isValid).length;
  const invalidCount = parsedData.filter(r => !r.isValid).length;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Bulk Import Qualifications
          </DialogTitle>
          <DialogDescription>
            Upload a CSV file to import multiple qualifications at once.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Template Download */}
          <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
            <div>
              <p className="font-medium">Download Template</p>
              <p className="text-sm text-muted-foreground">
                Use this template to format your qualifications data correctly
              </p>
            </div>
            <Button variant="outline" onClick={downloadTemplate}>
              <Download className="h-4 w-4 mr-2" />
              Download CSV Template
            </Button>
          </div>

          {/* File Upload */}
          <div className="space-y-2">
            <Label htmlFor="file">Upload CSV File</Label>
            <div className="flex gap-2">
              <Input
                ref={fileInputRef}
                id="file"
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                className="flex-1"
              />
              {fileName && (
                <Button variant="ghost" size="icon" onClick={() => {
                  setParsedData([]);
                  setFileName("");
                  if (fileInputRef.current) fileInputRef.current.value = "";
                }}>
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>

          {/* Parse Error */}
          {parseError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{parseError}</AlertDescription>
            </Alert>
          )}

          {/* Preview Table */}
          {parsedData.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-4">
                <Badge variant="default" className="bg-primary/10 text-primary border-primary/20">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  {validCount} valid
                </Badge>
                {invalidCount > 0 && (
                  <Badge variant="destructive" className="bg-destructive/10 text-destructive border-destructive/20">
                    <AlertCircle className="h-3 w-3 mr-1" />
                    {invalidCount} with errors
                  </Badge>
                )}
              </div>

              <ScrollArea className="h-[300px] border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[60px]">Row</TableHead>
                      <TableHead className="w-[80px]">Status</TableHead>
                      <TableHead>Code</TableHead>
                      <TableHead>Title</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>NQF</TableHead>
                      <TableHead>Duration</TableHead>
                      <TableHead>Errors</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parsedData.map((row) => (
                      <TableRow key={row.rowNumber} className={!row.isValid ? "bg-destructive/5" : ""}>
                        <TableCell className="font-mono text-xs">{row.rowNumber}</TableCell>
                        <TableCell>
                          {row.isValid ? (
                            <CheckCircle className="h-4 w-4 text-primary" />
                          ) : (
                            <AlertCircle className="h-4 w-4 text-destructive" />
                          )}
                        </TableCell>
                        <TableCell className="font-mono text-xs">{row.qualification_code}</TableCell>
                        <TableCell className="max-w-[200px] truncate text-sm">
                          {row.qualification_title}
                        </TableCell>
                        <TableCell className="uppercase text-xs">{row.qualification_type}</TableCell>
                        <TableCell className="text-center">{row.nqf_level}</TableCell>
                        <TableCell className="text-sm">
                          {row.duration_value} {row.duration_unit}
                        </TableCell>
                        <TableCell className="text-xs text-destructive max-w-[200px]">
                          {row.errors.join("; ")}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button 
            onClick={handleImport} 
            disabled={validCount === 0 || bulkImportMutation.isPending}
          >
            {bulkImportMutation.isPending ? (
              "Importing..."
            ) : (
              <>
                <Upload className="h-4 w-4 mr-2" />
                Import {validCount} Qualification{validCount !== 1 ? "s" : ""}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
