import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useLibraryItems, useLibraryBorrowing, useLibraryFines } from "@/hooks/useLibrary";
import {
  DEFAULT_LIBRARY_SETTINGS, LibrarySettings, useLibrarySettings, useSaveLibrarySettings,
  useLibraryMembers, useSendLibraryAnnouncement,
} from "@/hooks/useLibraryCentre";
import { exportToCSV } from "@/lib/exportUtils";

export function ReportsSettingsTab() {
  const { data: items } = useLibraryItems();
  const { data: loans } = useLibraryBorrowing();
  const { data: fines } = useLibraryFines();
  const { data: members } = useLibraryMembers();
  const { data: settings } = useLibrarySettings();
  const save = useSaveLibrarySettings();
  const announce = useSendLibraryAnnouncement();
  const [form, setForm] = useState<LibrarySettings>(DEFAULT_LIBRARY_SETTINGS);
  const [ann, setAnn] = useState({ title: "", message: "" });
  useEffect(() => { if (settings) setForm(settings); }, [settings]);

  const outstanding = (fines ?? []).filter((f) => f.status === "pending")
    .reduce((sum, f) => sum + Number(f.fine_amount) - Number(f.amount_paid), 0);
  const stats = [
    { label: "Titles", value: items?.length ?? 0 },
    { label: "Copies", value: items?.reduce((s, i) => s + i.total_copies, 0) ?? 0 },
    { label: "Members", value: members?.length ?? 0 },
    { label: "Active loans", value: loans?.filter((l) => l.status !== "returned").length ?? 0 },
    { label: "Overdue", value: loans?.filter((l) => l.status === "overdue").length ?? 0 },
    { label: "Fines outstanding", value: outstanding.toFixed(2) },
  ];

  const counts = new Map<string, number>();
  loans?.forEach((l) => counts.set(l.library_items?.title ?? "Unknown", (counts.get(l.library_items?.title ?? "Unknown") ?? 0) + 1));
  const popular = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);

  const num = (k: keyof LibrarySettings) => (
    <div className="space-y-1">
      <Label>{k.replace(/_/g, " ")}</Label>
      <Input type="number" min={0} step={k === "fine_per_day" ? 0.5 : 1} value={form[k]} onChange={(e) => setForm({ ...form, [k]: Number(e.target.value) })} />
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {stats.map((s) => (
          <Card key={s.label}><CardContent className="p-4"><div className="text-2xl font-bold">{s.value}</div><div className="text-xs text-muted-foreground">{s.label}</div></CardContent></Card>
        ))}
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Most borrowed titles</CardTitle>
          <div className="space-x-2">
            <Button size="sm" variant="outline" onClick={() => exportToCSV(loans?.map((l) => ({ item: l.library_items?.title, borrower: l.borrower_id, borrowed: l.borrow_date, due: l.due_date, returned: l.return_date, status: l.status })) ?? [], "library-loans")}>Export loans</Button>
            <Button size="sm" variant="outline" onClick={() => exportToCSV(items?.map((i) => ({ title: i.title, author: i.author, type: i.item_type, total: i.total_copies, available: i.available_copies, location: i.location })) ?? [], "library-catalogue")}>Export catalogue</Button>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Title</TableHead><TableHead className="text-right">Loans</TableHead></TableRow></TableHeader>
            <TableBody>{popular.map(([t, n]) => <TableRow key={t}><TableCell>{t}</TableCell><TableCell className="text-right">{n}</TableCell></TableRow>)}</TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Circulation policy</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {num("loan_days")}{num("fine_per_day")}{num("max_active_loans")}{num("reservation_hold_days")}{num("reminder_days_before")}
            <Button disabled={save.isPending} onClick={() => save.mutate(form)}>Save policy</Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Announce to library members</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <Input placeholder="Title" value={ann.title} onChange={(e) => setAnn({ ...ann, title: e.target.value })} />
            <Textarea rows={4} placeholder="Message" value={ann.message} onChange={(e) => setAnn({ ...ann, message: e.target.value })} />
            <Button disabled={announce.isPending || !ann.title || !ann.message}
              onClick={async () => { await announce.mutateAsync(ann); setAnn({ title: "", message: "" }); }}>Send</Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
