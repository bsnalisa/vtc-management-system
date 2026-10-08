import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { DashboardLayout } from "@/components/DashboardLayout";
import { withRoleAccess } from "@/components/withRoleAccess";
import { VacancyDialog } from "@/components/hr/VacancyDialog";
import { ApplicantsPanel } from "@/components/hr/ApplicantsPanel";
import { useRoleNavigation } from "@/hooks/useRoleNavigation";
import { Vacancy, fmtDate, labelOf, useApplicants, useDeleteVacancy, useVacancies } from "@/hooks/useHr";

const HrRecruitment = () => {
  const { navItems, groupLabel } = useRoleNavigation();
  const { data, isLoading, error } = useVacancies();
  const allApplicants = useApplicants();
  const del = useDeleteVacancy();
  const [dialog, setDialog] = useState<{ vacancy: Vacancy | null } | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<Vacancy | null>(null);
  const selected = (data ?? []).find((v) => v.id === selectedId) ?? null;
  const countFor = (id: string) => (allApplicants.data ?? []).filter((a) => a.vacancy_id === id).length;

  return (
    <DashboardLayout title="Recruitment" subtitle="Vacancies and the applicants moving through each stage" navItems={navItems} groupLabel={groupLabel}>
      <div className="space-y-6">
        <Card className="border-0 shadow-md">
          <CardHeader className="flex-col sm:flex-row items-start justify-between space-y-0 gap-3">
            <div><CardTitle>Vacancies</CardTitle><CardDescription>Select a vacancy to manage its applicants.</CardDescription></div>
            <Button onClick={() => setDialog({ vacancy: null })}>New vacancy</Button>
          </CardHeader>
          <CardContent>
            {isLoading && <LoadingSpinner text="Loading vacancies" />}
            {error && <p role="alert" className="text-sm text-destructive">Could not load vacancies: {(error as Error).message}</p>}
            {!isLoading && !error && (
              <Table>
                <TableHeader><TableRow><TableHead>Title</TableHead><TableHead>Department</TableHead><TableHead>Closes</TableHead><TableHead>Status</TableHead><TableHead>Applicants</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
                <TableBody>
                  {(data ?? []).map((v) => (
                    <TableRow key={v.id} data-state={v.id === selectedId ? "selected" : undefined}>
                      <TableCell>{v.title}</TableCell>
                      <TableCell>{v.department ?? "-"}</TableCell>
                      <TableCell>{fmtDate(v.closes_on)}</TableCell>
                      <TableCell><Badge variant={v.status === "open" ? "default" : "secondary"}>{labelOf(v.status)}</Badge></TableCell>
                      <TableCell>{countFor(v.id)}</TableCell>
                      <TableCell className="text-right space-x-2">
                        <Button size="sm" onClick={() => setSelectedId(v.id)}>Applicants</Button>
                        <Button size="sm" variant="outline" onClick={() => setDialog({ vacancy: v })}>Edit</Button>
                        <Button size="sm" variant="outline" onClick={() => setToDelete(v)}>Delete</Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
            {!isLoading && !error && !data?.length && <p className="text-sm text-muted-foreground text-center py-8">No vacancies yet. Create one to start collecting applicants.</p>}
          </CardContent>
        </Card>
        {selected && <ApplicantsPanel vacancy={selected} />}
      </div>
      <VacancyDialog open={!!dialog} vacancy={dialog?.vacancy ?? null} onClose={() => setDialog(null)} />
      <ConfirmDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)} title="Delete vacancy?" variant="destructive" confirmText="Delete"
        description={`"${toDelete?.title}" and all of its applicants will be permanently removed.`}
        onConfirm={() => { if (toDelete) { if (toDelete.id === selectedId) setSelectedId(null); del.mutate(toDelete.id); } setToDelete(null); }} />
    </DashboardLayout>
  );
};

export default withRoleAccess(HrRecruitment, { requiredRoles: ["hr_officer", "admin", "organization_admin"] });
