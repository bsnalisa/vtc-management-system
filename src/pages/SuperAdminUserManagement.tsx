import { useState, useEffect } from "react";
import { SuperAdminLayout } from "@/components/SuperAdminLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Plus,
  UserCog,
  Save,
  Trash2,
  Users,
  Search,
  Filter,
  Mail,
  Phone,
  Building2,
  Shield,
  Eye,
  MoreHorizontal,
  UserPlus,
  Settings,
} from "lucide-react";
import { useOrganizations } from "@/hooks/useOrganizations";
import {
  useUsers,
  useCreateUser,
  useDeleteUser,
  useAddUserRole,
  useRemoveUserRole,
  useUpdateUserOrganization,
} from "@/hooks/useUsers";
import { useUpdateProfile } from "@/hooks/useProfile";
import { useUserRole } from "@/hooks/useUserRole";
import { useOrganizationContext } from "@/hooks/useOrganizationContext";
import { useCustomRoles } from "@/hooks/useRoleManagement";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const SuperAdminUserManagement = () => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isManageDialogOpen, setIsManageDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [userToDelete, setUserToDelete] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [orgFilter, setOrgFilter] = useState("all");

  const [editFormData, setEditFormData] = useState({
    firstname: "",
    surname: "",
    phone: "",
    organization_id: "",
  });
  const [newRole, setNewRole] = useState<string>("");
  const [newRoleOrg, setNewRoleOrg] = useState<string>("");
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    firstname: "",
    surname: "",
    phone: "",
    role: "organization_admin" as string,
    organization_id: "",
  });

  const { role: currentRole, loading: roleLoading } = useUserRole();
  const isSuperAdmin = currentRole === "super_admin";
  const { organizationId } = useOrganizationContext();
  const { data: organizations } = useOrganizations();
  const {
    data: users,
    isLoading,
    refetch: refetchUsers,
  } = useUsers(isSuperAdmin ? undefined : organizationId || undefined);
  const { data: availableRoles } = useCustomRoles();
  const createUser = useCreateUser();
  const updateProfile = useUpdateProfile();
  const deleteUser = useDeleteUser();
  const addUserRole = useAddUserRole();
  const removeUserRole = useRemoveUserRole();
  const updateUserOrganization = useUpdateUserOrganization();

  // Reset form when dialog closes
  useEffect(() => {
    if (!isDialogOpen) {
      setFormData({
        email: "",
        password: "",
        firstname: "",
        surname: "",
        phone: "",
        role: "organization_admin",
        organization_id: "",
      });
    }
  }, [isDialogOpen]);

  // Filter users based on search and filters
  const filteredUsers = users?.filter((user) => {
    const fullName = user.firstname && user.surname 
      ? `${user.firstname} ${user.surname}` 
      : user.full_name || '';
    const matchesSearch =
      fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = roleFilter === "all" || user.user_roles?.some((role: any) => role.role === roleFilter);
    const matchesOrg =
      orgFilter === "all" || user.user_roles?.some((role: any) => role.organizations?.id === orgFilter);

    return matchesSearch && matchesRole && matchesOrg;
  });

  const userStats = {
    total: users?.length || 0,
    superAdmins: users?.filter((user) => user.user_roles?.some((role: any) => role.role === "super_admin")).length || 0,
    orgAdmins:
      users?.filter((user) => user.user_roles?.some((role: any) => role.role === "organization_admin")).length || 0,
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createUser.mutateAsync({
        email: formData.email,
        password: formData.password,
        firstname: formData.firstname,
        surname: formData.surname,
        phone: formData.phone,
        role: formData.role,
        organization_id: formData.organization_id || (!isSuperAdmin ? organizationId : undefined),
      });
      setIsDialogOpen(false);
      toast.success("User created successfully");
      refetchUsers();
    } catch (error: any) {
      toast.error(error.message || "Failed to create user");
    }
  };

  const handleManageClick = (user: any) => {
    setSelectedUser(user);
    // Get the primary organization ID - handle both cases where user might have multiple roles
    const primaryOrgRole = user.user_roles?.find(
      (role: any) => role.organization_id && role.organization_id !== "vms_user",
    );
    const userOrgId = primaryOrgRole?.organization_id || user.user_roles?.[0]?.organization_id || "vms_user";

    setEditFormData({
      firstname: user.firstname || "",
      surname: user.surname || "",
      phone: user.phone || "",
      organization_id: userOrgId,
    });
    setNewRole("");
    setNewRoleOrg("");
    setIsManageDialogOpen(true);
  };

  const handleUpdateUser = async () => {
    if (!selectedUser?.user_id && !selectedUser?.id) {
      toast.error("No user selected");
      return;
    }

    try {
      const userId = selectedUser.user_id || selectedUser.id;
      const oldOrgId = selectedUser.user_roles?.[0]?.organization_id || null;
      const newOrgId = editFormData.organization_id === "vms_user" ? null : editFormData.organization_id || null;

      let updatesMade = false;

      // Update profile only if fields changed
      if (
        editFormData.firstname !== selectedUser.firstname ||
        editFormData.surname !== selectedUser.surname ||
        editFormData.phone !== selectedUser.phone
      ) {
        await updateProfile.mutateAsync({
          userId: userId,
          profileData: {
            firstname: editFormData.firstname,
            surname: editFormData.surname,
            phone: editFormData.phone,
          },
        });
        updatesMade = true;
      }

      // Update organization if changed and user is Super Admin
      if (isSuperAdmin && oldOrgId !== newOrgId) {
        await updateUserOrganization.mutateAsync({
          userId: userId,
          oldOrganizationId: oldOrgId,
          newOrganizationId: newOrgId,
        });
        updatesMade = true;
      }

      if (updatesMade) {
        toast.success("User profile updated successfully");
        refetchUsers();
        setIsManageDialogOpen(false);
      } else {
        toast.info("No changes detected");
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to update user");
      console.error("Error updating user:", error);
    }
  };

  const handleDeleteClick = (user: any) => {
    setUserToDelete(user);
    setIsDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!userToDelete?.user_id && !userToDelete?.id) {
      toast.error("No user selected for deletion");
      return;
    }

    const userId = userToDelete.user_id || userToDelete.id;

    try {
      await deleteUser.mutateAsync(userId);
      toast.success("User deleted successfully");
      refetchUsers();
      setIsDeleteDialogOpen(false);
      setUserToDelete(null);
    } catch (error: any) {
      toast.error(error.message || "Failed to delete user");
    }
  };

  const handleAddRole = async () => {
    if (!selectedUser?.user_id && !selectedUser?.id) {
      toast.error("No user selected");
      return;
    }

    if (!newRole) {
      toast.error("Please select a role to add");
      return;
    }

    try {
      const userId = selectedUser.user_id || selectedUser.id;
      await addUserRole.mutateAsync({
        userId: userId,
        role: newRole,
        organizationId: newRole === "organization_admin" ? newRoleOrg : undefined,
      });
      toast.success("Role added successfully");
      setNewRole("");
      setNewRoleOrg("");
      refetchUsers();
    } catch (error: any) {
      toast.error(error.message || "Failed to add role");
      console.error("Error adding role:", error);
    }
  };

  const handleRemoveRole = async (roleId: string) => {
    if (!roleId) {
      toast.error("Invalid role ID");
      return;
    }

    try {
      await removeUserRole.mutateAsync(roleId);
      toast.success("Role removed successfully");
      refetchUsers();
    } catch (error: any) {
      toast.error(error.message || "Failed to remove role");
    }
  };

  const getInitials = (name: string) => {
    if (!name) return "U";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase();
  };

  const formatRoleName = (role: string) => {
    if (!role) return "Unknown Role";
    return role
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case "super_admin":
        return "bg-purple-100 text-purple-800 border-purple-200";
      case "organization_admin":
        return "bg-blue-100 text-blue-800 border-blue-200";
      case "admin":
        return "bg-green-100 text-green-800 border-green-200";
      case "hod":
        return "bg-orange-100 text-orange-800 border-orange-200";
      case "trainer":
        return "bg-cyan-100 text-cyan-800 border-cyan-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  // Safe user ID display
  const getSafeUserId = (user: any) => {
    if (!user) return "N/A";
    const userId = user.id || user.user_id;
    if (!userId) return "N/A";
    return userId.slice(0, 8) + "...";
  };

  return (
    <SuperAdminLayout>
      <div className="space-y-6">
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">User Management</h1>
            <p className="text-muted-foreground mt-2">
              {isSuperAdmin
                ? "Manage all users and assign roles across organizations"
                : "Manage users in your organization"}
            </p>
          </div>
          {(isSuperAdmin || currentRole === "organization_admin") && (
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button className="bg-blue-600 hover:bg-blue-700">
                  <UserPlus className="h-4 w-4 mr-2" />
                  Create User
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <form onSubmit={handleSubmit}>
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                      <UserPlus className="h-5 w-5" />
                      Create New User
                    </DialogTitle>
                    <DialogDescription>Add a new user and assign appropriate roles and permissions</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="firstname" className="font-medium">
                        First Name *
                      </Label>
                      <Input
                        id="firstname"
                        placeholder="John"
                        value={formData.firstname}
                        onChange={(e) => setFormData({ ...formData, firstname: e.target.value })}
                        className="focus:ring-2 focus:ring-blue-500"
                        required
                        minLength={2}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="surname" className="font-medium">
                        Last Name *
                      </Label>
                      <Input
                        id="surname"
                        placeholder="Doe"
                        value={formData.surname}
                        onChange={(e) => setFormData({ ...formData, surname: e.target.value })}
                        className="focus:ring-2 focus:ring-blue-500"
                        required
                        minLength={2}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email" className="font-medium">
                        Email *
                      </Label>
                      <Input
                        id="email"
                        type="email"
                        placeholder="john@example.com"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        className="focus:ring-2 focus:ring-blue-500"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="password" className="font-medium">
                        Password *
                      </Label>
                      <Input
                        id="password"
                        type="password"
                        placeholder="••••••••"
                        value={formData.password}
                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                        className="focus:ring-2 focus:ring-blue-500"
                        required
                        minLength={6}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phone" className="font-medium">
                        Phone (Optional)
                      </Label>
                      <Input
                        id="phone"
                        type="tel"
                        placeholder="+264 81 234 5678"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        className="focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="role" className="font-medium">
                        Role *
                      </Label>
                      <Select
                        value={formData.role}
                        onValueChange={(value: string) =>
                          setFormData({
                            ...formData,
                            role: value,
                            organization_id: value === "organization_admin" ? formData.organization_id : "",
                          })
                        }
                      >
                        <SelectTrigger className="focus:ring-2 focus:ring-blue-500">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {availableRoles
                            ?.filter(
                              (role) =>
                                isSuperAdmin || (role.role_code !== "super_admin" && role.role_code !== "admin"),
                            )
                            .map((role) => (
                              <SelectItem key={role.role_code} value={role.role_code}>
                                {role.role_name}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>
                    {formData.role === "organization_admin" && (
                      <div className="space-y-2">
                        <Label htmlFor="organization" className="font-medium">
                          Organization *
                        </Label>
                        <Select
                          value={formData.organization_id}
                          onValueChange={(value) => setFormData({ ...formData, organization_id: value })}
                          disabled={!isSuperAdmin}
                          required
                        >
                          <SelectTrigger className="focus:ring-2 focus:ring-blue-500">
                            <SelectValue placeholder="Select organization" />
                          </SelectTrigger>
                          <SelectContent>
                            {organizations?.map((org) => (
                              <SelectItem key={org.id} value={org.id}>
                                {org.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {!isSuperAdmin && (
                          <p className="text-xs text-muted-foreground">User will be assigned to your organization</p>
                        )}
                      </div>
                    )}
                  </div>
                  <DialogFooter>
                    <Button type="submit" disabled={createUser.isPending} className="bg-blue-600 hover:bg-blue-700">
                      {createUser.isPending ? (
                        <>
                          <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent mr-2" />
                          Creating...
                        </>
                      ) : (
                        "Create User"
                      )}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-blue-600">Total Users</p>
                  <p className="text-3xl font-bold text-blue-900">{userStats.total}</p>
                </div>
                <Users className="h-8 w-8 text-blue-400" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-purple-600">Super Admins</p>
                  <p className="text-3xl font-bold text-purple-900">{userStats.superAdmins}</p>
                </div>
                <Shield className="h-8 w-8 text-purple-400" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-green-600">Org Admins</p>
                  <p className="text-3xl font-bold text-green-900">{userStats.orgAdmins}</p>
                </div>
                <Building2 className="h-8 w-8 text-green-400" />
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
                  placeholder="Search users..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                <Select value={roleFilter} onValueChange={setRoleFilter}>
                  <SelectTrigger className="w-full sm:w-40 focus:ring-2 focus:ring-blue-500">
                    <Filter className="h-4 w-4 mr-2" />
                    <SelectValue placeholder="Filter by role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Roles</SelectItem>
                    {availableRoles?.map((role) => (
                      <SelectItem key={role.role_code} value={role.role_code}>
                        {role.role_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {isSuperAdmin && (
                  <Select value={orgFilter} onValueChange={setOrgFilter}>
                    <SelectTrigger className="w-full sm:w-48 focus:ring-2 focus:ring-blue-500">
                      <Building2 className="h-4 w-4 mr-2" />
                      <SelectValue placeholder="Filter by org" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Organizations</SelectItem>
                      {organizations?.map((org) => (
                        <SelectItem key={org.id} value={org.id}>
                          {org.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Users Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              System Users
            </CardTitle>
            <CardDescription>{filteredUsers?.length || 0} users found</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-12">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent mx-auto mb-4"></div>
                <p className="text-muted-foreground">Loading users...</p>
              </div>
            ) : filteredUsers?.length === 0 ? (
              <div className="text-center py-12">
                <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No users found</p>
                {searchTerm || roleFilter !== "all" || orgFilter !== "all" ? (
                  <p className="text-sm text-muted-foreground mt-2">Try adjusting your search or filters</p>
                ) : null}
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader className="bg-muted/50">
                    <TableRow>
                      <TableHead className="font-semibold">User</TableHead>
                      <TableHead className="font-semibold">Contact</TableHead>
                      <TableHead className="font-semibold">Organization</TableHead>
                      <TableHead className="font-semibold">Roles</TableHead>
                      <TableHead className="font-semibold text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredUsers?.map((user) => (
                      <TableRow key={user.id} className="hover:bg-muted/30 transition-colors">
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="h-10 w-10 border-2 border-muted">
                              <AvatarImage src={user.avatar_url} />
                              <AvatarFallback className="bg-blue-100 text-blue-600 font-medium">
                                {getInitials(
                                  user.firstname && user.surname
                                    ? `${user.firstname} ${user.surname}`
                                    : user.full_name || ""
                                )}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-medium text-foreground">
                                {user.firstname && user.surname
                                  ? `${user.firstname} ${user.surname}`
                                  : user.full_name || "Unnamed User"}
                              </p>
                              <p className="text-xs text-muted-foreground">ID: {getSafeUserId(user)}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 text-sm">
                              <Mail className="h-3 w-3 text-muted-foreground" />
                              {user.email}
                            </div>
                            {user.phone && (
                              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <Phone className="h-3 w-3" />
                                {user.phone}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {user.user_roles && user.user_roles.length > 0 && user.user_roles[0]?.organizations?.name ? (
                            <div className="flex items-center gap-2">
                              <Building2 className="h-4 w-4 text-muted-foreground" />
                              <span className="text-sm">{user.user_roles[0].organizations.name}</span>
                            </div>
                          ) : (
                            <span className="text-sm text-muted-foreground">System User</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {user.user_roles && user.user_roles.length > 0 ? (
                              user.user_roles.map((roleObj: any, idx: number) => (
                                <Badge key={idx} variant="outline" className={`text-xs ${getRoleColor(roleObj.role)}`}>
                                  {formatRoleName(roleObj.role)}
                                </Badge>
                              ))
                            ) : (
                              <span className="text-sm text-muted-foreground">No roles</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleManageClick(user)}
                              className="flex items-center gap-1"
                            >
                              <Settings className="h-3 w-3" />
                              Manage
                            </Button>
                            {(isSuperAdmin || currentRole === "organization_admin") && (
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => handleDeleteClick(user)}
                                disabled={
                                  user.user_roles?.some((role: any) => role.role === "super_admin") && !isSuperAdmin
                                }
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            )}
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

        {/* Manage User Dialog */}
        <Dialog open={isManageDialogOpen} onOpenChange={setIsManageDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <UserCog className="h-5 w-5" />
                Manage User
              </DialogTitle>
              <DialogDescription>Update user details and manage role assignments</DialogDescription>
            </DialogHeader>
            <div className="grid md:grid-cols-2 gap-6 py-4">
              {/* User Profile Section */}
              <div className="space-y-6">
                <div className="flex flex-col items-center text-center">
                  <Avatar className="h-24 w-24 border-4 border-muted">
                    <AvatarImage src={selectedUser?.avatar_url} />
                    <AvatarFallback className="text-2xl bg-blue-100 text-blue-600">
                      {getInitials(`${selectedUser?.firstname || ''} ${selectedUser?.surname || ''}`)}
                    </AvatarFallback>
                  </Avatar>
                  <h3 className="font-semibold mt-3">
                    {selectedUser?.firstname && selectedUser?.surname
                      ? `${selectedUser.firstname} ${selectedUser.surname}`
                      : selectedUser?.full_name || "Unnamed User"}
                  </h3>
                  <p className="text-sm text-muted-foreground">{selectedUser?.email}</p>
                </div>

                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="edit_firstname">First Name</Label>
                      <Input
                        id="edit_firstname"
                        value={editFormData.firstname}
                        onChange={(e) => setEditFormData({ ...editFormData, firstname: e.target.value })}
                        className="focus:ring-2 focus:ring-blue-500"
                        placeholder="Enter first name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit_surname">Last Name</Label>
                      <Input
                        id="edit_surname"
                        value={editFormData.surname}
                        onChange={(e) => setEditFormData({ ...editFormData, surname: e.target.value })}
                        className="focus:ring-2 focus:ring-blue-500"
                        placeholder="Enter last name"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="edit_phone">Phone</Label>
                    <Input
                      id="edit_phone"
                      value={editFormData.phone}
                      onChange={(e) => setEditFormData({ ...editFormData, phone: e.target.value })}
                      placeholder="+264 81 234 5678"
                      className="focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  {isSuperAdmin && (
                    <div className="space-y-2">
                      <Label htmlFor="edit_organization">Organization / VTC</Label>
                      <Select
                        value={editFormData.organization_id}
                        onValueChange={(value) => setEditFormData({ ...editFormData, organization_id: value })}
                      >
                        <SelectTrigger id="edit_organization" className="focus:ring-2 focus:ring-blue-500">
                          <SelectValue placeholder="Select organization" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="vms_user">VMS User (No Organization)</SelectItem>
                          {organizations?.map((org) => (
                            <SelectItem key={org.id} value={org.id}>
                              {org.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        Change user's organization assignment. Select "VMS User" for system users without organization.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Roles Section */}
              <div className="space-y-6">
                <div className="space-y-3">
                  <Label className="font-medium">Current Roles</Label>
                  <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto p-2 border rounded-lg">
                    {selectedUser?.user_roles && selectedUser.user_roles.length > 0 ? (
                      selectedUser.user_roles.map((roleObj: any, idx: number) => (
                        <Badge key={idx} variant="outline" className={`gap-1 ${getRoleColor(roleObj.role)}`}>
                          {formatRoleName(roleObj.role)}
                          {roleObj.organizations?.name && (
                            <span className="text-xs">({roleObj.organizations.name})</span>
                          )}
                          {isSuperAdmin && roleObj.role !== "super_admin" && (
                            <button
                              onClick={() => handleRemoveRole(roleObj.id)}
                              className="ml-1 hover:text-destructive text-xs"
                              type="button"
                              title="Remove role"
                            >
                              ×
                            </button>
                          )}
                        </Badge>
                      ))
                    ) : (
                      <span className="text-sm text-muted-foreground">No roles assigned</span>
                    )}
                  </div>
                </div>

                {isSuperAdmin && (
                  <div className="space-y-3 pt-4 border-t">
                    <Label className="font-medium">Add New Role</Label>
                    <div className="space-y-3">
                      <Select value={newRole} onValueChange={setNewRole}>
                        <SelectTrigger className="focus:ring-2 focus:ring-blue-500">
                          <SelectValue placeholder="Select role to add" />
                        </SelectTrigger>
                        <SelectContent>
                          {availableRoles
                            ?.filter(
                              (role) =>
                                !selectedUser?.user_roles?.some((userRole: any) => userRole.role === role.role_code),
                            )
                            .map((role) => (
                              <SelectItem key={role.role_code} value={role.role_code}>
                                {role.role_name}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>

                      {newRole === "organization_admin" && (
                        <Select value={newRoleOrg} onValueChange={setNewRoleOrg}>
                          <SelectTrigger className="focus:ring-2 focus:ring-blue-500">
                            <SelectValue placeholder="Select organization" />
                          </SelectTrigger>
                          <SelectContent>
                            {organizations?.map((org) => (
                              <SelectItem key={org.id} value={org.id}>
                                {org.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}

                      <Button
                        onClick={handleAddRole}
                        disabled={
                          !newRole || (newRole === "organization_admin" && !newRoleOrg) || addUserRole.isPending
                        }
                        size="sm"
                        className="w-full bg-blue-600 hover:bg-blue-700"
                      >
                        {addUserRole.isPending ? (
                          <>
                            <div className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent mr-2" />
                            Adding...
                          </>
                        ) : (
                          "Add Role"
                        )}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsManageDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleUpdateUser}
                disabled={updateProfile.isPending || updateUserOrganization.isPending}
                className="bg-blue-600 hover:bg-blue-700"
              >
                <Save className="h-4 w-4 mr-2" />
                {updateProfile.isPending || updateUserOrganization.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2 text-destructive">
                <Trash2 className="h-5 w-5" />
                Delete User
              </AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. This will permanently delete the user{" "}
                <strong>{userToDelete?.full_name || "Unnamed User"}</strong> ({userToDelete?.email}) and remove all
                their data from our servers.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleConfirmDelete}
                disabled={deleteUser.isPending}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {deleteUser.isPending ? (
                  <>
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent mr-2" />
                    Deleting...
                  </>
                ) : (
                  "Delete User"
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </SuperAdminLayout>
  );
};

export default SuperAdminUserManagement;
