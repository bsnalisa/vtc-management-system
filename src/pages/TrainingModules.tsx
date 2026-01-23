import { useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { adminNavItems, organizationAdminNavItems } from "@/lib/navigationConfig";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { BookOpen, Plus, Pencil, Trash2, Clock } from "lucide-react";
import {
  useTrainingModules,
  useCreateTrainingModule,
  useUpdateTrainingModule,
  useDeleteTrainingModule,
  TrainingModule,
} from "@/hooks/useOnboarding";
import { useUserRole } from "@/hooks/useUserRole";

const TrainingModules = () => {
  const { role } = useUserRole();
  const [open, setOpen] = useState(false);
  const [editingModule, setEditingModule] = useState<TrainingModule | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [moduleToDelete, setModuleToDelete] = useState<string | null>(null);

  const { data: modules, isLoading } = useTrainingModules();
  const createModule = useCreateTrainingModule();
  const updateModule = useUpdateTrainingModule();
  const deleteModule = useDeleteTrainingModule();
  
  const navItems = role === "organization_admin" ? organizationAdminNavItems : adminNavItems;

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    content: "",
    duration_minutes: 15,
    order_index: 0,
    is_required: true,
    role_specific: [] as string[],
  });

  const resetForm = () => {
    setFormData({
      title: "",
      description: "",
      content: "",
      duration_minutes: 15,
      order_index: 0,
      is_required: true,
      role_specific: [],
    });
    setEditingModule(null);
  };

  const handleEdit = (module: TrainingModule) => {
    setEditingModule(module);
    setFormData({
      title: module.title,
      description: module.description || "",
      content: module.content || "",
      duration_minutes: module.duration_minutes || 15,
      order_index: module.order_index,
      is_required: module.is_required,
      role_specific: module.role_specific || [],
    });
    setOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (editingModule) {
      await updateModule.mutateAsync({
        id: editingModule.id,
        updates: formData,
      });
    } else {
      await createModule.mutateAsync(formData);
    }

    setOpen(false);
    resetForm();
  };

  const handleDelete = async () => {
    if (moduleToDelete) {
      await deleteModule.mutateAsync(moduleToDelete);
      setDeleteDialogOpen(false);
      setModuleToDelete(null);
    }
  };

  return (
    <DashboardLayout
      title="Training Modules"
      subtitle="Manage onboarding training modules for staff"
      navItems={adminNavItems}
      groupLabel="Navigation"
    >
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Dialog open={open} onOpenChange={(value) => {
            setOpen(value);
            if (!value) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Create Module
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>
                  {editingModule ? "Edit Training Module" : "Create Training Module"}
                </DialogTitle>
                <DialogDescription>
                  {editingModule
                    ? "Update the training module details"
                    : "Add a new training module for staff onboarding"}
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Title *</Label>
                  <Input
                    id="title"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Input
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="content">Content *</Label>
                  <Textarea
                    id="content"
                    value={formData.content}
                    onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                    rows={8}
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="duration_minutes">Duration (minutes) *</Label>
                    <Input
                      id="duration_minutes"
                      type="number"
                      value={formData.duration_minutes}
                      onChange={(e) =>
                        setFormData({ ...formData, duration_minutes: parseInt(e.target.value) })
                      }
                      min="1"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="order_index">Order Index</Label>
                    <Input
                      id="order_index"
                      type="number"
                      value={formData.order_index}
                      onChange={(e) =>
                        setFormData({ ...formData, order_index: parseInt(e.target.value) })
                      }
                      min="0"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="is_required">Required Module</Label>
                  <Select
                    value={formData.is_required ? "yes" : "no"}
                    onValueChange={(value) =>
                      setFormData({ ...formData, is_required: value === "yes" })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="yes">Yes - Required for all staff</SelectItem>
                      <SelectItem value="no">No - Optional</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setOpen(false);
                      resetForm();
                    }}
                  >
                    Cancel
                  </Button>
                  <Button type="submit">
                    {editingModule ? "Update Module" : "Create Module"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5" />
              Training Modules
            </CardTitle>
            <CardDescription>
              {modules?.length || 0} training module{modules?.length !== 1 ? "s" : ""} configured
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8">Loading modules...</div>
            ) : modules && modules.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Order</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {modules.map((module) => (
                    <TableRow key={module.id}>
                      <TableCell className="font-medium">{module.order_index}</TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{module.title}</p>
                          {module.description && (
                            <p className="text-sm text-muted-foreground">
                              {module.description}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          <span className="text-sm">{module.duration_minutes} min</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {module.is_required ? (
                          <Badge variant="default">Required</Badge>
                        ) : (
                          <Badge variant="outline">Optional</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(module)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setModuleToDelete(module.id);
                              setDeleteDialogOpen(true);
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                No training modules configured yet. Create one to get started.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Training Module</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this training module? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
};

export default TrainingModules;