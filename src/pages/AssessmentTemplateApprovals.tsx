import { useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useRoleNavigation } from "@/hooks/useRoleNavigation";
import { withRoleAccess } from "@/components/withRoleAccess";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckCircle, RotateCcw, Eye, ClipboardList } from "lucide-react";
import {
  useAssessmentTemplates,
  useTemplateComponents,
  useApproveTemplate,
  useRejectTemplate,
  type AssessmentTemplate,
} from "@/hooks/useAssessmentTemplates";

const AssessmentTemplateApprovalsPage = () => {
  const { navItems, groupLabel } = useRoleNavigation();
  const { data: pendingTemplates, isLoading: loadingPending } = useAssessmentTemplates("pending_approval");
  const { data: approvedTemplates } = useAssessmentTemplates("approved");
  const approve = useApproveTemplate();
  const reject = useRejectTemplate();

  const [viewTemplate, setViewTemplate] = useState<AssessmentTemplate | null>(null);
  const [rejectDialog, setRejectDialog] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const handleReject = async () => {
    if (!rejectDialog || !rejectReason.trim()) return;
    await reject.mutateAsync({ templateId: rejectDialog, reason: rejectReason });
    setRejectDialog(null);
    setRejectReason("");
  };

  return (
    <DashboardLayout
      title="Assessment Template Approvals"
      subtitle="Review and approve qualification assessment templates"
      navItems={navItems}
      groupLabel={groupLabel}
    >
      <Tabs defaultValue="pending" className="space-y-4">
        <TabsList>
          <TabsTrigger value="pending">
            Pending ({pendingTemplates?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="approved">
            Approved ({approvedTemplates?.length || 0})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="space-y-4">
          {loadingPending ? (
            <Skeleton className="h-32 w-full" />
          ) : !pendingTemplates?.length ? (
            <Card>
              <CardContent className="py-12 text-center">
                <CheckCircle className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                <h3 className="text-lg font-medium">No Pending Templates</h3>
                <p className="text-muted-foreground">All assessment templates have been reviewed.</p>
              </CardContent>
            </Card>
          ) : (
            pendingTemplates.map((template) => (
              <TemplateApprovalCard
                key={template.id}
                template={template}
                onApprove={() => approve.mutateAsync(template.id)}
                onReject={() => setRejectDialog(template.id)}
                onView={() => setViewTemplate(template)}
                isApproving={approve.isPending}
              />
            ))
          )}
        </TabsContent>

        <TabsContent value="approved" className="space-y-4">
          {approvedTemplates?.map((template) => (
            <Card key={template.id}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base">{template.qualifications?.qualification_title}</CardTitle>
                    <CardDescription>{template.qualifications?.qualification_code}</CardDescription>
                  </div>
                  <Badge className="bg-green-600 text-white">Approved</Badge>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex gap-6 text-sm text-muted-foreground">
                  <span>Theory ≥{template.theory_pass_mark}%</span>
                  <span>Practical ≥{template.practical_pass_mark}%</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>
      </Tabs>

      {/* View Template Components */}
      {viewTemplate && (
        <TemplateViewDialog template={viewTemplate} onClose={() => setViewTemplate(null)} />
      )}

      {/* Reject Dialog */}
      <Dialog open={!!rejectDialog} onOpenChange={() => setRejectDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Return Template</DialogTitle>
            <DialogDescription>Provide feedback for the Assessment Coordinator.</DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="Reason for returning..."
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialog(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleReject} disabled={!rejectReason.trim() || reject.isPending}>
              Return Template
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

const TemplateApprovalCard = ({
  template,
  onApprove,
  onReject,
  onView,
  isApproving,
}: {
  template: AssessmentTemplate;
  onApprove: () => void;
  onReject: () => void;
  onView: () => void;
  isApproving: boolean;
}) => (
  <Card className="border-primary/30">
    <CardHeader className="pb-2">
      <div className="flex items-center justify-between">
        <div>
          <CardTitle className="text-base">{template.qualifications?.qualification_title}</CardTitle>
          <CardDescription>
            {template.qualifications?.qualification_code} • NQF Level {template.qualifications?.nqf_level}
          </CardDescription>
        </div>
        <Badge>Pending Approval</Badge>
      </div>
    </CardHeader>
    <CardContent>
      <div className="flex gap-6 text-sm text-muted-foreground mb-4">
        <span>Theory Pass: <strong className="text-foreground">{template.theory_pass_mark}%</strong></span>
        <span>Practical Pass: <strong className="text-foreground">{template.practical_pass_mark}%</strong></span>
      </div>
      <div className="flex gap-2">
        <Button size="sm" variant="outline" onClick={onView}>
          <Eye className="h-4 w-4 mr-1" /> View Components
        </Button>
        <Button size="sm" onClick={onApprove} disabled={isApproving}>
          <CheckCircle className="h-4 w-4 mr-1" /> Approve
        </Button>
        <Button size="sm" variant="destructive" onClick={onReject}>
          <RotateCcw className="h-4 w-4 mr-1" /> Return
        </Button>
      </div>
    </CardContent>
  </Card>
);

const TemplateViewDialog = ({
  template,
  onClose,
}: {
  template: AssessmentTemplate;
  onClose: () => void;
}) => {
  const { data: components, isLoading } = useTemplateComponents(template.id);
  const theoryComponents = components?.filter((c) => c.component_type === "theory") || [];
  const practicalComponents = components?.filter((c) => c.component_type === "practical") || [];

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{template.qualifications?.qualification_title}</DialogTitle>
          <DialogDescription>Assessment structure review</DialogDescription>
        </DialogHeader>
        {isLoading ? (
          <Skeleton className="h-24 w-full" />
        ) : (
          <div className="space-y-4">
            <div>
              <h4 className="font-semibold text-sm mb-2">Theory Components ({theoryComponents.length})</h4>
              {theoryComponents.length > 0 ? (
                <ul className="space-y-1">
                  {theoryComponents.map((c) => (
                    <li key={c.id} className="text-sm p-2 bg-muted rounded">
                      {c.component_name}
                      {c.description && <span className="text-muted-foreground ml-2">— {c.description}</span>}
                    </li>
                  ))}
                </ul>
              ) : <p className="text-sm text-muted-foreground">None defined</p>}
            </div>
            <div>
              <h4 className="font-semibold text-sm mb-2">Practical Components ({practicalComponents.length})</h4>
              {practicalComponents.length > 0 ? (
                <ul className="space-y-1">
                  {practicalComponents.map((c) => (
                    <li key={c.id} className="text-sm p-2 bg-muted rounded">
                      {c.component_name}
                      {c.description && <span className="text-muted-foreground ml-2">— {c.description}</span>}
                    </li>
                  ))}
                </ul>
              ) : <p className="text-sm text-muted-foreground">None defined</p>}
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default withRoleAccess(AssessmentTemplateApprovalsPage, {
  requiredRoles: ["head_of_training"],
});
