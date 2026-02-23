import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Building2, Plus, Pencil, Trash2 } from "lucide-react";
import { useTrainingBuildings, useCreateBuilding, useUpdateBuilding, useDeleteBuilding } from "@/hooks/useTrainingBuildings";
import { useTrades } from "@/hooks/useTrades";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";

interface BuildingForm {
  name: string;
  code: string;
  description: string;
  location: string;
  trade_ids: string[];
}

const EMPTY_FORM: BuildingForm = { name: "", code: "", description: "", location: "", trade_ids: [] };

const BuildingsTab = () => {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState<BuildingForm>({ ...EMPTY_FORM });

  const { data: buildings, isLoading } = useTrainingBuildings();
  const { data: trades } = useTrades();
  const createBuilding = useCreateBuilding();
  const updateBuilding = useUpdateBuilding();
  const deleteBuilding = useDeleteBuilding();

  const handleOpen = (building?: any) => {
    if (building) {
      setEditing(building);
      setForm({
        name: building.name,
        code: building.code,
        description: building.description || "",
        location: building.location || "",
        trade_ids: building.building_trades?.map((bt: any) => bt.trade_id) || [],
      });
    } else {
      setEditing(null);
      setForm({ ...EMPTY_FORM });
    }
    setOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editing) {
      await updateBuilding.mutateAsync({ id: editing.id, ...form });
    } else {
      await createBuilding.mutateAsync(form);
    }
    setOpen(false);
    setEditing(null);
    setForm({ ...EMPTY_FORM });
  };

  const toggleTrade = (tradeId: string) => {
    setForm(prev => ({
      ...prev,
      trade_ids: prev.trade_ids.includes(tradeId)
        ? prev.trade_ids.filter(id => id !== tradeId)
        : [...prev.trade_ids, tradeId],
    }));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => handleOpen()}>
              <Plus className="h-4 w-4 mr-2" /> Add Building
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{editing ? "Edit Building" : "Add Building / Workshop"}</DialogTitle>
              <DialogDescription>{editing ? "Update building details" : "Define a new building or workshop and assign trades to it"}</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Building Name</Label>
                  <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g., Block A" required />
                </div>
                <div className="space-y-2">
                  <Label>Code</Label>
                  <Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="e.g., BLK-A" required />
                </div>
                <div className="space-y-2">
                  <Label>Location</Label>
                  <Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="e.g., Main Campus, East Wing" />
                </div>
                <div className="space-y-2 col-span-2">
                  <Label>Description</Label>
                  <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Optional description" rows={2} />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Assigned Trades</Label>
                <p className="text-sm text-muted-foreground">Select which trades occupy this building</p>
                <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto border rounded-md p-3">
                  {trades?.map((trade) => (
                    <div key={trade.id} className="flex items-center gap-2">
                      <Checkbox
                        id={`trade-${trade.id}`}
                        checked={form.trade_ids.includes(trade.id)}
                        onCheckedChange={() => toggleTrade(trade.id)}
                      />
                      <label htmlFor={`trade-${trade.id}`} className="text-sm cursor-pointer">{trade.name}</label>
                    </div>
                  ))}
                  {!trades?.length && <p className="text-sm text-muted-foreground col-span-2">No trades available</p>}
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={createBuilding.isPending || updateBuilding.isPending}>
                  {editing ? "Update Building" : "Add Building"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Building2 className="h-5 w-5" /> Buildings & Workshops</CardTitle>
          <CardDescription>Manage physical buildings and assign trades to them</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">Loading buildings...</div>
          ) : !buildings?.length ? (
            <div className="text-center py-8 text-muted-foreground">No buildings defined yet. Add one to get started.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Assigned Trades</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {buildings.map((b) => (
                  <TableRow key={b.id}>
                    <TableCell className="font-medium">{b.code}</TableCell>
                    <TableCell>{b.name}</TableCell>
                    <TableCell>{b.location || "—"}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {b.building_trades?.length ? b.building_trades.map((bt: any) => (
                          <Badge key={bt.id} variant="secondary">{bt.trades?.name}</Badge>
                        )) : <span className="text-muted-foreground text-sm">None</span>}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="sm" onClick={() => handleOpen(b)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="sm"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Building</AlertDialogTitle>
                              <AlertDialogDescription>This will also delete all rooms inside "{b.name}". Continue?</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => deleteBuilding.mutateAsync(b.id)}>Delete</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default BuildingsTab;
