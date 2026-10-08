import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { LoadingIndicator } from "@/components/ui/loading-spinner";
import { useHostelComplaints, useUpdateHostelComplaint, type HostelComplaint } from "@/hooks/useHostelRequests";

const STATUSES: HostelComplaint["status"][] = ["open", "in_progress", "resolved", "closed"];
const LABEL: Record<string, string> = { open: "Open", in_progress: "In progress", resolved: "Resolved", closed: "Closed" };

export function HostelComplaintsTab() {
  const { data = [], isLoading, error } = useHostelComplaints();
  const update = useUpdateHostelComplaint();
  const [editing, setEditing] = useState<HostelComplaint | null>(null);
  const [status, setStatus] = useState<HostelComplaint["status"]>("open");
  const [action, setAction] = useState("");

  const edit = (c: HostelComplaint) => { setEditing(c); setStatus(c.status); setAction(c.action_taken ?? ""); };

  return (
    <div className="space-y-4">
      {isLoading && <LoadingIndicator className="h-6 w-6 text-muted-foreground" />}
      {error && <p className="text-sm text-destructive">{(error as Error).message}</p>}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Complaint</TableHead><TableHead>Trainee</TableHead><TableHead>Date</TableHead>
            <TableHead>Status</TableHead><TableHead>Action taken</TableHead><TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.length === 0 && !isLoading && (
            <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">No hostel complaints</TableCell></TableRow>
          )}
          {data.map((c) => (
            <TableRow key={c.id}>
              <TableCell className="max-w-[20rem]">
                <div className="font-medium">{c.title}</div>
                <div className="text-sm text-muted-foreground">{c.description}</div>
              </TableCell>
              <TableCell>
                {c.trainees ? `${c.trainees.first_name} ${c.trainees.last_name}` : "Unknown"}
                <div className="text-xs text-muted-foreground">{c.trainees?.trainee_id}</div>
              </TableCell>
              <TableCell>{new Date(c.record_date).toLocaleDateString("en-ZA")}</TableCell>
              <TableCell><Badge variant="outline">{LABEL[c.status]}</Badge></TableCell>
              <TableCell className="max-w-[14rem]">{c.action_taken || "-"}</TableCell>
              <TableCell className="text-right"><Button size="sm" variant="outline" onClick={() => edit(c)}>Update</Button></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Dialog open={!!editing} onOpenChange={(o) => { if (!o) setEditing(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing?.title}</DialogTitle>
            <DialogDescription>Set the status and record what was done.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Status</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as HostelComplaint["status"])}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s}>{LABEL[s]}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Action taken</Label>
            <Textarea rows={4} value={action} onChange={(e) => setAction(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            <Button disabled={update.isPending}
              onClick={() => editing && update.mutate({ id: editing.id, status, action_taken: action.trim() || null }, { onSuccess: () => setEditing(null) })}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
