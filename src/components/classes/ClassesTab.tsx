import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Users, Plus, Pencil, Trash2 } from "lucide-react";
import { useClasses, useCreateClass, useUpdateClass, useDeleteClass, ClassData } from "@/hooks/useClasses";
import { useTrades } from "@/hooks/useTrades";
import { useTrainers } from "@/hooks/useTrainers";
import { Badge } from "@/components/ui/badge";

const EMPTY_FORM: ClassData = {
  trade_id: "",
  level: 1,
  training_mode: "fulltime",
  class_code: "",
  class_name: "",
  academic_year: new Date().getFullYear().toString(),
  capacity: 30,
  trainer_id: "",
};

const ClassesTab = ({ readOnly = false }: { readOnly?: boolean }) => {
  const [open, setOpen] = useState(false);
  const [editingClass, setEditingClass] = useState<any>(null);
  const [formData, setFormData] = useState<ClassData>({ ...EMPTY_FORM });

  const { data: classes, isLoading } = useClasses();
  const { data: trades } = useTrades();
  const { data: trainers } = useTrainers();
  const createClass = useCreateClass();
  const updateClass = useUpdateClass();
  const deleteClass = useDeleteClass();

  const handleOpenDialog = (classToEdit?: any) => {
    if (classToEdit) {
      setEditingClass(classToEdit);
      setFormData({
        trade_id: classToEdit.trade_id,
        level: classToEdit.level,
        training_mode: classToEdit.training_mode,
        class_code: classToEdit.class_code,
        class_name: classToEdit.class_name,
        academic_year: classToEdit.academic_year,
        capacity: classToEdit.capacity || 30,
        trainer_id: classToEdit.trainer_id || "",
      });
    } else {
      setEditingClass(null);
      setFormData({ ...EMPTY_FORM });
    }
    setOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = { ...formData, trainer_id: formData.trainer_id || null };
    if (editingClass) {
      await updateClass.mutateAsync({ id: editingClass.id, ...payload });
    } else {
      await createClass.mutateAsync(payload);
    }
    setOpen(false);
    setEditingClass(null);
    setFormData({ ...EMPTY_FORM });
  };

  const trainingModeLabel = (mode: string) => {
    switch (mode) {
      case "fulltime": return "Full Time";
      case "bdl": return "Block/Day Release";
      case "shortcourse": return "Short Course";
      default: return mode;
    }
  };

  return (
    <div className="space-y-4">
      {!readOnly && (
      <div className="flex items-center justify-between">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => handleOpenDialog()}>
              <Plus className="h-4 w-4 mr-2" /> Create Class
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{editingClass ? "Edit Class" : "Create New Class"}</DialogTitle>
              <DialogDescription>{editingClass ? "Update class details" : "Add a new class"}</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Class Code</Label>
                  <Input value={formData.class_code} onChange={(e) => setFormData({ ...formData, class_code: e.target.value })} placeholder="e.g., ICT2-2025" required />
                </div>
                <div className="space-y-2">
                  <Label>Class Name</Label>
                  <Input value={formData.class_name} onChange={(e) => setFormData({ ...formData, class_name: e.target.value })} placeholder="e.g., ICT Level 2" required />
                </div>
                <div className="space-y-2">
                  <Label>Trade</Label>
                  <Select value={formData.trade_id} onValueChange={(v) => setFormData({ ...formData, trade_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Select trade" /></SelectTrigger>
                    <SelectContent>
                      {trades?.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Level</Label>
                  <Select value={formData.level.toString()} onValueChange={(v) => setFormData({ ...formData, level: parseInt(v) })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {[1, 2, 3, 4].map((l) => <SelectItem key={l} value={l.toString()}>Level {l}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Training Mode</Label>
                  <Select value={formData.training_mode} onValueChange={(v) => setFormData({ ...formData, training_mode: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fulltime">Full Time</SelectItem>
                      <SelectItem value="bdl">Block/Day Release</SelectItem>
                      <SelectItem value="shortcourse">Short Course</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Trainer</Label>
                  <Select value={formData.trainer_id || "none"} onValueChange={(v) => setFormData({ ...formData, trainer_id: v === "none" ? "" : v })}>
                    <SelectTrigger><SelectValue placeholder="Select trainer" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No trainer assigned</SelectItem>
                      {trainers?.filter(t => t.active).map((t) => <SelectItem key={t.id} value={t.id}>{t.full_name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Capacity</Label>
                  <Input type="number" value={formData.capacity} onChange={(e) => setFormData({ ...formData, capacity: parseInt(e.target.value) })} required />
                </div>
                <div className="space-y-2">
                  <Label>Academic Year</Label>
                  <Input value={formData.academic_year} onChange={(e) => setFormData({ ...formData, academic_year: e.target.value })} required />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={createClass.isPending || updateClass.isPending}>
                  {editingClass ? "Update Class" : "Create Class"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5" /> Classes</CardTitle>
          <CardDescription>All classes in the system</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">Loading classes...</div>
          ) : !classes?.length ? (
            <div className="text-center py-8 text-muted-foreground">No classes found. Create one to get started.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Class Code</TableHead>
                  <TableHead>Class Name</TableHead>
                  <TableHead>Trade</TableHead>
                  <TableHead>Level</TableHead>
                  <TableHead>Mode</TableHead>
                  <TableHead>Trainer</TableHead>
                  <TableHead>Capacity</TableHead>
                  <TableHead>Year</TableHead>
                  {!readOnly && <TableHead className="text-right">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {classes.map((cls: any) => (
                  <TableRow key={cls.id}>
                    <TableCell className="font-medium">{cls.class_code}</TableCell>
                    <TableCell>{cls.class_name}</TableCell>
                    <TableCell>{cls.trades?.name || "—"}</TableCell>
                    <TableCell><Badge variant="outline">Level {cls.level}</Badge></TableCell>
                    <TableCell>{trainingModeLabel(cls.training_mode)}</TableCell>
                    <TableCell>{cls.trainers?.full_name || <span className="text-muted-foreground">Unassigned</span>}</TableCell>
                    <TableCell>{cls.capacity}</TableCell>
                    <TableCell>{cls.academic_year}</TableCell>
                    {!readOnly && (
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="sm" onClick={() => handleOpenDialog(cls)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="sm"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Class</AlertDialogTitle>
                              <AlertDialogDescription>Are you sure you want to delete "{cls.class_name}"?</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => deleteClass.mutateAsync(cls.id)}>Delete</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ClassesTab;
