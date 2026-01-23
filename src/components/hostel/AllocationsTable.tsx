import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, UserCheck, UserX } from "lucide-react";
import { useHostelAllocations, useCheckOutHostelAllocation } from "@/hooks/useHostel";
import { AllocationDialog } from "./AllocationDialog";
import { format } from "date-fns";
import { useUserRole } from "@/hooks/useUserRole";
import { supabase } from "@/integrations/supabase/client";
import { useOrganizationContext } from "@/hooks/useOrganizationContext";

interface AllocationsTableProps {
  limit?: number;
}

export function AllocationsTable({ limit }: AllocationsTableProps) {
  const { data: allocations = [], isLoading } = useHostelAllocations();
  const checkOutMutation = useCheckOutHostelAllocation();
  const { role } = useUserRole();
  const { organizationId } = useOrganizationContext();
  const [dialogOpen, setDialogOpen] = useState(false);

  const displayAllocations = limit ? allocations.slice(0, limit) : allocations;

  const handleCheckOut = async (allocation: any) => {
    if (confirm("Are you sure you want to check out this trainee?")) {
      await checkOutMutation.mutateAsync({
        id: allocation.id,
        checked_out_by: allocation.allocated_by,
      });

      // Create in-app notification
      try {
        await supabase.functions.invoke('create-notification', {
          body: {
            organization_id: organizationId,
            user_id: allocation.trainee_id,
            type: 'allocation_checkout',
            priority: 'medium',
            title: 'Hostel Check-Out Completed',
            message: `You have been checked out from your hostel accommodation.`,
            metadata: {
              allocation_id: allocation.id,
              room_id: allocation.room_id,
            },
          }
        });
      } catch (error) {
        console.error('Failed to create notification:', error);
      }
    }
  };

  if (isLoading) {
    return <div className="text-center py-4">Loading allocations...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setDialogOpen(true)} size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Allocate Bed
        </Button>
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Trainee ID</TableHead>
              <TableHead>Building</TableHead>
              <TableHead>Room</TableHead>
              <TableHead>Bed</TableHead>
              <TableHead>Check-In Date</TableHead>
              <TableHead>Expected Check-Out</TableHead>
              <TableHead>Monthly Fee</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {displayAllocations.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                  <UserCheck className="h-12 w-12 mx-auto mb-2 opacity-20" />
                  <p>No allocations found. Allocate your first bed to get started.</p>
                </TableCell>
              </TableRow>
            ) : (
              displayAllocations.map((allocation) => (
                <TableRow key={allocation.id}>
                  <TableCell className="font-medium">{allocation.trainee_id}</TableCell>
                  <TableCell>{allocation.building_id}</TableCell>
                  <TableCell>{allocation.room_id}</TableCell>
                  <TableCell>{allocation.bed_id}</TableCell>
                  <TableCell>{format(new Date(allocation.check_in_date), "PP")}</TableCell>
                  <TableCell>
                    {allocation.expected_check_out_date
                      ? format(new Date(allocation.expected_check_out_date), "PP")
                      : "N/A"}
                  </TableCell>
                  <TableCell>R {allocation.monthly_fee}</TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        allocation.status === "active"
                          ? "default"
                          : allocation.status === "checked_out"
                          ? "secondary"
                          : "destructive"
                      }
                      className="capitalize"
                    >
                      {allocation.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {allocation.status === "active" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleCheckOut(allocation)}
                        disabled={checkOutMutation.isPending}
                      >
                        <UserX className="h-4 w-4 mr-2" />
                        Check Out
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <AllocationDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  );
}
