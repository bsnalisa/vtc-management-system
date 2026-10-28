import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Plus, Trash2 } from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ButtonSpinner, LoadingSpinner } from "@/components/ui/loading-spinner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useRoleNavigation } from "@/hooks/useRoleNavigation";
import { useOrganizationContext } from "@/hooks/useOrganizationContext";
import { useRequisition, useRequisitionActions } from "@/hooks/useRequisitions";
import { useRequisitionSupervisor } from "@/hooks/useRequisitionSupervisor";
import { useToast } from "@/hooks/use-toast";

interface Row { description: string; quantity: string; specifications: string }
const blank = (): Row => ({ description: "", quantity: "1", specifications: "" });

// New requisition or a correction: purpose, department and the item table (No., Quantity, Description, Specifications)
export default function RequisitionEdit() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { navItems, groupLabel } = useRoleNavigation();
  const { organizationId } = useOrganizationContext();
  const existing = useRequisition(id);
  const { saveDraft, submit } = useRequisitionActions();
  const orgId = existing.data?.organization_id ?? organizationId;
  const supervisor = useRequisitionSupervisor(orgId);
  const [purpose, setPurpose] = useState("");
  const [department, setDepartment] = useState("");
  const [rows, setRows] = useState<Row[]>([blank()]);
  const [loaded, setLoaded] = useState(!id);

  useEffect(() => {
    const v = existing.data;
    if (!id || !v || loaded) return;
    setPurpose(v.purpose ?? ""); setDepartment(v.department ?? "");
    setRows(v.items.length ? v.items.map((i) => ({ description: i.description, quantity: String(i.quantity), specifications: i.specifications ?? "" })) : [blank()]);
    setLoaded(true);
  }, [existing.data, id, loaded]);

  const update = (i: number, patch: Partial<Row>) => setRows((r) => r.map((x, n) => (n === i ? { ...x, ...patch } : x)));
  const busy = saveDraft.isPending || submit.isPending;
  const sup = supervisor.data;

  const problem = (): string | null => {
    if (!purpose.trim()) return "State the purpose of the requisition.";
    if (!department.trim()) return "Enter your department.";
    if (rows.some((r) => !r.description.trim())) return "Every item needs a description.";
    if (rows.some((r) => !/^[0-9]+$/.test(r.quantity.trim()) || Number(r.quantity) < 1)) return "Quantities must be whole numbers of at least 1.";
    return null;
  };

  const save = async (andSubmit: boolean) => {
    if (andSubmit) { const p = problem(); if (p) { toast({ title: "Complete the form", description: p, variant: "destructive" }); return; } }
    const reqId = await saveDraft.mutateAsync({ id: id ?? null, organizationId: orgId ?? null, purpose, department, items: rows });
    if (!andSubmit) { toast({ title: "Draft saved" }); navigate(`/requisitions/${reqId}`); return; }
    const r = await submit.mutateAsync(reqId);
    toast({ title: `Submitted as ${r.requisition_number}`, description: `Sent to ${r.supervisor} for recommendation.` });
    navigate(`/requisitions/${reqId}`);
  };

  if (id && (existing.isLoading || !loaded)) return <DashboardLayout title="Requisition" subtitle="Internal Quotation Request Form" navItems={navItems} groupLabel={groupLabel}><LoadingSpinner text="Loading..." className="py-8" /></DashboardLayout>;
  if (id && existing.data && !existing.data.can_edit) {
    return <DashboardLayout title="Requisition" subtitle="Internal Quotation Request Form" navItems={navItems} groupLabel={groupLabel}><Alert><AlertDescription>This requisition can no longer be edited.</AlertDescription></Alert></DashboardLayout>;
  }

  return (
    <DashboardLayout title={id ? "Correct requisition" : "New requisition"} subtitle="Internal Quotation Request Form" navItems={navItems} groupLabel={groupLabel}>
      <div className="mx-auto max-w-4xl space-y-6">
        {sup && !sup.valid && (
          <Alert variant="destructive"><AlertDescription>You do not have a line supervisor configured, so a requisition cannot enter the approval process yet. You can save a draft; ask your Organisational Admin to set your reporting line before submitting.</AlertDescription></Alert>
        )}
        {sup?.valid && <Alert><AlertDescription>When you submit, this goes first to your line supervisor: <strong>{sup.supervisors.map((s) => `${s.name}${s.role ? ` (${s.role.replace(/_/g, " ")})` : ""}`).join(", ")}</strong>. It then follows the Accountant, the Head of Finance and Administration and the Centre Manager, in that order.</AlertDescription></Alert>}

        <Card>
          <CardHeader><CardTitle>Request</CardTitle><CardDescription>Explain what is needed and why. This text appears at the top of the printed form.</CardDescription></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="purpose">Purpose / justification</Label>
              <Textarea id="purpose" rows={4} value={purpose} onChange={(e) => setPurpose(e.target.value)} maxLength={4000} placeholder="Request to procure the following items for use on ..." />
            </div>
            <div className="space-y-1">
              <Label htmlFor="department">Department</Label>
              <Input id="department" className="max-w-sm" value={department} onChange={(e) => setDepartment(e.target.value)} maxLength={120} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Items</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {rows.map((r, i) => (
              <div key={i} className="rounded border p-3">
                <div className="mb-2 flex items-center justify-between text-sm font-medium">Item {i + 1}
                  <Button type="button" variant="ghost" size="sm" aria-label={`Remove item ${i + 1}`} disabled={rows.length === 1} onClick={() => setRows((x) => x.filter((_, n) => n !== i))}><Trash2 className="h-4 w-4" /></Button>
                </div>
                <div className="grid gap-3 sm:grid-cols-[8rem_1fr]">
                  <div className="space-y-1"><Label htmlFor={`q${i}`}>Quantity</Label><Input id={`q${i}`} inputMode="numeric" value={r.quantity} onChange={(e) => update(i, { quantity: e.target.value })} /></div>
                  <div className="space-y-1"><Label htmlFor={`d${i}`}>Description</Label><Input id={`d${i}`} value={r.description} onChange={(e) => update(i, { description: e.target.value })} maxLength={500} /></div>
                </div>
                <div className="mt-3 space-y-1"><Label htmlFor={`s${i}`}>Specifications</Label><Textarea id={`s${i}`} rows={2} value={r.specifications} onChange={(e) => update(i, { specifications: e.target.value })} maxLength={2000} /></div>
              </div>
            ))}
            <Button type="button" variant="outline" disabled={rows.length >= 100} onClick={() => setRows((x) => [...x, blank()])}><Plus className="mr-1 h-4 w-4" />Add item</Button>
          </CardContent>
        </Card>

        <div className="flex flex-wrap gap-2">
          <Button disabled={busy || (sup ? !sup.valid : false)} onClick={() => save(true)}>{busy && <ButtonSpinner />}{id ? "Resubmit" : "Submit for approval"}</Button>
          <Button variant="outline" disabled={busy} onClick={() => save(false)}>Save draft</Button>
          <Button variant="ghost" disabled={busy} onClick={() => navigate(id ? `/requisitions/${id}` : "/requisitions")}>Cancel</Button>
        </div>
      </div>
    </DashboardLayout>
  );
}
