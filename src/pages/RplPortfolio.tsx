import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useRoleNavigation } from "@/hooks/useRoleNavigation";
import { withRoleAccess } from "@/components/withRoleAccess";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { useAssessmentRequests } from "@/hooks/useAssessmentRequests";
import { PortfolioDetail } from "@/components/rpl/PortfolioDetail";
import { statusLabel, statusVariant } from "@/components/rpl/RplRequestsList";

const VIEWS: Record<string, string[]> = {
  review: ["under_review", "more_info_needed"],
  scheduled: ["assessment_scheduled"],
  new: ["submitted"],
};

const RplPortfolio = () => {
  const { navItems, groupLabel } = useRoleNavigation();
  const { data, isLoading, error } = useAssessmentRequests("rpl");
  const [view, setView] = useState("review");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const rows = useMemo(() => (data ?? []).filter((r) => VIEWS[view].includes(r.status)), [data, view]);
  const selected = rows.find((r) => r.id === selectedId) ?? null;

  return (
    <DashboardLayout title="RPL Portfolios" subtitle="Assess the evidence each applicant has submitted" navItems={navItems} groupLabel={groupLabel}>
      <div className="space-y-4">
        <Tabs value={view} onValueChange={(v) => { setView(v); setSelectedId(null); }}>
          <TabsList>
            <TabsTrigger value="review">Under review</TabsTrigger>
            <TabsTrigger value="scheduled">Scheduled</TabsTrigger>
            <TabsTrigger value="new">New</TabsTrigger>
          </TabsList>
        </Tabs>
        {isLoading && <LoadingSpinner text="Loading portfolios..." />}
        {error && <p role="alert" className="text-sm text-destructive">Could not load portfolios: {(error as Error).message}</p>}
        {!isLoading && !error && (
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
            <Card>
              <CardHeader><CardTitle>Portfolios ({rows.length})</CardTitle><CardDescription>Select one to open its evidence</CardDescription></CardHeader>
              <CardContent className="space-y-2">
                {rows.map((r) => (
                  <button key={r.id} type="button" onClick={() => setSelectedId(r.id)} aria-pressed={r.id === selectedId}
                    className={`w-full rounded-md border p-3 text-left text-sm transition-colors hover:bg-muted ${r.id === selectedId ? "border-primary bg-muted" : ""}`}>
                    <div className="font-medium">{r.applicant_name}</div>
                    <div className="text-muted-foreground">{r.qualifications?.qualification_title ?? "No qualification"}</div>
                    <div className="mt-1 flex flex-wrap items-center gap-2"><Badge variant={statusVariant(r.status)}>{statusLabel(r.status)}</Badge><span className="font-mono text-xs">{r.reference_number}</span></div>
                  </button>
                ))}
                {!rows.length && <p className="text-sm text-muted-foreground text-center py-6">Nothing in this list.</p>}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between space-y-0">
                <CardTitle>{selected ? selected.applicant_name : "Portfolio"}</CardTitle>
                {selected && <Button asChild size="sm" variant="outline"><Link to={`/rpl/credits?request=${selected.id}`}>Map credits</Link></Button>}
              </CardHeader>
              <CardContent>
                {selected ? <PortfolioDetail request={selected} /> : <p className="text-sm text-muted-foreground text-center py-10">Select a portfolio to review it.</p>}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default withRoleAccess(RplPortfolio, {
  requiredRoles: ["rpl_coordinator", "assessment_coordinator", "admin", "organization_admin", "head_of_training"],
});
