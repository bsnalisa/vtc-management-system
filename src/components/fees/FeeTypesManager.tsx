import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Pencil, Trash2, DollarSign, Tag, RefreshCw } from "lucide-react";
import { useFeeTypes, useCreateFeeType, useUpdateFeeType, useDeleteFeeType, FeeType, FeeCategory } from "@/hooks/useFeeTypes";

const CATEGORY_LABELS: Record<FeeCategory, { label: string; color: string }> = {
  tuition: { label: "Tuition", color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400" },
  registration: { label: "Registration", color: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" },
  training_grant: { label: "Training Grant", color: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400" },
  hostel: { label: "Hostel", color: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400" },
  materials: { label: "Materials", color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400" },
  examination: { label: "Examination", color: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400" },
  other: { label: "Other", color: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400" },
};

export const FeeTypesManager = () => {
  const { data: feeTypes, isLoading } = useFeeTypes();
  const createFeeType = useCreateFeeType();
  const updateFeeType = useUpdateFeeType();
  const deleteFeeType = useDeleteFeeType();

  const [showDialog, setShowDialog] = useState(false);
  const [editingFeeType, setEditingFeeType] = useState<FeeType | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    code: "",
    description: "",
    default_amount: "",
    category: "tuition" as FeeCategory,
    is_mandatory: false,
    is_recurring: false,
    recurring_frequency: "" as string,
  });

  const resetForm = () => {
    setFormData({
      name: "",
      code: "",
      description: "",
      default_amount: "",
      category: "tuition",
      is_mandatory: false,
      is_recurring: false,
      recurring_frequency: "",
    });
    setEditingFeeType(null);
  };

  const openCreateDialog = () => {
    resetForm();
    setShowDialog(true);
  };

  const openEditDialog = (feeType: FeeType) => {
    setEditingFeeType(feeType);
    setFormData({
      name: feeType.name,
      code: feeType.code,
      description: feeType.description || "",
      default_amount: String(feeType.default_amount),
      category: feeType.category,
      is_mandatory: feeType.is_mandatory,
      is_recurring: feeType.is_recurring,
      recurring_frequency: feeType.recurring_frequency || "",
    });
    setShowDialog(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const payload = {
      name: formData.name,
      code: formData.code.toUpperCase(),
      description: formData.description || undefined,
      default_amount: parseFloat(formData.default_amount) || 0,
      category: formData.category,
      is_mandatory: formData.is_mandatory,
      is_recurring: formData.is_recurring,
      recurring_frequency: formData.is_recurring && formData.recurring_frequency
        ? (formData.recurring_frequency as 'monthly' | 'quarterly' | 'annually')
        : null,
    };

    if (editingFeeType) {
      await updateFeeType.mutateAsync({ id: editingFeeType.id, ...payload });
    } else {
      await createFeeType.mutateAsync(payload);
    }

    setShowDialog(false);
    resetForm();
  };

  const handleDelete = async (id: string) => {
    if (confirm("Are you sure you want to delete this fee type?")) {
      await deleteFeeType.mutateAsync(id);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Tag className="h-5 w-5" />
              Fee Types Configuration
            </CardTitle>
            <CardDescription>
              Configure and manage fee types for your institution
            </CardDescription>
          </div>
          <Button onClick={openCreateDialog}>
            <Plus className="h-4 w-4 mr-2" />
            Add Fee Type
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {feeTypes?.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <DollarSign className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No fee types configured yet</p>
            <p className="text-sm">Add fee types to start managing trainee fees</p>
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Properties</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {feeTypes?.map((feeType) => (
                  <TableRow key={feeType.id}>
                    <TableCell className="font-medium">{feeType.name}</TableCell>
                    <TableCell className="font-mono text-sm">{feeType.code}</TableCell>
                    <TableCell>
                      <Badge className={CATEGORY_LABELS[feeType.category].color}>
                        {CATEGORY_LABELS[feeType.category].label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      N$ {Number(feeType.default_amount).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {feeType.is_mandatory && (
                          <Badge variant="outline" className="text-xs">Required</Badge>
                        )}
                        {feeType.is_recurring && (
                          <Badge variant="outline" className="text-xs">
                            <RefreshCw className="h-3 w-3 mr-1" />
                            {feeType.recurring_frequency}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-2 justify-end">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEditDialog(feeType)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(feeType.id)}
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
        )}
      </CardContent>

      {/* Create/Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>
              {editingFeeType ? "Edit Fee Type" : "Create Fee Type"}
            </DialogTitle>
            <DialogDescription>
              {editingFeeType
                ? "Update the fee type configuration"
                : "Add a new fee type for your institution"}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Training Grant"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="code">Code *</Label>
                <Input
                  id="code"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                  placeholder="e.g., TG001"
                  className="font-mono uppercase"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="category">Category *</Label>
                <Select
                  value={formData.category}
                  onValueChange={(value: FeeCategory) => setFormData({ ...formData, category: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(CATEGORY_LABELS).map(([key, { label }]) => (
                      <SelectItem key={key} value={key}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="amount">Default Amount (N$) *</Label>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  value={formData.default_amount}
                  onChange={(e) => setFormData({ ...formData, default_amount: e.target.value })}
                  placeholder="0.00"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Optional description..."
                rows={2}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Switch
                  id="mandatory"
                  checked={formData.is_mandatory}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_mandatory: checked })}
                />
                <Label htmlFor="mandatory">Mandatory fee</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  id="recurring"
                  checked={formData.is_recurring}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_recurring: checked })}
                />
                <Label htmlFor="recurring">Recurring</Label>
              </div>
            </div>

            {formData.is_recurring && (
              <div className="space-y-2">
                <Label htmlFor="frequency">Recurring Frequency</Label>
                <Select
                  value={formData.recurring_frequency}
                  onValueChange={(value) => setFormData({ ...formData, recurring_frequency: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select frequency" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="quarterly">Quarterly</SelectItem>
                    <SelectItem value="annually">Annually</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowDialog(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createFeeType.isPending || updateFeeType.isPending}
              >
                {createFeeType.isPending || updateFeeType.isPending
                  ? "Saving..."
                  : editingFeeType
                  ? "Update"
                  : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  );
};
