import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TRANSCRIPT_RULES, type TranscriptData } from "@/lib/transcriptDocument";

const mark = (n: unknown) => (n === null || n === undefined || n === "" ? "-" : String(n));
const label = (s: string) => s.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());

/** On-screen transcript, shared by the trainee and staff pages. */
export const TranscriptView = ({ transcript }: { transcript: TranscriptData }) => (
  <div className="space-y-4 text-sm">
    <div className="grid sm:grid-cols-3 gap-2">
      <div><div className="text-muted-foreground text-xs">Trainee</div><div className="font-medium">{transcript.first_name} {transcript.last_name}</div></div>
      <div><div className="text-muted-foreground text-xs">Trainee number</div><div className="font-medium">{transcript.trainee_number}</div></div>
      {transcript.transcript_number && <div><div className="text-muted-foreground text-xs">Transcript number</div><div className="font-medium">{transcript.transcript_number}</div></div>}
    </div>
    {transcript.blocks.length === 0 && <p className="text-muted-foreground text-center py-6">There are no approved results to show.</p>}
    {transcript.blocks.map((b, i) => (
      <div key={`${b.qualification_code}-${b.academic_year}-${i}`} className="space-y-1">
        <div className="font-medium">{b.qualification}{b.qualification_code ? ` (${b.qualification_code})` : ""} - {b.academic_year}{b.nqf_level != null ? `, NQF level ${b.nqf_level}` : ""}</div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Component</TableHead><TableHead className="text-right">CA</TableHead><TableHead className="text-right">SA</TableHead>
              <TableHead className="text-right">Final</TableHead><TableHead className="text-right">Pass mark</TableHead><TableHead>Outcome</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {b.components.map((c, j) => (
                <TableRow key={j}>
                  <TableCell>{c.component}</TableCell><TableCell className="text-right">{mark(c.ca_mark)}</TableCell><TableCell className="text-right">{mark(c.sa_mark)}</TableCell>
                  <TableCell className="text-right font-medium">{mark(c.final_mark)}</TableCell><TableCell className="text-right">{mark(c.pass_mark)}</TableCell><TableCell>{label(c.status)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <div className="text-xs text-muted-foreground">Credits completed {b.completed_credits} of {b.credits}. Average mark {mark(b.average_mark)}.</div>
      </div>
    ))}
    <div className="border-t pt-3 flex flex-wrap gap-x-8 gap-y-1 font-medium">
      <span>Total credits: {transcript.total_credits}</span><span>Completed credits: {transcript.completed_credits}</span><span>Average mark: {mark(transcript.average_mark)}</span>
    </div>
    <p className="text-xs text-muted-foreground">{TRANSCRIPT_RULES}</p>
  </div>
);
