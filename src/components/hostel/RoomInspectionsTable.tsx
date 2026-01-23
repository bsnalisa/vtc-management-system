import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, ClipboardCheck, Search } from "lucide-react";
import { useRoomInspections, useCreateRoomInspection, CreateInspectionData } from "@/hooks/useRoomInspections";
import { useHostelBuildings, useHostelRooms } from "@/hooks/useHostel";
import { format } from "date-fns";
import { TableSkeleton } from "@/components/ui/table-skeleton";

export const RoomInspectionsTable = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedBuilding, setSelectedBuilding] = useState<string>("");
  
  const { data: inspections = [], isLoading } = useRoomInspections();
  const { data: buildings = [] } = useHostelBuildings();
  const { data: allRooms = [] } = useHostelRooms(selectedBuilding || undefined);
  const createInspection = useCreateRoomInspection();

  const [formData, setFormData] = useState<CreateInspectionData>({
    room_id: "",
    inspection_date: format(new Date(), "yyyy-MM-dd"),
    cleanliness_rating: 5,
    condition_rating: 5,
    safety_rating: 5,
    issues_found: "",
    recommendations: "",
    follow_up_required: false,
  });

  const filteredInspections = inspections.filter(i => 
    i.hostel_rooms?.room_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    i.hostel_rooms?.hostel_buildings?.building_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await createInspection.mutateAsync(formData);
    setDialogOpen(false);
    setFormData({
      room_id: "",
      inspection_date: format(new Date(), "yyyy-MM-dd"),
      cleanliness_rating: 5,
      condition_rating: 5,
      safety_rating: 5,
      issues_found: "",
      recommendations: "",
      follow_up_required: false,
    });
    setSelectedBuilding("");
  };

  const getScoreBadge = (score: number) => {
    if (score >= 8) return <Badge className="bg-green-500">Excellent</Badge>;
    if (score >= 6) return <Badge className="bg-yellow-500">Good</Badge>;
    if (score >= 4) return <Badge className="bg-orange-500">Fair</Badge>;
    return <Badge variant="destructive">Poor</Badge>;
  };

  if (isLoading) return <TableSkeleton columns={8} rows={5} />;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-4 justify-between">
        <div className="relative flex-1 sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search inspections..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              New Inspection
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Record Room Inspection</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Building *</Label>
                  <Select
                    value={selectedBuilding}
                    onValueChange={(v) => {
                      setSelectedBuilding(v);
                      setFormData({ ...formData, room_id: "" });
                    }}
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
                  <Label>Room *</Label>
                  <Select
                    value={formData.room_id}
                    onValueChange={(v) => setFormData({ ...formData, room_id: v })}
                    disabled={!selectedBuilding}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select room" />
                    </SelectTrigger>
                    <SelectContent>
                      {allRooms.map((r) => (
                        <SelectItem key={r.id} value={r.id}>{r.room_number}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label>Inspection Date</Label>
                <Input
                  type="date"
                  value={formData.inspection_date}
                  onChange={(e) => setFormData({ ...formData, inspection_date: e.target.value })}
                />
              </div>
              
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Cleanliness (1-10)</Label>
                  <Input
                    type="number"
                    min={1}
                    max={10}
                    value={formData.cleanliness_rating}
                    onChange={(e) => setFormData({ ...formData, cleanliness_rating: parseInt(e.target.value) || 1 })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Condition (1-10)</Label>
                  <Input
                    type="number"
                    min={1}
                    max={10}
                    value={formData.condition_rating}
                    onChange={(e) => setFormData({ ...formData, condition_rating: parseInt(e.target.value) || 1 })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Safety (1-10)</Label>
                  <Input
                    type="number"
                    min={1}
                    max={10}
                    value={formData.safety_rating}
                    onChange={(e) => setFormData({ ...formData, safety_rating: parseInt(e.target.value) || 1 })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Issues Found</Label>
                <Textarea
                  value={formData.issues_found || ""}
                  onChange={(e) => setFormData({ ...formData, issues_found: e.target.value })}
                  placeholder="Issues found during inspection..."
                  rows={2}
                />
              </div>

              <div className="space-y-2">
                <Label>Recommendations</Label>
                <Textarea
                  value={formData.recommendations || ""}
                  onChange={(e) => setFormData({ ...formData, recommendations: e.target.value })}
                  placeholder="Recommendations..."
                  rows={2}
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="followup"
                  checked={formData.follow_up_required}
                  onChange={(e) => setFormData({ ...formData, follow_up_required: e.target.checked })}
                />
                <Label htmlFor="followup">Follow-up required</Label>
              </div>

              <div className="flex gap-2 justify-end">
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createInspection.isPending}>
                  {createInspection.isPending ? "Saving..." : "Save Inspection"}
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
              <TableHead>Building</TableHead>
              <TableHead>Room</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Cleanliness</TableHead>
              <TableHead>Condition</TableHead>
              <TableHead>Safety</TableHead>
              <TableHead>Overall</TableHead>
              <TableHead>Follow Up</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredInspections.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                  <ClipboardCheck className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  No inspections recorded
                </TableCell>
              </TableRow>
            ) : (
              filteredInspections.map((inspection) => (
                <TableRow key={inspection.id}>
                  <TableCell>{inspection.hostel_rooms?.hostel_buildings?.building_name || "-"}</TableCell>
                  <TableCell className="font-medium">{inspection.hostel_rooms?.room_number || "-"}</TableCell>
                  <TableCell>{format(new Date(inspection.inspection_date), "dd MMM yyyy")}</TableCell>
                  <TableCell>{inspection.cleanliness_rating}/10</TableCell>
                  <TableCell>{inspection.condition_rating}/10</TableCell>
                  <TableCell>{inspection.safety_rating}/10</TableCell>
                  <TableCell>{getScoreBadge(inspection.overall_rating)}</TableCell>
                  <TableCell>
                    {inspection.follow_up_required ? (
                      <Badge variant="destructive">Yes</Badge>
                    ) : (
                      <Badge variant="secondary">No</Badge>
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
