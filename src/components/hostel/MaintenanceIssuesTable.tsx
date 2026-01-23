import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Wrench } from "lucide-react";
import { useHostelMaintenanceIssues } from "@/hooks/useHostel";
import { MaintenanceIssueDialog } from "./MaintenanceIssueDialog";
import { format } from "date-fns";

export function MaintenanceIssuesTable() {
  const { data: issues = [], isLoading } = useHostelMaintenanceIssues();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedIssue, setSelectedIssue] = useState<any>(null);

  const handleEdit = (issue: any) => {
    setSelectedIssue(issue);
    setDialogOpen(true);
  };

  const handleAdd = () => {
    setSelectedIssue(null);
    setDialogOpen(true);
  };

  if (isLoading) {
    return <div className="text-center py-4">Loading maintenance issues...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={handleAdd} size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Report Issue
        </Button>
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Issue #</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Building</TableHead>
              <TableHead>Room</TableHead>
              <TableHead>Priority</TableHead>
              <TableHead>Reported Date</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {issues.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                  <Wrench className="h-12 w-12 mx-auto mb-2 opacity-20" />
                  <p>No maintenance issues found.</p>
                </TableCell>
              </TableRow>
            ) : (
              issues.map((issue) => (
                <TableRow key={issue.id}>
                  <TableCell className="font-medium">{issue.issue_number}</TableCell>
                  <TableCell className="capitalize">{issue.issue_type}</TableCell>
                  <TableCell>{issue.building_id}</TableCell>
                  <TableCell>{issue.room_id || "N/A"}</TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        issue.priority === "high"
                          ? "destructive"
                          : issue.priority === "medium"
                          ? "secondary"
                          : "outline"
                      }
                      className="capitalize"
                    >
                      {issue.priority}
                    </Badge>
                  </TableCell>
                  <TableCell>{format(new Date(issue.reported_date), "PP")}</TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        issue.status === "completed"
                          ? "default"
                          : issue.status === "in_progress"
                          ? "secondary"
                          : "outline"
                      }
                      className="capitalize"
                    >
                      {issue.status.replace("_", " ")}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" onClick={() => handleEdit(issue)}>
                      View
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <MaintenanceIssueDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        issue={selectedIssue}
      />
    </div>
  );
}
