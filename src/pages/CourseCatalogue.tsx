import { Fragment, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ChevronDown, ChevronRight, Search } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useRoleNavigation } from "@/hooks/useRoleNavigation";
import { useOrganizationContext } from "@/hooks/useOrganizationContext";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

interface UnitStandard { id: string; unit_standard_id: string; unit_standard_title: string; credit_value: number | null; level: number; is_mandatory: boolean }
interface CatalogueQualification {
  id: string; qualification_title: string; qualification_code: string; qualification_type: string; nqf_level: number;
  duration_value: number; duration_unit: string; trade_id: string | null;
  trades: { id: string; name: string; code: string } | null;
  qualification_unit_standards: UnitStandard[];
}

const useCatalogue = () => {
  const { organizationId } = useOrganizationContext();
  return useQuery({
    queryKey: ["course-catalogue", organizationId], enabled: !!organizationId,
    queryFn: async () => {
      const { data, error } = await db.from("qualifications")
        .select("id, qualification_title, qualification_code, qualification_type, nqf_level, duration_value, duration_unit, trade_id, trades(id,name,code), qualification_unit_standards(id,unit_standard_id,unit_standard_title,credit_value,level,is_mandatory)")
        .eq("organization_id", organizationId).eq("status", "approved").eq("active", true).order("qualification_title");
      if (error) { toast.error(error.message); throw error; }
      return data as CatalogueQualification[];
    },
  });
};

const CourseCatalogue = () => {
  const { navItems, groupLabel } = useRoleNavigation();
  const { data, isLoading } = useCatalogue();
  const [search, setSearch] = useState("");
  const [nqf, setNqf] = useState("all");
  const [expanded, setExpanded] = useState<string | null>(null);

  const levels = useMemo(() => Array.from(new Set((data ?? []).map((q) => q.nqf_level))).sort((a, b) => a - b), [data]);
  const groups = useMemo(() => {
    const term = search.trim().toLowerCase();
    const m = new Map<string, CatalogueQualification[]>();
    (data ?? [])
      .filter((q) => (nqf === "all" || q.nqf_level === Number(nqf)) &&
        (!term || q.qualification_title.toLowerCase().includes(term) || q.qualification_code.toLowerCase().includes(term)))
      .forEach((q) => { const k = q.trades?.name ?? "Other"; m.set(k, [...(m.get(k) ?? []), q]); });
    return Array.from(m.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [data, search, nqf]);

  const credits = (q: CatalogueQualification) => q.qualification_unit_standards.reduce((s, u) => s + (u.credit_value ?? 0), 0);

  return (
    <DashboardLayout title="Course Catalogue" subtitle="Approved qualifications offered at the centre" navItems={navItems} groupLabel={groupLabel}>
      <Card className="border-0 shadow-md">
        <CardHeader className="flex-row items-start justify-between space-y-0 gap-2 flex-wrap">
          <div><CardTitle>Qualifications</CardTitle><CardDescription>Select a row to see its unit standards.</CardDescription></div>
          <div className="flex gap-2 flex-wrap">
            <div className="relative"><Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" /><Input className="pl-8 w-[220px]" placeholder="Search title or code" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
            <Select value={nqf} onValueChange={setNqf}>
              <SelectTrigger className="w-[140px]"><SelectValue placeholder="NQF level" /></SelectTrigger>
              <SelectContent><SelectItem value="all">All levels</SelectItem>{levels.map((l) => <SelectItem key={l} value={String(l)}>Level {l}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {groups.map(([trade, list]) => (
            <div key={trade} className="space-y-2">
              <h3 className="font-semibold">{trade}</h3>
              <Table>
                <TableHeader><TableRow><TableHead className="w-8" /><TableHead>Qualification</TableHead><TableHead>Code</TableHead><TableHead>Type</TableHead><TableHead>NQF</TableHead><TableHead>Duration</TableHead></TableRow></TableHeader>
                <TableBody>
                  {list.map((q) => (
                    <Fragment key={q.id}>
                      <TableRow className="cursor-pointer" onClick={() => setExpanded(expanded === q.id ? null : q.id)}>
                        <TableCell>
                          <Button variant="ghost" size="icon" className="h-6 w-6" aria-label="Toggle unit standards" aria-expanded={expanded === q.id}>
                            {expanded === q.id ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                          </Button>
                        </TableCell>
                        <TableCell className="font-medium">{q.qualification_title}</TableCell>
                        <TableCell>{q.qualification_code}</TableCell>
                        <TableCell><Badge variant="secondary">{q.qualification_type.toUpperCase()}</Badge></TableCell>
                        <TableCell>{q.nqf_level}</TableCell>
                        <TableCell>{q.duration_value} {q.duration_unit}</TableCell>
                      </TableRow>
                      {expanded === q.id && (
                        <TableRow>
                          <TableCell />
                          <TableCell colSpan={5}>
                            {q.qualification_unit_standards.length ? (
                              <div className="space-y-2">
                                <Table>
                                  <TableHeader><TableRow><TableHead>Unit standard</TableHead><TableHead>Title</TableHead><TableHead>Level</TableHead><TableHead>Credits</TableHead><TableHead /></TableRow></TableHeader>
                                  <TableBody>
                                    {q.qualification_unit_standards.map((u) => (
                                      <TableRow key={u.id}>
                                        <TableCell>{u.unit_standard_id}</TableCell><TableCell>{u.unit_standard_title}</TableCell>
                                        <TableCell>{u.level}</TableCell><TableCell>{u.credit_value ?? "-"}</TableCell>
                                        <TableCell>{u.is_mandatory ? <Badge>Mandatory</Badge> : <Badge variant="outline">Elective</Badge>}</TableCell>
                                      </TableRow>
                                    ))}
                                  </TableBody>
                                </Table>
                                <p className="text-sm font-medium">Total credits: {credits(q)}</p>
                              </div>
                            ) : <p className="text-sm text-muted-foreground">No unit standards have been listed for this qualification.</p>}
                          </TableCell>
                        </TableRow>
                      )}
                    </Fragment>
                  ))}
                </TableBody>
              </Table>
            </div>
          ))}
          {!isLoading && !groups.length && <p className="text-sm text-muted-foreground text-center py-8">No qualifications match.</p>}
        </CardContent>
      </Card>
    </DashboardLayout>
  );
};

export default CourseCatalogue;
