import { useState } from "react";
import { SuperAdminLayout } from "@/components/SuperAdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, Package as PackageIcon, Check, DollarSign } from "lucide-react";
import { usePackages } from "@/hooks/usePackages";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";

interface PackageFormData {
  name: string;
  description: string;
  price: number;
  billing_cycle: string;
  max_trainees: string;
  max_trainers: string;
  max_classes: string;
  max_storage_mb: string;
  is_trial: boolean;
  trial_days: number;
  active: boolean;
  features: string[];
  selectedModules: string[];
}

const SuperAdminPackagesManagement = () => {
  const { data: packages, isLoading: packagesLoading } = usePackages();
  const { data: modules } = useModules();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [editingPackage, setEditingPackage] = useState<any>(null);
  const [deletingPackage, setDeletingPackage] = useState<any>(null);
  const [featureInput, setFeatureInput] = useState("");
  const [formData, setFormData] = useState<PackageFormData>({
    name: "",
    description: "",
    price: 0,
    billing_cycle: "monthly",
    max_trainees: "",
    max_trainers: "",
    max_classes: "",
    max_storage_mb: "",
    is_trial: false,
    trial_days: 14,
    active: true,
    features: [],
    selectedModules: [],
  });

  const handleOpenDialog = (pkg?: any) => {
    if (pkg) {
      setEditingPackage(pkg);
      setFormData({
        name: pkg.name,
        description: pkg.description || "",
        price: pkg.price,
        billing_cycle: pkg.billing_cycle,
        max_trainees: pkg.limits?.max_trainees?.toString() || "",
        max_trainers: pkg.limits?.max_trainers?.toString() || "",
        max_classes: pkg.limits?.max_classes?.toString() || "",
        max_storage_mb: pkg.limits?.max_storage_mb?.toString() || "",
        is_trial: pkg.is_trial,
        trial_days: pkg.trial_days || 14,
        active: pkg.active,
        features: pkg.features || [],
        selectedModules: pkg.module_access || [],
      });
    } else {
      setEditingPackage(null);
      setFormData({
        name: "",
        description: "",
        price: 0,
        billing_cycle: "monthly",
        max_trainees: "",
        max_trainers: "",
        max_classes: "",
        max_storage_mb: "",
        is_trial: false,
        trial_days: 14,
        active: true,
        features: [],
        selectedModules: [],
      });
    }
    setIsDialogOpen(true);
  };

  const handleAddFeature = () => {
    if (featureInput.trim()) {
      setFormData({
        ...formData,
        features: [...formData.features, featureInput.trim()],
      });
      setFeatureInput("");
    }
  };

  const handleRemoveFeature = (index: number) => {
    setFormData({
      ...formData,
      features: formData.features.filter((_, i) => i !== index),
    });
  };

  const handleSavePackage = async () => {
    try {
      const packageData = {
        name: formData.name,
        description: formData.description,
        price: formData.price,
        billing_cycle: formData.billing_cycle,
        module_access: formData.selectedModules,
        limits: {
          max_trainees: formData.max_trainees ? parseInt(formData.max_trainees) : null,
          max_trainers: formData.max_trainers ? parseInt(formData.max_trainers) : null,
          max_classes: formData.max_classes ? parseInt(formData.max_classes) : null,
          max_storage_mb: formData.max_storage_mb ? parseInt(formData.max_storage_mb) : null,
        },
        is_trial: formData.is_trial,
        trial_days: formData.trial_days,
        active: formData.active,
        features: formData.features,
      };

      if (editingPackage) {
        const { error } = await supabase
          .from("packages")
          .update(packageData)
          .eq("id", editingPackage.id);

        if (error) throw error;

        toast({
          title: "Package updated",
          description: "The package has been updated successfully.",
        });
      } else {
        const { error } = await supabase.from("packages").insert([packageData]);

        if (error) throw error;

        toast({
          title: "Package created",
          description: "The package has been created successfully.",
        });
      }

      queryClient.invalidateQueries({ queryKey: ["packages"] });
      setIsDialogOpen(false);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleDeletePackage = async () => {
    if (!deletingPackage) return;

    try {
      const { error } = await supabase
        .from("packages")
        .delete()
        .eq("id", deletingPackage.id);

      if (error) throw error;

      toast({
        title: "Package deleted",
        description: "The package has been deleted successfully.",
      });

      queryClient.invalidateQueries({ queryKey: ["packages"] });
      setIsDeleteDialogOpen(false);
      setDeletingPackage(null);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleInitializeStandardPackages = async () => {
    const standardPackages = [
      {
        name: "Basic",
        description: "Essential modules for small training centers",
        price: 15000,
        billing_cycle: "monthly",
        module_access: [
          "trainee_management",
          "trainer_management",
          "class_management",
          "attendance_management",
          "fee_management",
          "user_management",
          "reports_analytics",
        ],
        limits: {
          max_trainees: 100,
          max_trainers: 15,
          max_classes: 10,
          max_storage_mb: 10000,
        },
        is_trial: false,
        trial_days: 14,
        active: true,
        features: [
          "Up to 100 trainees",
          "15 trainers maximum",
          "10 concurrent classes",
          "Basic attendance tracking",
          "Fee management",
          "10GB storage",
          "Email support",
          "Basic reporting",
        ],
      },
      {
        name: "Professional",
        description: "Comprehensive solution for medium-sized institutions",
        price: 32000,
        billing_cycle: "monthly",
        module_access: [
          "trainee_management",
          "trainer_management",
          "class_management",
          "attendance_management",
          "timetable_management",
          "assessment_results",
          "course_enrollment",
          "training_modules",
          "fee_management",
          "hostel_fees",
          "payment_processing",
          "hostel_management",
          "stock_management",
          "user_management",
          "role_management",
          "reports_analytics",
          "document_generation",
          "announcements",
          "messages",
        ],
        limits: {
          max_trainees: 350,
          max_trainers: 40,
          max_classes: 30,
          max_storage_mb: 50000,
        },
        is_trial: false,
        trial_days: 14,
        active: true,
        features: [
          "Up to 350 trainees",
          "40 trainers maximum",
          "30 concurrent classes",
          "Advanced timetable management",
          "Assessment & results tracking",
          "Hostel management",
          "Stock control",
          "Document generation",
          "50GB storage",
          "Priority email support",
          "Phone support",
          "Custom reports",
        ],
      },
      {
        name: "Enterprise",
        description: "Full-featured platform for large training organizations",
        price: 65000,
        billing_cycle: "monthly",
        module_access: [
          "trainee_management",
          "trainer_management",
          "class_management",
          "attendance_management",
          "timetable_management",
          "assessment_results",
          "course_enrollment",
          "training_modules",
          "alumni_management",
          "placement_management",
          "fee_management",
          "hostel_fees",
          "payment_processing",
          "hostel_management",
          "stock_management",
          "asset_management",
          "procurement",
          "library_management",
          "user_management",
          "role_management",
          "reports_analytics",
          "role_activity",
          "document_generation",
          "announcements",
          "messages",
          "support_tickets",
        ],
        limits: {
          max_trainees: null,
          max_trainers: null,
          max_classes: null,
          max_storage_mb: null,
        },
        is_trial: false,
        trial_days: 14,
        active: true,
        features: [
          "Unlimited trainees",
          "Unlimited trainers",
          "Unlimited classes",
          "Full alumni management",
          "Placement & internships",
          "Complete hostel management",
          "Asset management",
          "Procurement system",
          "Library management",
          "Advanced role management",
          "Activity monitoring",
          "Unlimited storage",
          "24/7 priority support",
          "Dedicated account manager",
          "Custom training",
        ],
      },
    ];

    try {
      for (const pkg of standardPackages) {
        const { data: existing } = await supabase
          .from("packages")
          .select("id")
          .eq("name", pkg.name)
          .single();

        if (!existing) {
          await supabase.from("packages").insert([pkg]);
        }
      }

      queryClient.invalidateQueries({ queryKey: ["packages"] });
      toast({
        title: "Packages initialized",
        description: "Standard packages have been added successfully.",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const toggleModule = (moduleCode: string) => {
    setFormData((prev) => ({
      ...prev,
      selectedModules: prev.selectedModules.includes(moduleCode)
        ? prev.selectedModules.filter((m) => m !== moduleCode)
        : [...prev.selectedModules, moduleCode],
    }));
  };

  const groupedModules = modules
    ? modules.reduce((acc: Record<string, any[]>, module: any) => {
        const category = module.category || "Other";
        if (!acc[category]) acc[category] = [];
        acc[category].push(module);
        return acc;
      }, {})
    : {};

  return (
    <SuperAdminLayout>
      <div className="space-y-6">
        {/* Info Banner */}
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="pt-6">
            <div className="flex gap-3">
              <DollarSign className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="space-y-2">
                <h3 className="font-semibold text-blue-900">Package Pricing & Structure</h3>
                <p className="text-sm text-blue-800">
                  Create subscription packages with Namibian Dollar (NAD) pricing. Each package bundles multiple modules
                  with defined limits on trainees, trainers, classes, and storage. VTCs subscribe to packages based on
                  their center size and feature requirements.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold">Package Management</h2>
            <p className="text-muted-foreground">
              Create and manage subscription packages for training centers
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleInitializeStandardPackages}>
              <PackageIcon className="h-4 w-4 mr-2" />
              Initialize Standard Packages
            </Button>
            <Button onClick={() => handleOpenDialog()}>
              <Plus className="h-4 w-4 mr-2" />
              Create Package
            </Button>
          </div>
        </div>

        {/* Packages Table */}
        {packagesLoading ? (
          <Card>
            <CardContent className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </CardContent>
          </Card>
        ) : packages && packages.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>Available Packages</CardTitle>
              <CardDescription>Manage subscription plans and pricing</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Package Name</TableHead>
                      <TableHead>Price (NAD)</TableHead>
                      <TableHead>Cycle</TableHead>
                      <TableHead>Modules</TableHead>
                      <TableHead>Limits</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {packages.map((pkg) => (
                      <TableRow key={pkg.id}>
                        <TableCell className="font-medium">{pkg.name}</TableCell>
                        <TableCell className="font-semibold text-green-600">
                          N${pkg.price.toLocaleString()}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{pkg.billing_cycle}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">
                            {pkg.module_access?.length || 0} modules
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {pkg.limits.max_trainees || "∞"} trainees,{" "}
                          {pkg.limits.max_trainers || "∞"} trainers
                        </TableCell>
                        <TableCell>
                          <Badge variant={pkg.active ? "default" : "secondary"}>
                            {pkg.active ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleOpenDialog(pkg)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setDeletingPackage(pkg);
                                setIsDeleteDialogOpen(true);
                              }}
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
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="text-center py-12">
              <PackageIcon className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Packages Found</h3>
              <p className="text-muted-foreground mb-4">
                Create your first subscription package or initialize standard packages.
              </p>
              <Button onClick={handleInitializeStandardPackages}>
                <PackageIcon className="h-4 w-4 mr-2" />
                Initialize Standard Packages
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Create/Edit Dialog */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingPackage ? "Edit Package" : "Create Package"}
              </DialogTitle>
              <DialogDescription>
                Configure package details, pricing, limits, and included modules
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6">
              {/* Basic Info */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Package Name</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Professional"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="billing_cycle">Billing Cycle</Label>
                  <Select
                    value={formData.billing_cycle}
                    onValueChange={(value) =>
                      setFormData({ ...formData, billing_cycle: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="monthly">Monthly</SelectItem>
                      <SelectItem value="quarterly">Quarterly</SelectItem>
                      <SelectItem value="annually">Annually</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  rows={2}
                />
              </div>

              {/* Pricing */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="price">Price (NAD)</Label>
                  <Input
                    id="price"
                    type="number"
                    value={formData.price}
                    onChange={(e) =>
                      setFormData({ ...formData, price: parseFloat(e.target.value) })
                    }
                    placeholder="5500"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="trial_days">Trial Days</Label>
                  <Input
                    id="trial_days"
                    type="number"
                    value={formData.trial_days}
                    onChange={(e) =>
                      setFormData({ ...formData, trial_days: parseInt(e.target.value) })
                    }
                  />
                </div>
              </div>

              {/* Limits */}
              <div>
                <Label className="text-base font-semibold">Resource Limits</Label>
                <p className="text-sm text-muted-foreground mb-3">
                  Leave blank for unlimited
                </p>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="max_trainees">Max Trainees</Label>
                    <Input
                      id="max_trainees"
                      type="number"
                      value={formData.max_trainees}
                      onChange={(e) =>
                        setFormData({ ...formData, max_trainees: e.target.value })
                      }
                      placeholder="Unlimited"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="max_trainers">Max Trainers</Label>
                    <Input
                      id="max_trainers"
                      type="number"
                      value={formData.max_trainers}
                      onChange={(e) =>
                        setFormData({ ...formData, max_trainers: e.target.value })
                      }
                      placeholder="Unlimited"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="max_classes">Max Classes</Label>
                    <Input
                      id="max_classes"
                      type="number"
                      value={formData.max_classes}
                      onChange={(e) =>
                        setFormData({ ...formData, max_classes: e.target.value })
                      }
                      placeholder="Unlimited"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="max_storage_mb">Storage (MB)</Label>
                    <Input
                      id="max_storage_mb"
                      type="number"
                      value={formData.max_storage_mb}
                      onChange={(e) =>
                        setFormData({ ...formData, max_storage_mb: e.target.value })
                      }
                      placeholder="Unlimited"
                    />
                  </div>
                </div>
              </div>

              {/* Features */}
              <div className="space-y-3">
                <Label>Package Features</Label>
                <div className="flex gap-2">
                  <Input
                    value={featureInput}
                    onChange={(e) => setFeatureInput(e.target.value)}
                    placeholder="Enter a feature"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddFeature();
                      }
                    }}
                  />
                  <Button type="button" onClick={handleAddFeature}>
                    Add
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {formData.features.map((feature, idx) => (
                    <Badge
                      key={idx}
                      variant="secondary"
                      className="cursor-pointer"
                      onClick={() => handleRemoveFeature(idx)}
                    >
                      {feature} ×
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Modules Selection */}
              <div className="space-y-3">
                <Label className="text-base font-semibold">Included Modules</Label>
                <p className="text-sm text-muted-foreground">
                  Select modules that will be available in this package
                </p>
                <div className="border rounded-lg p-4 max-h-60 overflow-y-auto space-y-4">
                  {Object.entries(groupedModules).map(([category, categoryModules]) => (
                    <div key={category}>
                      <h4 className="font-semibold text-sm mb-2">{category}</h4>
                      <div className="space-y-2 ml-4">
                        {categoryModules.map((module: any) => (
                          <div key={module.id} className="flex items-center space-x-2">
                            <Checkbox
                              id={module.id}
                              checked={formData.selectedModules.includes(module.code)}
                              onCheckedChange={() => toggleModule(module.code)}
                            />
                            <label
                              htmlFor={module.id}
                              className="text-sm cursor-pointer flex-1"
                            >
                              {module.name}
                            </label>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="text-sm text-muted-foreground">
                  {formData.selectedModules.length} modules selected
                </div>
              </div>

              {/* Status Switches */}
              <div className="flex gap-6">
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
                <div className="flex items-center space-x-2">
                  <Switch
                    id="is_trial"
                    checked={formData.is_trial}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, is_trial: checked })
                    }
                  />
                  <Label htmlFor="is_trial">Trial Available</Label>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSavePackage}>
                {editingPackage ? "Update Package" : "Create Package"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete Package</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete "{deletingPackage?.name}"? This action
                cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setIsDeleteDialogOpen(false);
                  setDeletingPackage(null);
                }}
              >
                Cancel
              </Button>
              <Button variant="destructive" onClick={handleDeletePackage}>
                Delete
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </SuperAdminLayout>
  );
};

export default SuperAdminPackagesManagement;
