import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus } from "lucide-react";
import { InterlibraryLoan, useInterlibraryLoans, useCreateInterlibraryLoan, useUpdateInterlibraryLoan } from "@/hooks/useLibraryCentre";

const STATUSES: InterlibraryLoan["status"][] = ["requested", "approved", "in_transit", "received", "returned", "declined", "cancelled"];

export function InterlibraryTab() {
  const { data } = useInterlibraryLoans();
  const create = useCreateInterlibraryLoan();
  const update = useUpdateInterlibraryLoan();
  const [open, setOpen] = useState(false);
  const empty = { direction: "incoming" as InterlibraryLoan["direction"], partner_library: "", title: "", author: "", due_date: "" };
  const [form, setForm] = useState(empty);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    await create.mutateAsync({ ...form, author: form.author || null, due_date: form.due_date || null });
    setForm(empty);
    setOpen(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />New request</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Interlibrary loan</DialogTitle></DialogHeader>
            <form onSubmit={submit} className="space-y-3">
              <div className="space-y-1"><Label>Direction</Label>
                <Select value={form.direction} onValueChange={(v) => setForm({ ...form, direction: v as InterlibraryLoan["direction"] })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="incoming">Borrow from another library</SelectItem>
                    <SelectItem value="outgoing">Lend to another library</SelectItem>
                  </SelectContent>
                </Select></div>
              <div className="space-y-1"><Label>Partner library</Label><Input required placeholder="e.g. UNAM, another VTC, community library" value={form.partner_library} onChange={(e) => setForm({ ...form, partner_library: e.target.value })} /></div>
              <div className="space-y-1"><Label>Title</Label><Input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
              <div className="space-y-1"><Label>Author</Label><Input value={form.author} onChange={(e) => setForm({ ...form, author: e.target.value })} /></div>
              <div className="space-y-1"><Label>Due date</Label><Input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} /></div>
              <Button type="submit" className="w-full" disabled={create.isPending}>Save</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>
      <Table>
        <TableHeader><TableRow><TableHead>Requested</TableHead><TableHead>Direction</TableHead><TableHead>Partner</TableHead><TableHead>Title</TableHead><TableHead>Due</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
        <TableBody>
          {data?.map((l) => (
            <TableRow key={l.id}>
              <TableCell>{l.requested_date}</TableCell>
              <TableCell><Badge variant="outline">{l.direction}</Badge></TableCell>
              <TableCell>{l.partner_library}</TableCell>
              <TableCell className="font-medium">{l.title}</TableCell>
              <TableCell>{l.due_date ?? "-"}</TableCell>
              <TableCell>
                <Select value={l.status} onValueChange={(status) => update.mutate({ id: l.id, status: status as InterlibraryLoan["status"], returned_date: status === "returned" ? new Date().toISOString().slice(0, 10) : undefined } as Partial<InterlibraryLoan> & { id: string })}>
                  <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                  <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s}>{s.replace("_", " ")}</SelectItem>)}</SelectContent>
                </Select>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {!data?.length && <p className="text-sm text-muted-foreground text-center py-6">No interlibrary requests.</p>}
    </div>
  );
}
