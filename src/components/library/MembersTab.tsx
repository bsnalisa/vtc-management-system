import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus } from "lucide-react";
import { LibraryMember, useLibraryMembers, useCreateLibraryMember, useUpdateLibraryMember } from "@/hooks/useLibraryCentre";

const TYPES: LibraryMember["member_type"][] = ["trainee", "trainer", "staff", "community", "partner_library"];

export function MembersTab() {
  const { data: members } = useLibraryMembers();
  const create = useCreateLibraryMember();
  const update = useUpdateLibraryMember();
  const [open, setOpen] = useState(false);
  const empty = { full_name: "", member_type: "community" as LibraryMember["member_type"], email: "", phone: "", id_number: "", barcode: "", rfid_tag: "", expiry_date: "" };
  const [form, setForm] = useState(empty);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    await create.mutateAsync({
      ...form,
      email: form.email || null, phone: form.phone || null, id_number: form.id_number || null,
      barcode: form.barcode || null, rfid_tag: form.rfid_tag || null, expiry_date: form.expiry_date || null,
    });
    setForm(empty);
    setOpen(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />Register member</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Register library member</DialogTitle></DialogHeader>
            <form onSubmit={submit} className="space-y-3">
              <div className="space-y-1"><Label>Full name</Label><Input required value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></div>
              <div className="space-y-1"><Label>Member type</Label>
                <Select value={form.member_type} onValueChange={(v) => setForm({ ...form, member_type: v as LibraryMember["member_type"] })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{TYPES.map((t) => <SelectItem key={t} value={t}>{t.replace("_", " ")}</SelectItem>)}</SelectContent>
                </Select></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1"><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
                <div className="space-y-1"><Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
                <div className="space-y-1"><Label>ID number</Label><Input value={form.id_number} onChange={(e) => setForm({ ...form, id_number: e.target.value })} /></div>
                <div className="space-y-1"><Label>Expiry date</Label><Input type="date" value={form.expiry_date} onChange={(e) => setForm({ ...form, expiry_date: e.target.value })} /></div>
                <div className="space-y-1"><Label>Card barcode</Label><Input value={form.barcode} onChange={(e) => setForm({ ...form, barcode: e.target.value })} /></div>
                <div className="space-y-1"><Label>Card RFID</Label><Input value={form.rfid_tag} onChange={(e) => setForm({ ...form, rfid_tag: e.target.value })} /></div>
              </div>
              <Button type="submit" className="w-full" disabled={create.isPending}>Register</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>
      <Table>
        <TableHeader><TableRow><TableHead>No.</TableHead><TableHead>Name</TableHead><TableHead>Type</TableHead><TableHead>Contact</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
        <TableBody>
          {members?.map((m) => (
            <TableRow key={m.id}>
              <TableCell className="font-mono">{m.member_number}</TableCell>
              <TableCell className="font-medium">{m.full_name}</TableCell>
              <TableCell><Badge variant="outline">{m.member_type.replace("_", " ")}</Badge></TableCell>
              <TableCell>{m.email ?? m.phone ?? "-"}</TableCell>
              <TableCell>
                <Select value={m.status} onValueChange={(status) => update.mutate({ id: m.id, status: status as LibraryMember["status"] })}>
                  <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                  <SelectContent>{["pending", "active", "suspended", "expired"].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {!members?.length && <p className="text-sm text-muted-foreground text-center py-6">No members registered.</p>}
    </div>
  );
}
