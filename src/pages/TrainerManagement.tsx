import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { UserPlus, Search, Pencil, Trash2, Loader2, Download } from "lucide-react";
import { useTrainers, useRegisterTrainer, useUpdateTrainer, useDeleteTrainer } from "@/hooks/useTrainers";
import { useTrades } from "@/hooks/useTrades";
import { DashboardLayout } from "@/components/DashboardLayout";
import { adminNavItems, registrationOfficerNavItems, headOfTrainingNavItems, hodNavItems } from "@/lib/navigationConfig";
import { useUserRole } from "@/hooks/useUserRole";
import { usePagination } from "@/hooks/usePagination";
import { DataTablePagination } from "@/components/ui/data-table-pagination";
import { exportToCSV } from "@/lib/exportUtils";

const TrainerManagement = () => {
  const { role } = useUserRole();
  const [open, setOpen] = useState(false);
  const [editingTrainer, setEditingTrainer] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [formData, setFormData] = useState({
    fullName: "",
    gender: "",
    phone: "",
    email: "",
    designation: "",
    employmentType: "",
    selectedTrades: [] as string[],
  });

  const { data: trainersData, isLoading, error } = useTrainers();
  const { data: trades } = useTrades();
  const registerTrainer = useRegisterTrainer();
  const updateTrainer = useUpdateTrainer();
  const deleteTrainer = useDeleteTrainer();
  
  const getNavItems = () => {
    switch (role) {
      case "registration_officer":
        return registrationOfficerNavItems;
      case "head_of_training":
        return headOfTrainingNavItems;
      case "hod":
        return hodNavItems;
      default:
        return adminNavItems;
    }
  };

  const navItems = getNavItems();

  const filteredTrainers = useMemo(() => {
    if (!trainersData) return [];
    
    return trainersData.filter((trainer) => {
      const matchesSearch = 
        trainer.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        trainer.trainer_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        trainer.email?.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesStatus = filterStatus === "all" || 
        (filterStatus === "active" && trainer.active) ||
        (filterStatus === "inactive" && !trainer.active);
      
      return matchesSearch && matchesStatus;
    });
  }, [trainersData, searchTerm, filterStatus]);

  const {
    paginatedData,
    currentPage,
    totalPages,
    pageSize,
    totalItems,
    setCurrentPage,
    setPageSize,
  } = usePagination({ data: filteredTrainers, defaultPageSize: 20 });

  const handleOpenDialog = (trainerToEdit?: any) => {
    if (trainerToEdit) {
      setEditingTrainer(trainerToEdit);
      const trainerTradeIds = trainerToEdit.trainer_trades?.map((tt: any) => tt.trade_id) || [];
      setFormData({
        fullName: trainerToEdit.full_name,
        gender: trainerToEdit.gender,
        phone: trainerToEdit.phone || "",
        email: trainerToEdit.email || "",
        designation: trainerToEdit.designation,
        employmentType: trainerToEdit.employment_type,
        selectedTrades: trainerTradeIds,
      });
    } else {
      setEditingTrainer(null);
      setFormData({
        fullName: "",
        gender: "",
        phone: "",
        email: "",
        designation: "",
        employmentType: "",
        selectedTrades: [],
      });
    }
    setOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (editingTrainer) {
      await updateTrainer.mutateAsync({
        id: editingTrainer.id,
        full_name: formData.fullName,
        gender: formData.gender,
        phone: formData.phone || undefined,
        email: formData.email || undefined,
        designation: formData.designation,
        employment_type: formData.employmentType,
        trade_ids: formData.selectedTrades,
      });
    } else {
      await registerTrainer.mutateAsync({
        full_name: formData.fullName,
        gender: formData.gender,
        phone: formData.phone || undefined,
        email: formData.email || undefined,
        designation: formData.designation,
        employment_type: formData.employmentType,
        trade_ids: formData.selectedTrades,
      });
    }

    setOpen(false);
    setEditingTrainer(null);
    setFormData({
      fullName: "",
      gender: "",
      phone: "",
      email: "",
      designation: "",
      employmentType: "",
      selectedTrades: [],
    });
  };

  const handleDelete = async (id: string) => {
    await deleteTrainer.mutateAsync(id);
  };

  const handleExport = () => {
    if (!filteredTrainers.length) return;
    
    const exportData = filteredTrainers.map(trainer => ({
      "Trainer ID": trainer.trainer_id,
      "Full Name": trainer.full_name,
      "Gender": trainer.gender,
      "Email": trainer.email || "",
      "Phone": trainer.phone || "",
      "Designation": trainer.designation || "",
      "Employment Type": trainer.employment_type,
      "Status": trainer.active ? "Active" : "Inactive",
      "Trades": trainer.trainer_trades?.map((tt: any) => tt.trades?.name).filter(Boolean).join(", ") || "",
    }));
    
    exportToCSV(exportData, `trainers-export-${new Date().toISOString().split('T')[0]}`);
  };

  if (error) {
    return (
      <DashboardLayout
        title="Trainer Management"
        subtitle="Manage trainers and their assigned trades"
        navItems={navItems}
        groupLabel={role === "registration_officer" ? "Registration" : "Administration"}
      >
        <Card>
          <CardContent className="py-8">
            <div className="text-center text-destructive">
              <p>Error loading trainers: {error.message}</p>
              <Button variant="outline" className="mt-4" onClick={() => window.location.reload()}>
                Try Again
              </Button>
            </div>
          </CardContent>
        </Card>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      title="Trainer Management"
      subtitle="Manage trainers and their assigned trades"
      navItems={navItems}
      groupLabel={role === "registration_officer" ? "Registration" : "Administration"}
    >
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="relative w-64">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search trainers..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[130px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={handleExport} disabled={!filteredTrainers.length}>
              <Download className="mr-2 h-4 w-4" />
              Export
            </Button>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button onClick={() => handleOpenDialog()}>
                  <UserPlus className="mr-2 h-4 w-4" />
                  Add Trainer
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>{editingTrainer ? "Edit Trainer" : "Register New Trainer"}</DialogTitle>
                  <DialogDescription>
                    {editingTrainer ? "Update trainer details and trades" : "Enter trainer details and assign to trades"}
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="trainer-name">Full Name *</Label>
                      <Input 
                        id="trainer-name"
                        value={formData.fullName}
                        onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                        required 
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="trainer-gender">Gender *</Label>
                      <Select 
                        value={formData.gender}
                        onValueChange={(value) => setFormData({ ...formData, gender: value })}
                        required
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select gender" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="male">Male</SelectItem>
                          <SelectItem value="female">Female</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="trainer-phone">Phone</Label>
                      <Input 
                        id="trainer-phone" 
                        type="tel"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="trainer-email">Email</Label>
                      <Input 
                        id="trainer-email" 
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="designation">Designation *</Label>
                      <Input 
                        id="designation" 
                        placeholder="e.g. Senior Trainer, HOD"
                        value={formData.designation}
                        onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
                        required 
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="employment-type">Employment Type *</Label>
                      <Select 
                        value={formData.employmentType}
                        onValueChange={(value) => setFormData({ ...formData, employmentType: value })}
                        required
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="fulltime">Full-time</SelectItem>
                          <SelectItem value="parttime">Part-time</SelectItem>
                          <SelectItem value="contract">Contract</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="trades">Assigned Trade *</Label>
                    <Select 
                      value={formData.selectedTrades[0] || ""}
                      onValueChange={(value) => setFormData({ ...formData, selectedTrades: [value] })}
                      required
                    >
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
                  <div className="flex gap-2 justify-end">
                    <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                      Cancel
                    </Button>
                    <Button type="submit" disabled={registerTrainer.isPending || updateTrainer.isPending}>
                      {editingTrainer 
                        ? (updateTrainer.isPending ? "Updating..." : "Update Trainer")
                        : (registerTrainer.isPending ? "Registering..." : "Register Trainer")
                      }
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>All Trainers</CardTitle>
            <CardDescription>
              {searchTerm || filterStatus !== "all"
                ? `Showing ${totalItems} filtered results`
                : `Total: ${totalItems} trainers`
              }
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
                <p className="text-sm text-muted-foreground">Loading trainers...</p>
              </div>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Trainer ID</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Gender</TableHead>
                      <TableHead>Trade(s)</TableHead>
                      <TableHead>Designation</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedData.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-12">
                          <div className="text-muted-foreground">
                            {searchTerm || filterStatus !== "all"
                              ? "No trainers match your search criteria"
                              : "No trainers registered yet"
                            }
                          </div>
                          {!searchTerm && filterStatus === "all" && (
                            <Button 
                              variant="outline" 
                              className="mt-4"
                              onClick={() => handleOpenDialog()}
                            >
                              <UserPlus className="mr-2 h-4 w-4" />
                              Add First Trainer
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ) : (
                      paginatedData.map((trainer) => {
                        const tradeNames = trainer.trainer_trades
                          ?.map((tt: any) => tt.trades?.name)
                          .filter(Boolean)
                          .join(", ") || "N/A";
                        
                        return (
                          <TableRow key={trainer.id}>
                            <TableCell className="font-medium">{trainer.trainer_id}</TableCell>
                            <TableCell>{trainer.full_name}</TableCell>
                            <TableCell className="capitalize">{trainer.gender}</TableCell>
                            <TableCell>{tradeNames}</TableCell>
                            <TableCell>{trainer.designation || "N/A"}</TableCell>
                            <TableCell className="capitalize">{trainer.employment_type.replace("_", " ")}</TableCell>
                            <TableCell>
                              <Badge variant={trainer.active ? "default" : "secondary"}>
                                {trainer.active ? "Active" : "Inactive"}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-2">
                                <Button 
                                  variant="ghost" 
                                  size="sm"
                                  onClick={() => handleOpenDialog(trainer)}
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button variant="ghost" size="sm">
                                      <Trash2 className="h-4 w-4 text-destructive" />
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Delete Trainer</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        Are you sure you want to delete "{trainer.full_name}"? This action cannot be undone.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                                      <AlertDialogAction 
                                        onClick={() => handleDelete(trainer.id)}
                                        className="bg-destructive hover:bg-destructive/90"
                                      >
                                        Delete
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
                {totalItems > 0 && (
                  <DataTablePagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    pageSize={pageSize}
                    totalItems={totalItems}
                    onPageChange={setCurrentPage}
                    onPageSizeChange={setPageSize}
                  />
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default TrainerManagement;
