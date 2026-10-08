import { useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Printer, Search, FileCheck } from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useRoleNavigation } from "@/hooks/useRoleNavigation";
import { withRoleAccess } from "@/components/withRoleAccess";
import { useTrainees } from "@/hooks/useTrainees";
import { useOrganizationContext } from "@/hooks/useOrganizationContext";
import { useIssueTranscript, useTranscriptData, useTranscriptYears } from "@/hooks/useTranscriptData";
import { TranscriptView } from "@/components/TranscriptView";
import { printHtml } from "@/lib/printDocument";
import { transcriptHtml, type TranscriptData } from "@/lib/transcriptDocument";
import { toast } from "sonner";

const ALL = "all";

const Transcripts = () => {
  const { navItems, groupLabel } = useRoleNavigation();
  const { organizationName, settings } = useOrganizationContext();
  const { data: trainees, isLoading: traineesLoading } = useTrainees();
  const [search, setSearch] = useState("");
  const [traineeId, setTraineeId] = useState<string | null>(null);
  const [year, setYear] = useState(ALL);
  const academicYear = year === ALL ? null : year;

  const matches = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q || !trainees) return [];
    return trainees.filter((t) => t.trainee_id.toLowerCase().includes(q) || `${t.first_name} ${t.last_name}`.toLowerCase().includes(q)).slice(0, 8);
  }, [search, trainees]);
  const selected = trainees?.find((t) => t.id === traineeId);

  const { data: years } = useTranscriptYears(traineeId);
  const { data: preview, isLoading, error } = useTranscriptData(traineeId, academicYear);
  const issue = useIssueTranscript();

  const print = (t: TranscriptData, y: string | null) => {
    try {
      printHtml("Academic transcript", transcriptHtml(t, y), { name: organizationName, logoUrl: settings?.logo_url });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not print");
    }
  };

  const issueAndPrint = async () => {
    if (!traineeId || !academicYear) return;
    try {
      const issued = await issue.mutateAsync({ traineeId, academicYear });
      print(issued, academicYear);
    } catch {
      // the mutation's onError has already shown the message
    }
  };

  return (
    <DashboardLayout title="Transcripts" subtitle="Preview, issue and print academic transcripts" navItems={navItems} groupLabel={groupLabel}>
      <div className="space-y-4 max-w-5xl">
        <Card className="border-0 shadow-md">
          <CardHeader><CardTitle>Choose a trainee</CardTitle><CardDescription>Search by trainee number or name.</CardDescription></CardHeader>
          <CardContent className="space-y-3">
            <div className="relative max-w-sm">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input className="pl-9" placeholder="Trainee number or name" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            {traineesLoading && <Loader2 className="h-4 w-4 animate-spin" />}
            {matches.length > 0 && (
              <div className="border rounded-md divide-y max-w-sm">
                {matches.map((t) => (
                  <button key={t.id} type="button" className="w-full text-left px-3 py-2 text-sm hover:bg-muted"
                    onClick={() => { setTraineeId(t.id); setYear(ALL); setSearch(""); }}>
                    {t.first_name} {t.last_name} <span className="text-muted-foreground">({t.trainee_id})</span>
                  </button>
                ))}
              </div>
            )}
            {search.trim() && !traineesLoading && matches.length === 0 && <p className="text-sm text-muted-foreground">No trainee matches.</p>}
            {selected && <p className="text-sm">Selected: <strong>{selected.first_name} {selected.last_name}</strong> ({selected.trainee_id})</p>}
          </CardContent>
        </Card>

        {traineeId && (
          <Card className="border-0 shadow-md">
            <CardHeader className="flex-row items-start justify-between space-y-0 gap-3 flex-wrap">
              <div><CardTitle>Transcript preview</CardTitle><CardDescription>Only approved results are included. Issuing records a transcript number and date.</CardDescription></div>
              <div className="flex gap-2 flex-wrap">
                <Button variant="outline" size="sm" disabled={!preview?.blocks.length} onClick={() => preview && print(preview, academicYear)}>
                  <Printer className="h-4 w-4 mr-2" />Print preview
                </Button>
                <Button size="sm" disabled={!academicYear || !preview?.blocks.length || issue.isPending} onClick={issueAndPrint}
                  title={academicYear ? undefined : "Choose one academic year to issue"}>
                  {issue.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileCheck className="h-4 w-4 mr-2" />}Issue and print
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="max-w-xs space-y-1.5">
                <Label>Academic year</Label>
                <Select value={year} onValueChange={setYear}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL}>All years (preview only)</SelectItem>
                    {(years ?? []).map((y) => <SelectItem key={y} value={y}>{y}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {isLoading && <div className="flex justify-center py-6"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>}
              {error && <p className="text-sm text-destructive">{(error as Error).message}</p>}
              {preview && <TranscriptView transcript={preview} />}
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
};

export default withRoleAccess(Transcripts, { requiredRoles: ["admin", "organization_admin", "registration_officer", "head_of_training"] });
