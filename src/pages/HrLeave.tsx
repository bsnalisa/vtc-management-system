import { useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { DashboardLayout } from "@/components/DashboardLayout";
import { withRoleAccess } from "@/components/withRoleAccess";
import { LeaveTypesPanel } from "@/components/hr/LeaveTypesPanel";
import { LeaveCalendar } from "@/components/hr/LeaveCalendar";
import { LeaveDecisionDialog } from "@/components/hr/LeaveDecisionDialog";
import { useRoleNavigation } from "@/hooks/useRoleNavigation";
import { LeaveRequest, fmtDate, labelOf, useAllLeaveRequests, useStaffDirectory } from "@/hooks/useHr";

const variant = (s: string): "default" | "secondary" | "destructive" | "outline" =>
  s === "approved" ? "default" : s === "rejected" ? "destructive" : s === "pending" ? "secondary" : "outline";

const HrLeave = () => {
  const { navItems, groupLabel } = useRoleNavigation();
  const requests = useAllLeaveRequests();
  const directory = useStaffDirectory();
  const [selected, setSelected] = useState<LeaveRequest | null>(null);
  const [status, setStatus] = useState("all");
  const [person, setPerson] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const names = useMemo(() => new Map((directory.data ?? []).map((s) => [s.user_id, s.full_name ?? s.email ?? "Unknown"])), [directory.data]);
  const all = requests.data ?? [];
  const pending = all.filter((r) => r.status === "pending").sort((a, b) => a.start_date.localeCompare(b.start_date));
  const filtered = useMemo(() => {
    const q = person.trim().toLowerCase();
    return all.filter((r) =>
      (status === "all" || r.status === status) && (!q || (names.get(r.user_id) ?? "").toLowerCase().includes(q)) &&
      (!from || r.end_date >= from) && (!to || r.start_date <= to));
  }, [all, status, person, from, to, names]);

  const table = (rows: LeaveRequest[], decide: boolean) => (
    <Table>
      <TableHeader><TableRow><TableHead>Person</TableHead><TableHead>Type</TableHead><TableHead>From</TableHead><TableHead>To</TableHead><TableHead>Days</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
      <TableBody>
        {rows.map((r) => (
          <TableRow key={r.id}>
            <TableCell>{names.get(r.user_id) ?? "Unknown"}</TableCell>
            <TableCell>{r.leave_types?.name ?? "-"}</TableCell>
            <TableCell>{fmtDate(r.start_date)}</TableCell>
            <TableCell>{fmtDate(r.end_date)}</TableCell>
            <TableCell>{r.days}</TableCell>
            <TableCell><Badge variant={variant(r.status)}>{labelOf(r.status)}</Badge></TableCell>
            <TableCell className="text-right"><Button size="sm" variant="outline" onClick={() => setSelected(r)}>{decide && r.status === "pending" ? "Review" : "View"}</Button></TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
  const state = requests.isLoading ? <LoadingSpinner text="Loading leave requests" /> :
    requests.error ? <p role="alert" className="text-sm text-destructive">Could not load leave requests: {(requests.error as Error).message}</p> : null;

  return (
    <DashboardLayout title="Leave Management" subtitle="Approve requests, manage leave types and see who is away" navItems={navItems} groupLabel={groupLabel}>
      <Tabs defaultValue="pending" className="space-y-4">
        <TabsList>
          <TabsTrigger value="pending">Pending approvals{pending.length ? ` (${pending.length})` : ""}</TabsTrigger>
          <TabsTrigger value="all">All requests</TabsTrigger>
          <TabsTrigger value="types">Leave types</TabsTrigger>
          <TabsTrigger value="calendar">Calendar</TabsTrigger>
        </TabsList>
        <TabsContent value="pending">
          <Card className="border-0 shadow-md">
            <CardHeader><CardTitle>Pending approvals</CardTitle><CardDescription>Approve, or decline with a reason the employee will see.</CardDescription></CardHeader>
            <CardContent>
              {state ?? table(pending, true)}
              {!state && !pending.length && <p className="text-sm text-muted-foreground text-center py-8">No leave requests are waiting for a decision.</p>}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="all">
          <Card className="border-0 shadow-md">
            <CardHeader><CardTitle>All requests</CardTitle><CardDescription>{filtered.length} shown</CardDescription></CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger className="sm:w-[160px]"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="all">All statuses</SelectItem>{["pending", "approved", "rejected", "cancelled"].map((s) => <SelectItem key={s} value={s}>{labelOf(s)}</SelectItem>)}</SelectContent>
                </Select>
                <Input className="sm:max-w-xs" placeholder="Search person" value={person} onChange={(e) => setPerson(e.target.value)} />
                <Input type="date" aria-label="Leave ends on or after" value={from} onChange={(e) => setFrom(e.target.value)} className="sm:w-[160px]" />
                <Input type="date" aria-label="Leave starts on or before" value={to} onChange={(e) => setTo(e.target.value)} className="sm:w-[160px]" />
              </div>
              {state ?? table(filtered, false)}
              {!state && !filtered.length && <p className="text-sm text-muted-foreground text-center py-8">No leave requests match these filters.</p>}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="types"><LeaveTypesPanel /></TabsContent>
        <TabsContent value="calendar">{state ?? <LeaveCalendar requests={all} names={names} />}</TabsContent>
      </Tabs>
      <LeaveDecisionDialog request={selected?.status === "pending" ? selected : null} name={selected ? names.get(selected.user_id) ?? "Unknown" : ""} onClose={() => setSelected(null)} />
      <ReadOnlyDetail request={selected?.status !== "pending" ? selected : null} name={selected ? names.get(selected.user_id) ?? "Unknown" : ""} onClose={() => setSelected(null)} />
    </DashboardLayout>
  );
};

function ReadOnlyDetail({ request, name, onClose }: { request: LeaveRequest | null; name: string; onClose: () => void }) {
  return (
    <Dialog open={!!request} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>{name}</DialogTitle><DialogDescription>{request?.leave_types?.name} - {fmtDate(request?.start_date)} to {fmtDate(request?.end_date)} ({request?.days} working days) - {labelOf(request?.status)}</DialogDescription></DialogHeader>
        <p className="text-sm"><span className="font-medium">Reason:</span> {request?.reason || "None given"}</p>
        {request?.decision_notes && <p className="text-sm"><span className="font-medium">HR notes:</span> {request.decision_notes}</p>}
      </DialogContent>
    </Dialog>
  );
}

export default withRoleAccess(HrLeave, { requiredRoles: ["hr_officer", "admin", "organization_admin"] });
