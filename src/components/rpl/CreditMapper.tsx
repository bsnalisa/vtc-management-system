import { useEffect, useMemo, useState } from "react";
import { Printer } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ButtonSpinner, LoadingSpinner } from "@/components/ui/loading-spinner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AssessmentRequest } from "@/hooks/useAssessmentRequests";
import { CreditRow, useQualificationUnitStandards, useRplCreditMappings, useSaveRplCredits } from "@/hooks/useRpl";
import { useOrganizationContext } from "@/hooks/useOrganizationContext";
import { detailList, esc, htmlTable, printHtml } from "@/lib/printDocument";

interface Draft { decision: "granted" | "not_granted" | null; credits: number; note: string }

/** Per unit standard credit decisions for one RPL request. */
export function CreditMapper({ request }: { request: AssessmentRequest }) {
  const { organizationName, settings } = useOrganizationContext();
  const { data: units = [], isLoading: loadingUnits, error: unitsError } = useQualificationUnitStandards(request.qualification_id);
  const { data: saved = [], isLoading: loadingSaved, error: savedError } = useRplCreditMappings(request.id);
  const save = useSaveRplCredits();
  const [draft, setDraft] = useState<Record<string, Draft>>({});

  useEffect(() => {
    const next: Record<string, Draft> = {};
    units.forEach((u) => {
      const m = saved.find((s) => s.unit_standard_code === u.unit_standard_id);
      next[u.unit_standard_id] = m
        ? { decision: m.decision, credits: m.credits, note: m.evidence_note ?? "" }
        : { decision: null, credits: u.credit_value ?? 0, note: "" };
    });
    setDraft(next);
  }, [units, saved]);

  const patch = (code: string, p: Partial<Draft>) => setDraft((d) => ({ ...d, [code]: { ...d[code], ...p } }));
  const total = useMemo(() => units.reduce((s, u) => s + (u.credit_value ?? 0), 0), [units]);
  const granted = useMemo(() => units.reduce((s, u) => s + (draft[u.unit_standard_id]?.decision === "granted" ? draft[u.unit_standard_id].credits : 0), 0), [units, draft]);

  if (!request.qualification_id) return <p className="text-sm text-muted-foreground py-6 text-center">This request has no qualification, so there are no unit standards to map.</p>;
  if (loadingUnits || loadingSaved) return <LoadingSpinner text="Loading unit standards..." />;
  const err = unitsError ?? savedError;
  if (err) return <p role="alert" className="text-sm text-destructive">Could not load credits: {(err as Error).message}</p>;
  if (!units.length) return <p className="text-sm text-muted-foreground py-6 text-center">The qualification has no unit standards recorded.</p>;

  const decided = units.filter((u) => draft[u.unit_standard_id]?.decision);
  const onSave = () => {
    const rows: CreditRow[] = decided.map((u) => {
      const d = draft[u.unit_standard_id];
      return { unit_standard_code: u.unit_standard_id, unit_standard_title: u.unit_standard_title, decision: d.decision!, credits: d.decision === "granted" ? Math.max(0, Math.round(d.credits || 0)) : 0, evidence_note: d.note.trim() || null };
    });
    save.mutate({ requestId: request.id, rows });
  };

  const print = () => {
    const rows = units.map((u) => { const d = draft[u.unit_standard_id]; return [u.unit_standard_id, u.unit_standard_title, u.is_mandatory ? "Yes" : "No", u.credit_value ?? 0, d?.decision === "granted" ? "Granted" : d?.decision === "not_granted" ? "Not granted" : "Not decided", d?.decision === "granted" ? d.credits : 0, d?.note ?? ""]; });
    try {
      printHtml("RPL credit summary",
        detailList([["Applicant", request.applicant_name], ["Reference", request.reference_number], ["Qualification", request.qualifications?.qualification_title ?? ""], ["Outcome", request.outcome?.replace(/_/g, " ") ?? ""]]) +
        htmlTable(["Code", "Unit standard", "Mandatory", "Credit value", "Decision", "Credits granted", "Evidence note"], rows, { rightAlign: [3, 5] }) +
        `<p><strong>Total credits granted: ${esc(granted)} of ${esc(total)}</strong></p><div class="sign"><div>Coordinator</div><div>Date</div></div>`,
        { name: organizationName, logoUrl: settings?.logo_url });
    } catch (e) { toast.error((e as Error).message); }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm"><span className="text-2xl font-bold">{granted}</span> of {total} credits granted <Badge variant="outline" className="ml-2">{total ? Math.round((granted / total) * 100) : 0}%</Badge></div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button variant="outline" onClick={print}><Printer className="h-4 w-4 mr-2" />Print summary</Button>
          <Button disabled={save.isPending || !decided.length} onClick={onSave}>{save.isPending && <ButtonSpinner className="mr-2" />}Save decisions</Button>
        </div>
      </div>
      <Table>
        <TableHeader><TableRow><TableHead>Unit standard</TableHead><TableHead>Credit value</TableHead><TableHead>Decision</TableHead><TableHead>Credits</TableHead><TableHead>Evidence note</TableHead></TableRow></TableHeader>
        <TableBody>
          {units.map((u) => {
            const d = draft[u.unit_standard_id];
            if (!d) return null;
            return (
              <TableRow key={u.id}>
                <TableCell><div className="font-mono">{u.unit_standard_id}</div><div className="text-muted-foreground text-xs">{u.unit_standard_title}{u.is_mandatory ? " (mandatory)" : ""}</div></TableCell>
                <TableCell>{u.credit_value ?? 0}</TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button size="sm" variant={d.decision === "granted" ? "default" : "outline"} aria-pressed={d.decision === "granted"} onClick={() => patch(u.unit_standard_id, { decision: "granted" })}>Grant</Button>
                    <Button size="sm" variant={d.decision === "not_granted" ? "destructive" : "outline"} aria-pressed={d.decision === "not_granted"} onClick={() => patch(u.unit_standard_id, { decision: "not_granted" })}>Not granted</Button>
                  </div>
                </TableCell>
                <TableCell><Input type="number" min={0} className="w-20" aria-label={`Credits for ${u.unit_standard_id}`} disabled={d.decision !== "granted"} value={d.decision === "granted" ? d.credits : 0} onChange={(e) => patch(u.unit_standard_id, { credits: Math.max(0, Number(e.target.value) || 0) })} /></TableCell>
                <TableCell><Input className="min-w-48" aria-label={`Evidence note for ${u.unit_standard_id}`} value={d.note} onChange={(e) => patch(u.unit_standard_id, { note: e.target.value })} /></TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
