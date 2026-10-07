import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Printer } from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { traineeNavItems } from "@/lib/navigationConfig";
import { withRoleAccess } from "@/components/withRoleAccess";
import { useTraineeRecord, useTraineeUserId } from "@/hooks/useTraineePortalData";
import { useOrganizationContext } from "@/hooks/useOrganizationContext";
import { useTranscriptData, useTranscriptYears } from "@/hooks/useTranscriptData";
import { TranscriptView } from "@/components/TranscriptView";
import { printHtml } from "@/lib/printDocument";
import { transcriptHtml } from "@/lib/transcriptDocument";
import { toast } from "sonner";

const ALL = "all";

const TraineeTranscriptPage = () => {
  const userId = useTraineeUserId();
  const { data: trainee, isLoading: tLoading } = useTraineeRecord(userId);
  const { organizationName, settings } = useOrganizationContext();
  const { data: years } = useTranscriptYears(trainee?.id);
  const [year, setYear] = useState(ALL);
  const academicYear = year === ALL ? null : year;
  const { data: transcript, isLoading, error } = useTranscriptData(trainee?.id, academicYear);

  const print = () => {
    if (!transcript) return;
    try {
      printHtml("Academic transcript", transcriptHtml(transcript, academicYear), { name: organizationName, logoUrl: settings?.logo_url });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not print");
    }
  };

  return (
    <DashboardLayout title="My Transcript" subtitle="Credits and marks from approved results" navItems={traineeNavItems} groupLabel="Trainee iEnabler">
      <Card className="border-0 shadow-md max-w-4xl">
        <CardHeader className="flex-row items-start justify-between space-y-0 gap-3">
          <div><CardTitle>Academic transcript</CardTitle><CardDescription>Only results that have been approved appear here.</CardDescription></div>
          <Button variant="outline" size="sm" disabled={!transcript || !transcript.blocks.length} onClick={print}><Printer className="h-4 w-4 mr-2" />Print</Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="max-w-xs space-y-1.5">
            <Label>Academic year</Label>
            <Select value={year} onValueChange={setYear}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All years</SelectItem>
                {(years ?? []).map((y) => <SelectItem key={y} value={y}>{y}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {(tLoading || isLoading) && <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>}
          {!tLoading && !trainee && <p className="text-sm text-muted-foreground text-center py-8">No trainee record is linked to your account.</p>}
          {error && <p className="text-sm text-destructive">{(error as Error).message}</p>}
          {transcript && <TranscriptView transcript={transcript} />}
        </CardContent>
      </Card>
    </DashboardLayout>
  );
};

export default withRoleAccess(TraineeTranscriptPage, { requiredRoles: ["trainee"] });
