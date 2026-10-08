import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Printer } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { DashboardLayout } from "@/components/DashboardLayout";
import { withRoleAccess } from "@/components/withRoleAccess";
import { ExportMenu } from "@/components/ExportMenu";
import { LoadingIndicator } from "@/components/ui/loading-spinner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useRoleNavigation } from "@/hooks/useRoleNavigation";
import { useOrganizationContext } from "@/hooks/useOrganizationContext";
import { useAssessmentCertificationSummary, useCertifiedTrainees } from "@/hooks/useCertificationReports";
import { esc, htmlTable, printHtml } from "@/lib/printDocument";

const ALL = "all";

const CertificationReports = () => {
  const { navItems, groupLabel } = useRoleNavigation();
  const { organizationName } = useOrganizationContext();
  const [year, setYear] = useState(ALL);
  const [trade, setTrade] = useState(ALL);
  const [level, setLevel] = useState(ALL);

  // Fetch every year once; the year filter and the year list are derived client-side.
  const certified = useCertifiedTrainees(null);
  const summary = useAssessmentCertificationSummary(null);

  useEffect(() => {
    if (certified.error) toast.error(`Could not load certified trainees: ${(certified.error as Error).message}`);
  }, [certified.error]);
  useEffect(() => {
    if (summary.error) toast.error(`Could not load the assessment summary: ${(summary.error as Error).message}`);
  }, [summary.error]);

  const certRows = useMemo(() => certified.data ?? [], [certified.data]);
  const sumRows = useMemo(() => summary.data ?? [], [summary.data]);

  const years = useMemo(
    () => Array.from(new Set([...certRows.map((r) => r.academic_year), ...sumRows.map((r) => r.academic_year)])).sort().reverse(),
    [certRows, sumRows],
  );
  const trades = useMemo(() => Array.from(new Set(certRows.map((r) => r.trade ?? "No trade"))).sort(), [certRows]);
  const levels = useMemo(() => Array.from(new Set(certRows.map((r) => r.level).filter((l): l is number => l != null))).sort((a, b) => a - b), [certRows]);

  const filteredCert = useMemo(
    () => certRows.filter((r) =>
      (year === ALL || r.academic_year === year) &&
      (trade === ALL || (r.trade ?? "No trade") === trade) &&
      (level === ALL || String(r.level) === level)),
    [certRows, year, trade, level],
  );
  const filteredSum = useMemo(() => sumRows.filter((r) => year === ALL || r.academic_year === year), [sumRows, year]);

  const grouped = useMemo(() => {
    const m = new Map<string, { trade: string; level: string; count: number }>();
    for (const r of filteredCert) {
      const t = r.trade ?? "No trade";
      const l = r.level == null ? "-" : String(r.level);
      const k = `${t}|${l}`;
      const cur = m.get(k) ?? { trade: t, level: l, count: 0 };
      cur.count += 1;
      m.set(k, cur);
    }
    return Array.from(m.values()).sort((a, b) => a.trade.localeCompare(b.trade) || a.level.localeCompare(b.level));
  }, [filteredCert]);

  const certExport = () => filteredCert.map((r) => ({
    "Trainee Number": r.trainee_number, "First Name": r.first_name, "Last Name": r.last_name, Trade: r.trade ?? "",
    Level: r.level ?? "", Qualification: r.qualification, "Qualification Code": r.qualification_code,
    "NQF Level": r.nqf_level ?? "", "Academic Year": r.academic_year, "Certified On": r.certified_on ?? "",
  }));
  const sumExport = () => filteredSum.map((r) => ({
    Qualification: r.qualification, Code: r.qualification_code, "Academic Year": r.academic_year, Candidates: r.candidates,
    Certified: r.certified, "Not Yet Certified": r.not_yet_certified, "Certification Rate (%)": r.certification_rate ?? "",
  }));

  const org = { name: organizationName };
  const printCertified = () => {
    try {
      const filters = `Academic year: ${year === ALL ? "all" : year} · Trade: ${trade === ALL ? "all" : trade} · Level: ${level === ALL ? "all" : level}`;
      const body = `<p class="note">${esc(filters)} · ${filteredCert.length} certified trainee(s)</p>` +
        "<h3>Certified per trade and level</h3>" + htmlTable(["Trade", "Level", "Certified"], grouped.map((g) => [g.trade, g.level, g.count]), { rightAlign: [2] }) +
        "<h3>Trainees</h3>" + htmlTable(
          ["Trainee no.", "Name", "Trade", "Level", "Qualification", "Year", "Certified on"],
          filteredCert.map((r) => [r.trainee_number, `${r.first_name} ${r.last_name}`, r.trade ?? "", r.level ?? "", `${r.qualification_code} ${r.qualification}`, r.academic_year, r.certified_on ?? ""]));
      printHtml("Certified trainees", body, org);
    } catch (e) {
      toast.error(`Could not print: ${e instanceof Error ? e.message : "unknown error"}`);
    }
  };
  const printSummary = () => {
    try {
      const body = `<p class="note">Academic year: ${esc(year === ALL ? "all" : year)}</p>` + htmlTable(
        ["Qualification", "Code", "Year", "Candidates", "Certified", "Not yet certified", "Rate %"],
        filteredSum.map((r) => [r.qualification, r.qualification_code, r.academic_year, r.candidates, r.certified, r.not_yet_certified, r.certification_rate ?? ""]),
        { rightAlign: [3, 4, 5, 6] });
      printHtml("Assessment certification summary", body, org);
    } catch (e) {
      toast.error(`Could not print: ${e instanceof Error ? e.message : "unknown error"}`);
    }
  };

  const chartData = filteredSum.map((r) => ({
    name: year === ALL ? `${r.qualification_code} (${r.academic_year})` : r.qualification_code || r.qualification,
    Candidates: r.candidates,
    Certified: r.certified,
  }));

  const loading = certified.isLoading || summary.isLoading;

  return (
    <DashboardLayout title="Certification Reports" subtitle="Certified trainees and assessment certification rates (approved results only)" navItems={navItems} groupLabel={groupLabel}>
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Filters</CardTitle>
            <CardDescription>Academic year applies to both reports; trade and level apply to certified trainees.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col md:flex-row gap-4">
            <Select value={year} onValueChange={setYear}>
              <SelectTrigger className="w-full md:w-[200px]"><SelectValue placeholder="Academic year" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All academic years</SelectItem>
                {years.map((y) => <SelectItem key={y} value={y}>{y}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={trade} onValueChange={setTrade}>
              <SelectTrigger className="w-full md:w-[220px]"><SelectValue placeholder="Trade" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All trades</SelectItem>
                {trades.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={level} onValueChange={setLevel}>
              <SelectTrigger className="w-full md:w-[160px]"><SelectValue placeholder="Level" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All levels</SelectItem>
                {levels.map((l) => <SelectItem key={l} value={String(l)}>Level {l}</SelectItem>)}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {loading ? (
          <div className="flex justify-center py-12"><LoadingIndicator className="h-8 w-8 text-muted-foreground" /></div>
        ) : (
          <Tabs defaultValue="certified" className="space-y-4">
            <TabsList>
              <TabsTrigger value="certified">Certified trainees</TabsTrigger>
              <TabsTrigger value="assessment">Assessment certification</TabsTrigger>
            </TabsList>

            <TabsContent value="certified" className="space-y-4">
              <div className="flex flex-wrap gap-2 justify-end">
                <ExportMenu data={certExport} filename="certified-trainees" title="Certified trainees" disabled={!filteredCert.length} />
                <Button variant="outline" onClick={printCertified} disabled={!filteredCert.length}><Printer className="h-4 w-4 mr-2" />Print</Button>
              </div>
              {certified.error ? (
                <Card><CardContent className="py-8 text-center text-destructive">Error loading certified trainees: {(certified.error as Error).message}</CardContent></Card>
              ) : (
                <>
                  <Card>
                    <CardHeader>
                      <CardTitle>Certified per trade and level</CardTitle>
                      <CardDescription>{filteredCert.length} certified trainee(s) match the filters</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {grouped.length === 0 ? <p className="text-sm text-muted-foreground">No certified trainees match the filters.</p> : (
                        <Table>
                          <TableHeader><TableRow><TableHead>Trade</TableHead><TableHead>Level</TableHead><TableHead className="text-right">Certified</TableHead></TableRow></TableHeader>
                          <TableBody>
                            {grouped.map((g) => (
                              <TableRow key={`${g.trade}|${g.level}`}>
                                <TableCell>{g.trade}</TableCell><TableCell>{g.level}</TableCell><TableCell className="text-right">{g.count}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      )}
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader><CardTitle>Certified trainees</CardTitle></CardHeader>
                    <CardContent className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Trainee no.</TableHead><TableHead>Name</TableHead><TableHead>Trade</TableHead><TableHead>Level</TableHead>
                            <TableHead>Qualification</TableHead><TableHead>NQF</TableHead><TableHead>Year</TableHead><TableHead>Certified on</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredCert.length === 0 ? (
                            <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground">No certified trainees found.</TableCell></TableRow>
                          ) : filteredCert.map((r) => (
                            <TableRow key={`${r.trainee_number}|${r.qualification_code}|${r.academic_year}`}>
                              <TableCell>{r.trainee_number}</TableCell>
                              <TableCell>{r.first_name} {r.last_name}</TableCell>
                              <TableCell>{r.trade ?? "-"}</TableCell>
                              <TableCell>{r.level ?? "-"}</TableCell>
                              <TableCell>{r.qualification_code} {r.qualification}</TableCell>
                              <TableCell>{r.nqf_level ?? "-"}</TableCell>
                              <TableCell>{r.academic_year}</TableCell>
                              <TableCell>{r.certified_on ?? "-"}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                </>
              )}
            </TabsContent>

            <TabsContent value="assessment" className="space-y-4">
              <div className="flex flex-wrap gap-2 justify-end">
                <ExportMenu data={sumExport} filename="assessment-certification-summary" title="Assessment certification" disabled={!filteredSum.length} />
                <Button variant="outline" onClick={printSummary} disabled={!filteredSum.length}><Printer className="h-4 w-4 mr-2" />Print</Button>
              </div>
              {summary.error ? (
                <Card><CardContent className="py-8 text-center text-destructive">Error loading the summary: {(summary.error as Error).message}</CardContent></Card>
              ) : (
                <>
                  <Card>
                    <CardHeader>
                      <CardTitle>Candidates vs certified</CardTitle>
                      <CardDescription>Per qualification</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {chartData.length === 0 ? <p className="text-sm text-muted-foreground">No assessment results found.</p> : (
                        <div className="h-72 w-full">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={chartData}>
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis dataKey="name" interval={0} tick={{ fontSize: 11 }} />
                              <YAxis allowDecimals={false} />
                              <Tooltip />
                              <Legend />
                              <Bar dataKey="Candidates" fill="hsl(var(--muted-foreground))" />
                              <Bar dataKey="Certified" fill="hsl(var(--primary))" />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-6 overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Qualification</TableHead><TableHead>Year</TableHead>
                            <TableHead className="text-right">Candidates</TableHead><TableHead className="text-right">Certified</TableHead>
                            <TableHead className="text-right">Not yet certified</TableHead><TableHead className="text-right">Rate</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredSum.length === 0 ? (
                            <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">No data.</TableCell></TableRow>
                          ) : filteredSum.map((r) => (
                            <TableRow key={`${r.qualification_code}|${r.academic_year}`}>
                              <TableCell>{r.qualification_code} {r.qualification}</TableCell>
                              <TableCell>{r.academic_year}</TableCell>
                              <TableCell className="text-right">{r.candidates}</TableCell>
                              <TableCell className="text-right">{r.certified}</TableCell>
                              <TableCell className="text-right">{r.not_yet_certified}</TableCell>
                              <TableCell className="text-right"><Badge variant={(r.certification_rate ?? 0) >= 50 ? "default" : "secondary"}>{r.certification_rate ?? 0}%</Badge></TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                </>
              )}
            </TabsContent>
          </Tabs>
        )}
      </div>
    </DashboardLayout>
  );
};

export default withRoleAccess(CertificationReports, {
  requiredRoles: ["admin", "organization_admin", "registration_officer", "head_of_training", "assessment_coordinator", "hod"],
});
