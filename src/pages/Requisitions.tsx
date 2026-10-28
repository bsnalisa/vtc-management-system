import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Plus } from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useRoleNavigation } from "@/hooks/useRoleNavigation";
import { useUserRole } from "@/hooks/useUserRole";
import { useRequisitionList, type RequisitionScope } from "@/hooks/useRequisitions";
import { RequisitionStatusBadge } from "@/components/requisitions/RequisitionStatusBadge";
import { REQUISITION_STATUS } from "@/components/requisitions/status";

const date = (d: string | null) => (d ? new Date(d).toLocaleDateString(undefined, { dateStyle: "medium" }) : "-");

function List({ scope, emptyText, statusFilter = false }: { scope: RequisitionScope; emptyText: string; statusFilter?: boolean }) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(0);
  const [q, setQ] = useState("");
  useEffect(() => { const t = setTimeout(() => { setQ(search); setPage(0); }, 300); return () => clearTimeout(t); }, [search]);
  const { data, isLoading, error } = useRequisitionList(scope, { search: q, status, page });
  const rows = data?.rows ?? [];
  const pages = Math.max(1, Math.ceil((data?.total ?? 0) / 25));
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Input className="max-w-xs" placeholder="Search by reference or purpose" aria-label="Search requisitions" value={search} onChange={(e) => setSearch(e.target.value)} />
        {statusFilter && (
          <select aria-label="Filter by status" className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={status} onChange={(e) => { setStatus(e.target.value); setPage(0); }}>
            <option value="">All statuses</option>
            {Object.entries(REQUISITION_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        )}
      </div>
      {error && <Alert variant="destructive"><AlertDescription>{(error as Error).message}</AlertDescription></Alert>}
      {isLoading ? <LoadingSpinner text="Loading..." className="py-6" /> : rows.length === 0 ? <p className="py-6 text-sm text-muted-foreground">{emptyText}</p> : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader><TableRow><TableHead>Reference</TableHead><TableHead>Purpose</TableHead><TableHead>Requester</TableHead><TableHead>Status</TableHead><TableHead>Next</TableHead><TableHead>Submitted</TableHead><TableHead /></TableRow></TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.requisition_number.startsWith("DRAFT-") ? "Draft" : r.requisition_number}</TableCell>
                  <TableCell className="max-w-xs whitespace-normal"><div className="line-clamp-2">{r.purpose ?? <span className="text-muted-foreground">No purpose yet</span>}</div><div className="text-xs text-muted-foreground">{r.item_count} item{r.item_count === 1 ? "" : "s"}{r.department ? ` · ${r.department}` : ""}</div></TableCell>
                  <TableCell>{r.requester_name ?? "-"}</TableCell>
                  <TableCell><RequisitionStatusBadge status={r.status} /></TableCell>
                  <TableCell className="max-w-[16rem] whitespace-normal text-sm">{r.next_action ?? "-"}</TableCell>
                  <TableCell>{date(r.submitted_at)}</TableCell>
                  <TableCell className="text-right"><Button asChild size="sm" variant={scope === "to_decide" ? "default" : "outline"}><Link to={`/requisitions/${r.id}`}>{scope === "to_decide" ? "Review" : "Open"}</Link></Button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      {pages > 1 && (
        <div className="flex items-center gap-2 text-sm">
          <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Previous</Button>
          <span>Page {page + 1} of {pages}</span>
          <Button size="sm" variant="outline" disabled={page + 1 >= pages} onClick={() => setPage((p) => p + 1)}>Next</Button>
        </div>
      )}
    </div>
  );
}

// Requester's own requisitions, the ones waiting for their decision, and (for the roles that need them) procurement and centre-wide views
export default function Requisitions() {
  const { navItems, groupLabel } = useRoleNavigation();
  const { role } = useUserRole();
  const [params, setParams] = useSearchParams();
  const showProcurement = role === "procurement_officer";
  const showCentre = role === "centre_manager";
  const showReceiving = role === "stock_control_officer" || role === "asset_maintenance_coordinator";
  const canRequest = role !== "trainee";
  const tab = params.get("tab") ?? (showProcurement ? "procurement" : showReceiving ? "receiving" : "mine");
  const decideCount = useRequisitionList("to_decide", { pageSize: 1 }).data?.total ?? 0;

  return (
    <DashboardLayout title="Requisitions" subtitle="Internal quotation requests, approvals and procurement" navItems={navItems} groupLabel={groupLabel}>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-muted-foreground">Every requisition follows the same approval order: line supervisor, Accountant, Head of Finance and Administration, Centre Manager.</p>
          {canRequest && <Button asChild><Link to="/requisitions/new"><Plus className="mr-1 h-4 w-4" />New requisition</Link></Button>}
        </div>
        <Tabs value={tab} onValueChange={(t) => setParams({ tab: t })}>
          <TabsList className="h-auto flex-wrap justify-start">
            <TabsTrigger value="mine">My requisitions</TabsTrigger>
            <TabsTrigger value="to_decide">Awaiting my decision{decideCount > 0 ? ` (${decideCount})` : ""}</TabsTrigger>
            {showProcurement && <TabsTrigger value="procurement">Approved: procurement</TabsTrigger>}
            {showReceiving && <TabsTrigger value="receiving">Deliveries to receive</TabsTrigger>}
            {showCentre && <TabsTrigger value="centre">All at this centre</TabsTrigger>}
          </TabsList>
          <TabsContent value="mine"><Card><CardHeader><CardTitle>My requisitions</CardTitle><CardDescription>Drafts, requests in the approval process, returned and completed ones.</CardDescription></CardHeader>
            <CardContent><List scope="mine" statusFilter emptyText="You have not made a requisition yet. Choose New requisition to start one." /></CardContent></Card></TabsContent>
          <TabsContent value="to_decide"><Card><CardHeader><CardTitle>Awaiting my decision</CardTitle><CardDescription>Requisitions whose current stage is assigned to you or delegated to you.</CardDescription></CardHeader>
            <CardContent><List scope="to_decide" emptyText="Nothing is waiting for your decision." /></CardContent></Card></TabsContent>
          {showProcurement && <TabsContent value="procurement"><Card><CardHeader><CardTitle>Approved requisitions</CardTitle><CardDescription>Only fully approved requisitions reach procurement. Open one to record the supplier, order, deliveries and closure.</CardDescription></CardHeader>
            <CardContent><List scope="procurement" statusFilter emptyText="No approved requisitions are waiting for procurement." /></CardContent></Card></TabsContent>}
          {showReceiving && <TabsContent value="receiving"><Card><CardHeader><CardTitle>Deliveries to receive</CardTitle><CardDescription>Ordered requisitions waiting for goods, partly delivered, or fully received.</CardDescription></CardHeader>
            <CardContent><List scope="receiving" statusFilter emptyText="Nothing is waiting to be received." /></CardContent></Card></TabsContent>}
          {showCentre && <TabsContent value="centre"><Card><CardHeader><CardTitle>Requisitions at this centre</CardTitle></CardHeader>
            <CardContent><List scope="centre" statusFilter emptyText="No requisitions have been submitted yet." /></CardContent></Card></TabsContent>}
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
