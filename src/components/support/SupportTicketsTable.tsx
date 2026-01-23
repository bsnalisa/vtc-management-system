import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SupportTicket, useUpdateSupportTicket } from "@/hooks/useSupportTickets";
import { format } from "date-fns";
import { Eye } from "lucide-react";

interface SupportTicketsTableProps {
  tickets: SupportTicket[];
  isAdmin?: boolean;
}

export function SupportTicketsTable({ tickets, isAdmin = false }: SupportTicketsTableProps) {
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [status, setStatus] = useState<string>("");
  const [resolutionNotes, setResolutionNotes] = useState("");
  
  const updateTicket = useUpdateSupportTicket();

  const handleViewTicket = (ticket: SupportTicket) => {
    setSelectedTicket(ticket);
    setStatus(ticket.status);
    setResolutionNotes(ticket.resolution_notes || "");
  };

  const handleUpdateTicket = async () => {
    if (!selectedTicket) return;

    await updateTicket.mutateAsync({
      id: selectedTicket.id,
      data: {
        status: status as any,
        resolution_notes: resolutionNotes || undefined,
      },
    });

    setSelectedTicket(null);
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      open: "destructive",
      in_progress: "secondary",
      resolved: "default",
      closed: "outline",
    };
    return <Badge variant={variants[status] || "default"}>{status.replace("_", " ")}</Badge>;
  };

  const getPriorityBadge = (priority: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      low: "outline",
      medium: "secondary",
      high: "default",
      urgent: "destructive",
    };
    return <Badge variant={variants[priority] || "default"}>{priority}</Badge>;
  };

  return (
    <>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Subject</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Priority</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Created</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tickets.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  No support tickets found
                </TableCell>
              </TableRow>
            ) : (
              tickets.map((ticket) => (
                <TableRow key={ticket.id}>
                  <TableCell className="font-medium">{ticket.subject}</TableCell>
                  <TableCell>{ticket.category || "-"}</TableCell>
                  <TableCell>{getPriorityBadge(ticket.priority)}</TableCell>
                  <TableCell>{getStatusBadge(ticket.status)}</TableCell>
                  <TableCell>{format(new Date(ticket.created_at), "MMM dd, yyyy")}</TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleViewTicket(ticket)}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* View/Edit Ticket Dialog */}
      <Dialog open={!!selectedTicket} onOpenChange={(open) => !open && setSelectedTicket(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Ticket Details</DialogTitle>
          </DialogHeader>
          {selectedTicket && (
            <div className="space-y-4">
              <div>
                <Label>Subject</Label>
                <p className="text-sm mt-1">{selectedTicket.subject}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Priority</Label>
                  <p className="text-sm mt-1">{getPriorityBadge(selectedTicket.priority)}</p>
                </div>
                <div>
                  <Label>Category</Label>
                  <p className="text-sm mt-1">{selectedTicket.category || "-"}</p>
                </div>
              </div>

              <div>
                <Label>Description</Label>
                <p className="text-sm mt-1 whitespace-pre-wrap">{selectedTicket.description}</p>
              </div>

              {isAdmin && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="status">Status</Label>
                    <Select value={status} onValueChange={setStatus}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="open">Open</SelectItem>
                        <SelectItem value="in_progress">In Progress</SelectItem>
                        <SelectItem value="resolved">Resolved</SelectItem>
                        <SelectItem value="closed">Closed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="notes">Resolution Notes</Label>
                    <Textarea
                      id="notes"
                      value={resolutionNotes}
                      onChange={(e) => setResolutionNotes(e.target.value)}
                      rows={4}
                      placeholder="Add notes about the resolution"
                    />
                  </div>

                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setSelectedTicket(null)}>
                      Cancel
                    </Button>
                    <Button onClick={handleUpdateTicket} disabled={updateTicket.isPending}>
                      Update Ticket
                    </Button>
                  </div>
                </>
              )}

              {selectedTicket.resolution_notes && !isAdmin && (
                <div>
                  <Label>Resolution Notes</Label>
                  <p className="text-sm mt-1 whitespace-pre-wrap">{selectedTicket.resolution_notes}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
