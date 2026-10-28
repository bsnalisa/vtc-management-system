import { useState } from "react";
import { Link } from "react-router-dom";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useApprovalLimits, useSaveApprovalLimit } from "@/hooks/useFinance";
import { Input } from "@/components/ui/input";
import { useProcessTypes } from "@/hooks/useWorkflows";

/** Who reports to whom: the role-level lines every centre starts with, plus optional per-person supervisors. */
export function ReportingLinesTab() {
  const { data: limits } = useApprovalLimits();
  const { data: processTypes } = useProcessTypes();
  const saveLimit = useSaveApprovalLimit();
  const [limitProcess, setLimitProcess] = useState("");
  const [limitAmount, setLimitAmount] = useState("");

  return (
    <div className="space-y-8">
      <Alert>
        <AlertDescription>
          Reporting lines and named supervisors are managed on the <Link to="/reporting-structure" className="underline">Reporting structure</Link> page, where every change is checked, dated and recorded.
        </AlertDescription>
      </Alert>

      <section className="space-y-3">
        <h4 className="font-medium">Approval limits</h4>
        <p className="text-sm text-muted-foreground max-w-3xl">
          When a request is for more than the limit, the first approver's approval is not enough: it goes on to that approver's own supervisor (for example the Centre Manager). No limit means one approval is always enough.
        </p>
        <Table>
          <TableHeader><TableRow><TableHead>Kind of request</TableHead><TableHead className="text-right">Limit (N$)</TableHead><TableHead /></TableRow></TableHeader>
          <TableBody>
            {limits?.map((l) => (
              <TableRow key={l.process_type}>
                <TableCell>{processTypes?.find((t) => t.code === l.process_type)?.label ?? l.process_type}</TableCell>
                <TableCell className="text-right">{Number(l.limit_amount).toLocaleString("en-ZA", { minimumFractionDigits: 2 })}</TableCell>
                <TableCell className="text-right"><Button size="sm" variant="ghost" onClick={() => saveLimit.mutate({ process_type: l.process_type, limit_amount: null })}>Remove</Button></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {!limits?.length && <p className="text-sm text-muted-foreground">No approval limits are set.</p>}
        <form className="grid gap-3 md:grid-cols-3 items-end border rounded-md p-4" onSubmit={async (e) => {
          e.preventDefault(); await saveLimit.mutateAsync({ process_type: limitProcess, limit_amount: Number(limitAmount) }); setLimitProcess(""); setLimitAmount("");
        }}>
          <div className="space-y-1"><Label>Kind of request</Label>
            <Select value={limitProcess} onValueChange={setLimitProcess}><SelectTrigger><SelectValue placeholder="Choose" /></SelectTrigger>
              <SelectContent>{processTypes?.filter((t) => ["payment_request", "debtor_adjustment", "asset_request", "finance_submission", "loan_request", "executive_matter"].includes(t.code)).map((t) => <SelectItem key={t.code} value={t.code}>{t.label}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-1"><Label>Needs the next level above (N$)</Label><Input type="number" min="1" step="0.01" value={limitAmount} onChange={(e) => setLimitAmount(e.target.value)} /></div>
          <Button type="submit" disabled={!limitProcess || !(Number(limitAmount) > 0) || saveLimit.isPending}>Set limit</Button>
        </form>
      </section>
    </div>
  );
}