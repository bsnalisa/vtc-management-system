import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { LoadingIndicator } from "@/components/ui/loading-spinner";
import { useHostelRequestsAdmin, useDecideHostelRequest, type HostelRoomRequest } from "@/hooks/useHostelRequests";

const STATUS_LABEL: Record<string, string> = { requested: "Pending", approved: "Approved", rejected: "Declined", cancelled: "Cancelled" };
const STATUS_STYLE: Record<string, string> = {
  requested: "bg-yellow-100 text-yellow-800", approved: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-800", cancelled: "bg-muted text-muted-foreground",
};

export function RoomRequestsTab() {
  const { data = [], isLoading, error } = useHostelRequestsAdmin();
  const decide = useDecideHostelRequest();
  const [filter, setFilter] = useState("requested");
  const [declining, setDeclining] = useState<HostelRoomRequest | null>(null);
  const [reason, setReason] = useState("");

  const rows = filter === "all" ? data : data.filter((r) => r.status === filter);

  const closeDialog = () => { setDeclining(null); setReason(""); };

  return (
    <div className="space-y-4">
      <div className="max-w-xs space-y-2">
        <Label>Status</Label>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            {Object.entries(STATUS_LABEL).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      {isLoading && <LoadingIndicator className="h-6 w-6 text-muted-foreground" />}
      {error && <p className="text-sm text-destructive">{(error as Error).message}</p>}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Trainee</TableHead><TableHead>Gender</TableHead><TableHead>Room</TableHead>
            <TableHead>Note</TableHead><TableHead>Date</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 && !isLoading && (
            <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">No requests</TableCell></TableRow>
          )}
          {rows.map((r) => (
            <TableRow key={r.id}>
              <TableCell>
                {r.trainees ? `${r.trainees.first_name} ${r.trainees.last_name}` : "Unknown"}
                <div className="text-xs text-muted-foreground">{r.trainees?.trainee_id}</div>
              </TableCell>
              <TableCell className="capitalize">{r.trainees?.gender ?? "-"}</TableCell>
              <TableCell>{r.hostel_rooms?.hostel_buildings?.building_name} - {r.hostel_rooms?.room_number}</TableCell>
              <TableCell className="max-w-[16rem]">
                {r.note || "-"}
                {r.decision_notes && <div className="text-xs text-muted-foreground">Decision: {r.decision_notes}</div>}
              </TableCell>
              <TableCell>{new Date(r.created_at).toLocaleDateString("en-ZA")}</TableCell>
              <TableCell><Badge className={STATUS_STYLE[r.status]}>{STATUS_LABEL[r.status]}</Badge></TableCell>
              <TableCell className="text-right space-x-2 whitespace-nowrap">
                {r.status === "requested" && (
                  <>
                    <Button size="sm" disabled={decide.isPending} onClick={() => decide.mutate({ id: r.id, approve: true })}>Approve</Button>
                    <Button size="sm" variant="outline" disabled={decide.isPending} onClick={() => setDeclining(r)}>Decline</Button>
                  </>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Dialog open={!!declining} onOpenChange={(o) => { if (!o) closeDialog(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Decline room request</DialogTitle>
            <DialogDescription>The reason is sent to the trainee.</DialogDescription>
          </DialogHeader>
          <Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (required)" />
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Back</Button>
            <Button variant="destructive" disabled={!reason.trim() || decide.isPending}
              onClick={() => declining && decide.mutate({ id: declining.id, approve: false, notes: reason }, { onSuccess: closeDialog })}>
              Decline request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
