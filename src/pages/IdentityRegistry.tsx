import { useState } from "react";
import { Fingerprint } from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useRoleNavigation } from "@/hooks/useRoleNavigation";
import { useMergeIdentities, useNumberCapacity, useRemapLegacy, useResolveReview, useReviewQueue } from "@/hooks/useTransfers";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { toast } from "sonner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { withRoleAccess } from "@/components/withRoleAccess";

const KIND: Record<string, string> = { possible_duplicate: "Possible duplicate", manual_verification: "Manual verification", identity_conflict: "Active at more than one VTC" };

function Reviews() {
  const { data, isLoading, error } = useReviewQueue();
  const resolve = useResolveReview();
  const [reason, setReason] = useState<Record<string, string>>({});
  if (error) return <Alert variant="destructive"><AlertDescription>{(error as Error).message}</AlertDescription></Alert>;
  if (isLoading) return <Skeleton className="h-40" />;
  if (!data?.length) return <EmptyState icon={Fingerprint} title="No identity cases" description="Possible duplicates and applicants without a usable ID document appear here. Nothing is merged automatically." />;
  const options: Record<string, [string, string][]> = {
    possible_duplicate: [["same_person", "Same person"], ["different_people", "Different people"]],
    manual_verification: [["verified", "Verify identity"], ["dismissed", "Dismiss"]],
    identity_conflict: [["dismissed", "Dismiss"]],
  };
  return (
    <ul className="space-y-3">
      {data.map((c) => (
        <li key={c.id} className="space-y-2 rounded-lg border p-4">
          <div className="flex flex-wrap items-center justify-between gap-2"><span className="font-medium">{KIND[c.kind]}</span><Badge variant={c.status === "open" ? "default" : "secondary"}>{c.status.replace(/_/g, " ")}</Badge></div>
          <p className="text-sm text-muted-foreground">{c.reason}{c.organization ? ` · ${c.organization}` : ""}{c.applicant ? ` · applicant ${c.applicant}` : ""}</p>
          {(c.a || c.b) && <p className="text-sm">{[c.a, c.b].filter(Boolean).map((i) => `${i!.name} (${i!.trainee_number}${i!.date_of_birth ? `, born ${i!.date_of_birth}` : ""})`).join("  ↔  ")}</p>}
          {c.status === "open" ? (
            <div className="flex flex-col gap-2 sm:flex-row"><Input aria-label="Reason" placeholder="Reason for the decision (at least 10 characters)" value={reason[c.id] ?? ""} onChange={(e) => setReason({ ...reason, [c.id]: e.target.value })} />
              {options[c.kind].map(([d, label]) => <Button key={d} size="sm" variant={d === "same_person" || d === "verified" ? "default" : "outline"} disabled={resolve.isPending || (reason[c.id] ?? "").trim().length < 10} onClick={() => resolve.mutate({ id: c.id, decision: d, reason: reason[c.id] })}>{label}</Button>)}</div>
          ) : <p className="text-xs text-muted-foreground">Resolved: {c.resolution_reason}</p>}
        </li>
      ))}
    </ul>
  );
}

async function findIdentity(number: string): Promise<string | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any).from("trainee_number_ledger").select("identity_id").eq("number", number.trim()).maybeSingle();
  if (error) throw error;
  return data?.identity_id ?? null;
}

function Tools() {
  const merge = useMergeIdentities();
  const remap = useRemapLegacy();
  const [from, setFrom] = useState(""); const [into, setInto] = useState(""); const [why, setWhy] = useState("");
  const [legacy, setLegacy] = useState(""); const [why2, setWhy2] = useState("");
  const run = async (fn: () => Promise<unknown>) => { try { await fn(); } catch (e) { toast.error((e as Error).message); } };
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader><CardTitle className="text-base">Merge two identities</CardTitle><CardDescription>Only when they are confirmed to be the same person. The first number is retired for good and the second becomes the person’s number. Both must not be active at the same time.</CardDescription></CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5"><Label>Number to retire</Label><Input value={from} onChange={(e) => setFrom(e.target.value)} className="font-mono" /></div>
          <div className="space-y-1.5"><Label>Number to keep</Label><Input value={into} onChange={(e) => setInto(e.target.value)} className="font-mono" /></div>
          <div className="space-y-1.5"><Label>Reason</Label><Textarea rows={2} value={why} onChange={(e) => setWhy(e.target.value)} /></div>
          <Button disabled={merge.isPending || !from || !into || why.trim().length < 10} onClick={() => run(async () => {
            const [a, b] = await Promise.all([findIdentity(from), findIdentity(into)]);
            if (!a || !b) throw new Error("One of the numbers was not found");
            await merge.mutateAsync({ from: a, into: b, reason: why }); setFrom(""); setInto(""); setWhy("");
          })}>Merge identities</Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-base">Give a legacy number the nine-digit format</CardTitle><CardDescription>The old number stays on record as an alias of the same person and is never reissued. Do this only under an approved migration decision.</CardDescription></CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5"><Label>Legacy number</Label><Input value={legacy} onChange={(e) => setLegacy(e.target.value)} className="font-mono" placeholder="e.g. 062-26-48213" /></div>
          <div className="space-y-1.5"><Label>Reason</Label><Textarea rows={2} value={why2} onChange={(e) => setWhy2(e.target.value)} /></div>
          <Button variant="outline" disabled={remap.isPending || !legacy || why2.trim().length < 10} onClick={() => run(async () => {
            const id = await findIdentity(legacy);
            if (!id) throw new Error("That number was not found");
            await remap.mutateAsync({ identity: id, reason: why2 }); setLegacy(""); setWhy2("");
          })}>Remap number</Button>
        </CardContent>
      </Card>
    </div>
  );
}

function Overview() {
  const { data, isLoading, error } = useNumberCapacity();
  if (error) return <Alert variant="destructive"><AlertDescription>{(error as Error).message}</AlertDescription></Alert>;
  if (isLoading || !data) return <Skeleton className="h-40" />;
  const stats: [string, number][] = [["Trainees (global identities)", data.global_identities], ["Currently registered", data.with_active_registration], ["Registration records at VTCs", data.registration_records],
    ["Old-format numbers still in use", data.legacy_format_identities], ["Open identity cases", data.open_reviews], ["Failed transfers", data.failed_transfers]];
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">A trainee who moved between VTCs is one person here and has several registration records.</p>
      <div className="grid gap-3 sm:grid-cols-3">{stats.map(([k, v]) => <Card key={k}><CardContent className="p-4"><p className="text-sm text-muted-foreground">{k}</p><p className="text-2xl font-semibold">{v}</p></CardContent></Card>)}</div>
      <Card>
        <CardHeader><CardTitle className="text-base">Number capacity</CardTitle><CardDescription>Each year has 100,000 possible suffixes. A warning appears from 50,000 issued.</CardDescription></CardHeader>
        <CardContent>{!data.years.length ? <p className="text-sm text-muted-foreground">No nine-digit numbers issued yet.</p> : (
          <Table><TableHeader><TableRow><TableHead>Year</TableHead><TableHead className="text-right">Issued</TableHead><TableHead className="text-right">Used</TableHead></TableRow></TableHeader>
            <TableBody>{data.years.map((y) => <TableRow key={y.year}><TableCell>{y.year}</TableCell><TableCell className="text-right">{y.issued}</TableCell><TableCell className="text-right">{y.used_pct}% {y.warning && <Badge variant="destructive" className="ml-2">Capacity warning</Badge>}</TableCell></TableRow>)}</TableBody></Table>)}</CardContent>
      </Card>
      {data.migration_report && (
        <Card><CardHeader><CardTitle className="text-base">Migration report</CardTitle><CardDescription>Recorded when existing trainees were linked to identities.</CardDescription></CardHeader>
          <CardContent><dl className="grid gap-2 text-sm sm:grid-cols-2">{Object.entries(data.migration_report).filter(([k]) => k !== "note").map(([k, v]) => <div key={k} className="flex justify-between gap-3 border-b py-1"><dt className="text-muted-foreground">{k.replace(/_/g, " ")}</dt><dd className="font-medium">{String(v)}</dd></div>)}</dl>
            {data.migration_report.note ? <p className="mt-3 text-xs text-muted-foreground">{String(data.migration_report.note)}</p> : null}</CardContent></Card>
      )}
    </div>
  );
}

function IdentityRegistry() {
  const { navItems, groupLabel } = useRoleNavigation();
  return (
    <DashboardLayout title="Trainee Identity Registry" subtitle="One identity and one permanent number per trainee, across all VTCs" navItems={navItems} groupLabel={groupLabel}>
      <Tabs defaultValue="overview">
        <TabsList><TabsTrigger value="overview">Overview</TabsTrigger><TabsTrigger value="reviews">Identity review</TabsTrigger><TabsTrigger value="tools">Merge and remap</TabsTrigger></TabsList>
        <TabsContent value="overview"><Overview /></TabsContent>
        <TabsContent value="reviews"><Card><CardContent className="p-4"><Reviews /></CardContent></Card></TabsContent>
        <TabsContent value="tools"><Tools /></TabsContent>
      </Tabs>
    </DashboardLayout>
  );
}

// super admins pass the role check automatically; the database functions allow only the platform team
export default withRoleAccess(IdentityRegistry, { requiredRoles: [] });
