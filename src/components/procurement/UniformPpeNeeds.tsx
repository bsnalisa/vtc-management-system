import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Shirt } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ButtonSpinner, LoadingSpinner } from "@/components/ui/loading-spinner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { useOrganizationContext } from "@/hooks/useOrganizationContext";
import { supabase } from "@/integrations/supabase/client";

// These functions are newer than the generated Supabase types.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

interface Needs {
  registered: number; open_trainees: number; already_requisitioned: number; no_sizes: number;
  open_items: { item: string; size: string; quantity: number }[];
  years: string[]; trades: { id: string; name: string }[];
}
interface RegisterRow {
  registration_id: string; trainee_number: string | null; full_name: string; trade_name: string | null; academic_year: string;
  shoe_size: string | null; overall_size: string | null; tshirt_size: string | null; skirt_trousers_size: string | null;
  chef_trouser_size: string | null; chef_jacket_size: string | null; requisition_number: string | null;
}

// Sizes the applicants gave, for trainees who are now registered, added up by item and size.
export function UniformPpeNeeds() {
  const { organizationId } = useOrganizationContext();
  const { toast } = useToast();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [year, setYear] = useState("");
  const [trade, setTrade] = useState("");
  const [onlyOpen, setOnlyOpen] = useState(true);

  const args = { _org: organizationId, _year: year || null, _trade: trade || null };
  const needs = useQuery({
    queryKey: ["ppe-needs", organizationId, year, trade],
    enabled: !!organizationId,
    queryFn: async () => {
      const { data, error } = await db.rpc("uniform_ppe_needs", args);
      if (error) throw error;
      return data as Needs;
    },
  });
  const register = useQuery({
    queryKey: ["ppe-register", organizationId, year, trade, onlyOpen],
    enabled: !!organizationId,
    queryFn: async () => {
      const { data, error } = await db.rpc("uniform_ppe_register", { ...args, _only_open: onlyOpen });
      if (error) throw error;
      return (data ?? []) as RegisterRow[];
    },
  });

  const prepare = useMutation({
    mutationFn: async () => {
      const { data, error } = await db.rpc("create_uniform_requisition", args);
      if (error) throw error;
      return data as { requisition_number: string; trainees: number; lines: number };
    },
    onSuccess: (r) => {
      toast({ title: `Draft requisition ${r.requisition_number} prepared`, description: `${r.lines} line${r.lines === 1 ? "" : "s"} for ${r.trainees} trainee${r.trainees === 1 ? "" : "s"}. Add unit costs, then submit it.` });
      qc.invalidateQueries({ queryKey: ["ppe-needs"] });
      qc.invalidateQueries({ queryKey: ["ppe-register"] });
      qc.invalidateQueries({ queryKey: ["purchase-requisitions"] });
    },
    onError: (e: Error) => toast({ title: "Could not prepare the requisition", description: e.message, variant: "destructive" }),
  });

  const n = needs.data;
  const byItem = new Map<string, { size: string; quantity: number }[]>();
  (n?.open_items ?? []).forEach((i) => byItem.set(i.item, [...(byItem.get(i.item) ?? []), { size: i.size, quantity: i.quantity }]));
  const sel = "h-10 rounded-md border border-input bg-background px-3 text-sm";

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Shirt className="h-5 w-5" />Uniforms and PPE needed</CardTitle>
          <CardDescription>Sizes entered on the applications of trainees who have been registered. Prepare a draft requisition from what is still outstanding.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1"><Label htmlFor="ppe-year">Academic year</Label>
              <select id="ppe-year" className={sel} value={year} onChange={(e) => setYear(e.target.value)}><option value="">All</option>{(n?.years ?? []).map((y) => <option key={y} value={y}>{y}</option>)}</select></div>
            <div className="space-y-1"><Label htmlFor="ppe-trade">Trade</Label>
              <select id="ppe-trade" className={sel} value={trade} onChange={(e) => setTrade(e.target.value)}><option value="">All</option>{(n?.trades ?? []).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></div>
          </div>

          {needs.error && <Alert variant="destructive"><AlertDescription>{(needs.error as Error).message}</AlertDescription></Alert>}
          {needs.isLoading ? <LoadingSpinner text="Loading..." className="py-4" /> : n && (
            <>
              <div className="grid gap-3 sm:grid-cols-4 text-sm">
                <div className="rounded border p-3"><div className="text-2xl font-bold">{n.registered}</div>Registered trainees</div>
                <div className="rounded border p-3"><div className="text-2xl font-bold">{n.open_trainees}</div>Outstanding (not yet in a requisition)</div>
                <div className="rounded border p-3"><div className="text-2xl font-bold">{n.already_requisitioned}</div>Already in a requisition</div>
                <div className="rounded border p-3"><div className="text-2xl font-bold">{n.no_sizes}</div>Gave no sizes</div>
              </div>

              {byItem.size === 0 ? <p className="text-sm text-muted-foreground">Nothing outstanding. New registrations appear here as soon as the trainee is registered.</p> : (
                <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                  {[...byItem.entries()].map(([item, sizes]) => (
                    <div key={item} className="rounded border p-3">
                      <div className="mb-2 flex items-center justify-between font-medium">{item}<Badge variant="secondary">{sizes.reduce((s, x) => s + x.quantity, 0)}</Badge></div>
                      <div className="flex flex-wrap gap-2">{sizes.map((s) => <span key={s.size} className="rounded border px-2 py-1 text-sm">Size {s.size}: <strong>{s.quantity}</strong></span>)}</div>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                <Button disabled={n.open_trainees === 0 || prepare.isPending} onClick={() => prepare.mutate()}>{prepare.isPending && <ButtonSpinner />}Prepare draft requisition ({n.open_trainees} trainee{n.open_trainees === 1 ? "" : "s"})</Button>
                <Button variant="outline" onClick={() => navigate("/purchase-requisitions")}>Open purchase requisitions</Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle>Size register</CardTitle>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={onlyOpen} onChange={(e) => setOnlyOpen(e.target.checked)} />Only trainees not yet in a requisition</label>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader><TableRow><TableHead>Trainee no.</TableHead><TableHead>Name</TableHead><TableHead>Trade</TableHead><TableHead>Shoes</TableHead><TableHead>Overall</TableHead><TableHead>T-shirt</TableHead><TableHead>Skirt / trousers</TableHead><TableHead>Chef trousers</TableHead><TableHead>Chef jacket</TableHead><TableHead>Requisition</TableHead></TableRow></TableHeader>
              <TableBody>
                {register.isLoading ? <TableRow><TableCell colSpan={10}><LoadingSpinner text="Loading..." className="py-2" /></TableCell></TableRow>
                  : (register.data ?? []).length === 0 ? <TableRow><TableCell colSpan={10} className="text-muted-foreground">No trainees to show.</TableCell></TableRow>
                  : (register.data ?? []).map((r) => (
                    <TableRow key={r.registration_id}>
                      <TableCell>{r.trainee_number ?? "-"}</TableCell><TableCell>{r.full_name}</TableCell><TableCell>{r.trade_name ?? "-"}</TableCell>
                      <TableCell>{r.shoe_size ?? "-"}</TableCell><TableCell>{r.overall_size ?? "-"}</TableCell><TableCell>{r.tshirt_size ?? "-"}</TableCell>
                      <TableCell>{r.skirt_trousers_size ?? "-"}</TableCell><TableCell>{r.chef_trouser_size ?? "-"}</TableCell><TableCell>{r.chef_jacket_size ?? "-"}</TableCell>
                      <TableCell>{r.requisition_number ?? <Badge variant="outline">Outstanding</Badge>}</TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
