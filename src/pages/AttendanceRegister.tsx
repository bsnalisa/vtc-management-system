import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Printer, Download } from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useRoleNavigation } from "@/hooks/useRoleNavigation";
import { useTrades } from "@/hooks/useTrades";
import { useTrainees } from "@/hooks/useTrainees";

const AttendanceRegister = () => {
  const { navItems, groupLabel } = useRoleNavigation();
  const [selectedTrade, setSelectedTrade] = useState("");
  const [selectedLevel, setSelectedLevel] = useState("");
  const [selectedMode, setSelectedMode] = useState("");
  
  const { data: trades } = useTrades();
  const { data: trainees } = useTrainees();

  // Filter trainees based on selections
  const filteredTrainees = trainees?.filter(t => {
    if (selectedTrade && t.trade_id !== selectedTrade) return false;
    if (selectedLevel && t.level !== parseInt(selectedLevel)) return false;
    if (selectedMode && selectedMode !== "all" && t.training_mode !== selectedMode) return false;
    return true;
  }) || [];

  const generateRegister = () => {
    console.log("Generating register for:", { selectedTrade, selectedLevel, selectedMode });
  };

  return (
    <DashboardLayout
      title="Attendance Register"
      subtitle="Generate and manage attendance registers"
      navItems={navItems}
      groupLabel={groupLabel}
    >
      <div className="space-y-6">
        {/* Filter Section */}
        <Card>
          <CardHeader>
            <CardTitle>Select Class Details</CardTitle>
            <CardDescription>Choose trade, level, and mode to generate register</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="trade">Trade / Program *</Label>
                <Select value={selectedTrade} onValueChange={setSelectedTrade}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select trade" />
                  </SelectTrigger>
                  <SelectContent>
                    {trades?.map((trade) => (
                      <SelectItem key={trade.id} value={trade.id}>
                        {trade.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="level">Level *</Label>
                <Select value={selectedLevel} onValueChange={setSelectedLevel}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select level" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">Level 1</SelectItem>
                    <SelectItem value="2">Level 2</SelectItem>
                    <SelectItem value="3">Level 3</SelectItem>
                    <SelectItem value="4">Level 4</SelectItem>
                    <SelectItem value="5">Level 5</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="mode">Training Mode</Label>
                <Select value={selectedMode} onValueChange={setSelectedMode}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select mode" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Modes</SelectItem>
                    <SelectItem value="fulltime">Full-time</SelectItem>
                    <SelectItem value="bdl">BDL</SelectItem>
                    <SelectItem value="shortcourse">Short Course</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Button onClick={generateRegister} className="w-full md:w-auto">
              Generate Register
            </Button>
          </CardContent>
        </Card>

        {/* Preview Section */}
        {selectedTrade && selectedLevel && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Attendance Register Preview</CardTitle>
                  <CardDescription>
                    {trades?.find(t => t.id === selectedTrade)?.name || "Selected Trade"} - Level {selectedLevel} - Academic Year 2024/2025
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm">
                    <Printer className="mr-2 h-4 w-4" />
                    Print
                  </Button>
                  <Button variant="outline" size="sm">
                    <Download className="mr-2 h-4 w-4" />
                    Export PDF
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid gap-2 text-sm">
                  <div className="flex gap-2">
                    <span className="font-semibold">Total Trainees:</span>
                    <span className="text-muted-foreground">{filteredTrainees.length}</span>
                  </div>
                </div>

                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[100px]">ID</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead className="text-center">Week 1</TableHead>
                      <TableHead className="text-center">Week 2</TableHead>
                      <TableHead className="text-center">Week 3</TableHead>
                      <TableHead className="text-center">Week 4</TableHead>
                      <TableHead>Remarks</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredTrainees.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                          No trainees found for the selected criteria
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredTrainees.map((trainee) => (
                        <TableRow key={trainee.id}>
                          <TableCell className="font-medium">{trainee.trainee_id}</TableCell>
                          <TableCell>{trainee.first_name} {trainee.last_name}</TableCell>
                          <TableCell className="border-l"></TableCell>
                          <TableCell className="border-l"></TableCell>
                          <TableCell className="border-l"></TableCell>
                          <TableCell className="border-l"></TableCell>
                          <TableCell className="border-l"></TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>

                <div className="mt-8 pt-4 border-t space-y-4">
                  <div className="flex gap-8">
                    <div>
                      <p className="text-sm font-semibold mb-2">Trainer Signature:</p>
                      <div className="border-b border-foreground w-48 h-8"></div>
                    </div>
                    <div>
                      <p className="text-sm font-semibold mb-2">Date:</p>
                      <div className="border-b border-foreground w-48 h-8"></div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
};

export default AttendanceRegister;
