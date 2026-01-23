import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Building2 } from "lucide-react";
import { useHostelBuildings } from "@/hooks/useHostel";
import { BuildingDialog } from "./BuildingDialog";

interface BuildingsTableProps {
  limit?: number;
}

export function BuildingsTable({ limit }: BuildingsTableProps) {
  const { data: buildings = [], isLoading } = useHostelBuildings();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedBuilding, setSelectedBuilding] = useState<any>(null);

  const displayBuildings = limit ? buildings.slice(0, limit) : buildings;

  const handleEdit = (building: any) => {
    setSelectedBuilding(building);
    setDialogOpen(true);
  };

  const handleAdd = () => {
    setSelectedBuilding(null);
    setDialogOpen(true);
  };

  if (isLoading) {
    return <div className="text-center py-4">Loading buildings...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={handleAdd} size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Add Building
        </Button>
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Building Name</TableHead>
              <TableHead>Gender</TableHead>
              <TableHead>Capacity</TableHead>
              <TableHead>Occupancy</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {displayBuildings.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  <Building2 className="h-12 w-12 mx-auto mb-2 opacity-20" />
                  <p>No buildings found. Add your first building to get started.</p>
                </TableCell>
              </TableRow>
            ) : (
              displayBuildings.map((building) => {
                const occupancyRate = building.total_capacity > 0 
                  ? ((building.current_occupancy / building.total_capacity) * 100).toFixed(0)
                  : "0";
                
                return (
                  <TableRow key={building.id}>
                    <TableCell className="font-medium">{building.building_name}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">
                        {building.gender_type}
                      </Badge>
                    </TableCell>
                    <TableCell>{building.total_capacity}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span>{building.current_occupancy}</span>
                        <Badge variant={Number(occupancyRate) > 90 ? "destructive" : "secondary"}>
                          {occupancyRate}%
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={building.active ? "default" : "secondary"}>
                        {building.active ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(building)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <BuildingDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        building={selectedBuilding}
      />
    </div>
  );
}
