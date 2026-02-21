import { useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useRoleNavigation } from "@/hooks/useRoleNavigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Plus, Pencil, Trash2, BarChart3 } from "lucide-react";
import { useSymbolPoints, useCreateSymbolPoint, useUpdateSymbolPoint, useDeleteSymbolPoint } from "@/hooks/useGradingScale";
import { toast } from "sonner";
import { EmptyState } from "@/components/ui/empty-state";
import { TableSkeleton } from "@/components/ui/table-skeleton";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

const EXAM_LEVELS = [
  { value: "GCE_A_LEVEL", label: "GCE A-Level" },
  { value: "GCE_AS", label: "GCE AS Level" },
  { value: "GCE_O_LEVEL", label: "GCE O-Level" },
  { value: "NSSCH", label: "NSSC Higher (NSSCH)" },
  { value: "NSSCO", label: "NSSC Ordinary (NSSCO)" },
  { value: "NSSC_AS", label: "NSSC AS" },
  { value: "HIGCSE", label: "Cambridge HIGCSE" },
  { value: "IGCSE", label: "Cambridge IGCSE" },
  { value: "IB_HL", label: "IB Higher Level" },
  { value: "IB_SL", label: "IB Standard Level" },
  { value: "NSC_HG", label: "NSC Higher Grade" },
  { value: "NSC_SG", label: "NSC Standard Grade" },
];

const GradingScale = () => {
  const [selectedLevel, setSelectedLevel] = useState<string>("all");
  const { navItems, groupLabel } = useRoleNavigation();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    exam_level: "",
    symbol: "",
    points: 0,
  });

  const { data: symbolPoints, isLoading } = useSymbolPoints();
  const createMutation = useCreateSymbolPoint();
  const updateMutation = useUpdateSymbolPoint();
  const deleteMutation = useDeleteSymbolPoint();

  // Filter by exam level
  const filteredData = selectedLevel === "all"
    ? symbolPoints
    : symbolPoints?.filter((sp) => sp.exam_level === selectedLevel);

  // Group by exam level for display
  const groupedData = filteredData?.reduce((acc: any, item) => {
    if (!acc[item.exam_level]) {
      acc[item.exam_level] = [];
    }
    acc[item.exam_level].push(item);
    return acc;
  }, {});

  const handleOpenDialog = (item?: any) => {
    if (item) {
      setEditingItem(item);
      setFormData({
        exam_level: item.exam_level,
        symbol: item.symbol,
        points: item.points,
      });
    } else {
      setEditingItem(null);
      setFormData({
        exam_level: "",
        symbol: "",
        points: 0,
      });
    }
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!formData.exam_level || !formData.symbol) {
      toast.error("Please fill in all required fields");
      return;
    }

    try {
      if (editingItem) {
        await updateMutation.mutateAsync({
          id: editingItem.id,
          data: formData,
        });
      } else {
        await createMutation.mutateAsync(formData);
      }
      setDialogOpen(false);
    } catch (error) {
      // Error handled by hook
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteMutation.mutateAsync(deleteId);
      setDeleteId(null);
    } catch (error) {
      // Error handled by hook
    }
  };

  const getExamLevelLabel = (value: string) => {
    return EXAM_LEVELS.find((l) => l.value === value)?.label || value;
  };

  return (
    <DashboardLayout
      title="Grading Scale"
      subtitle="Configure symbol points for admission calculations"
      navItems={navItems}
      groupLabel={groupLabel}
    >
      <div className="space-y-4">
        {/* Overview */}
        <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
          <Card className="p-0">
            <CardHeader className="p-3 pb-1 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-xs font-medium">Total Entries</CardTitle>
              <BarChart3 className="h-3.5 w-3.5 text-muted-foreground" />
            </CardHeader>
            <CardContent className="p-3 pt-0">
              <div className="text-xl font-bold">{symbolPoints?.length || 0}</div>
            </CardContent>
          </Card>
          <Card className="p-0">
            <CardHeader className="p-3 pb-1 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-xs font-medium">Exam Levels</CardTitle>
              <BarChart3 className="h-3.5 w-3.5 text-muted-foreground" />
            </CardHeader>
            <CardContent className="p-3 pt-0">
              <div className="text-xl font-bold">
                {new Set(symbolPoints?.map((sp) => sp.exam_level)).size || 0}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Card */}
        <Card>
          <CardHeader className="p-4 pb-2">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <CardTitle className="text-base">Symbol Points Configuration</CardTitle>
                <CardDescription className="text-xs">
                  Define points for each symbol per examination level
                </CardDescription>
              </div>
              <div className="flex gap-2">
                <Select value={selectedLevel} onValueChange={setSelectedLevel}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="Filter by level" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Levels</SelectItem>
                    {EXAM_LEVELS.map((level) => (
                      <SelectItem key={level.value} value={level.value}>
                        {level.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button onClick={() => handleOpenDialog()}>
                  <Plus className="h-4 w-4 mr-1" />
                  Add Entry
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-2">
            {isLoading ? (
              <TableSkeleton columns={4} rows={5} />
            ) : !filteredData?.length ? (
              <EmptyState
                icon={BarChart3}
                title="No grading scale entries"
                description="Add symbol point entries to configure the grading scale"
              />
            ) : (
              <div className="space-y-6">
                {Object.entries(groupedData || {}).map(([examLevel, items]: [string, any]) => (
                  <div key={examLevel}>
                    <h3 className="text-sm font-semibold mb-2">{getExamLevelLabel(examLevel)}</h3>
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Symbol</TableHead>
                            <TableHead>Points</TableHead>
                            <TableHead className="w-[100px]">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {items
                            .sort((a: any, b: any) => b.points - a.points)
                            .map((item: any) => (
                              <TableRow key={item.id}>
                                <TableCell className="font-medium">{item.symbol}</TableCell>
                                <TableCell>{item.points}</TableCell>
                                <TableCell>
                                  <div className="flex gap-1">
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => handleOpenDialog(item)}
                                    >
                                      <Pencil className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => setDeleteId(item.id)}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Add/Edit Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingItem ? "Edit Entry" : "Add Entry"}</DialogTitle>
              <DialogDescription>
                Configure points for a symbol in an examination level
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Examination Level *</Label>
                <Select
                  value={formData.exam_level}
                  onValueChange={(value) => setFormData({ ...formData, exam_level: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select level" />
                  </SelectTrigger>
                  <SelectContent>
                    {EXAM_LEVELS.map((level) => (
                      <SelectItem key={level.value} value={level.value}>
                        {level.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Symbol *</Label>
                <Input
                  value={formData.symbol}
                  onChange={(e) => setFormData({ ...formData, symbol: e.target.value })}
                  placeholder="e.g., A, B, C or A*, 1, 2"
                />
              </div>
              <div className="space-y-2">
                <Label>Points *</Label>
                <Input
                  type="number"
                  min={0}
                  max={20}
                  value={formData.points}
                  onChange={(e) => setFormData({ ...formData, points: parseInt(e.target.value) || 0 })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={createMutation.isPending || updateMutation.isPending}
              >
                {createMutation.isPending || updateMutation.isPending ? "Saving..." : "Save"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation */}
        <ConfirmDialog
          open={!!deleteId}
          onOpenChange={(open) => !open && setDeleteId(null)}
          title="Delete Entry"
          description="Are you sure you want to delete this grading scale entry? This action cannot be undone."
          confirmText="Delete"
          onConfirm={handleDelete}
          variant="destructive"
        />
      </div>
    </DashboardLayout>
  );
};

export default GradingScale;
