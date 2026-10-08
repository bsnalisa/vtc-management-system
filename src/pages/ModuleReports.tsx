import { useEffect, useMemo } from "react";
import { toast } from "sonner";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { DashboardLayout } from "@/components/DashboardLayout";
import { withRoleAccess } from "@/components/withRoleAccess";
import { ExportMenu } from "@/components/ExportMenu";
import { LoadingIndicator } from "@/components/ui/loading-spinner";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useRoleNavigation } from "@/hooks/useRoleNavigation";
import {
  lastMonths, monthKey, useAffairsReport, useResourceCentreReport, useSurveyReport,
} from "@/hooks/useModuleReports";

const PRIMARY = "hsl(var(--primary))";
const MUTED = "hsl(var(--muted-foreground))";

const money = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const useErrorToast = (error: unknown, what: string) => {
  useEffect(() => {
    if (error) toast.error(`Could not load ${what}: ${(error as Error).message}`);
  }, [error, what]);
};

const Loading = () => <div className="flex justify-center py-12"><LoadingIndicator className="h-8 w-8 text-muted-foreground" /></div>;
const ErrorCard = ({ what, error }: { what: string; error: unknown }) => (
  <Card><CardContent className="py-8 text-center text-destructive">Error loading {what}: {(error as Error).message}</CardContent></Card>
);
const Stat = ({ label, value, hint }: { label: string; value: string | number; hint?: string }) => (
  <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">{label}</p><p className="text-2xl font-bold">{value}</p>{hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}</CardContent></Card>
);

// ---------------- Resource centre ----------------
const ResourceCentreTab = () => {
  const { data, isLoading, error } = useResourceCentreReport();
  useErrorToast(error, "resource centre data");

  const report = useMemo(() => {
    if (!data) return null;
    const months = lastMonths(12);
    const perMonth = new Map(months.map((m) => [m, 0]));
    const titles = new Map<string, number>();
    const today = new Date().toISOString().slice(0, 10);
    let overdue = 0;
    for (const b of data.borrowing) {
      const k = monthKey(b.borrow_date);
      if (perMonth.has(k)) {
        perMonth.set(k, (perMonth.get(k) ?? 0) + 1);
        const t = b.library_items?.title ?? "Unknown title";
        titles.set(t, (titles.get(t) ?? 0) + 1);
      }
      if (!b.return_date && (b.status === "overdue" || b.due_date < today)) overdue += 1;
    }
    // Billed excludes waived fines; collected is what has been paid on any fine.
    const billed = data.fines.filter((f) => f.status !== "waived").reduce((s, f) => s + Number(f.fine_amount), 0);
    const collected = data.fines.reduce((s, f) => s + Number(f.amount_paid), 0);
    return {
      monthly: months.map((m) => ({ month: m, Loans: perMonth.get(m) ?? 0 })),
      top: Array.from(titles.entries()).sort((a, b) => b[1] - a[1]).slice(0, 10),
      overdue, billed, collected, loans: Array.from(perMonth.values()).reduce((a, b) => a + b, 0),
    };
  }, [data]);

  if (isLoading) return <Loading />;
  if (error || !report) return <ErrorCard what="resource centre data" error={error ?? new Error("No data")} />;

  const rows = (): Record<string, unknown>[] => [
    ...report.monthly.map((m) => ({ Section: "Loans per month", Item: m.month, Value: m.Loans })),
    { Section: "Summary", Item: "Overdue loans", Value: report.overdue },
    { Section: "Summary", Item: "Fines billed", Value: report.billed },
    { Section: "Summary", Item: "Fines collected", Value: report.collected },
    ...report.top.map(([t, n]) => ({ Section: "Most borrowed (12 months)", Item: t, Value: n })),
  ];

  return (
    <div className="space-y-4">
      <div className="flex justify-end"><ExportMenu data={rows} filename="resource-centre-report" title="Resource centre" /></div>
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Stat label="Loans (12 months)" value={report.loans} />
        <Stat label="Overdue now" value={report.overdue} hint="Not returned and past due date" />
        <Stat label="Fines billed" value={money(report.billed)} hint="Waived fines excluded" />
        <Stat label="Fines collected" value={money(report.collected)} />
      </div>
      <Card>
        <CardHeader><CardTitle>Loans per month</CardTitle><CardDescription>Last 12 months</CardDescription></CardHeader>
        <CardContent>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={report.monthly}>
                <CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="month" tick={{ fontSize: 11 }} /><YAxis allowDecimals={false} /><Tooltip />
                <Bar dataKey="Loans" fill={PRIMARY} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Most borrowed titles</CardTitle><CardDescription>Last 12 months</CardDescription></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Title</TableHead><TableHead className="text-right">Loans</TableHead></TableRow></TableHeader>
            <TableBody>
              {report.top.length === 0 ? <TableRow><TableCell colSpan={2} className="text-center text-muted-foreground">No loans recorded.</TableCell></TableRow>
                : report.top.map(([t, n]) => <TableRow key={t}><TableCell>{t}</TableCell><TableCell className="text-right">{n}</TableCell></TableRow>)}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

// ---------------- Graduate surveys ----------------
interface QuestionSummary { question: string; type: string; answered: number; average: number | null; counts: [string, number][] }

const SurveysTab = () => {
  const { data, isLoading, error } = useSurveyReport();
  useErrorToast(error, "survey data");

  const report = useMemo(() => {
    if (!data) return null;
    return data.surveys.map((s) => {
      const recipients = data.recipients.filter((r) => r.survey_id === s.id);
      const responses = data.responses.filter((r) => r.survey_id === s.id);
      const questions = data.questions.filter((q) => q.survey_id === s.id).sort((a, b) => a.position - b.position);
      const summaries: QuestionSummary[] = questions.map((q) => {
        const answers = responses.map((r) => r.answers?.[q.id]).filter((a) => a !== undefined && a !== null && a !== "");
        if (q.question_type === "rating") {
          const nums = answers.map(Number).filter((n) => !Number.isNaN(n));
          return { question: q.question_text, type: q.question_type, answered: nums.length, average: nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : null, counts: [] };
        }
        if (q.question_type === "text") return { question: q.question_text, type: q.question_type, answered: answers.length, average: null, counts: [] };
        const tally = new Map<string, number>();
        for (const a of answers) for (const v of Array.isArray(a) ? a : [a]) tally.set(String(v), (tally.get(String(v)) ?? 0) + 1);
        return { question: q.question_text, type: q.question_type, answered: answers.length, average: null, counts: Array.from(tally.entries()).sort((a, b) => b[1] - a[1]) };
      });
      const sent = recipients.length;
      return { survey: s, sent, responded: responses.length, rate: sent ? Math.round((1000 * responses.length) / sent) / 10 : null, summaries };
    });
  }, [data]);

  if (isLoading) return <Loading />;
  if (error || !report) return <ErrorCard what="survey data" error={error ?? new Error("No data")} />;

  const rows = (): Record<string, unknown>[] => report.flatMap<Record<string, unknown>>((r) => r.summaries.length
    ? r.summaries.map((q) => ({
      Survey: r.survey.title, Recipients: r.sent, Responses: r.responded, "Response rate (%)": r.rate ?? "", Question: q.question, Type: q.type,
      Answered: q.answered, Average: q.average == null ? "" : q.average.toFixed(2), Choices: q.counts.map(([k, n]) => `${k}: ${n}`).join("; "),
    }))
    : [{ Survey: r.survey.title, Recipients: r.sent, Responses: r.responded, "Response rate (%)": r.rate ?? "", Question: "", Type: "", Answered: "", Average: "", Choices: "" }]);

  return (
    <div className="space-y-4">
      <div className="flex justify-end"><ExportMenu data={rows} filename="graduate-surveys-report" title="Graduate surveys" disabled={!report.length} /></div>
      {report.length === 0 ? (
        <Card><CardContent className="py-8 text-center text-muted-foreground">No graduate surveys yet.</CardContent></Card>
      ) : (
        <>
          <Card>
            <CardHeader><CardTitle>Response rates</CardTitle></CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader><TableRow><TableHead>Survey</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Recipients</TableHead><TableHead className="text-right">Responses</TableHead><TableHead className="text-right">Rate</TableHead></TableRow></TableHeader>
                <TableBody>
                  {report.map((r) => (
                    <TableRow key={r.survey.id}>
                      <TableCell>{r.survey.title}</TableCell><TableCell><Badge variant="outline" className="capitalize">{r.survey.status}</Badge></TableCell>
                      <TableCell className="text-right">{r.sent}</TableCell><TableCell className="text-right">{r.responded}</TableCell>
                      <TableCell className="text-right">{r.rate == null ? "-" : `${r.rate}%`}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
          {report.map((r) => (
            <Card key={r.survey.id}>
              <CardHeader><CardTitle className="text-base">{r.survey.title}</CardTitle><CardDescription>{r.responded} response(s){r.survey.anonymous ? " (anonymous)" : ""}</CardDescription></CardHeader>
              <CardContent className="space-y-3">
                {r.summaries.length === 0 ? <p className="text-sm text-muted-foreground">This survey has no questions.</p> : r.summaries.map((q, i) => (
                  <div key={i} className="rounded-lg border p-3 space-y-1">
                    <p className="font-medium text-sm">{q.question}</p>
                    <p className="text-xs text-muted-foreground">{q.answered} answer(s)</p>
                    {q.type === "rating" && <p className="text-sm">Average rating: <span className="font-semibold">{q.average == null ? "-" : q.average.toFixed(2)}</span></p>}
                    {q.counts.length > 0 && (
                      <div className="flex flex-wrap gap-2">{q.counts.map(([k, n]) => <Badge key={k} variant="secondary">{k}: {n}</Badge>)}</div>
                    )}
                    {q.type === "text" && <p className="text-xs text-muted-foreground">Free-text answers are not summarised.</p>}
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </>
      )}
    </div>
  );
};

// ---------------- Trainee affairs ----------------
const AffairsTab = () => {
  const { data, isLoading, error } = useAffairsReport();
  useErrorToast(error, "trainee affairs data");

  const report = useMemo(() => {
    if (!data) return null;
    const perType = new Map<string, { total: number; open: number; resolved: number }>();
    const months = lastMonths(12);
    const perMonth = new Map(months.map((m) => [m, 0]));
    let open = 0, resolved = 0, days = 0, timed = 0;
    for (const r of data) {
      const isResolved = r.status === "resolved" || r.status === "closed";
      const t = perType.get(r.record_type) ?? { total: 0, open: 0, resolved: 0 };
      t.total += 1;
      if (isResolved) { t.resolved += 1; resolved += 1; } else { t.open += 1; open += 1; }
      perType.set(r.record_type, t);
      const k = monthKey(r.record_date);
      if (perMonth.has(k)) perMonth.set(k, (perMonth.get(k) ?? 0) + 1);
      if (isResolved) {
        // There is no resolved_at column; the last update of a resolved/closed record is the best available proxy.
        const d = (new Date(r.updated_at).getTime() - new Date(r.created_at).getTime()) / 86_400_000;
        if (d >= 0) { days += d; timed += 1; }
      }
    }
    return {
      types: Array.from(perType.entries()).map(([type, v]) => ({ type: type.replace(/_/g, " "), ...v })).sort((a, b) => b.total - a.total),
      monthly: months.map((m) => ({ month: m, Records: perMonth.get(m) ?? 0 })),
      open, resolved, total: data.length, avgDays: timed ? days / timed : null,
    };
  }, [data]);

  if (isLoading) return <Loading />;
  if (error || !report) return <ErrorCard what="trainee affairs data" error={error ?? new Error("No data")} />;

  const rows = (): Record<string, unknown>[] => [
    ...report.types.map((t) => ({ Section: "By type", Item: t.type, Total: t.total, Open: t.open, Resolved: t.resolved })),
    ...report.monthly.map((m) => ({ Section: "By month", Item: m.month, Total: m.Records, Open: "", Resolved: "" })),
    { Section: "Summary", Item: "Average days to resolve", Total: report.avgDays == null ? "" : report.avgDays.toFixed(1), Open: report.open, Resolved: report.resolved },
  ];

  return (
    <div className="space-y-4">
      <div className="flex justify-end"><ExportMenu data={rows} filename="trainee-affairs-report" title="Trainee affairs" disabled={!report.total} /></div>
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Stat label="Total records" value={report.total} />
        <Stat label="Open / in progress" value={report.open} />
        <Stat label="Resolved / closed" value={report.resolved} />
        <Stat label="Avg. days to resolve" value={report.avgDays == null ? "-" : report.avgDays.toFixed(1)} hint="Created to last update of resolved records" />
      </div>
      <Card>
        <CardHeader><CardTitle>Records per type</CardTitle></CardHeader>
        <CardContent>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={report.types}>
                <CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="type" tick={{ fontSize: 11 }} /><YAxis allowDecimals={false} /><Tooltip /><Legend />
                <Bar dataKey="open" name="Open" stackId="a" fill={MUTED} />
                <Bar dataKey="resolved" name="Resolved" stackId="a" fill={PRIMARY} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Records per month</CardTitle><CardDescription>Last 12 months, by record date</CardDescription></CardHeader>
        <CardContent>
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={report.monthly}>
                <CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="month" tick={{ fontSize: 11 }} /><YAxis allowDecimals={false} /><Tooltip />
                <Bar dataKey="Records" fill={PRIMARY} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-6 overflow-x-auto">
          <Table>
            <TableHeader><TableRow><TableHead>Type</TableHead><TableHead className="text-right">Total</TableHead><TableHead className="text-right">Open</TableHead><TableHead className="text-right">Resolved</TableHead></TableRow></TableHeader>
            <TableBody>
              {report.types.length === 0 ? <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">No records.</TableCell></TableRow>
                : report.types.map((t) => <TableRow key={t.type}><TableCell className="capitalize">{t.type}</TableCell><TableCell className="text-right">{t.total}</TableCell><TableCell className="text-right">{t.open}</TableCell><TableCell className="text-right">{t.resolved}</TableCell></TableRow>)}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

const ModuleReports = () => {
  const { navItems, groupLabel } = useRoleNavigation();
  return (
    <DashboardLayout title="Module Reports" subtitle="Resource centre, graduate surveys and trainee affairs" navItems={navItems} groupLabel={groupLabel}>
      <Tabs defaultValue="resource" className="space-y-4">
        <TabsList>
          <TabsTrigger value="resource">Resource centre</TabsTrigger>
          <TabsTrigger value="surveys">Graduate surveys</TabsTrigger>
          <TabsTrigger value="affairs">Trainee affairs</TabsTrigger>
        </TabsList>
        <TabsContent value="resource"><ResourceCentreTab /></TabsContent>
        <TabsContent value="surveys"><SurveysTab /></TabsContent>
        <TabsContent value="affairs"><AffairsTab /></TabsContent>
      </Tabs>
    </DashboardLayout>
  );
};

export default withRoleAccess(ModuleReports, {
  requiredRoles: ["admin", "organization_admin", "head_of_training", "head_of_trainee_support", "librarian", "registration_officer"],
});
