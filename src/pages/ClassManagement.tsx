import { useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { 
  adminNavItems, 
  organizationAdminNavItems,
  trainerNavItems,
  hodNavItems,
  headOfTrainingNavItems
} from "@/lib/navigationConfig";
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
import { useUserRole } from "@/hooks/useUserRole";

const ClassManagement = () => {
  const { role } = useUserRole();
  const [open, setOpen] = useState(false);
  const [editingClass, setEditingClass] = useState<any>(null);
  const [formData, setFormData] = useState<ClassData>({
    trade_id: "",
    level: 1,
    training_mode: "fulltime",
    class_code: "",
    class_name: "",
    academic_year: new Date().getFullYear().toString(),
    capacity: 30,
    trainer_id: "",
  });

  const { data: classes, isLoading } = useClasses();
  const { data: trades } = useTrades();
  const { data: trainers } = useTrainers();
  const createClass = useCreateClass();
  const updateClass = useUpdateClass();
  const deleteClass = useDeleteClass();
  
  const getNavItems = () => {
    switch (role) {
      case "organization_admin":
        return organizationAdminNavItems;
      case "trainer":
        return trainerNavItems;
      case "hod":
        return hodNavItems;
      case "head_of_training":
        return headOfTrainingNavItems;
      default:
        return adminNavItems;
    }
  };
  
  const navItems = getNavItems();

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
      setFormData({
        trade_id: "",
        level: 1,
        training_mode: "fulltime",
        class_code: "",
        class_name: "",
        academic_year: new Date().getFullYear().toString(),
        capacity: 30,
        trainer_id: "",
      });
    }
    setOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (editingClass) {
      await updateClass.mutateAsync({ id: editingClass.id, ...formData });
    } else {
      await createClass.mutateAsync(formData);
    }
    
    setOpen(false);
    setEditingClass(null);
    setFormData({
      trade_id: "",
      level: 1,
      training_mode: "fulltime",
      class_code: "",
      class_name: "",
      academic_year: new Date().getFullYear().toString(),
      capacity: 30,
      trainer_id: "",
    });
  };

  const handleDelete = async (id: string) => {
    await deleteClass.mutateAsync(id);
  };

  return (
    <DashboardLayout
      title="Class Management"
      subtitle="Manage trades, classes, and training programs"
      navItems={navItems}
      groupLabel="Navigation"
    >
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => handleOpenDialog()}>
                <Plus className="h-4 w-4 mr-2" />
                Create Class
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>{editingClass ? "Edit Class" : "Create New Class"}</DialogTitle>
                <DialogDescription>
                  {editingClass ? "Update class details" : "Add a new class for organizing trainees"}
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="class_code">Class Code</Label>
                    <Input
                      id="class_code"
                      value={formData.class_code}
                      onChange={(e) => setFormData({ ...formData, class_code: e.target.value })}
                      placeholder="e.g., ICT2-2025"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="class_name">Class Name</Label>
                    <Input
                      id="class_name"
                      value={formData.class_name}
                      onChange={(e) => setFormData({ ...formData, class_name: e.target.value })}
                      placeholder="e.g., ICT Level 2 - Morning"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="trade">Trade</Label>
                    <Select value={formData.trade_id} onValueChange={(value) => setFormData({ ...formData, trade_id: value })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select trade" />
                      </SelectTrigger>
                      <SelectContent>
                        {trades?.map((trade) => (
                          <SelectItem key={trade.id} value={trade.id}>{trade.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="level">Level</Label>
                    <Select value={formData.level.toString()} onValueChange={(value) => setFormData({ ...formData, level: parseInt(value) })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[1, 2, 3, 4].map((level) => (
                          <SelectItem key={level} value={level.toString()}>Level {level}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="training_mode">Training Mode</Label>
                    <Select value={formData.training_mode} onValueChange={(value) => setFormData({ ...formData, training_mode: value })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="fulltime">Full Time</SelectItem>
                        <SelectItem value="bdl">Block/Day Release</SelectItem>
                        <SelectItem value="shortcourse">Short Course</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="trainer">Class Trainer</Label>
                    <Select value={formData.trainer_id} onValueChange={(value) => setFormData({ ...formData, trainer_id: value })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select trainer" />
                      </SelectTrigger>
                      <SelectContent>
                        {trainers?.map((trainer) => (
                          <SelectItem key={trainer.id} value={trainer.id}>{trainer.full_name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="capacity">Capacity</Label>
                    <Input
                      id="capacity"
                      type="number"
                      value={formData.capacity}
                      onChange={(e) => setFormData({ ...formData, capacity: parseInt(e.target.value) })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="academic_year">Academic Year</Label>
                    <Input
                      id="academic_year"
                      value={formData.academic_year}
                      onChange={(e) => setFormData({ ...formData, academic_year: e.target.value })}
                      required
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                  <Button type="submit">{editingClass ? "Update Class" : "Create Class"}</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Classes
            </CardTitle>
            <CardDescription>All classes in the system</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8">Loading classes...</div>
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
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {classes?.map((cls) => (
                    <TableRow key={cls.id}>
                      <TableCell className="font-medium">{cls.class_code}</TableCell>
                      <TableCell>{cls.class_name}</TableCell>
                      <TableCell>{cls.trades?.name}</TableCell>
                      <TableCell>Level {cls.level}</TableCell>
                      <TableCell className="capitalize">{cls.training_mode}</TableCell>
                      <TableCell>{cls.trainers?.full_name || "Unassigned"}</TableCell>
                      <TableCell>{cls.capacity}</TableCell>
                      <TableCell>{cls.academic_year}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => handleOpenDialog(cls)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete Class</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to delete "{cls.class_name}"? This action cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDelete(cls.id)}>
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default ClassManagement;
