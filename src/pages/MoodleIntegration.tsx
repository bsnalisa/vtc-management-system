import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Plug, RefreshCw, Users, GraduationCap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useRoleNavigation } from "@/hooks/useRoleNavigation";
import { useOrganizationContext } from "@/hooks/useOrganizationContext";
import { withRoleAccess } from "@/components/withRoleAccess";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

// Newer than the generated Supabase types, so access untyped.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

// Calls the moodle-sync edge function and turns a failure into a readable message
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function callMoodle(body: Record<string, unknown>): Promise<any> {
  const { data, error } = await supabase.functions.invoke("moodle-sync", { body });
  if (error) {
    // the function answers with { error } and a non-2xx status; surface that text
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ctx = (error as any).context;
    let message = error.message;
    try { const j = await ctx?.json?.(); if (j?.error) message = j.error; } catch { /* keep the generic message */ }
    throw new Error(message);
  }
  if (data?.error) throw new Error(data.error);
  return data;
}

const MoodleIntegration = () => {
  const { navItems, groupLabel } = useRoleNavigation();
  const { organizationId } = useOrganizationContext();
  const qc = useQueryClient();
  const [classId, setClassId] = useState("");
  const [courseId, setCourseId] = useState("");
  const [report, setReport] = useState<string[]>([]);

  const classes = useQuery({
    queryKey: ["moodle-classes", organizationId], enabled: !!organizationId,
    queryFn: async () => {
      const { data, error } = await db.from("classes").select("id, class_name, class_code, academic_year").eq("organization_id", organizationId).order("class_name");
      if (error) throw error;
      return data as { id: string; class_name: string; class_code: string; academic_year: string }[];
    },
  });
  const links = useQuery({
    queryKey: ["moodle-links", organizationId], enabled: !!organizationId,
    queryFn: async () => {
      const { data, error } = await db.from("moodle_course_links").select("*").eq("organization_id", organizationId);
      if (error) throw error;
      return data as { class_id: string; moodle_course_id: number; moodle_course_name: string | null; last_enrol_at: string | null; last_grades_at: string | null }[];
    },
  });
  const link = links.data?.find((l) => l.class_id === classId);
  const grades = useQuery({
    queryKey: ["moodle-grades", classId], enabled: !!classId,
    queryFn: async () => {
      const { data, error } = await db.from("moodle_grade_imports").select("item_name, grade, grade_max, percentage, imported_at, trainees(first_name,last_name,trainee_id)")
        .eq("class_id", classId).order("item_name");
      if (error) throw error;
      return data as { item_name: string; grade: number | null; grade_max: number | null; percentage: string | null; imported_at: string; trainees: { first_name: string; last_name: string; trainee_id: string } | null }[];
    },
  });

  const test = useMutation({
    mutationFn: () => callMoodle({ action: "test" }),
    onSuccess: (d) => toast.success(`Connected to ${d.site} (Moodle ${d.release}) as ${d.user}`),
    onError: (e: Error) => toast.error(e.message),
  });
  const courses = useMutation({
    mutationFn: () => callMoodle({ action: "courses" }),
    onError: (e: Error) => toast.error(e.message),
  });
  const doLink = useMutation({
    mutationFn: () => callMoodle({ action: "link", class_id: classId, moodle_course_id: Number(courseId) }),
    onSuccess: (d) => { toast.success(`Linked to ${d.course}`); qc.invalidateQueries({ queryKey: ["moodle-links"] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  const enrol = useMutation({
    mutationFn: () => callMoodle({ action: "enrol", class_id: classId }),
    onSuccess: (d) => {
      setReport([`${d.enrolled} trainee(s) enrolled, ${d.created} new Moodle account(s) created.`, ...d.skipped]);
      qc.invalidateQueries({ queryKey: ["moodle-links"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const pull = useMutation({
    mutationFn: () => callMoodle({ action: "grades", class_id: classId }),
    onSuccess: (d) => {
      setReport([`${d.imported} grade(s) imported.`, ...d.problems]);
      qc.invalidateQueries({ queryKey: ["moodle-grades"] }); qc.invalidateQueries({ queryKey: ["moodle-links"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const busy = test.isPending || courses.isPending || doLink.isPending || enrol.isPending || pull.isPending;

  return (
    <DashboardLayout title="Moodle" subtitle="Enrol a class in a Moodle course and bring its grades back" navItems={navItems} groupLabel={groupLabel}>
      <div className="space-y-6">
        <Card className="border-0 shadow-md">
          <CardHeader>
            <CardTitle>Connection</CardTitle>
            <CardDescription>
              The Moodle address and web-service token are stored as the secrets MOODLE_URL and MOODLE_TOKEN on the server, never in the browser.
              This connection has not been tested against your Moodle yet: start with the button below.
            </CardDescription>
          </CardHeader>
          <CardContent><Button variant="outline" onClick={() => test.mutate()} disabled={busy}>{test.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plug className="h-4 w-4 mr-2" />}Test connection</Button></CardContent>
        </Card>

        <Card className="border-0 shadow-md">
          <CardHeader><CardTitle>Link a class to a course</CardTitle><CardDescription>Trainees are matched by email address; those without a Moodle account get one (Moodle emails them to set a password).</CardDescription></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
              <Select value={classId} onValueChange={(v) => { setClassId(v); setReport([]); }}>
                <SelectTrigger><SelectValue placeholder="Choose a class" /></SelectTrigger>
                <SelectContent>{classes.data?.map((c) => <SelectItem key={c.id} value={c.id}>{c.class_name} ({c.class_code}, {c.academic_year})</SelectItem>)}</SelectContent>
              </Select>
              <div className="flex gap-2">
                <Select value={courseId} onValueChange={setCourseId} disabled={!courses.data}>
                  <SelectTrigger><SelectValue placeholder={courses.data ? "Choose a Moodle course" : "Load the course list first"} /></SelectTrigger>
                  <SelectContent>{courses.data?.courses.map((c: { id: number; name: string }) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}</SelectContent>
                </Select>
                <Button variant="outline" onClick={() => courses.mutate()} disabled={busy}>{courses.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}</Button>
              </div>
            </div>
            <Button onClick={() => doLink.mutate()} disabled={busy || !classId || !courseId}>Link class to course</Button>

            {classId && (
              <div className="border rounded-md p-3 text-sm space-y-3">
                {link ? (
                  <>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge>Linked</Badge><span className="font-medium">{link.moodle_course_name ?? `Course ${link.moodle_course_id}`}</span>
                      <span className="text-muted-foreground">
                        {link.last_enrol_at ? `Last enrolled ${new Date(link.last_enrol_at).toLocaleString()}` : "Not enrolled yet"}
                        {link.last_grades_at ? ` · grades pulled ${new Date(link.last_grades_at).toLocaleString()}` : ""}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" onClick={() => enrol.mutate()} disabled={busy}>{enrol.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Users className="h-4 w-4 mr-2" />}Enrol the class's trainees</Button>
                      <Button size="sm" variant="outline" onClick={() => pull.mutate()} disabled={busy}>{pull.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <GraduationCap className="h-4 w-4 mr-2" />}Import grades</Button>
                    </div>
                  </>
                ) : <span className="text-muted-foreground">This class is not linked to a Moodle course yet.</span>}
                {report.length > 0 && <ul className="list-disc pl-5 space-y-1">{report.map((r, i) => <li key={i}>{r}</li>)}</ul>}
              </div>
            )}
          </CardContent>
        </Card>

        {classId && (
          <Card className="border-0 shadow-md">
            <CardHeader><CardTitle>Imported grades</CardTitle><CardDescription>Shown for reference. They are not copied into the gradebook automatically.</CardDescription></CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader><TableRow><TableHead>Trainee</TableHead><TableHead>Item</TableHead><TableHead className="text-right">Grade</TableHead><TableHead className="text-right">Out of</TableHead><TableHead className="text-right">%</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {grades.data?.map((g, i) => (
                      <TableRow key={i}>
                        <TableCell className="whitespace-nowrap">{g.trainees ? `${g.trainees.first_name} ${g.trainees.last_name} (${g.trainees.trainee_id})` : ""}</TableCell>
                        <TableCell>{g.item_name}</TableCell>
                        <TableCell className="text-right">{g.grade ?? ""}</TableCell>
                        <TableCell className="text-right">{g.grade_max ?? ""}</TableCell>
                        <TableCell className="text-right">{g.percentage ?? ""}</TableCell>
                      </TableRow>
                    ))}
                    {!grades.isLoading && !grades.data?.length && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">No grades imported yet.</TableCell></TableRow>}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
};

export default withRoleAccess(MoodleIntegration, { requiredRoles: ["admin", "organization_admin", "head_of_training", "hod"] });
