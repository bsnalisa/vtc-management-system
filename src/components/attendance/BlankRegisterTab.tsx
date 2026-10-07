import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Printer } from "lucide-react";
import { detailList, esc, htmlTable, printHtml } from "@/lib/printDocument";
import { useOrganizationContext } from "@/hooks/useOrganizationContext";
import type { ClassTrainee } from "./CaptureTab";

/** A paper register to print for classes or days where attendance is first taken on paper. */
export function BlankRegisterTab({ trainees, title }: { trainees: ClassTrainee[]; title: string }) {
  const [columns, setColumns] = useState(10);
  const { organizationName, settings } = useOrganizationContext();
  const print = () => {
    const n = Math.min(Math.max(columns, 1), 31);
    const body = detailList([["Class", title], ["Trainees", trainees.length]]) +
      htmlTable(["No.", "Trainee no.", "Name", ...Array.from({ length: n }, () => " ")], trainees.map((t, i) => [i + 1, t.trainee_id, `${t.last_name}, ${t.first_name}`, ...Array.from({ length: n }, () => "")])) +
      `<div class="sign"><div>Trainer signature</div><div>Date</div></div><p class="note">${esc("Write the date at the top of each column. P = present, A = absent.")}</p>`;
    printHtml("Attendance register", body, { name: organizationName, logoUrl: settings?.logo_url });
  };
  return (
    <div className="space-y-3 max-w-md">
      <p className="text-sm text-muted-foreground">Prints the list of {trainees.length} trainee(s) with empty columns to fill in by hand.</p>
      <div className="space-y-1"><Label htmlFor="cols">Number of date columns</Label><Input id="cols" type="number" min={1} max={31} value={columns} onChange={(e) => setColumns(Number(e.target.value) || 1)} className="w-28" /></div>
      <Button onClick={print} disabled={!trainees.length}><Printer className="h-4 w-4 mr-2" />Print blank register</Button>
    </div>
  );
}
