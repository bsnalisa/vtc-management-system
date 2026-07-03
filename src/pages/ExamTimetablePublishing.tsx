import { useState, useMemo } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { assessmentCoordinatorNavItems } from "@/lib/navigationConfig";
import { withRoleAccess } from "@/components/withRoleAccess";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Calendar, Plus, Send, Trash2, Users, DoorOpen, Pencil } from "lucide-react";
import {
  useExamTimetables,
  useSaveExamTimetable,
  useTogglePublishExam,
  useDeleteExamTimetable,
  useInvigilators,
  useSaveInvigilator,
  useDeleteInvigilator,
  type ExamTimetableRow,
  type InvigilatorRow,
} from "@/hooks/useExamTimetables";
import { useQualifications } from "@/hooks/useQualifications";
import { useTrainingRooms } from "@/hooks/useTrainingBuildings";
import { supabase } from "@/integrations/supabase/client";
import { useOrganizationContext } from "@/hooks/useOrganizationContext";
import { useQuery } from "@tanstack/react-query";

const emptyExam: Partial<ExamTimetableRow> = {
  academic_year: new Date().getFullYear().toString(),
  level: 1,
  exam_type: "theory",
  min_theory_ca: 50,
  min_practical_avg: 60,
};

const ExamTimetablePublishing = () => {
  const { organizationId } = useOrganizationContext();
  const { data: exams = [], isLoading } = useExamTimetables();
  const { data: quals = [] } = useQualifications();
  const { data: rooms = [] } = useTrainingRooms();
  const { data: invigilators = [] } = useInvigilators();
  const saveExam = useSaveExamTimetable();
  const togglePublish = useTogglePublishExam();
  const deleteExam = useDeleteExamTimetable();

  // gradebooks for org (approved / in progress) for linking
  const { data: gradebooks = [] } = useQuery({
    queryKey: ["exam-gradebooks", organizationId],
    queryFn: async () => {
      if (!organizationId) return [];
      const { data } = await supabase
        .from("gradebooks")
        .select("id, title, academic_year, qualification_id, status")
        .eq("organization_id", organizationId)
        .order("updated_at", { ascending: false });
      return data || [];
    },
    enabled: !!organizationId,
  });

  const [examDialog, setExamDialog] = useState(false);
  const [editingExam, setEditingExam] = useState<Partial<ExamTimetableRow>>(emptyExam);

  const openExam = (row?: ExamTimetableRow) => {
    setEditingExam(row ? { ...row } : emptyExam);
    setExamDialog(true);
  };
  const submitExam = async () => {
    if (!editingExam.qualification_id || !editingExam.subject_name || !editingExam.exam_date) return;
    await saveExam.mutateAsync(editingExam);
    setExamDialog(false);
  };

  const draftCount = exams.filter((e) => !e.published).length;
  const publishedCount = exams.filter((e) => e.published).length;

  return (
    <DashboardLayout
      title="Exam Timetable Publishing"
      subtitle="Create, assign rooms & invigilators, set eligibility, and publish to trainees"
      navItems={assessmentCoordinatorNavItems}
      groupLabel="Assessment Coordinator"
    >
      <div className="space-y-6">
        {/* Summary */}
        <div className="grid gap-4 md:grid-cols-3">
          <SummaryCard label="Draft" value={draftCount} icon={<Pencil className="h-4 w-4" />} />
          <SummaryCard label="Published" value={publishedCount} icon={<Send className="h-4 w-4" />} />
          <SummaryCard label="Invigilators" value={invigilators.length} icon={<Users className="h-4 w-4" />} />
        </div>

        <Tabs defaultValue="exams">
          <TabsList>
            <TabsTrigger value="exams">
              <Calendar className="h-4 w-4 mr-2" />
              Exams
            </TabsTrigger>
            <TabsTrigger value="invigilators">
              <Users className="h-4 w-4 mr-2" />
              Invigilators
            </TabsTrigger>
          </TabsList>

          <TabsContent value="exams" className="space-y-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-2">
                <div>
                  <CardTitle>Exam Sittings</CardTitle>
                  <CardDescription>Manage exam schedule for the organisation</CardDescription>
                </div>
                <Button onClick={() => openExam()}>
                  <Plus className="h-4 w-4 mr-1" /> New Sitting
                </Button>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <p className="text-sm text-muted-foreground">Loading…</p>
                ) : exams.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">No exams scheduled yet.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Subject</TableHead>
                          <TableHead>Qualification</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Room</TableHead>
                          <TableHead>Invigilator</TableHead>
                          <TableHead>Eligibility</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {exams.map((e) => (
                          <TableRow key={e.id}>
                            <TableCell>
                              <div className="font-medium">{new Date(e.exam_date).toLocaleDateString()}</div>
                              <div className="text-xs text-muted-foreground">
                                {e.start_time?.slice(0, 5)}{e.end_time ? `–${e.end_time.slice(0, 5)}` : ""}
                              </div>
                            </TableCell>
                            <TableCell>{e.subject_name}</TableCell>
                            <TableCell className="text-xs">
                              {e.qualifications?.qualification_code || "—"}
                            </TableCell>
                            <TableCell>
                              <Badge variant={e.exam_type === "theory" ? "secondary" : "outline"}>
                                {e.exam_type}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs">
                              {e.training_rooms?.name || e.venue || "—"}
                            </TableCell>
                            <TableCell className="text-xs">
                              {e.invigilators?.full_name || "—"}
                            </TableCell>
                            <TableCell className="text-xs">
                              {e.exam_type === "theory" ? `CA ≥ ${e.min_theory_ca}%` : `Prac ≥ ${e.min_practical_avg}%`}
                            </TableCell>
                            <TableCell>
                              {e.published ? (
                                <Badge className="bg-green-100 text-green-800">Published</Badge>
                              ) : (
                                <Badge variant="secondary">Draft</Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-right space-x-1">
                              <Button size="sm" variant="ghost" onClick={() => openExam(e)}>
                                <Pencil className="h-3 w-3" />
                              </Button>
                              <Button
                                size="sm"
                                variant={e.published ? "outline" : "default"}
                                onClick={() => togglePublish.mutate({ id: e.id, published: !e.published })}
                              >
                                {e.published ? "Unpublish" : "Publish"}
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  if (confirm("Delete this exam sitting?")) deleteExam.mutate(e.id);
                                }}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="invigilators">
            <InvigilatorsPanel invigilators={invigilators} />
          </TabsContent>
        </Tabs>

        {/* Exam Dialog */}
        <Dialog open={examDialog} onOpenChange={setExamDialog}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingExam.id ? "Edit Exam Sitting" : "New Exam Sitting"}</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 md:grid-cols-2 py-2">
              <div className="md:col-span-2">
                <Label>Subject Name *</Label>
                <Input
                  value={editingExam.subject_name || ""}
                  onChange={(ev) => setEditingExam({ ...editingExam, subject_name: ev.target.value })}
                  placeholder="e.g. Automotive Systems – Theory Paper 1"
                />
              </div>
              <div>
                <Label>Qualification *</Label>
                <Select
                  value={editingExam.qualification_id || ""}
                  onValueChange={(v) => setEditingExam({ ...editingExam, qualification_id: v })}
                >
                  <SelectTrigger><SelectValue placeholder="Select qualification" /></SelectTrigger>
                  <SelectContent>
                    {quals.map((q: any) => (
                      <SelectItem key={q.id} value={q.id}>
                        {q.qualification_code} — {q.qualification_title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Linked Gradebook (for eligibility)</Label>
                <Select
                  value={editingExam.gradebook_id || "none"}
                  onValueChange={(v) => setEditingExam({ ...editingExam, gradebook_id: v === "none" ? null : v })}
                >
                  <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {gradebooks
                      .filter((g: any) => !editingExam.qualification_id || g.qualification_id === editingExam.qualification_id)
                      .map((g: any) => (
                        <SelectItem key={g.id} value={g.id}>
                          {g.title} ({g.academic_year})
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Exam Type *</Label>
                <Select
                  value={editingExam.exam_type || "theory"}
                  onValueChange={(v: "theory" | "practical") => setEditingExam({ ...editingExam, exam_type: v })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="theory">Theory</SelectItem>
                    <SelectItem value="practical">Practical</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Academic Year</Label>
                <Input
                  value={editingExam.academic_year || ""}
                  onChange={(ev) => setEditingExam({ ...editingExam, academic_year: ev.target.value })}
                />
              </div>
              <div>
                <Label>Level</Label>
                <Input
                  type="number"
                  value={editingExam.level ?? 1}
                  onChange={(ev) => setEditingExam({ ...editingExam, level: Number(ev.target.value) })}
                />
              </div>
              <div>
                <Label>Exam Date *</Label>
                <Input
                  type="date"
                  value={editingExam.exam_date || ""}
                  onChange={(ev) => setEditingExam({ ...editingExam, exam_date: ev.target.value })}
                />
              </div>
              <div>
                <Label>Start Time</Label>
                <Input
                  type="time"
                  value={editingExam.start_time || ""}
                  onChange={(ev) => setEditingExam({ ...editingExam, start_time: ev.target.value })}
                />
              </div>
              <div>
                <Label>End Time</Label>
                <Input
                  type="time"
                  value={editingExam.end_time || ""}
                  onChange={(ev) => setEditingExam({ ...editingExam, end_time: ev.target.value })}
                />
              </div>
              <div>
                <Label>Room</Label>
                <Select
                  value={editingExam.room_id || "none"}
                  onValueChange={(v) => setEditingExam({ ...editingExam, room_id: v === "none" ? null : v })}
                >
                  <SelectTrigger><SelectValue placeholder="Select room" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None (use venue text)</SelectItem>
                    {rooms.map((r: any) => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.name} ({r.code}) · cap {r.capacity}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Venue (fallback)</Label>
                <Input
                  value={editingExam.venue || ""}
                  onChange={(ev) => setEditingExam({ ...editingExam, venue: ev.target.value })}
                  placeholder="e.g. Main Hall"
                />
              </div>
              <div>
                <Label>Invigilator</Label>
                <Select
                  value={editingExam.invigilator_id || "none"}
                  onValueChange={(v) => setEditingExam({ ...editingExam, invigilator_id: v === "none" ? null : v })}
                >
                  <SelectTrigger><SelectValue placeholder="Select invigilator" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {invigilators.filter((i) => i.active).map((i) => (
                      <SelectItem key={i.id} value={i.id}>
                        {i.full_name} ({i.invigilator_type})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Min Theory CA % to write</Label>
                <Input
                  type="number"
                  value={editingExam.min_theory_ca ?? 50}
                  onChange={(ev) => setEditingExam({ ...editingExam, min_theory_ca: Number(ev.target.value) })}
                />
              </div>
              <div>
                <Label>Min Practical Avg %</Label>
                <Input
                  type="number"
                  value={editingExam.min_practical_avg ?? 60}
                  onChange={(ev) => setEditingExam({ ...editingExam, min_practical_avg: Number(ev.target.value) })}
                />
              </div>
              <div className="md:col-span-2">
                <Label>Notes</Label>
                <Textarea
                  value={editingExam.notes || ""}
                  onChange={(ev) => setEditingExam({ ...editingExam, notes: ev.target.value })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setExamDialog(false)}>Cancel</Button>
              <Button onClick={submitExam} disabled={saveExam.isPending}>Save</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};

const SummaryCard = ({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) => (
  <Card>
    <CardContent className="pt-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="text-3xl font-bold">{value}</p>
        </div>
        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
          {icon}
        </div>
      </div>
    </CardContent>
  </Card>
);

const InvigilatorsPanel = ({ invigilators }: { invigilators: InvigilatorRow[] }) => {
  const save = useSaveInvigilator();
  const del = useDeleteInvigilator();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<InvigilatorRow>>({ invigilator_type: "internal", active: true });

  const openDlg = (row?: InvigilatorRow) => {
    setEditing(row ? { ...row } : { invigilator_type: "internal", active: true });
    setOpen(true);
  };
  const submit = async () => {
    if (!editing.full_name) return;
    await save.mutateAsync(editing);
    setOpen(false);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Invigilators</CardTitle>
          <CardDescription>Internal and external invigilators for exam duty</CardDescription>
        </div>
        <Button onClick={() => openDlg()}>
          <Plus className="h-4 w-4 mr-1" /> Add Invigilator
        </Button>
      </CardHeader>
      <CardContent>
        {invigilators.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">No invigilators added yet.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invigilators.map((i) => (
                <TableRow key={i.id}>
                  <TableCell className="font-medium">{i.full_name}</TableCell>
                  <TableCell>
                    <Badge variant={i.invigilator_type === "external" ? "outline" : "secondary"}>
                      {i.invigilator_type}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs">{i.email || "—"}</TableCell>
                  <TableCell className="text-xs">{i.phone || "—"}</TableCell>
                  <TableCell>
                    {i.active ? <Badge className="bg-green-100 text-green-800">Active</Badge> : <Badge variant="secondary">Inactive</Badge>}
                  </TableCell>
                  <TableCell className="text-right space-x-1">
                    <Button size="sm" variant="ghost" onClick={() => openDlg(i)}>
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        if (confirm("Delete this invigilator?")) del.mutate(i.id);
                      }}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing.id ? "Edit Invigilator" : "New Invigilator"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div>
              <Label>Full Name *</Label>
              <Input value={editing.full_name || ""} onChange={(e) => setEditing({ ...editing, full_name: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Type</Label>
                <Select
                  value={editing.invigilator_type || "internal"}
                  onValueChange={(v: "internal" | "external") => setEditing({ ...editing, invigilator_type: v })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="internal">Internal</SelectItem>
                    <SelectItem value="external">External</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between pt-6">
                <Label>Active</Label>
                <Switch
                  checked={editing.active ?? true}
                  onCheckedChange={(v) => setEditing({ ...editing, active: v })}
                />
              </div>
            </div>
            <div>
              <Label>Email</Label>
              <Input value={editing.email || ""} onChange={(e) => setEditing({ ...editing, email: e.target.value })} />
            </div>
            <div>
              <Label>Phone</Label>
              <Input value={editing.phone || ""} onChange={(e) => setEditing({ ...editing, phone: e.target.value })} />
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea value={editing.notes || ""} onChange={(e) => setEditing({ ...editing, notes: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={submit} disabled={save.isPending}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default withRoleAccess(ExamTimetablePublishing, {
  requiredRoles: ["assessment_coordinator", "organization_admin", "super_admin"],
});
