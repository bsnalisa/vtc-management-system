import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useLibraryFines, usePayLibraryFine, useWaiveLibraryFine } from "@/hooks/useLibrary";
import { useLibraryMembers } from "@/hooks/useLibraryCentre";

export function FinesTab() {
  const { data: fines } = useLibraryFines();
  const { data: members } = useLibraryMembers();
  const pay = usePayLibraryFine();
  const waive = useWaiveLibraryFine();
  const name = (id: string) => members?.find((m) => m.id === id)?.full_name ?? "Unknown";

  return (
    <Table>
      <TableHeader><TableRow><TableHead>Member</TableHead><TableHead>Item</TableHead><TableHead>Reason</TableHead><TableHead>Charged</TableHead><TableHead>Paid</TableHead><TableHead>Status</TableHead><TableHead /></TableRow></TableHeader>
      <TableBody>
        {fines?.map((f) => {
          const row = f as typeof f & { fine_type?: string; library_borrowing?: { library_items?: { title: string } } };
          return (
            <TableRow key={f.id}>
              <TableCell>{name(f.borrower_id)}</TableCell>
              <TableCell>{row.library_borrowing?.library_items?.title ?? "-"}</TableCell>
              <TableCell><Badge variant="outline">{row.fine_type ?? "overdue"}{f.days_overdue ? ` (${f.days_overdue}d)` : ""}</Badge></TableCell>
              <TableCell>{Number(f.fine_amount).toFixed(2)}</TableCell>
              <TableCell>{Number(f.amount_paid).toFixed(2)}</TableCell>
              <TableCell><Badge variant={f.status === "pending" ? "destructive" : "secondary"}>{f.status}</Badge></TableCell>
              <TableCell className="space-x-2 text-right">
                {f.status === "pending" && (
                  <>
                    <Button size="sm" disabled={pay.isPending} onClick={() => {
                      const amt = Number(window.prompt("Payment amount:", String(Number(f.fine_amount) - Number(f.amount_paid))));
                      if (amt > 0) pay.mutate({ id: f.id, amount: amt });
                    }}>Record payment</Button>
                    <Button size="sm" variant="outline" disabled={waive.isPending} onClick={async () => {
                      const reason = window.prompt("Reason for waiving:");
                      if (!reason) return;
                      const { data: { user } } = await supabase.auth.getUser();
                      waive.mutate({ id: f.id, waived_by: user!.id, waive_reason: reason });
                    }}>Waive</Button>
                  </>
                )}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
