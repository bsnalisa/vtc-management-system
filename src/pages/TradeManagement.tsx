import { useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, BookOpen, Layers, Settings } from "lucide-react";
import { useRoleNavigation } from "@/hooks/useRoleNavigation";
import { withRoleAccess } from "@/components/withRoleAccess";
import { TradesTable } from "@/components/trades/TradesTable";
import { TradeDialog } from "@/components/trades/TradeDialog";
import { useTrades } from "@/hooks/useTrades";
import { useOrganizationContext } from "@/hooks/useOrganizationContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
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
  const { navItems, groupLabel } = useRoleNavigation();
  const { data: trades, isLoading } = useTrades();
  const { organizationId } = useOrganizationContext();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedTrade, setSelectedTrade] = useState<Trade | null>(null);
  const [activeTab, setActiveTab] = useState("trades");

  // Fetch trade levels
  const { data: tradeLevels } = useQuery({
    queryKey: ["trade_levels", organizationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trade_levels")
        .select("*, trades:trade_id(name, code)")
        .eq("organization_id", organizationId!)
        .order("level");
      if (error) throw error;
      return data;
    },
    enabled: !!organizationId,
  });

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
      subtitle="Manage trades, levels, and course configurations"
      navItems={navItems}
      groupLabel={groupLabel}
    >
      <div className="space-y-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="trades" className="flex items-center gap-2">
              <BookOpen className="h-4 w-4" />
              Trades
            </TabsTrigger>
            <TabsTrigger value="levels" className="flex items-center gap-2">
              <Layers className="h-4 w-4" />
              Trade Levels
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Settings
            </TabsTrigger>
          </TabsList>

          <TabsContent value="trades" className="space-y-4 mt-4">
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
          </TabsContent>

          <TabsContent value="levels" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Trade Levels Configuration</CardTitle>
                <CardDescription>
                  Configure levels and their specific requirements for each trade
                </CardDescription>
              </CardHeader>
              <CardContent>
                {!tradeLevels || tradeLevels.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <p>Trade levels are automatically created based on trade configuration.</p>
                    <p className="text-sm mt-2">Configure entry requirements for specific level settings.</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Trade</TableHead>
                        <TableHead>Level</TableHead>
                        <TableHead>Duration (Months)</TableHead>
                        <TableHead>Total Credits</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {tradeLevels.map((level: any) => (
                        <TableRow key={level.id}>
                          <TableCell className="font-medium">
                            {level.trades?.name || "-"}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">Level {level.level}</Badge>
                          </TableCell>
                          <TableCell>{level.duration_months || "-"}</TableCell>
                          <TableCell>{level.total_credits || "-"}</TableCell>
                          <TableCell>
                            <Badge variant={level.active ? "default" : "secondary"}>
                              {level.active ? "Active" : "Inactive"}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="settings" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Trade & Course Settings</CardTitle>
                <CardDescription>
                  General settings for trade and course management
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <Label className="text-base">Auto-generate Trade Levels</Label>
                    <p className="text-sm text-muted-foreground">
                      Automatically create level records when a new trade is added
                    </p>
                  </div>
                  <Switch defaultChecked />
                </div>
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <Label className="text-base">Require Entry Requirement Approval</Label>
                    <p className="text-sm text-muted-foreground">
                      Changes to entry requirements must be approved by Head of Trainee Support
                    </p>
                  </div>
                  <Switch defaultChecked />
                </div>
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <Label className="text-base">Enable Mature Age Entry</Label>
                    <p className="text-sm text-muted-foreground">
                      Allow mature age applicants (23+) with work experience
                    </p>
                  </div>
                  <Switch defaultChecked />
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
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
