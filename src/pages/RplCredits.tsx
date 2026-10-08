import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useRoleNavigation } from "@/hooks/useRoleNavigation";
import { withRoleAccess } from "@/components/withRoleAccess";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { useAssessmentRequests } from "@/hooks/useAssessmentRequests";
import { CreditMapper } from "@/components/rpl/CreditMapper";

const RplCredits = () => {
  const { navItems, groupLabel } = useRoleNavigation();
  const { data, isLoading, error } = useAssessmentRequests("rpl");
  const [params, setParams] = useSearchParams();
  const requests = useMemo(() => (data ?? []).filter((r) => r.status !== "submitted"), [data]);
  const selected = requests.find((r) => r.id === params.get("request")) ?? null;

  return (
    <DashboardLayout title="RPL Credits" subtitle="Grant credits per unit standard for an RPL application" navItems={navItems} groupLabel={groupLabel}>
      <Card>
        <CardHeader><CardTitle>Credit mapping</CardTitle><CardDescription>Choose an application, then grant or decline each unit standard of its qualification.</CardDescription></CardHeader>
        <CardContent className="space-y-5">
          {isLoading && <LoadingSpinner text="Loading RPL requests..." />}
          {error && <p role="alert" className="text-sm text-destructive">Could not load RPL requests: {(error as Error).message}</p>}
          {!isLoading && !error && (
            <>
              <div className="space-y-1 max-w-xl">
                <Label>RPL application</Label>
                <Select value={selected?.id ?? ""} onValueChange={(v) => setParams({ request: v })}>
                  <SelectTrigger aria-label="RPL application"><SelectValue placeholder={requests.length ? "Select an application" : "No applications to map yet"} /></SelectTrigger>
                  <SelectContent>
                    {requests.map((r) => <SelectItem key={r.id} value={r.id}>{r.reference_number} - {r.applicant_name} ({r.qualifications?.qualification_title ?? "no qualification"})</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {selected ? <CreditMapper key={selected.id} request={selected} /> : <p className="text-sm text-muted-foreground text-center py-6">Select an application to map its credits.</p>}
            </>
          )}
        </CardContent>
      </Card>
    </DashboardLayout>
  );
};

export default withRoleAccess(RplCredits, {
  requiredRoles: ["rpl_coordinator", "assessment_coordinator", "admin", "organization_admin", "head_of_training"],
});
