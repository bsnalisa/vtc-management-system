import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, LogOut, Search } from "lucide-react";
import { useHostelVisitors, useCheckInVisitor, useCheckOutVisitor, CreateVisitorData } from "@/hooks/useHostelVisitors";
import { useHostelBuildings } from "@/hooks/useHostel";
import { useTrainees } from "@/hooks/useTrainees";
import { format } from "date-fns";
import { TableSkeleton } from "@/components/ui/table-skeleton";

export const VisitorManagementTable = () => {
  const today = format(new Date(), "yyyy-MM-dd");
  const [selectedDate, setSelectedDate] = useState(today);
  const [searchTerm, setSearchTerm] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  
  const { data: visitors = [], isLoading } = useHostelVisitors(selectedDate);
  const { data: buildings = [] } = useHostelBuildings();
  const { data: trainees = [] } = useTrainees();
  const checkIn = useCheckInVisitor();
  const checkOut = useCheckOutVisitor();

  const [formData, setFormData] = useState<CreateVisitorData>({
    building_id: "",
    trainee_id: "",
    visitor_name: "",
    visitor_id_number: "",
    visitor_phone: "",
    relationship: "",
    visit_date: today,
    check_in_time: format(new Date(), "HH:mm"),
    purpose: "",
    notes: "",
  });

  const filteredVisitors = visitors.filter(v => 
    v.visitor_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    v.trainees?.first_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    v.trainees?.last_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleCheckIn = async (e: React.FormEvent) => {
    e.preventDefault();
    await checkIn.mutateAsync(formData);
    setDialogOpen(false);
    setFormData({
      building_id: "",
      trainee_id: "",
      visitor_name: "",
      visitor_id_number: "",
      visitor_phone: "",
      relationship: "",
      visit_date: today,
      check_in_time: format(new Date(), "HH:mm"),
      purpose: "",
      notes: "",
    });
  };

  const handleCheckOut = async (visitorId: string) => {
    await checkOut.mutateAsync(visitorId);
  };

  if (isLoading) return <TableSkeleton columns={8} rows={5} />;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-4 justify-between">
        <div className="flex gap-2 items-center">
          <Input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="w-40"
          />
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search visitors..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>
        
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Check In Visitor
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Check In Visitor</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCheckIn} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Building *</Label>
                  <Select
                    value={formData.building_id}
                    onValueChange={(v) => setFormData({ ...formData, building_id: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select building" />
                    </SelectTrigger>
                    <SelectContent>
                      {buildings.map((b) => (
                        <SelectItem key={b.id} value={b.id}>{b.building_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Visiting Trainee *</Label>
                  <Select
                    value={formData.trainee_id}
                    onValueChange={(v) => setFormData({ ...formData, trainee_id: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select trainee" />
                    </SelectTrigger>
                    <SelectContent>
                      {trainees.slice(0, 100).map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.first_name} {t.last_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label>Visitor Name *</Label>
                <Input
                  value={formData.visitor_name}
                  onChange={(e) => setFormData({ ...formData, visitor_name: e.target.value })}
                  required
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>ID Number</Label>
                  <Input
                    value={formData.visitor_id_number || ""}
                    onChange={(e) => setFormData({ ...formData, visitor_id_number: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Phone</Label>
                  <Input
                    value={formData.visitor_phone || ""}
                    onChange={(e) => setFormData({ ...formData, visitor_phone: e.target.value })}
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Relationship</Label>
                  <Select
                    value={formData.relationship || ""}
                    onValueChange={(v) => setFormData({ ...formData, relationship: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="parent">Parent</SelectItem>
                      <SelectItem value="guardian">Guardian</SelectItem>
                      <SelectItem value="sibling">Sibling</SelectItem>
                      <SelectItem value="friend">Friend</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Purpose</Label>
                  <Input
                    value={formData.purpose || ""}
                    onChange={(e) => setFormData({ ...formData, purpose: e.target.value })}
                    placeholder="Visit purpose"
                  />
                </div>
              </div>

              <div className="flex gap-2 justify-end">
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={checkIn.isPending}>
                  {checkIn.isPending ? "Checking in..." : "Check In"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Visitor</TableHead>
              <TableHead>ID Number</TableHead>
              <TableHead>Visiting</TableHead>
              <TableHead>Building</TableHead>
              <TableHead>Check In</TableHead>
              <TableHead>Check Out</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredVisitors.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                  No visitors for selected date
                </TableCell>
              </TableRow>
            ) : (
              filteredVisitors.map((visitor) => (
                <TableRow key={visitor.id}>
                  <TableCell className="font-medium">{visitor.visitor_name}</TableCell>
                  <TableCell>{visitor.visitor_id_number || "-"}</TableCell>
                  <TableCell>
                    {visitor.trainees ? `${visitor.trainees.first_name} ${visitor.trainees.last_name}` : "-"}
                  </TableCell>
                  <TableCell>{visitor.hostel_buildings?.building_name || "-"}</TableCell>
                  <TableCell>{visitor.check_in_time}</TableCell>
                  <TableCell>{visitor.check_out_time || "-"}</TableCell>
                  <TableCell>
                    <Badge variant={visitor.status === "checked_out" ? "secondary" : "default"}>
                      {visitor.status === "checked_out" ? "Checked Out" : "Active"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {visitor.status !== "checked_out" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleCheckOut(visitor.id)}
                        disabled={checkOut.isPending}
                      >
                        <LogOut className="h-4 w-4 mr-1" />
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
    </div>
  );
};
