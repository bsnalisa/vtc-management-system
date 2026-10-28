import { useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { withRoleAccess } from "@/components/withRoleAccess";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ButtonSpinner, LoadingSpinner } from "@/components/ui/loading-spinner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useRoleNavigation } from "@/hooks/useRoleNavigation";
import { useOrganizationContext } from "@/hooks/useOrganizationContext";
import { useBudgetActions, useBudgetOverview, type BudgetLine } from "@/hooks/useBudgets";

const money = (n: number | null | undefined) => `N$ ${Number(n ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const day = (d: string | null) => (d ? new Date(d).toLocaleDateString() : "-");
const EVENT: Record<string, string> = { proposed: "Proposed", approved: "Approved", rejected: "Rejected", withdrawn: "Withdrawn" };

type Edit = { department: string; fixed: boolean; amount: string; reason: string };

function Budgets() {
  const { navItems, groupLabel } = useRoleNavigation();
  const { organizationId } = useOrganizationContext();
  const [year, setYear] = useState<string | null>(null);
  const { data, isLoading, error } = useBudgetOverview(organizationId, year);
  const act = useBudgetActions(organizationId);
  const [edit, setEdit] = useState<Edit | null>(null);
  const [reject, setReject] = useState<{ line: BudgetLine; note: string } | null>(null);
  const shell = (children: React.ReactNode) => <DashboardLayout title="Departmental budgets" subtitle="Approved budgets, what is committed and what is left" navItems={navItems} groupLabel={groupLabel}>{children}</DashboardLayout>;

  if (isLoading) return shell(<LoadingSpinner text="Loading..." className="py-8" />);
  if (error || !data) return shell(<Alert variant="destructive"><AlertDescription>{(error as Error)?.message ?? "Could not load the budgets"}</AlertDescription></Alert>);

  const y = data.year;
  const submit = () => {
    if (!edit) return;
    act.propose.mutate({ department: edit.department.trim(), year: y, amount: Number(edit.amount), reason: edit.reason.trim() }, { onSuccess: () => setEdit(null) });
  };
  const valid = !!edit && edit.department.trim() !== "" && edit.amount !== "" && Number(edit.amount) >= 0 && edit.reason.trim().length >= 5;

  return shell(
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="w-40 space-y-1"><Label>Budget year</Label>
          <Select value={y} onValueChange={setYear}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{data.years.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        {data.can_propose && <Button onClick={() => setEdit({ department: "", fixed: false, amount: "", reason: "" })}>Add a department budget</Button>}
      </div>

      <Alert><AlertDescription>
        Only the Head of Finance and Administration proposes a budget and only the Centre Manager approves it; the figure counts once approved.
        Committed is the order value the Procurement Officer records on the department&apos;s requisitions submitted in {y}, so it is never typed in.
      </AlertDescription></Alert>

      <Tabs defaultValue="budgets">
        <TabsList><TabsTrigger value="budgets">Budgets</TabsTrigger><TabsTrigger value="history">History</TabsTrigger></TabsList>
        <TabsContent value="budgets" className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Budgets for {y}</CardTitle></CardHeader>
            <CardContent>
              {!data.lines.length ? <p className="text-sm text-muted-foreground">No department budget has been entered for {y}.</p> : (
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>Department</TableHead><TableHead className="text-right">Approved budget</TableHead><TableHead className="text-right">Committed</TableHead>
                    <TableHead className="text-right">Available</TableHead><TableHead>Used</TableHead><TableHead>Status</TableHead><TableHead />
                  </TableRow></TableHeader>
                  <TableBody>
                    {data.lines.map((l) => (
                      <TableRow key={l.id}>
                        <TableCell className="font-medium">{l.department}<div className="text-xs text-muted-foreground">{l.requisitions} requisition{l.requisitions === 1 ? "" : "s"}</div></TableCell>
                        <TableCell className="text-right">{l.in_force ? money(l.total) : "-"}</TableCell>
                        <TableCell className="text-right">{money(l.committed)}</TableCell>
                        <TableCell className={`text-right ${l.in_force && l.available < 0 ? "text-destructive" : ""}`}>{l.in_force ? money(l.available) : "-"}</TableCell>
                        <TableCell className="min-w-[8rem]">{l.utilisation == null ? "-" : <div className="space-y-1"><Progress value={Math.min(100, l.utilisation)} /><span className="text-xs">{l.utilisation}%</span></div>}</TableCell>
                        <TableCell className="whitespace-normal">
                          {l.proposal_status === "pending" && <><Badge variant="outline">Waiting for Centre Manager</Badge><div className="mt-1 text-xs">Proposed {money(l.proposed_total)} by {l.proposed_by ?? "-"} on {day(l.proposed_at)}: {l.proposal_reason}</div></>}
                          {l.proposal_status === "rejected" && <><Badge variant="destructive">Rejected</Badge><div className="mt-1 text-xs">{l.proposal_note}</div></>}
                          {l.proposal_status === "none" && <Badge>{l.in_force ? "Approved" : "-"}</Badge>}
                          {l.in_force && l.proposal_status === "none" && <div className="mt-1 text-xs text-muted-foreground">Approved by {l.approved_by ?? "-"} on {day(l.approved_at)}</div>}
                        </TableCell>
                        <TableCell className="space-x-2 whitespace-nowrap text-right">
                          {data.can_decide && l.proposal_status === "pending" && <>
                            <Button size="sm" disabled={act.decide.isPending} onClick={() => act.decide.mutate({ line: l.id, approve: true, note: "" })}>Approve</Button>
                            <Button size="sm" variant="outline" onClick={() => setReject({ line: l, note: "" })}>Reject</Button></>}
                          {data.can_propose && l.proposal_status !== "pending" && <Button size="sm" variant="outline" onClick={() => setEdit({ department: l.department, fixed: true, amount: String(l.total), reason: "" })}>Propose change</Button>}
                          {data.can_propose && l.proposal_status !== "none" && <Button size="sm" variant="ghost" disabled={act.withdraw.isPending} onClick={() => act.withdraw.mutate(l.id)}>Withdraw</Button>}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {data.unbudgeted.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-base">Departments with requisitions but no budget</CardTitle><CardDescription>Requisitions submitted in {y} for departments that have no budget line.</CardDescription></CardHeader>
              <CardContent className="space-y-2">
                {data.unbudgeted.map((u) => (
                  <div key={u.department} className="flex flex-wrap items-center justify-between gap-2 rounded border p-2 text-sm">
                    <span>{u.department} - {u.requisitions} requisition{u.requisitions === 1 ? "" : "s"}, {money(u.committed)} ordered</span>
                    {data.can_propose && <Button size="sm" variant="outline" onClick={() => setEdit({ department: u.department, fixed: true, amount: "", reason: "" })}>Propose a budget</Button>}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </TabsContent>
        <TabsContent value="history">
          <Card><CardContent className="space-y-2 pt-6">
            {!data.events.length && <p className="text-sm text-muted-foreground">Nothing has been recorded yet.</p>}
            {data.events.map((e, i) => (
              <div key={i} className="rounded border p-2 text-sm">
                <span className="font-medium">{EVENT[e.event] ?? e.event}</span> - {e.department} ({e.year}){e.new_total != null ? `, ${money(e.new_total)}` : ""}{e.old_total != null ? ` (was ${money(e.old_total)})` : ""}
                <div className="text-xs text-muted-foreground">{e.by ?? "-"}{e.role ? `, ${e.role.replace(/_/g, " ")}` : ""} on {day(e.at)}{e.note ? ` - ${e.note}` : ""}</div>
              </div>
            ))}
          </CardContent></Card>
        </TabsContent>
      </Tabs>

      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Propose a budget for {y}</DialogTitle><DialogDescription>The Centre Manager approves it before it counts.</DialogDescription></DialogHeader>
          {edit && <div className="space-y-3">
            <div className="space-y-1"><Label>Department</Label><Input value={edit.department} maxLength={120} disabled={edit.fixed} onChange={(e) => setEdit({ ...edit, department: e.target.value })} /></div>
            <div className="space-y-1"><Label>Budget (N$)</Label><Input type="number" min={0} step="0.01" value={edit.amount} onChange={(e) => setEdit({ ...edit, amount: e.target.value })} /></div>
            <div className="space-y-1"><Label>Reason</Label><Textarea rows={3} value={edit.reason} onChange={(e) => setEdit({ ...edit, reason: e.target.value })} /></div>
          </div>}
          <DialogFooter><Button variant="outline" onClick={() => setEdit(null)}>Cancel</Button><Button disabled={!valid || act.propose.isPending} onClick={submit}>{act.propose.isPending && <ButtonSpinner />}Send for approval</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!reject} onOpenChange={(o) => !o && setReject(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Reject the {reject?.line.department} budget</DialogTitle><DialogDescription>The Head of Finance and Administration sees your reason.</DialogDescription></DialogHeader>
          <Textarea rows={3} value={reject?.note ?? ""} onChange={(e) => reject && setReject({ ...reject, note: e.target.value })} placeholder="Reason (at least 5 characters)" />
          <DialogFooter><Button variant="outline" onClick={() => setReject(null)}>Cancel</Button>
            <Button variant="destructive" disabled={(reject?.note.trim().length ?? 0) < 5 || act.decide.isPending} onClick={() => reject && act.decide.mutate({ line: reject.line.id, approve: false, note: reject.note.trim() }, { onSuccess: () => setReject(null) })}>{act.decide.isPending && <ButtonSpinner />}Reject</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default withRoleAccess(Budgets, { requiredRoles: ["head_of_finance_admin", "accountant", "centre_manager", "procurement_officer"] });
