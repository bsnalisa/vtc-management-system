import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";
import { Eye } from "lucide-react";
import { SupportTicket, isAwaitingResponse, usePeopleNames } from "@/hooks/useSupportTickets";
import { EscalationBadge, PriorityBadge, StatusBadge } from "./TicketThread";

interface Props {
  tickets: (SupportTicket & { organizations?: { name: string } | null })[];
  /** Show who raised each ticket and who it is assigned to (staff views). */
  staffView?: boolean;
  showCentre?: boolean;
  onOpen: (t: SupportTicket) => void;
  empty?: string;
}

export function SupportTicketsTable({ tickets, staffView = false, showCentre = false, onOpen, empty = "No tickets here" }: Props) {
  const { data: names } = usePeopleNames(tickets.flatMap((t) => [t.user_id, t.assigned_to ?? ""]));
  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Ticket</TableHead>
            {showCentre && <TableHead>Centre</TableHead>}
            {staffView && <TableHead>Raised by</TableHead>}
            <TableHead>Priority</TableHead>
            <TableHead>Status</TableHead>
            {staffView && <TableHead>Assigned to</TableHead>}
            <TableHead>Updated</TableHead>
            <TableHead className="text-right">Open</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {tickets.length === 0 ? (
            <TableRow><TableCell colSpan={8} className="py-8 text-center text-muted-foreground">{empty}</TableCell></TableRow>
          ) : tickets.map((t) => (
            <TableRow key={t.id} className="cursor-pointer" onClick={() => onOpen(t)}>
              <TableCell className="whitespace-normal">
                <div className="font-medium">{t.subject}</div>
                <div className="text-xs text-muted-foreground">{t.reference ?? ""}{t.category ? ` · ${t.category}` : ""}</div>
              </TableCell>
              {showCentre && <TableCell>{t.organizations?.name ?? "-"}</TableCell>}
              {staffView && <TableCell>{names?.[t.user_id] ?? "…"}</TableCell>}
              <TableCell><PriorityBadge priority={t.priority} /></TableCell>
              <TableCell>
                <div className="flex flex-wrap items-center gap-1">
                  <StatusBadge status={t.status} />
                  <EscalationBadge status={t.escalation_status} />
                  {staffView && isAwaitingResponse(t) && <Badge variant="outline">Awaiting reply</Badge>}
                </div>
              </TableCell>
              {staffView && <TableCell>{t.assigned_to ? names?.[t.assigned_to] ?? "…" : <span className="text-muted-foreground">Unassigned</span>}</TableCell>}
              <TableCell className="text-sm text-muted-foreground">{formatDistanceToNow(new Date(t.updated_at), { addSuffix: true })}</TableCell>
              <TableCell className="text-right"><Button size="sm" variant="ghost" aria-label={`Open ${t.subject}`}><Eye className="h-4 w-4" /></Button></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
