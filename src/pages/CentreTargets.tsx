import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ButtonSpinner, LoadingSpinner } from "@/components/ui/loading-spinner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRoleNavigation } from "@/hooks/useRoleNavigation";
import { useUserRole } from "@/hooks/useUserRole";
import { useOrganizationContext } from "@/hooks/useOrganizationContext";
import { TARGETS, useCentreTargets } from "@/hooks/useCentreManagerPanels";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { withRoleAccess } from "@/components/withRoleAccess";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

// Targets shown next to the Centre Manager's figures. The PA keeps them on the Centre Manager's instruction; the Centre Manager reads them.
function CentreTargets() {
  const { navItems, groupLabel } = useRoleNavigation();
  const { role } = useUserRole();
  const { organizationId } = useOrganizationContext();
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data, isLoading, error } = useCentreTargets();
  const canEdit = role === "pa_to_centre_manager";
  const [values, setValues] = useState<Record<string, string>>({});
  useEffect(() => { if (data) setValues(Object.fromEntries(Object.keys(TARGETS).map((k) => [k, data[k] != null ? String(data[k]) : ""]))); }, [data]);
  const save = useMutation({
    mutationFn: async ({ indicator, value }: { indicator: string; value: string }) => {
      const { error: e } = await db.rpc("save_centre_target", { _org: organizationId, _indicator: indicator, _target: value.trim() === "" ? null : Number(value) });
      if (e) throw e;
    },
    onSuccess: () => { toast({ title: "Target saved" }); qc.invalidateQueries({ queryKey: ["centre-targets"] }); },
    onError: (e: Error) => toast({ title: "Not saved", description: e.message, variant: "destructive" }),
  });
  return (
    <DashboardLayout title="Centre targets" subtitle="What the centre is aiming for" navItems={navItems} groupLabel={groupLabel}>
      <Card className="mx-auto max-w-2xl">
        <CardHeader><CardTitle>Targets</CardTitle><CardDescription>The dashboard shows "on target" or "off target" next to each figure. Leave a target empty to show none.{!canEdit && " Your PA keeps these for you."}</CardDescription></CardHeader>
        <CardContent className="space-y-4">
          {error && <Alert variant="destructive"><AlertDescription>{(error as Error).message}</AlertDescription></Alert>}
          {isLoading ? <LoadingSpinner text="Loading..." /> : Object.entries(TARGETS).map(([key, t]) => (
            <div key={key} className="flex flex-wrap items-end gap-3">
              <div className="min-w-[12rem] flex-1 space-y-1"><Label htmlFor={key}>{t.label} ({t.goodWhen === "min" ? "at least" : "at most"}{t.unit ? `, ${t.unit}` : ""})</Label>
                <Input id={key} inputMode="decimal" disabled={!canEdit} value={values[key] ?? ""} onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.value }))} /></div>
              {canEdit && <Button disabled={save.isPending} onClick={() => save.mutate({ indicator: key, value: values[key] ?? "" })}>{save.isPending && <ButtonSpinner />}Save</Button>}
            </div>
          ))}
        </CardContent>
      </Card>
    </DashboardLayout>
  );
}
export default withRoleAccess(CentreTargets, { requiredRoles: ["pa_to_centre_manager", "centre_manager"] });
