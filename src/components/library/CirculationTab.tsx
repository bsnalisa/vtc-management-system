import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useLibraryItems, useLibraryBorrowing, useCreateLibraryBorrowing, useReturnLibraryItem } from "@/hooks/useLibrary";
import { useLibraryMembers, useLibrarySettings, useBillLostItem, useProcessOverdue, DEFAULT_LIBRARY_SETTINGS } from "@/hooks/useLibraryCentre";

export function CirculationTab() {
  const [memberId, setMemberId] = useState("");
  const [scan, setScan] = useState("");
  const { data: members } = useLibraryMembers();
  const { data: items } = useLibraryItems();
  const { data: loans } = useLibraryBorrowing();
  const { data: settings } = useLibrarySettings();
  const borrow = useCreateLibraryBorrowing();
  const giveBack = useReturnLibraryItem();
  const bill = useBillLostItem();
  const sweep = useProcessOverdue();
  const cfg = settings ?? DEFAULT_LIBRARY_SETTINGS;

  const active = loans?.filter((l) => l.status !== "returned") ?? [];
  const memberName = (id: string) => members?.find((m) => m.id === id)?.full_name ?? "Unknown";

  const checkout = async (e: React.FormEvent) => {
    e.preventDefault();
    const member = members?.find((m) => m.id === memberId);
    if (!member) return toast.error("Select a member");
    if (member.status !== "active") return toast.error(`Member is ${member.status}`);
    if (member.expiry_date && member.expiry_date < new Date().toISOString().slice(0, 10)) return toast.error("Membership has expired");
    const code = scan.trim().toLowerCase();
    // Barcode / RFID / ISBN lookup
    const item = items?.find((i) => {
      const r = i as typeof i & { barcode?: string | null; rfid_tag?: string | null };
      return [r.barcode, r.rfid_tag, i.isbn].some((v) => v && v.toLowerCase() === code);
    });
    if (!item) return toast.error("No item matches that barcode, RFID tag or ISBN");
    if (item.available_copies < 1) return toast.error("No copies available. Place a reservation instead.");
    if (active.filter((l) => l.borrower_id === member.id).length >= cfg.max_active_loans)
      return toast.error(`Loan limit of ${cfg.max_active_loans} reached`);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const unpaid = await (supabase as any).from("library_fines").select("id").eq("borrower_id", member.id).eq("status", "pending").limit(1);
    if (unpaid.data?.length) return toast.error("Member has unpaid fines");
    const { data: { user } } = await supabase.auth.getUser();
    const due = new Date();
    due.setDate(due.getDate() + cfg.loan_days);
    await borrow.mutateAsync({
      library_item_id: item.id,
      borrower_id: member.id,
      borrower_type: member.member_type,
      due_date: due.toISOString().slice(0, 10),
      issued_by: user!.id,
    });
    setScan("");
  };

  const doReturn = async (id: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    giveBack.mutate({ id, returned_to: user!.id });
  };

  return (
    <div className="space-y-6">
      <form onSubmit={checkout} className="grid gap-3 md:grid-cols-[1fr_1fr_auto] items-end">
        <div className="space-y-1">
          <Label>Member</Label>
          <Select value={memberId} onValueChange={setMemberId}>
            <SelectTrigger><SelectValue placeholder="Select member" /></SelectTrigger>
            <SelectContent>{members?.filter((m) => m.status === "active").map((m) => <SelectItem key={m.id} value={m.id}>{m.full_name} ({m.member_number})</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>Scan item (barcode, RFID or ISBN)</Label>
          <Input value={scan} onChange={(e) => setScan(e.target.value)} placeholder="Scan to check out" autoFocus />
        </div>
        <Button type="submit" disabled={borrow.isPending || !scan}>Check out</Button>
      </form>

      <div className="flex justify-between items-center">
        <h3 className="font-semibold">Active loans ({active.length})</h3>
        <Button variant="outline" size="sm" disabled={sweep.isPending} onClick={() => sweep.mutate()}>Run overdue check &amp; send reminders</Button>
      </div>
      <Table>
        <TableHeader><TableRow><TableHead>Item</TableHead><TableHead>Member</TableHead><TableHead>Due</TableHead><TableHead>Status</TableHead><TableHead /></TableRow></TableHeader>
        <TableBody>
          {active.map((l) => (
            <TableRow key={l.id}>
              <TableCell className="font-medium">{l.library_items?.title}</TableCell>
              <TableCell>{memberName(l.borrower_id)}</TableCell>
              <TableCell>{l.due_date}</TableCell>
              <TableCell><Badge variant={l.status === "overdue" ? "destructive" : "secondary"}>{l.status}</Badge></TableCell>
              <TableCell className="space-x-2 text-right">
                <Button size="sm" onClick={() => doReturn(l.id)} disabled={giveBack.isPending}>Return</Button>
                <Button size="sm" variant="outline" disabled={bill.isPending}
                  onClick={() => {
                    const amount = Number(window.prompt("Replacement charge for lost item:", "0"));
                    if (amount > 0) bill.mutate({ borrowing_id: l.id, borrower_id: l.borrower_id, amount, fine_type: "lost" });
                  }}>Lost</Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {!active.length && <p className="text-sm text-muted-foreground text-center py-4">No active loans.</p>}
    </div>
  );
}
