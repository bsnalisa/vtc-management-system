import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Edit, Trash2, AlertCircle, CheckCircle } from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { registrationOfficerNavItems } from "@/lib/navigationConfig";
import { useEntryRequirements, useCreateEntryRequirement, useUpdateEntryRequirement, EntryRequirementData } from "@/hooks/useEntryRequirements";
import { useTrades } from "@/hooks/useTrades";
import { useToast } from "@/hooks/use-toast";
import { SYMBOLS } from "@/types/application";

const EntryRequirementsManagement = () => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRequirement, setEditingRequirement] = useState<any>(null);
  const [formData, setFormData] = useState<EntryRequirementData>({
    trade_id: "",
    level: 1,
    requirement_name: "",
    min_grade: 10,
    min_points: 20,
    english_symbol: "F",
    maths_symbol: "F",
    science_symbol: "",
    prevocational_symbol: "",
    requires_previous_level: false,
    previous_level_required: undefined,
    mature_age_entry: true,
    mature_min_age: 23,
    mature_min_experience_years: 3,
    additional_requirements: "",
  });

  const { data: requirements, isLoading } = useEntryRequirements();
  const { data: trades } = useTrades();
  const createRequirement = useCreateEntryRequirement();
  const updateRequirement = useUpdateEntryRequirement();
  const { toast } = useToast();

  const handleOpenDialog = (requirement?: any) => {
    if (requirement) {
      setEditingRequirement(requirement);
      setFormData({
        trade_id: requirement.trade_id,
        level: requirement.level,
        requirement_name: requirement.requirement_name,
        min_grade: requirement.min_grade || 10,
        min_points: requirement.min_points || 20,
        english_symbol: requirement.english_symbol || "F",
        maths_symbol: requirement.maths_symbol || "F",
        science_symbol: requirement.science_symbol || "",
        prevocational_symbol: requirement.prevocational_symbol || "",
        requires_previous_level: requirement.requires_previous_level || false,
        previous_level_required: requirement.previous_level_required,
        mature_age_entry: requirement.mature_age_entry ?? true,
        mature_min_age: requirement.mature_min_age || 23,
        mature_min_experience_years: requirement.mature_min_experience_years || 3,
        additional_requirements: requirement.additional_requirements || "",
      });
    } else {
      setEditingRequirement(null);
      setFormData({
        trade_id: "",
        level: 1,
        requirement_name: "",
        min_grade: 10,
        min_points: 20,
        english_symbol: "F",
        maths_symbol: "F",
        science_symbol: "",
        prevocational_symbol: "",
        requires_previous_level: false,
        previous_level_required: undefined,
        mature_age_entry: true,
        mature_min_age: 23,
        mature_min_experience_years: 3,
        additional_requirements: "",
      });
    }
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!formData.trade_id || !formData.requirement_name) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    try {
      if (editingRequirement) {
        await updateRequirement.mutateAsync({ id: editingRequirement.id, data: formData });
      } else {
        await createRequirement.mutateAsync(formData);
      }
      setDialogOpen(false);
    } catch (error) {
      // Error handled in mutation
    }
  };

  const getTradeName = (tradeId: string) => {
    const trade = trades?.find(t => t.id === tradeId);
    return trade ? `${trade.name} (${trade.code})` : tradeId;
  };

  return (
    <DashboardLayout
      title="Entry Requirements Management"
      subtitle="Manage entry requirements for all trades and levels"
      navItems={registrationOfficerNavItems}
      groupLabel="Registration"
    >
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <p className="text-sm text-muted-foreground">
              Configure entry requirements for each trade and level. Changes require approval from Head of Trainee Support.
            </p>
          </div>
          <Button onClick={() => handleOpenDialog()}>
            <Plus className="h-4 w-4 mr-2" />
            Add Requirement
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Entry Requirements</CardTitle>
            <CardDescription>
              {isLoading ? "Loading..." : `${requirements?.length || 0} requirement(s) configured`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8">Loading...</div>
            ) : !requirements || requirements.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No entry requirements configured yet
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Trade</TableHead>
                    <TableHead>Level</TableHead>
                    <TableHead>Min Grade</TableHead>
                    <TableHead>Min Points</TableHead>
                    <TableHead>English</TableHead>
                    <TableHead>Maths</TableHead>
                    <TableHead>Previous Level</TableHead>
                    <TableHead>Mature Entry</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {requirements.map((req: any) => (
                    <TableRow key={req.id}>
                      <TableCell className="font-medium">
                        {req.trades?.name || getTradeName(req.trade_id)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">Level {req.level}</Badge>
                      </TableCell>
                      <TableCell>Grade {req.min_grade || "-"}</TableCell>
                      <TableCell>{req.min_points || "-"} pts</TableCell>
                      <TableCell>{req.english_symbol || "-"}</TableCell>
                      <TableCell>{req.maths_symbol || "-"}</TableCell>
                      <TableCell>
                        {req.requires_previous_level ? (
                          <Badge variant="secondary">Level {req.previous_level_required}</Badge>
                        ) : (
                          <span className="text-muted-foreground">No</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {req.mature_age_entry ? (
                          <Badge className="bg-green-100 text-green-700">Yes</Badge>
                        ) : (
                          <span className="text-muted-foreground">No</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenDialog(req)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Standard Requirements Reference */}
        <Card>
          <CardHeader>
            <CardTitle>Standard Requirements Reference</CardTitle>
            <CardDescription>
              Reference guide for common entry requirements
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div className="p-4 border rounded-lg">
                <h4 className="font-semibold mb-2">Business Services (Level 1)</h4>
                <p>Grade 11/12, 20 points in 6 subjects, F in English & Maths</p>
              </div>
              <div className="p-4 border rounded-lg">
                <h4 className="font-semibold mb-2">Electrical General CBET (Level 2)</h4>
                <p>Grade 11/12, 20 points in 6 subjects, F in English, Maths, Science</p>
              </div>
              <div className="p-4 border rounded-lg">
                <h4 className="font-semibold mb-2">Hospitality & Tourism (Level 2)</h4>
                <p>Grade 10 with 23 points, E in English OR Grade 11/12 with 20 points, F in English</p>
              </div>
              <div className="p-4 border rounded-lg">
                <h4 className="font-semibold mb-2">Pre-Vocational Candidates</h4>
                <p>18 points in 6 subjects, F in English, Maths, Science, D in pre-vocational subject</p>
              </div>
              <div className="p-4 border rounded-lg">
                <h4 className="font-semibold mb-2">Mature Age Entry</h4>
                <p>23+ years, Grade 10 JSC, 3 years relevant experience</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingRequirement ? "Edit Entry Requirement" : "Add Entry Requirement"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Trade *</Label>
                <Select
                  value={formData.trade_id}
                  onValueChange={(value) => setFormData({ ...formData, trade_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select trade" />
                  </SelectTrigger>
                  <SelectContent>
                    {trades?.map((trade) => (
                      <SelectItem key={trade.id} value={trade.id}>
                        {trade.name} ({trade.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Level *</Label>
                <Select
                  value={formData.level.toString()}
                  onValueChange={(value) => setFormData({ ...formData, level: parseInt(value) })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">Level 1</SelectItem>
                    <SelectItem value="2">Level 2</SelectItem>
                    <SelectItem value="3">Level 3</SelectItem>
                    <SelectItem value="4">Level 4</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Requirement Name *</Label>
              <Input
                value={formData.requirement_name}
                onChange={(e) => setFormData({ ...formData, requirement_name: e.target.value })}
                placeholder="e.g., Standard Entry for Level 2"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Minimum Grade</Label>
                <Select
                  value={formData.min_grade?.toString() || ""}
                  onValueChange={(value) => setFormData({ ...formData, min_grade: parseInt(value) })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select grade" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">Grade 10</SelectItem>
                    <SelectItem value="11">Grade 11</SelectItem>
                    <SelectItem value="12">Grade 12</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Minimum Points</Label>
                <Input
                  type="number"
                  value={formData.min_points || ""}
                  onChange={(e) => setFormData({ ...formData, min_points: parseInt(e.target.value) || undefined })}
                  placeholder="e.g., 20"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>English Symbol (Minimum)</Label>
                <Select
                  value={formData.english_symbol || ""}
                  onValueChange={(value) => setFormData({ ...formData, english_symbol: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select symbol" />
                  </SelectTrigger>
                  <SelectContent>
                    {SYMBOLS.map((symbol) => (
                      <SelectItem key={symbol} value={symbol}>{symbol}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Maths Symbol (Minimum)</Label>
                <Select
                  value={formData.maths_symbol || ""}
                  onValueChange={(value) => setFormData({ ...formData, maths_symbol: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select symbol" />
                  </SelectTrigger>
                  <SelectContent>
                    {SYMBOLS.map((symbol) => (
                      <SelectItem key={symbol} value={symbol}>{symbol}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Science Symbol (Optional)</Label>
                <Select
                  value={formData.science_symbol || "none"}
                  onValueChange={(value) => setFormData({ ...formData, science_symbol: value === "none" ? "" : value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Not required" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Not required</SelectItem>
                    {SYMBOLS.map((symbol) => (
                      <SelectItem key={symbol} value={symbol}>{symbol}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Pre-Vocational Symbol (Optional)</Label>
                <Select
                  value={formData.prevocational_symbol || "none"}
                  onValueChange={(value) => setFormData({ ...formData, prevocational_symbol: value === "none" ? "" : value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Not required" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Not required</SelectItem>
                    {SYMBOLS.map((symbol) => (
                      <SelectItem key={symbol} value={symbol}>{symbol}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div>
                <Label>Requires Previous Level</Label>
                <p className="text-sm text-muted-foreground">Must have completed a previous level</p>
              </div>
              <Switch
                checked={formData.requires_previous_level}
                onCheckedChange={(checked) => setFormData({ 
                  ...formData, 
                  requires_previous_level: checked,
                  previous_level_required: checked ? formData.level - 1 : undefined
                })}
              />
            </div>

            {formData.requires_previous_level && (
              <div className="space-y-2">
                <Label>Previous Level Required</Label>
                <Select
                  value={formData.previous_level_required?.toString() || ""}
                  onValueChange={(value) => setFormData({ ...formData, previous_level_required: parseInt(value) })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select level" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">Level 1</SelectItem>
                    <SelectItem value="2">Level 2</SelectItem>
                    <SelectItem value="3">Level 3</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div>
                <Label>Allow Mature Age Entry</Label>
                <p className="text-sm text-muted-foreground">Allow entry for candidates 23+ with work experience</p>
              </div>
              <Switch
                checked={formData.mature_age_entry}
                onCheckedChange={(checked) => setFormData({ ...formData, mature_age_entry: checked })}
              />
            </div>

            {formData.mature_age_entry && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Minimum Age</Label>
                  <Input
                    type="number"
                    value={formData.mature_min_age || ""}
                    onChange={(e) => setFormData({ ...formData, mature_min_age: parseInt(e.target.value) || undefined })}
                    placeholder="23"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Minimum Experience (Years)</Label>
                  <Input
                    type="number"
                    value={formData.mature_min_experience_years || ""}
                    onChange={(e) => setFormData({ ...formData, mature_min_experience_years: parseInt(e.target.value) || undefined })}
                    placeholder="3"
                  />
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label>Additional Requirements</Label>
              <Textarea
                value={formData.additional_requirements || ""}
                onChange={(e) => setFormData({ ...formData, additional_requirements: e.target.value })}
                placeholder="Any additional requirements or notes..."
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleSubmit}
              disabled={createRequirement.isPending || updateRequirement.isPending}
            >
              {(createRequirement.isPending || updateRequirement.isPending) ? "Saving..." : "Save Requirement"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default EntryRequirementsManagement;
