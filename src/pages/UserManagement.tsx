import { useState, useMemo } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useRoleNavigation } from "@/hooks/useRoleNavigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Shield, Plus, Search, MoreHorizontal, Pencil, UserX, Trash2, Download, Loader2 } from "lucide-react";
import { useUsers, useCreateUser, useDeleteUser, useUpdateUser, useDeactivateUser, UserRoleData } from "@/hooks/useUsers";
import { useOrganizations } from "@/hooks/useOrganizations";
import { useOrganizationContext } from "@/hooks/useOrganizationContext";
import { useUserRole } from "@/hooks/useUserRole";
import { useCustomRoles } from "@/hooks/useRoleManagement";
import { UserEditDialog } from "@/components/users/UserEditDialog";
import { UserDeleteDialog } from "@/components/users/UserDeleteDialog";
import { usePagination } from "@/hooks/usePagination";
import { DataTablePagination } from "@/components/ui/data-table-pagination";
import { exportToCSV } from "@/lib/exportUtils";

type UserWithRoles = {
  id: string;
  user_id: string;
  firstname: string | null;
  surname: string | null;
  email: string | null;
  phone: string | null;
  user_roles: Array<{
    id: string;
    role: string;
    organization_id: string | null;
    organizations?: { name: string } | null;
  }>;
};

const UserManagement = () => {
  const [open, setOpen] = useState(false);
  const { organizationId } = useOrganizationContext();
  const { role: userRole, navItems, groupLabel } = useRoleNavigation();
  const [roleSearchQuery, setRoleSearchQuery] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserWithRoles | null>(null);
  const [deleteMode, setDeleteMode] = useState<"delete" | "deactivate">("deactivate");
  
  const [formData, setFormData] = useState<UserRoleData>({
    email: "",
    password: "",
    firstname: "",
    surname: "",
    role: "trainer",
    phone: "",
  });

  // Organization admins only see users in their organization
  const isOrgAdmin = userRole === "organization_admin";
  const isSuperAdmin = userRole === "super_admin";
  const { data: users, isLoading } = useUsers(isOrgAdmin ? organizationId : undefined);
  const { data: roles = [], isLoading: rolesLoading, error: rolesError } = useCustomRoles(organizationId);
  const { data: organizations } = useOrganizations();
  const createUser = useCreateUser();
  const deleteUser = useDeleteUser();
  const updateUser = useUpdateUser();
  const deactivateUser = useDeactivateUser();

  // Get organization name for display
  const userOrganizationName = organizations?.find(org => org.id === organizationId)?.name;

  const activeRoles = roles.filter((r) => r.active);

  const filteredRoles = useMemo(() => {
    const validRoles = activeRoles.filter((role) => role.role_code && role.role_code.trim() !== '');
    
    if (!roleSearchQuery) return validRoles;
    
    const query = roleSearchQuery.toLowerCase();
    return validRoles.filter(
      (role) =>
        role.role_name.toLowerCase().includes(query) ||
        role.role_code.toLowerCase().includes(query) ||
        role.description?.toLowerCase().includes(query)
    );
  }, [activeRoles, roleSearchQuery]);

  const filteredUsers = useMemo(() => {
    if (!users || !searchQuery) return users;
    
    const query = searchQuery.toLowerCase();
    return users.filter(user => 
      user.firstname?.toLowerCase().includes(query) ||
      user.surname?.toLowerCase().includes(query) ||
      user.email?.toLowerCase().includes(query) ||
      user.phone?.toLowerCase().includes(query)
    );
  }, [users, searchQuery]);

  const {
    paginatedData,
    currentPage,
    totalPages,
    pageSize,
    totalItems,
    setCurrentPage,
    setPageSize,
  } = usePagination({ data: filteredUsers, defaultPageSize: 20 });

  const handleExport = () => {
    if (!filteredUsers?.length) return;
    
    const exportData = filteredUsers.map(user => ({
      "First Name": user.firstname || "",
      "Last Name": user.surname || "",
      "Email": user.email || "",
      "Phone": user.phone || "",
      "Organization": user.user_roles?.[0]?.organizations?.name || "",
      "Roles": user.user_roles?.map(ur => ur.role.replace(/_/g, " ")).join(", ") || "",
    }));
    
    exportToCSV(exportData, `users-export-${new Date().toISOString().split('T')[0]}`);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Organization admins automatically assign users to their organization
    const submitData = isOrgAdmin && organizationId 
      ? { ...formData, organization_id: organizationId }
      : formData;
    await createUser.mutateAsync(submitData);
    setOpen(false);
    setFormData({
      email: "",
      password: "",
      firstname: "",
      surname: "",
      role: "trainer",
      phone: "",
    });
  };

  const handleEdit = (user: UserWithRoles) => {
    setSelectedUser(user);
    setEditDialogOpen(true);
  };

  const handleDeactivate = (user: UserWithRoles) => {
    setSelectedUser(user);
    setDeleteMode("deactivate");
    setDeleteDialogOpen(true);
  };

  const handleDelete = (user: UserWithRoles) => {
    setSelectedUser(user);
    setDeleteMode("delete");
    setDeleteDialogOpen(true);
  };

  const handleSaveEdit = async (data: {
    userId: string;
    firstname: string;
    surname: string;
    phone: string;
    role: string;
  }) => {
    await updateUser.mutateAsync(data);
    setEditDialogOpen(false);
    setSelectedUser(null);
  };

  const handleConfirmDelete = async () => {
    if (!selectedUser) return;

    if (deleteMode === "delete") {
      await deleteUser.mutateAsync(selectedUser.user_id);
    } else {
      await deactivateUser.mutateAsync({ userId: selectedUser.user_id, active: false });
    }
    
    setDeleteDialogOpen(false);
    setSelectedUser(null);
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case "super_admin": return "destructive";
      case "admin": return "default";
      case "organization_admin": return "default";
      case "trainer": return "secondary";
      case "registration_officer": return "outline";
      case "debtor_officer": return "outline";
      case "hod": return "secondary";
      case "assessment_coordinator": return "outline";
      default: return "secondary";
    }
  };

  return (
    <DashboardLayout
      title="User Management"
      subtitle="Manage system users and assign roles"
      navItems={navItems}
      groupLabel="Navigation"
    >
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search users..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={handleExport} disabled={!filteredUsers?.length}>
              <Download className="mr-2 h-4 w-4" />
              Export
            </Button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Create User
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New User</DialogTitle>
                <DialogDescription>Add a new user account with role assignment</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="firstname">First Name *</Label>
                    <Input
                      id="firstname"
                      value={formData.firstname}
                      onChange={(e) => setFormData({ ...formData, firstname: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="surname">Last Name *</Label>
                    <Input
                      id="surname"
                      value={formData.surname}
                      onChange={(e) => setFormData({ ...formData, surname: e.target.value })}
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password *</Label>
                  <Input
                    id="password"
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    required
                    minLength={6}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone *</Label>
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    required
                  />
                </div>
                {isOrgAdmin && userOrganizationName && (
                  <div className="space-y-2">
                    <Label>Organization</Label>
                    <Input 
                      value={userOrganizationName} 
                      disabled 
                      className="bg-muted cursor-not-allowed"
                    />
                    <p className="text-xs text-muted-foreground">
                      Users you create will be assigned to your organization
                    </p>
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="role">Role *</Label>
                  <div className="space-y-2">
                    {filteredRoles.length > 10 && (
                      <div className="relative">
                        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Search roles..."
                          value={roleSearchQuery}
                          onChange={(e) => setRoleSearchQuery(e.target.value)}
                          className="pl-9"
                        />
                      </div>
                    )}
                    <Select 
                      value={formData.role} 
                      onValueChange={(value) => setFormData({ ...formData, role: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={rolesLoading ? "Loading roles..." : "Select a role"} />
                      </SelectTrigger>
                      <SelectContent>
                        {rolesLoading ? (
                          <div className="p-2 text-sm text-muted-foreground text-center">
                            Loading roles...
                          </div>
                        ) : rolesError ? (
                          <div className="p-2 text-sm text-destructive text-center">
                            Error loading roles: {rolesError.message}
                          </div>
                        ) : filteredRoles.length === 0 ? (
                          <div className="p-2 text-sm text-muted-foreground text-center">
                            No roles available
                          </div>
                        ) : (
                          filteredRoles.map((role) => (
                            <SelectItem key={role.role_code} value={role.role_code}>
                              <div className="flex items-center gap-2">
                                <span>{role.role_name}</span>
                                {role.is_system_role && (
                                  <Badge variant="outline" className="text-xs">
                                    System
                                  </Badge>
                                )}
                              </div>
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                  <Button type="submit" disabled={createUser.isPending}>
                    {createUser.isPending ? "Creating..." : "Create User"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              System Users
            </CardTitle>
            <CardDescription>
              {searchQuery 
                ? `${totalItems} users matching "${searchQuery}"`
                : `Total: ${totalItems} users`
              }
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
                <p className="text-sm text-muted-foreground">Loading users...</p>
              </div>
            ) : paginatedData?.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                {searchQuery ? "No users found matching your search" : "No users found"}
              </div>
            ) : (
              <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Phone</TableHead>
                    {!isOrgAdmin && <TableHead>Organization</TableHead>}
                    <TableHead>Roles</TableHead>
                    <TableHead className="w-[80px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedData?.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">
                        {user.firstname || user.surname 
                          ? `${user.firstname || ""} ${user.surname || ""}`.trim()
                          : <span className="text-muted-foreground italic">No name</span>
                        }
                      </TableCell>
                      <TableCell>{user.email || "-"}</TableCell>
                      <TableCell>{user.phone || "-"}</TableCell>
                      {!isOrgAdmin && (
                        <TableCell>
                          {user.user_roles?.[0]?.organizations?.name || (
                            <span className="text-muted-foreground italic">No Organization</span>
                          )}
                        </TableCell>
                      )}
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {user.user_roles?.length > 0 ? (
                            user.user_roles.map((ur, idx) => (
                              <Badge key={idx} variant={getRoleBadgeVariant(ur.role)}>
                                {ur.role.replace(/_/g, " ")}
                              </Badge>
                            ))
                          ) : (
                            <span className="text-muted-foreground italic text-sm">No role</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleEdit(user)}>
                              <Pencil className="h-4 w-4 mr-2" />
                              Edit User
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleDeactivate(user)}>
                              <UserX className="h-4 w-4 mr-2" />
                              Deactivate
                            </DropdownMenuItem>
                            {isSuperAdmin && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem 
                                  onClick={() => handleDelete(user)}
                                  className="text-destructive focus:text-destructive"
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Delete Permanently
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
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

        <UserEditDialog
          open={editDialogOpen}
          onOpenChange={setEditDialogOpen}
          user={selectedUser}
          roles={activeRoles}
          onSave={handleSaveEdit}
          isLoading={updateUser.isPending}
        />

        <UserDeleteDialog
          open={deleteDialogOpen}
          onOpenChange={setDeleteDialogOpen}
          user={selectedUser}
          onConfirm={handleConfirmDelete}
          isLoading={deleteUser.isPending || deactivateUser.isPending}
          mode={deleteMode}
        />
      </div>
    </DashboardLayout>
  );
};

export default UserManagement;
