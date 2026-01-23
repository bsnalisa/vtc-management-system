import { useState } from "react";
import { SuperAdminLayout } from "@/components/SuperAdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Pencil, Trash2, PackageOpen, Package, DollarSign, Wrench, TrendingUp, BarChart3, Shield } from "lucide-react";
import { useModules } from "@/hooks/useModules";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";

interface ModuleFormData {
  name: string;
  code: string;
  description: string;
  category: string;
  active: boolean;
}

const SuperAdminModulesManagement = () => {
  const { data: modules, isLoading } = useModules();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [editingModule, setEditingModule] = useState<any>(null);
  const [deletingModule, setDeleteingModule] = useState<any>(null);
  const [formData, setFormData] = useState<ModuleFormData>({
    name: "",
    code: "",
    description: "",
    category: "",
    active: true,
  });

  const handleOpenDialog = (module?: any) => {
    if (module) {
      setEditingModule(module);
      setFormData({
        name: module.name,
        code: module.code,
        description: module.description || "",
        category: module.category,
        active: module.active,
      });
    } else {
      setEditingModule(null);
      setFormData({
        name: "",
        code: "",
        description: "",
        category: "",
        active: true,
      });
    }
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingModule(null);
  };

  const handleSaveModule = async () => {
    try {
      if (editingModule) {
        const { error } = await supabase
          .from("modules")
          .update(formData)
          .eq("id", editingModule.id);

        if (error) throw error;

        toast({
          title: "Module updated",
          description: "The module has been updated successfully.",
        });
      } else {
        const { error } = await supabase
          .from("modules")
          .insert([formData]);

        if (error) throw error;

        toast({
          title: "Module created",
          description: "The module has been created successfully.",
        });
      }

      queryClient.invalidateQueries({ queryKey: ["modules"] });
      handleCloseDialog();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleDeleteModule = async () => {
    if (!deletingModule) return;

    try {
      const { error } = await supabase
        .from("modules")
        .delete()
        .eq("id", deletingModule.id);

      if (error) throw error;

      toast({
        title: "Module deleted",
        description: "The module has been deleted successfully.",
      });

      queryClient.invalidateQueries({ queryKey: ["modules"] });
      setIsDeleteDialogOpen(false);
      setDeleteingModule(null);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case "Academic":
        return <Package className="h-4 w-4" />;
      case "Financial":
        return <DollarSign className="h-4 w-4" />;
      case "Operations":
        return <Wrench className="h-4 w-4" />;
      case "Administration":
        return <Shield className="h-4 w-4" />;
      default:
        return <Package className="h-4 w-4" />;
    }
  };

  const handleInitializeModules = async () => {
    const standardModules = [
      // Academic - All training and education operations
      { name: "Trainee Management", code: "trainee_management", category: "Academic", description: "Student registration, profiles, and records management" },
      { name: "Trainer Management", code: "trainer_management", category: "Academic", description: "Staff profiles, qualifications, and assignments" },
      { name: "Class Management", code: "class_management", category: "Academic", description: "Class creation, scheduling, and enrollment" },
      { name: "Attendance Management", code: "attendance_management", category: "Academic", description: "Daily attendance tracking and reporting" },
      { name: "Timetable Management", code: "timetable_management", category: "Academic", description: "Schedule management and planning" },
      { name: "Assessment & Results", code: "assessment_results", category: "Academic", description: "Exam management, marking, and results" },
      { name: "Course Enrollment", code: "course_enrollment", category: "Academic", description: "Student course registration and tracking" },
      { name: "Training Modules", code: "training_modules", category: "Academic", description: "Course content and curriculum management" },
      { name: "Alumni Management", code: "alumni_management", category: "Academic", description: "Graduate tracking and employment records" },
      { name: "Placement & Internships", code: "placement_management", category: "Academic", description: "Job placements and internship coordination" },
      
      // Financial - All fee and payment management
      { name: "Fee Management", code: "fee_management", category: "Financial", description: "Tuition fees, payments, and billing" },
      { name: "Hostel Fees", code: "hostel_fees", category: "Financial", description: "Accommodation fee management and tracking" },
      { name: "Payment Processing", code: "payment_processing", category: "Financial", description: "Payment receipts and transaction records" },
      
      // Operations - Facilities and resource management
      { name: "Hostel Management", code: "hostel_management", category: "Operations", description: "Accommodation, allocations, and maintenance" },
      { name: "Stock Management", code: "stock_management", category: "Operations", description: "Inventory control and stock movements" },
      { name: "Asset Management", code: "asset_management", category: "Operations", description: "Fixed assets tracking, depreciation, and maintenance" },
      { name: "Procurement", code: "procurement", category: "Operations", description: "Purchase requisitions, orders, and supplier management" },
      { name: "Library Management", code: "library_management", category: "Operations", description: "Library catalog, borrowing, and fines" },
      
      // Administration - System configuration and management
      { name: "User Management", code: "user_management", category: "Administration", description: "User accounts and access control" },
      { name: "Role Management", code: "role_management", category: "Administration", description: "Custom roles and permissions" },
      { name: "Reports & Analytics", code: "reports_analytics", category: "Administration", description: "Comprehensive reporting and data analysis" },
      { name: "Role Activity Monitoring", code: "role_activity", category: "Administration", description: "User activity tracking and auditing" },
      { name: "Document Generation", code: "document_generation", category: "Administration", description: "Automated certificates and reports" },
      { name: "Announcements", code: "announcements", category: "Administration", description: "System-wide notifications and bulletins" },
      { name: "Messages & Communication", code: "messages", category: "Administration", description: "Internal messaging system" },
      { name: "Support Tickets", code: "support_tickets", category: "Administration", description: "Help desk and issue tracking" },
    ];

    try {
      for (const module of standardModules) {
        // Check if module exists
        const { data: existing } = await supabase
          .from("modules")
          .select("id")
          .eq("code", module.code)
          .single();

        if (!existing) {
          await supabase.from("modules").insert([{ ...module, active: true }]);
        }
      }

      queryClient.invalidateQueries({ queryKey: ["modules"] });
      toast({
        title: "Modules initialized",
        description: "All standard modules have been added to the system.",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const categoryOrder: Record<string, number> = {
    Academic: 1,
    Financial: 2,
    Operations: 3,
    Administration: 4,
  };

  const categoryGroups = ["Academic", "Financial", "Operations", "Administration"] as const;

  const getModuleGroup = (module: any): string => {
    const rawCategory = (module.category || "").toString();
    const code: string = (module.code || "").toString();

    // If the category already matches one of our main groups, use it directly
    if (rawCategory in categoryOrder) {
      return rawCategory;
    }

    const normalizedCode = code.toLowerCase();

    if (
      normalizedCode.includes("fee") ||
      normalizedCode.includes("billing") ||
      normalizedCode.includes("payment")
    ) {
      return "Financial";
    }

    if (
      normalizedCode.includes("hostel") ||
      normalizedCode.includes("stock") ||
      normalizedCode.includes("asset") ||
      normalizedCode.includes("procurement") ||
      normalizedCode.includes("library")
    ) {
      return "Operations";
    }

    if (
      normalizedCode.includes("user") ||
      normalizedCode.includes("role") ||
      normalizedCode.includes("report") ||
      normalizedCode.includes("analytics") ||
      normalizedCode.includes("document") ||
      normalizedCode.includes("announcement") ||
      normalizedCode.includes("message") ||
      normalizedCode.includes("support") ||
      normalizedCode.includes("system")
    ) {
      return "Administration";
    }

    // Default fallback for learning-related items
    return "Academic";
  };

  const groupedModules: Record<string, any[]> = modules
    ? modules.reduce((acc: Record<string, any[]>, module: any) => {
        const group = getModuleGroup(module);
        if (!acc[group]) acc[group] = [];
        acc[group].push(module);
        return acc;
      }, {})
    : {};

  const categories = categoryGroups.filter((group) => groupedModules[group]?.length);

  return (
    <SuperAdminLayout>
      <div className="space-y-6">
        {/* Info Banner */}
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="pt-6">
            <div className="flex gap-3">
              <PackageOpen className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="space-y-2">
                <h3 className="font-semibold text-blue-900">Module-Based Subscription System</h3>
                <p className="text-sm text-blue-800">
                  VTCs subscribe to modules based on their center's size and requirements. Each module represents a specific feature or capability. 
                  Modules are grouped into packages (Basic, Standard, Premium) or can be subscribed to individually. This allows VTCs to pay only 
                  for the features they need and scale as they grow.
                </p>
                <div className="flex gap-2 mt-2 flex-wrap">
                  <Badge variant="outline" className="bg-white">Academic: Training & education</Badge>
                  <Badge variant="outline" className="bg-white">Financial: Fees & payments</Badge>
                  <Badge variant="outline" className="bg-white">Operations: Facilities & resources</Badge>
                  <Badge variant="outline" className="bg-white">Administration: System management</Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold">System Modules</h2>
            <p className="text-muted-foreground">
              Manage all available modules that VTCs can subscribe to
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleInitializeModules}>
              <PackageOpen className="h-4 w-4 mr-2" />
              Initialize Standard Modules
            </Button>
            <Button onClick={() => handleOpenDialog()}>
              <Plus className="h-4 w-4 mr-2" />
              Add Custom Module
            </Button>
          </div>
        </div>

        {/* Tabbed Module Categories */}
        {isLoading ? (
          <Card>
            <CardContent className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </CardContent>
          </Card>
        ) : modules && modules.length > 0 ? (
          <Tabs defaultValue={categories[0]} className="w-full">
            <TabsList className="w-full grid grid-cols-2 md:grid-cols-4 h-auto gap-2 bg-muted p-2">
              {categories.map((category) => {
                const count = groupedModules[category]?.length || 0;
                return (
                  <TabsTrigger
                    key={category}
                    value={category}
                    className="flex items-center gap-2 data-[state=active]:bg-background"
                  >
                    {getCategoryIcon(category)}
                    <span className="hidden sm:inline">{category}</span>
                    <Badge variant="secondary" className="ml-1">{count}</Badge>
                  </TabsTrigger>
                );
              })}
            </TabsList>

            {categories.map((category) => {
              const categoryModules = groupedModules[category] || [];
              
              return (
                <TabsContent key={category} value={category} className="mt-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        {getCategoryIcon(category)}
                        {category} Modules
                        <Badge variant="secondary">{categoryModules.length}</Badge>
                      </CardTitle>
                      <CardDescription>
                        {category === "Academic" && "Training, education, and student lifecycle management"}
                        {category === "Financial" && "Fee management, payments, and financial tracking"}
                        {category === "Operations" && "Facilities, resources, and operational management"}
                        {category === "Administration" && "System configuration, users, and support"}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      {categoryModules.length > 0 ? (
                        <div className="rounded-md border">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="w-[250px]">Module Name</TableHead>
                                <TableHead className="w-[200px]">Code</TableHead>
                                <TableHead className="w-[100px]">Status</TableHead>
                                <TableHead>Description</TableHead>
                                <TableHead className="text-right w-[120px]">Actions</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {categoryModules.map((module) => (
                                <TableRow key={module.id} className="hover:bg-muted/50">
                                  <TableCell className="font-medium">{module.name}</TableCell>
                                  <TableCell>
                                    <code className="px-2 py-1 bg-muted rounded text-xs font-mono">
                                      {module.code}
                                    </code>
                                  </TableCell>
                                  <TableCell>
                                    <Badge variant={module.active ? "default" : "secondary"}>
                                      {module.active ? "Active" : "Inactive"}
                                    </Badge>
                                  </TableCell>
                                  <TableCell>
                                    <p className="text-sm text-muted-foreground line-clamp-2">
                                      {module.description || "No description available"}
                                    </p>
                                  </TableCell>
                                  <TableCell className="text-right">
                                    <div className="flex justify-end gap-2">
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleOpenDialog(module)}
                                        title="Edit module"
                                      >
                                        <Pencil className="h-4 w-4" />
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => {
                                          setDeleteingModule(module);
                                          setIsDeleteDialogOpen(true);
                                        }}
                                        title="Delete module"
                                      >
                                        <Trash2 className="h-4 w-4 text-destructive" />
                                      </Button>
                                    </div>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      ) : (
                        <div className="text-center py-8 text-muted-foreground">
                          No modules in this category yet.
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>
              );
            })}
          </Tabs>
        ) : (
          <Card>
            <CardContent className="text-center py-12">
              <PackageOpen className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Modules Found</h3>
              <p className="text-muted-foreground mb-4">
                Click "Initialize Standard Modules" to add all system features as modules.
              </p>
              <Button onClick={handleInitializeModules}>
                <PackageOpen className="h-4 w-4 mr-2" />
                Initialize Standard Modules
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Create/Edit Dialog */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingModule ? "Edit Module" : "Create Module"}
              </DialogTitle>
              <DialogDescription>
                {editingModule
                  ? "Update module information"
                  : "Add a new module to the system"}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Module Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  placeholder="Trainee Management"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="code">Module Code</Label>
                <Input
                  id="code"
                  value={formData.code}
                  onChange={(e) =>
                    setFormData({ ...formData, code: e.target.value })
                  }
                  placeholder="trainee_management"
                  disabled={!!editingModule}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="category">Category</Label>
                <Select
                  value={formData.category}
                  onValueChange={(value) =>
                    setFormData({ ...formData, category: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a category" />
                  </SelectTrigger>
                  <SelectContent>
                  <SelectItem value="Academic">Academic - Training & education</SelectItem>
                  <SelectItem value="Financial">Financial - Fees & payments</SelectItem>
                  <SelectItem value="Operations">Operations - Facilities & resources</SelectItem>
                  <SelectItem value="Administration">Administration - System management</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  placeholder="Module description..."
                  rows={3}
                />
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="active"
                  checked={formData.active}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, active: checked })
                  }
                />
                <Label htmlFor="active">Active</Label>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={handleCloseDialog}>
                Cancel
              </Button>
              <Button onClick={handleSaveModule}>
                {editingModule ? "Update" : "Create"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete Module</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete "{deletingModule?.name}"? This action
                cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setIsDeleteDialogOpen(false);
                  setDeleteingModule(null);
                }}
              >
                Cancel
              </Button>
              <Button variant="destructive" onClick={handleDeleteModule}>
                Delete
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </SuperAdminLayout>
  );
};

export default SuperAdminModulesManagement;
