import { useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useRoleNavigation } from "@/hooks/useRoleNavigation";
import { withRoleAccess } from "@/components/withRoleAccess";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Send, Trash2, ClipboardList, FileCheck, AlertCircle } from "lucide-react";
import { useApprovedQualifications } from "@/hooks/useQualifications";
import {
  useAssessmentTemplates,
  useTemplateComponents,
  useCreateAssessmentTemplate,
  useAddTemplateComponent,
  useDeleteTemplateComponent,
  useSubmitTemplate,
  useUpdateTemplate,
  type AssessmentTemplate,
} from "@/hooks/useAssessmentTemplates";

const statusBadge = (status: string) => {
  switch (status) {
    case "draft": return <Badge variant="secondary">Draft</Badge>;
    case "pending_approval": return <Badge variant="default">Pending HoT Approval</Badge>;
    case "approved": return <Badge className="bg-green-600 text-white">Approved</Badge>;
    case "rejected": return <Badge variant="destructive">Rejected</Badge>;
    default: return <Badge variant="outline">{status}</Badge>;
  }
};

const AssessmentTemplateManagementPage = () => {
  const { navItems, groupLabel } = useRoleNavigation();
  const { data: templates, isLoading } = useAssessmentTemplates();
  const { data: qualifications } = useApprovedQualifications();
  const createTemplate = useCreateAssessmentTemplate();
  const submitTemplate = useSubmitTemplate();
  const updateTemplate = useUpdateTemplate();

  const [createOpen, setCreateOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<AssessmentTemplate | null>(null);
  const [newQualificationId, setNewQualificationId] = useState("");
  const [theoryPass, setTheoryPass] = useState("50");
  const [practicalPass, setPracticalPass] = useState("60");

  // Filter qualifications that don't already have templates
  const availableQualifications = qualifications?.filter(
    (q) => !templates?.some((t) => t.qualification_id === q.id)
  );

  const handleCreate = async () => {
    if (!newQualificationId) return;
    await createTemplate.mutateAsync({
      qualification_id: newQualificationId,
      theory_pass_mark: Number(theoryPass),
      practical_pass_mark: Number(practicalPass),
    });
    setCreateOpen(false);
    setNewQualificationId("");
    setTheoryPass("50");
    setPracticalPass("60");
  };

  return (
    <DashboardLayout
      title="Assessment Templates"
      subtitle="Define standardized assessment structures per qualification"
      navItems={navItems}
      groupLabel={groupLabel}
    >
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <p className="text-muted-foreground">
            Create CA/SA templates for each qualification. Templates must be approved by HoT before use.
          </p>
          <Button onClick={() => setCreateOpen(true)} disabled={!availableQualifications?.length}>
            <Plus className="h-4 w-4 mr-2" />
            New Template
          </Button>
        </div>

        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : !templates?.length ? (
          <Card>
            <CardContent className="py-12 text-center">
              <ClipboardList className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
              <h3 className="text-lg font-medium">No Assessment Templates</h3>
              <p className="text-muted-foreground mb-4">Create a template to define the assessment structure for a qualification.</p>
              <Button onClick={() => setCreateOpen(true)}>
                <Plus className="h-4 w-4 mr-2" /> Create First Template
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {templates.map((template) => (
              <Card
                key={template.id}
                className="cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => setSelectedTemplate(template)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-base">
                        {template.qualifications?.qualification_title || "Unknown Qualification"}
                      </CardTitle>
                      <CardDescription>
                        {template.qualifications?.qualification_code} • NQF Level {template.qualifications?.nqf_level}
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      {statusBadge(template.status)}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="flex gap-6 text-sm text-muted-foreground">
                    <span>Theory Pass: <strong className="text-foreground">{template.theory_pass_mark}%</strong></span>
                    <span>Practical Pass: <strong className="text-foreground">{template.practical_pass_mark}%</strong></span>
                  </div>
                  {template.status === "rejected" && template.rejection_reason && (
                    <div className="mt-2 p-2 bg-destructive/10 rounded text-sm text-destructive flex items-start gap-2">
                      <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                      <span>{template.rejection_reason}</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Template Detail Panel */}
        {selectedTemplate && (
          <TemplateDetailPanel
            template={selectedTemplate}
            onClose={() => setSelectedTemplate(null)}
            onSubmit={() => submitTemplate.mutateAsync(selectedTemplate.id)}
            isSubmitting={submitTemplate.isPending}
          />
        )}

        {/* Create Dialog */}
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Assessment Template</DialogTitle>
              <DialogDescription>
                Select a qualification and define pass thresholds.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Qualification</Label>
                <Select value={newQualificationId} onValueChange={setNewQualificationId}>
                  <SelectTrigger><SelectValue placeholder="Select qualification..." /></SelectTrigger>
                  <SelectContent>
                    {availableQualifications?.map((q) => (
                      <SelectItem key={q.id} value={q.id}>
                        {q.qualification_title} ({q.qualification_code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Theory Pass Mark (%)</Label>
                  <Input type="number" value={theoryPass} onChange={(e) => setTheoryPass(e.target.value)} min={0} max={100} />
                </div>
                <div>
                  <Label>Practical Pass Mark (%)</Label>
                  <Input type="number" value={practicalPass} onChange={(e) => setPracticalPass(e.target.value)} min={0} max={100} />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
              <Button onClick={handleCreate} disabled={!newQualificationId || createTemplate.isPending}>
                Create Template
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};

// Template Detail with Components
const TemplateDetailPanel = ({
  template,
  onClose,
  onSubmit,
  isSubmitting,
}: {
  template: AssessmentTemplate;
  onClose: () => void;
  onSubmit: () => void;
  isSubmitting: boolean;
}) => {
  const { data: components, isLoading } = useTemplateComponents(template.id);
  const addComponent = useAddTemplateComponent();
  const deleteComponent = useDeleteTemplateComponent();

  const [addOpen, setAddOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState<"theory" | "practical">("theory");
  const [newDescription, setNewDescription] = useState("");

  const isDraft = template.status === "draft" || template.status === "rejected";
  const theoryComponents = components?.filter((c) => c.component_type === "theory") || [];
  const practicalComponents = components?.filter((c) => c.component_type === "practical") || [];

  const handleAdd = async () => {
    if (!newName.trim()) return;
    const maxOrder = Math.max(0, ...(components?.map((c) => c.sequence_order) || [0]));
    await addComponent.mutateAsync({
      template_id: template.id,
      component_name: newName.trim(),
      component_type: newType,
      sequence_order: maxOrder + 1,
      description: newDescription || undefined,
    });
    setNewName("");
    setNewDescription("");
    setAddOpen(false);
  };

  return (
    <Card className="border-primary/30">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>{template.qualifications?.qualification_title}</CardTitle>
            <CardDescription>
              {template.qualifications?.qualification_code} • Theory ≥{template.theory_pass_mark}% • Practical ≥{template.practical_pass_mark}%
            </CardDescription>
          </div>
          <div className="flex gap-2">
            {isDraft && components && components.length > 0 && (
              <Button onClick={onSubmit} disabled={isSubmitting} size="sm">
                <Send className="h-4 w-4 mr-2" />
                Submit for Approval
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={onClose}>Close</Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Theory Section */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h4 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">
              Theory Components ({theoryComponents.length})
            </h4>
          </div>
          {theoryComponents.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>Component Name</TableHead>
                  <TableHead>Description</TableHead>
                  {isDraft && <TableHead className="w-10" />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {theoryComponents.map((c, i) => (
                  <TableRow key={c.id}>
                    <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                    <TableCell className="font-medium">{c.component_name}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{c.description || "-"}</TableCell>
                    {isDraft && (
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive"
                          onClick={() => deleteComponent.mutate({ id: c.id, templateId: template.id })}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-sm text-muted-foreground py-2">No theory components defined.</p>
          )}
        </div>

        {/* Practical Section */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h4 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">
              Practical Components ({practicalComponents.length})
            </h4>
          </div>
          {practicalComponents.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>Component Name</TableHead>
                  <TableHead>Description</TableHead>
                  {isDraft && <TableHead className="w-10" />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {practicalComponents.map((c, i) => (
                  <TableRow key={c.id}>
                    <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                    <TableCell className="font-medium">{c.component_name}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{c.description || "-"}</TableCell>
                    {isDraft && (
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive"
                          onClick={() => deleteComponent.mutate({ id: c.id, templateId: template.id })}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-sm text-muted-foreground py-2">No practical components defined.</p>
          )}
        </div>

        {/* Add Component Button */}
        {isDraft && (
          <Button variant="outline" className="w-full" onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4 mr-2" /> Add Component
          </Button>
        )}

        {/* Add Component Dialog */}
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Template Component</DialogTitle>
              <DialogDescription>
                Define a theory or practical component for this qualification's assessment structure.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Component Type</Label>
                <Select value={newType} onValueChange={(v) => setNewType(v as "theory" | "practical")}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="theory">Theory</SelectItem>
                    <SelectItem value="practical">Practical</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Component Name</Label>
                <Input
                  placeholder={newType === "theory" ? "e.g., Theory Paper 1" : "e.g., Word Processing"}
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                />
              </div>
              <div>
                <Label>Description (optional)</Label>
                <Input
                  placeholder="Brief description of this component"
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
              <Button onClick={handleAdd} disabled={!newName.trim() || addComponent.isPending}>
                Add Component
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
};

export default withRoleAccess(AssessmentTemplateManagementPage, {
  requiredRoles: ["assessment_coordinator"],
});
