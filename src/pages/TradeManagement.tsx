import { useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { headOfTrainingNavItems } from "@/lib/navigationConfig";
import { withRoleAccess } from "@/components/withRoleAccess";
import { TradesTable } from "@/components/trades/TradesTable";
import { TradeDialog } from "@/components/trades/TradeDialog";
import { useTrades } from "@/hooks/useTrades";
import { Skeleton } from "@/components/ui/skeleton";

export interface Trade {
  id: string;
  name: string;
  code: string;
  description: string | null;
  active: boolean;
  organization_id: string | null;
  created_at: string;
  updated_at: string;
}

const TradeManagementPage = () => {
  const { data: trades, isLoading } = useTrades();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedTrade, setSelectedTrade] = useState<Trade | null>(null);

  const handleEdit = (trade: Trade) => {
    setSelectedTrade(trade);
    setDialogOpen(true);
  };

  const handleAddNew = () => {
    setSelectedTrade(null);
    setDialogOpen(true);
  };

  return (
    <DashboardLayout
      title="Trade Management"
      subtitle="Create and manage trades for qualifications"
      navItems={headOfTrainingNavItems}
      groupLabel="Academic"
    >
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <p className="text-muted-foreground">
            Trades define the vocational areas that qualifications belong to.
          </p>
          <Button onClick={handleAddNew}>
            <Plus className="h-4 w-4 mr-2" />
            Add Trade
          </Button>
        </div>

        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : trades && trades.length > 0 ? (
          <TradesTable trades={trades as Trade[]} onEdit={handleEdit} />
        ) : (
          <div className="border rounded-md p-12 text-center">
            <p className="text-muted-foreground mb-4">No trades created yet.</p>
            <Button onClick={handleAddNew}>
              <Plus className="h-4 w-4 mr-2" />
              Create Your First Trade
            </Button>
          </div>
        )}
      </div>

      <TradeDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        trade={selectedTrade}
      />
    </DashboardLayout>
  );
};

export default withRoleAccess(TradeManagementPage, {
  requiredRoles: ["head_of_training", "organization_admin", "super_admin"],
});
