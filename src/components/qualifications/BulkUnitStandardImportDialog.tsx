import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Download, Upload, AlertCircle, CheckCircle2, X } from "lucide-react";
import { useBulkUnitStandardImport, UnitStandardImportRow } from "@/hooks/useBulkUnitStandardImport";

interface BulkUnitStandardImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  qualificationId: string;
}

interface ParsedRow extends UnitStandardImportRow {
  isValid: boolean;
  errors: string[];
}

export const BulkUnitStandardImportDialog = ({ 
  open, 
  onOpenChange, 
  qualificationId 
}: BulkUnitStandardImportDialogProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [parsedData, setParsedData] = useState<ParsedRow[]>([]);
  const [fileName, setFileName] = useState<string>("");
  const importMutation = useBulkUnitStandardImport(qualificationId);

  const downloadTemplate = () => {
    const headers = "unit_standard_id,unit_standard_title,level,credit_value,is_mandatory";
    const sampleRow1 = "US-ICT-001,Install and configure hardware,2,10,true";
    const sampleRow2 = "US-ICT-002,Configure operating systems,2,8,true";
    const sampleRow3 = "US-ICT-003,Network fundamentals,3,12,false";
    const content = `${headers}\n${sampleRow1}\n${sampleRow2}\n${sampleRow3}`;
    
    const blob = new Blob([content], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "unit_standards_import_template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const validateRow = (row: UnitStandardImportRow): { isValid: boolean; errors: string[] } => {
    const errors: string[] = [];
    
    if (!row.unit_standard_id?.trim()) {
      errors.push("Unit Standard ID is required");
    }
    if (!row.unit_standard_title?.trim()) {
      errors.push("Title is required");
    }
    if (!row.level || isNaN(Number(row.level)) || Number(row.level) < 1 || Number(row.level) > 10) {
      errors.push("Level must be 1-10");
    }
    if (row.credit_value && (isNaN(Number(row.credit_value)) || Number(row.credit_value) < 0)) {
      errors.push("Credit value must be a positive number");
    }
    if (row.is_mandatory !== undefined && 
        !["true", "false", "yes", "no", "1", "0"].includes(String(row.is_mandatory).toLowerCase())) {
      errors.push("is_mandatory must be true/false");
    }

    return { isValid: errors.length === 0, errors };
  };

  const parseCSV = (content: string): ParsedRow[] => {
    const lines = content.split("\n").filter(line => line.trim());
    if (lines.length < 2) return [];

    const headers = lines[0].split(",").map(h => h.trim().toLowerCase());
    
    return lines.slice(1).map(line => {
      const values = line.split(",").map(v => v.trim());
      const row: UnitStandardImportRow = {
        unit_standard_id: "",
        unit_standard_title: "",
        level: 1,
      };

      headers.forEach((header, index) => {
        const value = values[index] || "";
        switch (header) {
          case "unit_standard_id":
            row.unit_standard_id = value.toUpperCase();
            break;
          case "unit_standard_title":
            row.unit_standard_title = value;
            break;
          case "level":
            row.level = parseInt(value) || 1;
            break;
          case "credit_value":
            row.credit_value = value ? parseInt(value) : undefined;
            break;
          case "is_mandatory":
            row.is_mandatory = ["true", "yes", "1"].includes(value.toLowerCase());
            break;
        }
      });

      const validation = validateRow(row);
      return { ...row, ...validation };
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      const parsed = parseCSV(content);
      setParsedData(parsed);
    };
    reader.readAsText(file);
  };

  const handleImport = async () => {
    const validRows = parsedData.filter(row => row.isValid);
    if (validRows.length === 0) return;

    await importMutation.mutateAsync(validRows);
    setParsedData([]);
    setFileName("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    onOpenChange(false);
  };

  const clearFile = () => {
    setParsedData([]);
    setFileName("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const validCount = parsedData.filter(r => r.isValid).length;
  const invalidCount = parsedData.filter(r => !r.isValid).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Bulk Import Unit Standards</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <Button variant="outline" onClick={downloadTemplate}>
              <Download className="h-4 w-4 mr-2" />
              Download Template
            </Button>
            
            <div className="flex-1">
              <Input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                className="cursor-pointer"
              />
            </div>

            {fileName && (
              <Button variant="ghost" size="icon" onClick={clearFile}>
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>

          {parsedData.length > 0 && (
            <>
              <div className="flex items-center gap-4 text-sm">
                <Badge variant="outline" className="gap-1">
                  <CheckCircle2 className="h-3 w-3 text-primary" />
                  {validCount} valid
                </Badge>
                {invalidCount > 0 && (
                  <Badge variant="destructive" className="gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {invalidCount} invalid
                  </Badge>
                )}
              </div>

              <ScrollArea className="h-[400px] border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Status</TableHead>
                      <TableHead>Unit ID</TableHead>
                      <TableHead>Title</TableHead>
                      <TableHead>Level</TableHead>
                      <TableHead>Credits</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Errors</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parsedData.map((row, index) => (
                      <TableRow key={index} className={!row.isValid ? "bg-destructive/10" : ""}>
                        <TableCell>
                          {row.isValid ? (
                            <CheckCircle2 className="h-4 w-4 text-primary" />
                          ) : (
                            <AlertCircle className="h-4 w-4 text-destructive" />
                          )}
                        </TableCell>
                        <TableCell className="font-mono text-sm">{row.unit_standard_id}</TableCell>
                        <TableCell className="max-w-[200px] truncate">{row.unit_standard_title}</TableCell>
                        <TableCell>{row.level}</TableCell>
                        <TableCell>{row.credit_value || "-"}</TableCell>
                        <TableCell>
                          <Badge variant={row.is_mandatory ? "default" : "secondary"}>
                            {row.is_mandatory ? "Mandatory" : "Elective"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-destructive text-sm">
                          {row.errors.join(", ")}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleImport} 
            disabled={validCount === 0 || importMutation.isPending}
          >
            <Upload className="h-4 w-4 mr-2" />
            {importMutation.isPending ? "Importing..." : `Import ${validCount} Unit Standards`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
