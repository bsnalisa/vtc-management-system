import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Shield,
  Plus,
  Edit,
  Trash2,
  Settings,
  UserPlus,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { CustomRole, useCustomRoles, useDeleteCustomRole } from "@/hooks/useRoleManagement";
import { RoleDialog } from "@/components/roles/RoleDialog";
import { PermissionsEditor } from "@/components/roles/PermissionsEditor";
import { BulkRoleAssignmentDialog } from "@/components/roles/BulkRoleAssignmentDialog";
import { DashboardLayout } from "@/components/DashboardLayout";
import { adminNavItems, organizationAdminNavItems } from "@/lib/navigationConfig";
import { useUserRole } from "@/hooks/useUserRole";

export default function RoleManagement() {
  const { role } = useUserRole();
  const { data: roles = [], isLoading } = useCustomRoles();
  const deleteRole = useDeleteCustomRole();
  
  const navItems = role === "organization_admin" ? organizationAdminNavItems : adminNavItems;

  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState<CustomRole | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [roleToDelete, setRoleToDelete] = useState<CustomRole | null>(null);
  const [permissionsRole, setPermissionsRole] = useState<CustomRole | null>(null);
  const [bulkAssignDialogOpen, setBulkAssignDialogOpen] = useState(false);

  const systemRoles = roles.filter((r) => r.is_system_role);
  const customRoles = roles.filter((r) => !r.is_system_role);

  const handleEdit = (role: CustomRole) => {
    setSelectedRole(role);
    setDialogOpen(true);
  };

  const handleCreate = () => {
    setSelectedRole(null);
    setDialogOpen(true);
  };

  const handleDelete = (role: CustomRole) => {
    setRoleToDelete(role);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (roleToDelete) {
      await deleteRole.mutateAsync(roleToDelete.id);
      setDeleteDialogOpen(false);
      setRoleToDelete(null);
    }
  };

  const handleManagePermissions = (role: CustomRole) => {
    setPermissionsRole(role);
  };

  const RolesTable = ({ roles: tableRoles, showActions = true }: { roles: CustomRole[]; showActions?: boolean }) => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Role Name</TableHead>
          <TableHead>Role Code</TableHead>
          <TableHead>Description</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Type</TableHead>
          {showActions && <TableHead className="text-right">Actions</TableHead>}
        </TableRow>
      </TableHeader>
      <TableBody>
        {tableRoles.length === 0 ? (
          <TableRow>
            <TableCell colSpan={showActions ? 6 : 5} className="text-center text-muted-foreground">
              No roles found
            </TableCell>
          </TableRow>
        ) : (
          tableRoles.map((tableRole) => (
            <TableRow key={tableRole.id}>
              <TableCell className="font-medium">{tableRole.role_name}</TableCell>
              <TableCell>
                <code className="text-sm bg-muted px-2 py-1 rounded">{tableRole.role_code}</code>
              </TableCell>
              <TableCell className="max-w-md truncate">
                {tableRole.description || <span className="text-muted-foreground">No description</span>}
              </TableCell>
              <TableCell>
                <Badge variant={tableRole.active ? "default" : "secondary"}>{tableRole.active ? "Active" : "Inactive"}</Badge>
              </TableCell>
              <TableCell>
                <Badge variant={tableRole.is_system_role ? "outline" : "secondary"}>
                  {tableRole.is_system_role ? "System" : "Custom"}
                </Badge>
              </TableCell>
              {showActions && (
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    {role === "super_admin" && (
                      <Button variant="outline" size="sm" onClick={() => handleManagePermissions(tableRole)}>
                        <Settings className="h-4 w-4 mr-1" />
                        Permissions
                      </Button>
                    )}
                    {role === "super_admin" && !tableRole.is_system_role && (
                      <>
                        <Button variant="outline" size="sm" onClick={() => handleEdit(tableRole)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => handleDelete(tableRole)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                  </div>
                </TableCell>
              )}
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );

  // If we're in permissions editor mode, render it separately
  if (permissionsRole) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Shield className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-3xl font-bold">{permissionsRole.role_name} Permissions</h1>
              <p className="text-muted-foreground mt-1">Configure module access for this role</p>
            </div>
          </div>
          <Button variant="outline" onClick={() => setPermissionsRole(null)}>
            Back to Roles
          </Button>
        </div>

        <PermissionsEditor role={permissionsRole} />
      </div>
    );
  }

  // Main roles management content
  const rolesContent = (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Shield className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold">Role Management</h1>
            <p className="text-muted-foreground mt-1">
              {role === "super_admin" 
                ? "Create and manage custom roles with specific permissions" 
                : "View roles and assign them to staff members"}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setBulkAssignDialogOpen(true)}>
            <UserPlus className="h-4 w-4 mr-2" />
            Bulk Assign Roles
          </Button>
          {role === "super_admin" && (
            <Button onClick={handleCreate}>
              <Plus className="h-4 w-4 mr-2" />
              Create Role
            </Button>
          )}
        </div>
      </div>

      <Card className="border-primary/20">
        <CardHeader>
          <CardTitle>About Role Management</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-sm text-muted-foreground">
            <strong>System Roles</strong> are built-in roles that come with the platform. Their permissions can be
            viewed but not modified.
          </p>
          <p className="text-sm text-muted-foreground">
            <strong>Custom Roles</strong> are roles created by super admins to fit specific organizational needs.
          </p>
          {role !== "super_admin" && (
            <p className="text-sm text-muted-foreground">
              <strong>Note:</strong> As an organizational admin, you can view existing roles and assign them to staff members during registration, but only super admins can create, edit, or delete roles.
            </p>
          )}
        </CardContent>
      </Card>

      <Tabs defaultValue="all" className="space-y-4">
        <TabsList>
          <TabsTrigger value="all">All Roles ({roles.length})</TabsTrigger>
          <TabsTrigger value="system">System Roles ({systemRoles.length})</TabsTrigger>
          <TabsTrigger value="custom">Custom Roles ({customRoles.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="all">
          <Card>
            <CardHeader>
              <CardTitle>All Roles</CardTitle>
              <CardDescription>View all system and custom roles</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <p className="text-center text-muted-foreground py-8">Loading roles...</p>
              ) : (
                <RolesTable roles={roles} />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="system">
          <Card>
            <CardHeader>
              <CardTitle>System Roles</CardTitle>
              <CardDescription>Built-in roles that come with the platform</CardDescription>
            </CardHeader>
            <CardContent>
              <RolesTable roles={systemRoles} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="custom">
          <Card>
            <CardHeader>
              <CardTitle>Custom Roles</CardTitle>
              <CardDescription>Roles created specifically for your organization</CardDescription>
            </CardHeader>
            <CardContent>
              <RolesTable roles={customRoles} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <RoleDialog open={dialogOpen} onOpenChange={setDialogOpen} role={selectedRole} />

      <BulkRoleAssignmentDialog open={bulkAssignDialogOpen} onOpenChange={setBulkAssignDialogOpen} />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Role</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the role "{roleToDelete?.role_name}"? This action cannot be undone. Users
              with this role will lose their permissions.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );

  return (
    <DashboardLayout
      title="Role Management"
      subtitle="Create and manage custom roles with specific permissions"
      navItems={navItems}
      groupLabel="Super Admin"
    >
      {rolesContent}
    </DashboardLayout>
  );
}
