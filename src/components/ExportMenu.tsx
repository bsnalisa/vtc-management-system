import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { exportToCSV, exportToExcel, exportToText, exportToWord } from "@/lib/exportUtils";

interface ExportMenuProps {
  /** Rows to export; pass a function to build them lazily when the user picks a format. */
  data: Record<string, unknown>[] | (() => Record<string, unknown>[]);
  filename: string;
  title?: string;
  label?: string;
  disabled?: boolean;
  variant?: "default" | "outline" | "secondary";
  size?: "default" | "sm";
}

/** Spec 3.6: reports extractable as xls, word, csv and text. */
export function ExportMenu({ data, filename, title, label = "Export", disabled, variant = "outline", size = "default" }: ExportMenuProps) {
  const run = async (format: "xlsx" | "csv" | "doc" | "txt") => {
    const rows = typeof data === "function" ? data() : data;
    if (!rows.length) {
      toast.error("Nothing to export");
      return;
    }
    try {
      if (format === "xlsx") await exportToExcel(rows, filename, title);
      else if (format === "csv") exportToCSV(rows, filename);
      else if (format === "doc") exportToWord(rows, filename, title);
      else exportToText(rows, filename);
    } catch (e) {
      toast.error(`Export failed: ${e instanceof Error ? e.message : "unknown error"}`);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant={variant} size={size} disabled={disabled}><Download className="h-4 w-4 mr-2" />{label}</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={() => run("xlsx")}>Excel (.xlsx)</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => run("doc")}>Word (.doc)</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => run("csv")}>CSV (.csv)</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => run("txt")}>Text (.txt)</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
