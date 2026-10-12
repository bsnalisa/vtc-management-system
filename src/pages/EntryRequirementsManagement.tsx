import { useState } from "react";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
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
import { useRoleNavigation } from "@/hooks/useRoleNavigation";
import { useEntryRequirements, useSaveEntryRequirement, EntryRequirementData } from "@/hooks/useEntryRequirements";
import { RequirementChangeRequests } from "@/components/registration/RequirementChangeRequests";
import { useTrades } from "@/hooks/useTrades";
import { useToast } from "@/hooks/use-toast";
import { SYMBOLS } from "@/types/application";

const EntryRequirementsManagement = () => {
  const { navItems, groupLabel, role } = useRoleNavigation();
  // Approvers change rules at once; registration officers send changes for approval
  const canApprove = role === "head_of_trainee_support" || role === "super_admin";
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRequirement, setEditingRequirement] = useState<any>(null);
  const [formData, setFormData] = useState<EntryRequirementData>({
    trade_id: "",
    level: 1,
    requirement_name: "",
    min_grade: 10,
    min_points: 20,
    english_symbol: "",
    maths_symbol: "",
    science_symbol: "",
    prevocational_symbol: "",
    requires_previous_level: false,
    previous_level_required: undefined,
    mature_age_entry: false,
    mature_min_age: 23,
    mature_min_experience_years: 3,
    additional_requirements: "",
  });

  const { data: requirements, isLoading } = useEntryRequirements();
  const { data: trades } = useTrades();
  const saveRequirement = useSaveEntryRequirement();
  const { toast } = useToast();

  const handleOpenDialog = (requirement?: any) => {
    if (requirement) {
      setEditingRequirement(requirement);
      setFormData({
        trade_id: requirement.trade_id ?? "",
        level: requirement.level ?? null,
        requirement_name: requirement.requirement_name,
        min_grade: requirement.min_grade ?? undefined,
        min_points: requirement.min_points ?? undefined,
        english_symbol: requirement.english_symbol || "",
        maths_symbol: requirement.maths_symbol || "",
        science_symbol: requirement.science_symbol || "",
        prevocational_symbol: requirement.prevocational_symbol || "",
        requires_previous_level: requirement.requires_previous_level || false,
        previous_level_required: requirement.previous_level_required,
        mature_age_entry: requirement.mature_age_entry ?? false,
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
        english_symbol: "",
        maths_symbol: "",
        science_symbol: "",
        prevocational_symbol: "",
        requires_previous_level: false,
        previous_level_required: undefined,
        mature_age_entry: false,
        mature_min_age: 23,
        mature_min_experience_years: 3,
        additional_requirements: "",
      });
    }
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!formData.requirement_name.trim()) {
      toast({ title: "Validation Error", description: "Give the requirement a name", variant: "destructive" });
      return;
    }
    // Empty trade or level means the rule applies to all of them; empty symbols mean "not required"
    const changes = {
      ...formData,
      trade_id: formData.trade_id || null,
      level: formData.level || null,
      english_symbol: formData.english_symbol || undefined,
      maths_symbol: formData.maths_symbol || undefined,
    };
    try {
      await saveRequirement.mutateAsync({ type: editingRequirement ? "update" : "create", id: editingRequirement?.id, changes });
      setDialogOpen(false);
    } catch (error) {
      // Error handled in mutation
    }
  };

  const handleRemove = async (req: { id: string; requirement_name: string }) => {
    if (!window.confirm(`Remove "${req.requirement_name}"? Applicants will no longer be checked against it.`)) return;
    await saveRequirement.mutateAsync({ type: "deactivate", id: req.id }).catch(() => undefined);
  };

  const getTradeName = (tradeId: string) => {
    const trade = trades?.find(t => t.id === tradeId);
    return trade ? `${trade.name} (${trade.code})` : tradeId;
  };

  return (
    <DashboardLayout
      title="Entry Requirements Management"
      subtitle="Manage entry requirements for all trades and levels"
      navItems={navItems}
      groupLabel={groupLabel}
    >
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <p className="text-sm text-muted-foreground">
              Configure entry requirements for each trade and level. Several rules for the same trade and level are alternatives: an applicant who meets any one of them qualifies. Rules with no trade are the general minimums, used for trades that have no rule of their own. {canApprove ? "Your changes take effect at once." : "Your changes are sent to the Head of Trainee Support for approval."}
            </p>
          </div>
          <Button onClick={() => handleOpenDialog()}>
            <Plus className="h-4 w-4 mr-2" />
            Add Requirement
          </Button>
        </div>

        <RequirementChangeRequests canReview={canApprove} title={canApprove ? "Changes awaiting your approval" : "Your changes awaiting approval"} />

        <Card>
          <CardHeader>
            <CardTitle>Entry Requirements</CardTitle>
            <CardDescription>
              {isLoading ? "Loading..." : `${requirements?.length || 0} requirement(s) configured`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <LoadingSpinner text="Loading..." className="py-8" />
            ) : !requirements || requirements.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No entry requirements configured yet
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Requirement</TableHead>
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
                      <TableCell className="whitespace-normal font-medium min-w-[14rem]">{req.requirement_name}</TableCell>
                      <TableCell>
                        {req.trade_id ? (req.trades?.name || getTradeName(req.trade_id)) : <Badge variant="secondary">All trades</Badge>}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{req.level ? `Level ${req.level}` : "All levels"}</Badge>
                      </TableCell>
                      <TableCell>{req.min_grade ? `Grade ${req.min_grade}+` : "-"}</TableCell>
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
                          aria-label={`Edit ${req.requirement_name}`}
                          onClick={() => handleOpenDialog(req)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          aria-label={`Remove ${req.requirement_name}`}
                          onClick={() => handleRemove(req)}
                        >
                          <Trash2 className="h-4 w-4" />
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
                <h4 className="font-semibold mb-2">General minimum: old curriculum (Grade 10 / JSC)</h4>
                <p>At least 23 points, with an E or better in English, Mathematics and Physical Science.</p>
              </div>
              <div className="p-4 border rounded-lg">
                <h4 className="font-semibold mb-2">General minimum: new curriculum (Grade 11/12 / NSSCO)</h4>
                <p>At least 20 points. The subject symbols depend on the level and trade.</p>
              </div>
              <div className="p-4 border rounded-lg">
                <h4 className="font-semibold mb-2">Office Administration (Level 1)</h4>
                <p>Grade 11/12 with 20 points, E in English and Mathematics.</p>
              </div>
              <div className="p-4 border rounded-lg">
                <h4 className="font-semibold mb-2">Electrical General (Level 1)</h4>
                <p>Grade 11/12 with 20 points, E in English, Mathematics and Physical Science (D in Mathematics and Science for higher levels).</p>
              </div>
              <div className="p-4 border rounded-lg">
                <h4 className="font-semibold mb-2">ICT Foundation (Level 2)</h4>
                <p>Grade 12 with 20 points (E in Mathematics and English) or Grade 11 with 20 points (F in English, Mathematics and Science).</p>
              </div>
              <div className="p-4 border rounded-lg">
                <h4 className="font-semibold mb-2">Wholesale and Retail Operations (Level 2)</h4>
                <p>Grade 11/12 with 20 points, E in English and Mathematics or Accounting.</p>
              </div>
              <div className="p-4 border rounded-lg">
                <h4 className="font-semibold mb-2">Hospitality &amp; Tourism (Level 2)</h4>
                <p>Grade 10 with 23 points (E in English) or Grade 11 with 20 points (F in English, Mathematics and Science).</p>
              </div>
              <div className="p-4 border rounded-lg">
                <h4 className="font-semibold mb-2">Hospitality &amp; Tourism (Level 3 and 4)</h4>
                <p>The preceding Level 2 or Level 3 trade certificate or relevant results.</p>
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
                <Label>Trade</Label>
                <Select
                  value={formData.trade_id || "all"}
                  onValueChange={(value) => setFormData({ ...formData, trade_id: value === "all" ? "" : value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All trades (general rule)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All trades (general rule)</SelectItem>
                    {trades?.map((trade) => (
                      <SelectItem key={trade.id} value={trade.id}>
                        {trade.name} ({trade.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Level</Label>
                <Select
                  value={(formData.level ?? 0).toString()}
                  onValueChange={(value) => setFormData({ ...formData, level: parseInt(value) || null })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">All levels</SelectItem>
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
                <Label>English Symbol (Minimum, optional)</Label>
                <Select
                  value={formData.english_symbol || "none"}
                  onValueChange={(value) => setFormData({ ...formData, english_symbol: value === "none" ? "" : value })}
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
                <Label>Maths Symbol (Minimum, optional)</Label>
                <Select
                  value={formData.maths_symbol || "none"}
                  onValueChange={(value) => setFormData({ ...formData, maths_symbol: value === "none" ? "" : value })}
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
                  previous_level_required: checked && formData.level ? formData.level - 1 : undefined
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
              disabled={saveRequirement.isPending}
            >
              {saveRequirement.isPending ? "Saving..." : canApprove ? "Save Requirement" : "Send for approval"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default EntryRequirementsManagement;
