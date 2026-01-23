import { useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CheckCircle, XCircle, Clock, ArrowRight } from "lucide-react";
import { headOfTraineeSupportNavItems } from "@/lib/navigationConfig";
import { useTraineeUpdateRequests, useApproveUpdateRequest } from "@/hooks/useTraineeUpdateRequests";

const PendingApprovals = () => {
  const { data: requests, isLoading } = useTraineeUpdateRequests("pending");
  const approveRequest = useApproveUpdateRequest();
  const [selectedRequest, setSelectedRequest] = useState<any>(null);
  const [approvalNotes, setApprovalNotes] = useState("");
  const [isApproving, setIsApproving] = useState(false);

  const handleApprove = () => {
    if (!selectedRequest) return;
    setIsApproving(true);
    approveRequest.mutate(
      {
        requestId: selectedRequest.id,
        approve: true,
        notes: approvalNotes,
      },
      {
        onSettled: () => {
          setIsApproving(false);
          setSelectedRequest(null);
          setApprovalNotes("");
        },
      }
    );
  };

  const handleReject = () => {
    if (!selectedRequest) return;
    setIsApproving(true);
    approveRequest.mutate(
      {
        requestId: selectedRequest.id,
        approve: false,
        notes: approvalNotes,
      },
      {
        onSettled: () => {
          setIsApproving(false);
          setSelectedRequest(null);
          setApprovalNotes("");
        },
      }
    );
  };

  const getChangeLabel = (key: string) => {
    const labels: Record<string, string> = {
      trade_id: "Programme/Trade",
      training_mode: "Training Mode",
      level: "Level",
      academic_year: "Academic Year",
    };
    return labels[key] || key;
  };

  const getChangeValue = (value: any, key: string) => {
    if (key === "training_mode") {
      return value.replace("_", " ").replace(/\b\w/g, (l: string) => l.toUpperCase());
    }
    if (key === "level") {
      return `Level ${value}`;
    }
    return value;
  };

  return (
    <DashboardLayout
      title="Pending Approvals"
      subtitle="Review and approve trainee enrollment updates"
      navItems={headOfTraineeSupportNavItems}
      groupLabel="Trainee Support"
    >
      <Card>
        <CardHeader>
          <CardTitle>Enrollment Update Requests</CardTitle>
          <CardDescription>
            Review changes requested by Registration Officers
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Trainee</TableHead>
                    <TableHead>Trade</TableHead>
                    <TableHead>Request Type</TableHead>
                    <TableHead>Requested Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right min-w-[100px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {!requests || requests.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        No pending approvals
                      </TableCell>
                    </TableRow>
                  ) : (
                    requests.map((request: any) => (
                      <TableRow key={request.id}>
                        <TableCell className="font-medium whitespace-nowrap">
                          {request.trainees?.first_name} {request.trainees?.last_name}
                          <br />
                          <span className="text-xs text-muted-foreground">
                            {request.trainees?.trainee_id}
                          </span>
                        </TableCell>
                        <TableCell>{request.trainees?.trades?.name}</TableCell>
                        <TableCell className="capitalize whitespace-nowrap">
                          {request.request_type.replace("_", " ")}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {new Date(request.created_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">
                            <Clock className="mr-1 h-3 w-3" />
                            Pending
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setSelectedRequest(request)}
                          >
                            Review
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Review Dialog */}
      <Dialog open={!!selectedRequest} onOpenChange={() => setSelectedRequest(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Review Update Request</DialogTitle>
            <DialogDescription>
              Review the proposed changes and approve or reject
            </DialogDescription>
          </DialogHeader>

          {selectedRequest && (
            <div className="space-y-4">
              <div className="bg-muted p-4 rounded-lg">
                <p className="font-medium">
                  {selectedRequest.trainees?.first_name} {selectedRequest.trainees?.last_name}
                </p>
                <p className="text-sm text-muted-foreground">
                  {selectedRequest.trainees?.trainee_id} • {selectedRequest.trainees?.trades?.name}
                </p>
              </div>

              <div className="space-y-3">
                <p className="font-medium">Proposed Changes:</p>
                {Object.keys(selectedRequest.new_values).map((key) => {
                  const oldValue = selectedRequest.old_values[key];
                  const newValue = selectedRequest.new_values[key];
                  if (oldValue === newValue) return null;

                  return (
                    <div key={key} className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                      <div className="flex-1">
                        <p className="text-sm font-medium">{getChangeLabel(key)}</p>
                        <p className="text-sm text-muted-foreground">
                          {getChangeValue(oldValue, key)}
                        </p>
                      </div>
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-primary">
                          {getChangeValue(newValue, key)}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">
                  Approval Notes (Optional)
                </label>
                <Textarea
                  placeholder="Add any notes or comments..."
                  value={approvalNotes}
                  onChange={(e) => setApprovalNotes(e.target.value)}
                  rows={3}
                />
              </div>
            </div>
          )}

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={() => setSelectedRequest(null)}
              disabled={isApproving}
              className="w-full sm:w-auto"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={isApproving}
              className="w-full sm:w-auto"
            >
              <XCircle className="mr-2 h-4 w-4" />
              Reject
            </Button>
            <Button onClick={handleApprove} disabled={isApproving} className="w-full sm:w-auto">
              <CheckCircle className="mr-2 h-4 w-4" />
              Approve
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default PendingApprovals;
