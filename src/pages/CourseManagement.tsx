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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Edit, BookOpen, GraduationCap, Settings, Layers } from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useRoleNavigation } from "@/hooks/useRoleNavigation";
import { useTrades } from "@/hooks/useTrades";
import { useToast } from "@/hooks/use-toast";
import { useOrganizationContext } from "@/hooks/useOrganizationContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

interface TradeFormData {
  name: string;
  code: string;
  description: string;
  department: string;
  max_levels: number;
  active: boolean;
}

const CourseManagement = () => {
  const { navItems, groupLabel } = useRoleNavigation();
  const [activeTab, setActiveTab] = useState("trades");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTrade, setEditingTrade] = useState<any>(null);
  const [formData, setFormData] = useState<TradeFormData>({
    name: "",
    code: "",
    description: "",
    department: "",
    max_levels: 4,
    active: true,
  });

  const { data: trades, isLoading: tradesLoading } = useTrades();
  const { organizationId } = useOrganizationContext();
  const { toast } = useToast();
  const queryClient = useQueryClient();

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

  // Create trade mutation
  const createTradeMutation = useMutation({
    mutationFn: async (data: TradeFormData) => {
      const { data: result, error } = await supabase
        .from("trades")
        .insert({
          name: data.name,
          code: data.code,
          description: data.description,
          department: data.department,
          max_levels: data.max_levels,
          active: data.active,
          organization_id: organizationId,
        })
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trades"] });
      toast({
        title: "Success",
        description: "Trade created successfully!",
      });
      setDialogOpen(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Update trade mutation
  const updateTradeMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<TradeFormData> }) => {
      const { data: result, error } = await supabase
        .from("trades")
        .update(data)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trades"] });
      toast({
        title: "Success",
        description: "Trade updated successfully!",
      });
      setDialogOpen(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleOpenDialog = (trade?: any) => {
    if (trade) {
      setEditingTrade(trade);
      setFormData({
        name: trade.name,
        code: trade.code,
        description: trade.description || "",
        department: trade.department || "",
        max_levels: trade.max_levels || 4,
        active: trade.active ?? true,
      });
    } else {
      setEditingTrade(null);
      setFormData({
        name: "",
        code: "",
        description: "",
        department: "",
        max_levels: 4,
        active: true,
      });
    }
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!formData.name || !formData.code) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    if (editingTrade) {
      await updateTradeMutation.mutateAsync({ id: editingTrade.id, data: formData });
    } else {
      await createTradeMutation.mutateAsync(formData);
    }
  };

  const toggleTradeStatus = async (trade: any) => {
    await updateTradeMutation.mutateAsync({ 
      id: trade.id, 
      data: { active: !trade.active } 
    });
  };

  const departments = [
    "Engineering",
    "Business Studies",
    "Hospitality & Tourism",
    "Information Technology",
    "Agriculture",
    "Construction",
    "Health Sciences",
  ];

  return (
    <DashboardLayout
      title="Course & Trade Management"
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
              <div>
                <p className="text-sm text-muted-foreground">
                  Manage all trades offered by the institution
                </p>
              </div>
              <Button onClick={() => handleOpenDialog()}>
                <Plus className="h-4 w-4 mr-2" />
                Add Trade
              </Button>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>All Trades</CardTitle>
                <CardDescription>
                  {tradesLoading ? "Loading..." : `${trades?.length || 0} trade(s) configured`}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {tradesLoading ? (
                  <div className="text-center py-8">Loading...</div>
                ) : !trades || trades.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No trades configured yet
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Trade Name</TableHead>
                        <TableHead>Code</TableHead>
                        <TableHead>Department</TableHead>
                        <TableHead>Max Levels</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {trades.map((trade: any) => (
                        <TableRow key={trade.id}>
                          <TableCell className="font-medium">{trade.name}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{trade.code}</Badge>
                          </TableCell>
                          <TableCell>{trade.department || "-"}</TableCell>
                          <TableCell>{trade.max_levels || 4}</TableCell>
                          <TableCell>
                            <Badge variant={trade.active ? "default" : "secondary"}>
                              {trade.active ? "Active" : "Inactive"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleOpenDialog(trade)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Switch
                                checked={trade.active}
                                onCheckedChange={() => toggleTradeStatus(trade)}
                              />
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
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
                <CardTitle>Course Settings</CardTitle>
                <CardDescription>
                  General settings for course and trade management
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

      {/* Add/Edit Trade Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingTrade ? "Edit Trade" : "Add New Trade"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Trade Name *</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Electrical Engineering"
              />
            </div>

            <div className="space-y-2">
              <Label>Trade Code *</Label>
              <Input
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                placeholder="e.g., EE"
              />
            </div>

            <div className="space-y-2">
              <Label>Department</Label>
              <Select
                value={formData.department}
                onValueChange={(value) => setFormData({ ...formData, department: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select department" />
                </SelectTrigger>
                <SelectContent>
                  {departments.map((dept) => (
                    <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Maximum Levels</Label>
              <Select
                value={formData.max_levels.toString()}
                onValueChange={(value) => setFormData({ ...formData, max_levels: parseInt(value) })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="2">2 Levels</SelectItem>
                  <SelectItem value="3">3 Levels</SelectItem>
                  <SelectItem value="4">4 Levels</SelectItem>
                  <SelectItem value="5">5 Levels</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Brief description of the trade..."
                rows={3}
              />
            </div>

            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div>
                <Label>Active</Label>
                <p className="text-sm text-muted-foreground">Trade is available for enrollment</p>
              </div>
              <Switch
                checked={formData.active}
                onCheckedChange={(checked) => setFormData({ ...formData, active: checked })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleSubmit}
              disabled={createTradeMutation.isPending || updateTradeMutation.isPending}
            >
              {(createTradeMutation.isPending || updateTradeMutation.isPending) ? "Saving..." : "Save Trade"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default CourseManagement;
