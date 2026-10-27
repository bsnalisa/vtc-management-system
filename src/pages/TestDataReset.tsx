import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/DashboardLayout";
import { ButtonSpinner } from "@/components/ui/loading-spinner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useRoleNavigation } from "@/hooks/useRoleNavigation";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

// These functions are newer than the generated Supabase types.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

interface TestIdentity { trainee_number: string; full_name: string; centre: string; status: string }
interface ResetResult { dry_run: boolean; identities: number; logins: number; files_queued: number; rows: Record<string, number> }
interface Seeded { centre: string; created: { role: string; email: string; password: string }[]; skipped: { role: string; email: string; reason: string }[] }

const CONFIRM_WORD = "RESET";

// Super Admin: remove test trainees, test logins and everything attached to them in one step.
export default function TestDataReset() {
  const { navItems, groupLabel } = useRoleNavigation();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [numbers, setNumbers] = useState("");
  const [includeStaff, setIncludeStaff] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [preview, setPreview] = useState<ResetResult | null>(null);

  const list = useQuery({
    queryKey: ["test-identities"],
    queryFn: async () => {
      const { data, error } = await db.rpc("list_test_identities");
      if (error) throw error;
      return (data ?? []) as TestIdentity[];
    },
  });

  const mark = useMutation({
    mutationFn: async (flag: boolean) => {
      const list = numbers.split(/[\s,;]+/).map((s) => s.trim()).filter(Boolean);
      const { data, error } = await db.rpc("mark_test_identities", { _numbers: list, _is_test: flag });
      if (error) throw error;
      return data as number;
    },
    onSuccess: (n, flag) => {
      toast({ title: flag ? `${n} marked as test` : `${n} unmarked` });
      setNumbers(""); setPreview(null);
      qc.invalidateQueries({ queryKey: ["test-identities"] });
    },
    onError: (e: Error) => toast({ title: "Could not update", description: e.message, variant: "destructive" }),
  });

  const run = useMutation({
    mutationFn: async (dry: boolean) => {
      const { data, error } = await db.rpc("reset_test_data", { _dry_run: dry, _include_staff: includeStaff });
      if (error) throw error;
      return data as ResetResult;
    },
    onSuccess: (res) => {
      setPreview(res);
      if (!res.dry_run) {
        toast({ title: "Test data removed", description: `${res.identities} test trainee${res.identities === 1 ? "" : "s"} and ${res.logins} login${res.logins === 1 ? "" : "s"} removed.` });
        setConfirm("");
        qc.invalidateQueries({ queryKey: ["test-identities"] });
        if (res.files_queued > 0) files.mutate();
      }
    },
    onError: (e: Error) => toast({ title: "Reset failed, nothing was changed", description: e.message, variant: "destructive" }),
  });

  const files = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("purge-test-storage", { body: {} });
      if (error) throw error;
      return data as { removed: number; failed: string[] };
    },
    onSuccess: (r) => toast({ title: `${r.removed} test file${r.removed === 1 ? "" : "s"} removed`, description: r.failed.length ? `${r.failed.length} could not be removed` : undefined }),
    onError: (e: Error) => toast({ title: "Test files were not removed", description: e.message, variant: "destructive" }),
  });

  const centres = useQuery({
    queryKey: ["centres-for-seed"],
    queryFn: async () => {
      const { data, error } = await supabase.from("organizations").select("id, name").order("name");
      if (error) throw error;
      return (data ?? []) as { id: string; name: string }[];
    },
  });
  const [centre, setCentre] = useState("");
  const [suffix, setSuffix] = useState("");
  const [seeded, setSeeded] = useState<Seeded | null>(null);
  const seed = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("seed-test-accounts", { body: { organization_id: centre, suffix: suffix || undefined } });
      if (error) throw error;
      return data as Seeded;
    },
    onSuccess: (r) => { setSeeded(r); qc.invalidateQueries({ queryKey: ["test-identities"] }); },
    onError: (e: Error) => toast({ title: "Test accounts were not created", description: e.message, variant: "destructive" }),
  });
  const downloadCsv = () => {
    if (!seeded) return;
    const csv = ["role,email,password", ...seeded.created.map((c) => `${c.role},${c.email},${c.password}`)].join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = "test-accounts.csv";
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const rows = preview ? Object.entries(preview.rows) : [];

  return (
    <DashboardLayout title="Test Data Reset" subtitle="Remove test trainees, their numbers and test logins" navItems={navItems} groupLabel={groupLabel}>
      <div className="space-y-6">
        <Alert>
          <AlertDescription>
            Only trainees marked as test are removed, together with their registrations, fees, results, transfers, issued numbers, logins and queued messages. Real trainees are never touched. Always preview first.
          </AlertDescription>
        </Alert>

        <Card>
          <CardHeader>
            <CardTitle>Test trainees</CardTitle>
            <CardDescription>Numbers starting with TEST- are marked automatically. Add other test trainees by their trainee number.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {list.error && <Alert variant="destructive"><AlertDescription>{(list.error as Error).message}</AlertDescription></Alert>}
            <div className="overflow-x-auto">
              <Table>
                <TableHeader><TableRow><TableHead>Number</TableHead><TableHead>Name</TableHead><TableHead>Centre</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                <TableBody>
                  {(list.data ?? []).length === 0 ? <TableRow><TableCell colSpan={4} className="text-muted-foreground">No trainees are marked as test.</TableCell></TableRow>
                    : (list.data ?? []).map((t) => <TableRow key={t.trainee_number}><TableCell>{t.trainee_number}</TableCell><TableCell>{t.full_name || "-"}</TableCell><TableCell>{t.centre}</TableCell><TableCell>{t.status}</TableCell></TableRow>)}
                </TableBody>
              </Table>
            </div>
            <div className="space-y-2">
              <Label htmlFor="numbers">Trainee numbers (separated by spaces, commas or new lines)</Label>
              <Textarea id="numbers" value={numbers} onChange={(e) => setNumbers(e.target.value)} placeholder="202651869" rows={3} />
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" disabled={!numbers.trim() || mark.isPending} onClick={() => mark.mutate(true)}>{mark.isPending && <ButtonSpinner />}Mark as test</Button>
                <Button variant="ghost" disabled={!numbers.trim() || mark.isPending} onClick={() => mark.mutate(false)}>Unmark</Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Reset</CardTitle>
            <CardDescription>This cannot be undone. Issued test numbers are released along with the records.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start gap-2">
              <Checkbox id="staff" checked={includeStaff} onCheckedChange={(v) => { setIncludeStaff(v === true); setPreview(null); }} />
              <Label htmlFor="staff" className="font-normal leading-snug">Also remove test staff logins (addresses ending in @vms-test.example, except Super Admins)</Label>
            </div>
            <Button variant="outline" disabled={run.isPending} onClick={() => run.mutate(true)}>{run.isPending && <ButtonSpinner />}Preview what would be removed</Button>

            {preview && (
              <div className="space-y-2">
                <p className="text-sm">{preview.dry_run ? "Preview: " : "Removed: "}{preview.identities} test trainee{preview.identities === 1 ? "" : "s"}, {preview.logins} login{preview.logins === 1 ? "" : "s"}{preview.files_queued > 0 ? `, ${preview.files_queued} uploaded file${preview.files_queued === 1 ? "" : "s"}` : ""}.</p>
                {rows.length > 0 && (
                  <div className="max-h-72 overflow-auto">
                    <Table>
                      <TableHeader><TableRow><TableHead>Records in</TableHead><TableHead className="text-right">Rows</TableHead></TableRow></TableHeader>
                      <TableBody>{rows.map(([t, n]) => <TableRow key={t}><TableCell>{t}</TableCell><TableCell className="text-right">{n}</TableCell></TableRow>)}</TableBody>
                    </Table>
                  </div>
                )}
              </div>
            )}

            {preview?.dry_run && (preview.identities > 0 || preview.logins > 0) && (
              <div className="space-y-2">
                <Label htmlFor="confirm">Type {CONFIRM_WORD} to confirm</Label>
                <div className="flex flex-wrap gap-2">
                  <Input id="confirm" className="max-w-[200px]" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
                  <Button variant="destructive" disabled={confirm !== CONFIRM_WORD || run.isPending} onClick={() => run.mutate(false)}>{run.isPending && <ButtonSpinner />}Remove test data</Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Start again with fresh test accounts</CardTitle>
            <CardDescription>Creates one test login for every role at a centre, with new random passwords. The passwords are shown once and are not stored, so download them now.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-1">
                <Label htmlFor="centre">Centre</Label>
                <select id="centre" className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={centre} onChange={(e) => setCentre(e.target.value)}>
                  <option value="">Choose a centre</option>
                  {(centres.data ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="suffix">Address suffix (optional, for a second centre)</Label>
                <Input id="suffix" className="max-w-[200px]" value={suffix} onChange={(e) => setSuffix(e.target.value)} placeholder="gobabis" />
              </div>
              <Button disabled={!centre || seed.isPending} onClick={() => seed.mutate()}>{seed.isPending && <ButtonSpinner />}Create test accounts</Button>
            </div>
            {seeded && (
              <div className="space-y-2">
                <p className="text-sm">{seeded.created.length} account{seeded.created.length === 1 ? "" : "s"} created at {seeded.centre}. These passwords will not be shown again.</p>
                <Button variant="outline" onClick={downloadCsv}>Download as CSV</Button>
                {seeded.skipped.length > 0 && <Alert variant="destructive"><AlertDescription>Skipped: {seeded.skipped.map((k) => `${k.email} (${k.reason})`).join("; ")}</AlertDescription></Alert>}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
