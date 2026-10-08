import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useLibraryReservations, useUpdateReservation } from "@/hooks/useLibraryCentre";

export function ReservationsTab({ isStaff }: { isStaff: boolean }) {
  const { data } = useLibraryReservations();
  const update = useUpdateReservation();
  return (
    <div className="space-y-4">
      <Table>
        <TableHeader><TableRow><TableHead>Item</TableHead>{isStaff && <TableHead>Member</TableHead>}<TableHead>Reserved</TableHead><TableHead>Status</TableHead><TableHead>Hold expires</TableHead><TableHead /></TableRow></TableHeader>
        <TableBody>
          {data?.map((r) => (
            <TableRow key={r.id}>
              <TableCell className="font-medium">{r.library_items?.title}</TableCell>
              {isStaff && <TableCell>{r.library_members?.full_name}</TableCell>}
              <TableCell>{new Date(r.reserved_at).toLocaleDateString()}</TableCell>
              <TableCell><Badge variant={r.status === "ready" ? "default" : "secondary"}>{r.status}</Badge></TableCell>
              <TableCell>{r.expires_at ? new Date(r.expires_at).toLocaleDateString() : "-"}</TableCell>
              <TableCell>
                {(r.status === "waiting" || r.status === "ready") && (
                  <Button size="sm" variant="outline" onClick={() => update.mutate({ id: r.id, status: "cancelled" })}>Cancel</Button>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {!data?.length && <p className="text-sm text-muted-foreground text-center py-6">No reservations.</p>}
    </div>
  );
}
