import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Search } from "lucide-react";
import { useLibraryItems, useCreateLibraryItem, useLibraryCategories } from "@/hooks/useLibrary";
import { useCreateReservation } from "@/hooks/useLibraryCentre";

type ItemType = "book" | "journal" | "digital" | "magazine" | "reference";

function AddItemDialog() {
  const [open, setOpen] = useState(false);
  const empty = { title: "", author: "", isbn: "", barcode: "", rfid_tag: "", item_type: "book" as ItemType, total_copies: 1, location: "", subject: "", category_id: "" };
  const [form, setForm] = useState(empty);
  const { data: categories } = useLibraryCategories();
  const create = useCreateLibraryItem();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    await create.mutateAsync({
      title: form.title,
      author: form.author || null,
      isbn: form.isbn || null,
      item_type: form.item_type,
      total_copies: form.total_copies,
      available_copies: form.total_copies,
      location: form.location || null,
      subject: form.subject || null,
      category_id: form.category_id || null,
      // barcode / rfid_tag post-date the generated types
      ...({ barcode: form.barcode || null, rfid_tag: form.rfid_tag || null } as object),
    });
    setForm(empty);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />Add item</Button></DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Add catalogue item</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-1"><Label>Title</Label><Input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><Label>Author</Label><Input value={form.author} onChange={(e) => setForm({ ...form, author: e.target.value })} /></div>
            <div className="space-y-1"><Label>ISBN</Label><Input value={form.isbn} onChange={(e) => setForm({ ...form, isbn: e.target.value })} /></div>
            <div className="space-y-1"><Label>Barcode</Label><Input value={form.barcode} onChange={(e) => setForm({ ...form, barcode: e.target.value })} placeholder="Scan or type" /></div>
            <div className="space-y-1"><Label>RFID tag</Label><Input value={form.rfid_tag} onChange={(e) => setForm({ ...form, rfid_tag: e.target.value })} placeholder="Scan or type" /></div>
            <div className="space-y-1"><Label>Type</Label>
              <Select value={form.item_type} onValueChange={(v) => setForm({ ...form, item_type: v as ItemType })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{["book", "journal", "digital", "magazine", "reference"].map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select></div>
            <div className="space-y-1"><Label>Copies</Label><Input type="number" min={1} value={form.total_copies} onChange={(e) => setForm({ ...form, total_copies: Math.max(1, Number(e.target.value)) })} /></div>
            <div className="space-y-1"><Label>Shelf location</Label><Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} /></div>
            <div className="space-y-1"><Label>Subject</Label><Input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} /></div>
          </div>
          <div className="space-y-1"><Label>Category</Label>
            <Select value={form.category_id} onValueChange={(v) => setForm({ ...form, category_id: v })}>
              <SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
              <SelectContent>{categories?.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
            </Select></div>
          <Button type="submit" className="w-full" disabled={create.isPending}>Save</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function CatalogueTab({ isStaff, memberId }: { isStaff: boolean; memberId?: string }) {
  const [search, setSearch] = useState("");
  const { data: items } = useLibraryItems({ search: search || undefined });
  const reserve = useCreateReservation();

  return (
    <div className="space-y-4">
      <div className="flex gap-2 justify-between">
        <div className="relative max-w-sm w-full">
          <Search className="h-4 w-4 absolute left-3 top-3 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search title, author or subject" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        {isStaff && <AddItemDialog />}
      </div>
      <Table>
        <TableHeader>
          <TableRow><TableHead>Title</TableHead><TableHead>Author</TableHead><TableHead>Type</TableHead><TableHead>Location</TableHead><TableHead>Available</TableHead><TableHead /></TableRow>
        </TableHeader>
        <TableBody>
          {items?.map((i) => (
            <TableRow key={i.id}>
              <TableCell className="font-medium">{i.title}</TableCell>
              <TableCell>{i.author ?? "-"}</TableCell>
              <TableCell><Badge variant="outline">{i.item_type}</Badge></TableCell>
              <TableCell>{i.location ?? "-"}</TableCell>
              <TableCell>{i.available_copies}/{i.total_copies}</TableCell>
              <TableCell>
                {i.available_copies === 0 && memberId && (
                  <Button size="sm" variant="outline" disabled={reserve.isPending}
                    onClick={() => reserve.mutate({ library_item_id: i.id, member_id: memberId })}>Reserve</Button>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {!items?.length && <p className="text-sm text-muted-foreground text-center py-6">No items found.</p>}
    </div>
  );
}
