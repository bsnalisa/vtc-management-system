import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Printer } from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ButtonSpinner, LoadingSpinner } from "@/components/ui/loading-spinner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useRoleNavigation } from "@/hooks/useRoleNavigation";
import { useRequisition, useRequisitionActions } from "@/hooks/useRequisitions";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { printRawDocument } from "@/lib/printDocument";
import { requisitionDocumentHtml } from "@/lib/requisitionDocument";
import { RequisitionStatusBadge } from "@/components/requisitions/RequisitionStatusBadge";
import { RequisitionHistory, RequisitionStages } from "@/components/requisitions/RequisitionTimeline";
import { RequisitionDecisionPanel } from "@/components/requisitions/RequisitionDecisionPanel";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

// One requisition: the form, who is responsible at each stage, decisions, history, and the printable form
export default function RequisitionDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { navItems, groupLabel } = useRoleNavigation();
  const { data: v, isLoading, error } = useRequisition(id);
  const { reopen, cancel } = useRequisitionActions();
  const [reason, setReason] = useState("");
  const [cancelling, setCancelling] = useState(false);
  const [printing, setPrinting] = useState(false);

  const print = async () => {
    if (!v) return;
    setPrinting(true);
    try {
      const { data, error: e } = await db.rpc("requisition_letterhead", { _req: v.id });
      if (e) throw e;
      if (!data.configured) toast({ title: "Letterhead not complete", description: "The centre's logo has not been uploaded in the Proof of Registration settings; the centre name is used until then." });
      printRawDocument(requisitionDocumentHtml(v, data));
    } catch (e) {
      toast({ title: "Could not prepare the form", description: (e as Error).message, variant: "destructive" });
    } finally { setPrinting(false); }
  };

  const shell = (children: React.ReactNode) => <DashboardLayout title="Requisition" subtitle="Internal Quotation Request Form" navItems={navItems} groupLabel={groupLabel}>{children}</DashboardLayout>;
  if (isLoading) return shell(<LoadingSpinner text="Loading..." className="py-8" />);
  if (error || !v) return shell(<Alert variant="destructive"><AlertDescription>{(error as Error)?.message ?? "Requisition not found"}</AlertDescription></Alert>);

  return shell(
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">{v.requisition_number.startsWith("DRAFT-") ? "Draft requisition" : v.requisition_number}</h2>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <RequisitionStatusBadge status={v.status} />
            <span>Requested by {v.requester.name}</span>{v.department && <span>· {v.department}</span>}{v.round > 1 && <span>· Round {v.round}</span>}
          </div>
          {v.next_action && ["pending_line_supervisor", "pending_accountant", "pending_head_finance", "pending_centre_manager"].includes(v.status) && <div className="mt-1 text-sm">Next: {v.next_action}</div>}
        </div>
        <div className="flex flex-wrap gap-2">
          {v.can_edit && <Button asChild><Link to={`/requisitions/${v.id}/edit`}>{v.status === "draft" ? "Edit and submit" : "Correct and resubmit"}</Link></Button>}
          {v.can_reopen && <Button disabled={reopen.isPending} onClick={() => reopen.mutate(v.id)}>{reopen.isPending && <ButtonSpinner />}Revise and resubmit</Button>}
          {!v.requisition_number.startsWith("DRAFT-") && <Button variant="outline" disabled={printing} onClick={print}>{printing ? <ButtonSpinner /> : <Printer className="mr-1 h-4 w-4" />}Print form</Button>}
        </div>
      </div>

      {v.status === "returned_for_correction" && v.is_requester && (
        <Alert><AlertDescription>This requisition was returned to you. Read the comment below, then correct and resubmit it. Earlier decisions stay on record.</AlertDescription></Alert>
      )}

      <RequisitionDecisionPanel view={v} />

      <Card>
        <CardHeader><CardTitle>Purpose</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <p className="whitespace-pre-wrap">{v.purpose}</p>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader><TableRow><TableHead className="w-12">No.</TableHead><TableHead className="w-24">Quantity</TableHead><TableHead>Description</TableHead><TableHead>Specifications</TableHead></TableRow></TableHeader>
              <TableBody>{v.items.map((i) => <TableRow key={i.no}><TableCell>{i.no}</TableCell><TableCell>{i.quantity}</TableCell><TableCell className="whitespace-normal">{i.description}</TableCell><TableCell className="whitespace-normal">{i.specifications ?? ""}</TableCell></TableRow>)}</TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Approval stages</CardTitle><CardDescription>The order is fixed. The line supervisor is the one configured for the requester.</CardDescription></CardHeader>
        <CardContent><RequisitionStages view={v} /></CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>History</CardTitle></CardHeader>
        <CardContent><RequisitionHistory view={v} /></CardContent>
      </Card>

      {v.can_cancel && (
        <Card>
          <CardHeader><CardTitle>Cancel this requisition</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {cancelling ? (
              <>
                <Textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why is it being cancelled?" />
                <div className="flex gap-2">
                  <Button variant="destructive" disabled={!reason.trim() || cancel.isPending} onClick={async () => { await cancel.mutateAsync({ id: v.id, reason: reason.trim() }); setCancelling(false); navigate("/requisitions"); }}>{cancel.isPending && <ButtonSpinner />}Confirm cancellation</Button>
                  <Button variant="ghost" onClick={() => setCancelling(false)}>Keep it</Button>
                </div>
              </>
            ) : <Button variant="outline" onClick={() => setCancelling(true)}>Cancel requisition</Button>}
          </CardContent>
        </Card>
      )}
    </div>,
  );
}
