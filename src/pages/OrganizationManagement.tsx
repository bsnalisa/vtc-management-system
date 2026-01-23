import { useState } from "react";
import { SuperAdminLayout } from "@/components/SuperAdminLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { 
  Plus, 
  Building2, 
  Search,
  Filter,
  MoreHorizontal,
  Eye,
  Edit,
  Trash2,
  Users,
  Calendar,
  TrendingUp
} from "lucide-react";
import { useOrganizations, useCreateOrganization, useUpdateOrganization } from "@/hooks/useOrganizations";

const OrganizationManagement = () => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [packageFilter, setPackageFilter] = useState("all");

  const [formData, setFormData] = useState({
    name: "",
    package: "basic" as "basic" | "extended" | "professional",
  });

  const { data: organizations, isLoading } = useOrganizations();
  const createOrganization = useCreateOrganization();
  const updateOrganization = useUpdateOrganization();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await createOrganization.mutateAsync(formData);
    setIsDialogOpen(false);
    setFormData({ name: "", package: "basic" });
  };

  const toggleActive = async (id: string, currentActive: boolean) => {
    await updateOrganization.mutateAsync({
      id,
      updates: { active: !currentActive },
    });
  };

  const getPackageBadgeVariant = (pkg: string) => {
    switch (pkg) {
      case "professional":
        return "default";
      case "extended":
        return "secondary";
      default:
        return "outline";
    }
  };

  const getPackageColor = (pkg: string) => {
    switch (pkg) {
      case "professional":
        return "bg-purple-100 text-purple-800 border-purple-200";
      case "extended":
        return "bg-blue-100 text-blue-800 border-blue-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  // Filter organizations based on search and filters
  const filteredOrganizations = organizations?.filter(org => {
    const matchesSearch = org.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || 
      (statusFilter === "active" && org.active) || 
      (statusFilter === "inactive" && !org.active);
    const matchesPackage = packageFilter === "all" || org.package === packageFilter;
    
    return matchesSearch && matchesStatus && matchesPackage;
  });

  const stats = {
    total: organizations?.length || 0,
    active: organizations?.filter(org => org.active).length || 0,
    professional: organizations?.filter(org => org.package === 'professional').length || 0,
  };

  return (
    <SuperAdminLayout>
      <div className="space-y-6">
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Organization Management</h1>
            <p className="text-muted-foreground mt-2">
              Create and manage VTC organizations across the platform
            </p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-blue-600 hover:bg-blue-700">
                <Plus className="h-4 w-4 mr-2" />
                Create Organization
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <form onSubmit={handleSubmit}>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <Building2 className="h-5 w-5" />
                    Create New Organization
                  </DialogTitle>
                  <DialogDescription>
                    Add a new VTC organization to the platform with appropriate package access.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="name" className="font-medium">Organization Name</Label>
                    <Input
                      id="name"
                      placeholder="e.g., Nairobi VTC Center"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="package" className="font-medium">Package Type</Label>
                    <Select
                      value={formData.package}
                      onValueChange={(value: "basic" | "extended" | "professional") =>
                        setFormData({ ...formData, package: value })
                      }
                    >
                      <SelectTrigger className="focus:ring-2 focus:ring-blue-500">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="basic" className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-gray-400"></div>
                          Basic - Trainee Registration Only
                        </SelectItem>
                        <SelectItem value="extended" className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-blue-400"></div>
                          Extended - Full Management Suite
                        </SelectItem>
                        <SelectItem value="professional" className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-purple-400"></div>
                          Professional - All Features + Future Modules
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button 
                    type="submit" 
                    disabled={createOrganization.isPending}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    {createOrganization.isPending ? (
                      <>
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent mr-2" />
                        Creating...
                      </>
                    ) : (
                      "Create Organization"
                    )}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-blue-600">Total Organizations</p>
                  <p className="text-3xl font-bold text-blue-900">{stats.total}</p>
                </div>
                <Building2 className="h-8 w-8 text-blue-400" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-green-600">Active Organizations</p>
                  <p className="text-3xl font-bold text-green-900">{stats.active}</p>
                </div>
                <TrendingUp className="h-8 w-8 text-green-400" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-purple-600">Professional Tier</p>
                  <p className="text-3xl font-bold text-purple-900">{stats.professional}</p>
                </div>
                <Users className="h-8 w-8 text-purple-400" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters and Search */}
        <Card>
          <CardContent className="p-6">
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search organizations..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-full sm:w-32 focus:ring-2 focus:ring-blue-500">
                    <Filter className="h-4 w-4 mr-2" />
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={packageFilter} onValueChange={setPackageFilter}>
                  <SelectTrigger className="w-full sm:w-40 focus:ring-2 focus:ring-blue-500">
                    <SelectValue placeholder="Package" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Packages</SelectItem>
                    <SelectItem value="basic">Basic</SelectItem>
                    <SelectItem value="extended">Extended</SelectItem>
                    <SelectItem value="professional">Professional</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Organizations Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Organizations List
            </CardTitle>
            <CardDescription>
              {filteredOrganizations?.length || 0} organizations found
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-12">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent mx-auto mb-4"></div>
                <p className="text-muted-foreground">Loading organizations...</p>
              </div>
            ) : filteredOrganizations?.length === 0 ? (
              <div className="text-center py-12">
                <Building2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No organizations found</p>
                {searchTerm || statusFilter !== "all" || packageFilter !== "all" ? (
                  <p className="text-sm text-muted-foreground mt-2">
                    Try adjusting your search or filters
                  </p>
                ) : null}
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader className="bg-muted/50">
                    <TableRow>
                      <TableHead className="font-semibold">Organization</TableHead>
                      <TableHead className="font-semibold">Package</TableHead>
                      <TableHead className="font-semibold">Status</TableHead>
                      <TableHead className="font-semibold">Created Date</TableHead>
                      <TableHead className="font-semibold text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredOrganizations?.map((org) => (
                      <TableRow key={org.id} className="hover:bg-muted/30 transition-colors">
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-lg bg-blue-100 flex items-center justify-center">
                              <Building2 className="h-5 w-5 text-blue-600" />
                            </div>
                            <div>
                              <p className="font-medium text-foreground">{org.name}</p>
                              <p className="text-sm text-muted-foreground">ID: {org.id.slice(0, 8)}...</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge 
                            variant="outline" 
                            className={`font-medium ${getPackageColor(org.package)}`}
                          >
                            {org.package.charAt(0).toUpperCase() + org.package.slice(1)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge 
                            variant={org.active ? "default" : "secondary"}
                            className={org.active ? "bg-green-100 text-green-800 hover:bg-green-100 border-green-200" : ""}
                          >
                            {org.active ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Calendar className="h-4 w-4" />
                            {new Date(org.created_at).toLocaleDateString()}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => toggleActive(org.id, org.active)}
                              className={org.active ? "text-orange-600 hover:text-orange-700" : "text-green-600 hover:text-green-700"}
                            >
                              {org.active ? "Deactivate" : "Activate"}
                            </Button>
                            <Button variant="ghost" size="sm">
                              <Eye className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </SuperAdminLayout>
  );
};

export default OrganizationManagement;