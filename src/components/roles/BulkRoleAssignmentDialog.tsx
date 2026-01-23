import { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, Users } from "lucide-react";
import {
  useCustomRoles,
  useUsersWithRoles,
  useBulkAssignRoles,
  UserWithRole,
} from "@/hooks/useRoleManagement";
import { useOrganizations } from "@/hooks/useOrganizations";

interface BulkRoleAssignmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function BulkRoleAssignmentDialog({ open, onOpenChange }: BulkRoleAssignmentDialogProps) {
  const [selectedRole, setSelectedRole] = useState<string>("");
  const [selectedOrganization, setSelectedOrganization] = useState<string>("");
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleSearchQuery, setRoleSearchQuery] = useState("");

  const { data: roles = [] } = useCustomRoles();
  const { data: organizations = [] } = useOrganizations();
  const { data: users = [], isLoading } = useUsersWithRoles();
  const bulkAssign = useBulkAssignRoles();

  const activeRoles = roles.filter((r) => r.active);

  const filteredRoles = useMemo(() => {
    const base = activeRoles.filter((role) => role.role_code && role.role_code.trim() !== "");
    if (!roleSearchQuery) return base;
    const query = roleSearchQuery.toLowerCase();
    return base.filter(
      (role) =>
        role.role_name.toLowerCase().includes(query) ||
        role.role_code.toLowerCase().includes(query) ||
        role.description?.toLowerCase().includes(query)
    );
  }, [activeRoles, roleSearchQuery]);

  const filteredUsers = useMemo(() => {
    let filtered = users;

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (user) =>
          user.email?.toLowerCase().includes(query) ||
          user.full_name?.toLowerCase().includes(query)
      );
    }

    // Filter by organization if selected
    if (selectedOrganization && selectedOrganization !== "all") {
      filtered = filtered.filter((user) => user.organization_id === selectedOrganization);
    }

    return filtered;
  }, [users, searchQuery, selectedOrganization]);

  const handleSelectAll = () => {
    if (selectedUsers.length === filteredUsers.length) {
      setSelectedUsers([]);
    } else {
      setSelectedUsers(filteredUsers.map((u) => u.id));
    }
  };

  const handleSelectUser = (userId: string) => {
    setSelectedUsers((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const handleAssign = async () => {
    if (!selectedRole || selectedUsers.length === 0) return;

    await bulkAssign.mutateAsync({
      userIds: selectedUsers,
      roleCode: selectedRole,
      organizationId: selectedOrganization && selectedOrganization !== "all" ? selectedOrganization : undefined,
    });

    // Reset state
    setSelectedUsers([]);
    setSelectedRole("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Bulk Role Assignment
          </DialogTitle>
          <DialogDescription>
            Select multiple users and assign them a role. This will replace their existing role.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Role Selection with Search */}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Select Role *</Label>
              <div className="space-y-2">
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search roles..."
                    value={roleSearchQuery}
                    onChange={(e) => setRoleSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <Select value={selectedRole} onValueChange={setSelectedRole}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a role to assign" />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredRoles.length === 0 ? (
                      <div className="p-2 text-sm text-muted-foreground text-center">
                        No roles found
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

            <div className="space-y-2">
              <Label>Filter by Organization</Label>
              <Select value={selectedOrganization} onValueChange={setSelectedOrganization}>
                <SelectTrigger>
                  <SelectValue placeholder="All organizations" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Organizations</SelectItem>
                  {organizations.map((org) => (
                    <SelectItem key={org.id} value={org.id}>
                      {org.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search users by name or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* User Selection */}
          <div className="border rounded-lg">
            <div className="p-3 border-b bg-muted/50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={selectedUsers.length === filteredUsers.length && filteredUsers.length > 0}
                  onCheckedChange={handleSelectAll}
                />
                <Label className="cursor-pointer" onClick={handleSelectAll}>
                  Select All ({filteredUsers.length} users)
                </Label>
              </div>
              {selectedUsers.length > 0 && (
                <Badge variant="secondary">
                  {selectedUsers.length} selected
                </Badge>
              )}
            </div>

            <div className="max-h-[300px] overflow-y-auto">
              {isLoading ? (
                <div className="p-8 text-center text-muted-foreground">
                  Loading users...
                </div>
              ) : filteredUsers.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  No users found
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12"></TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Current Role</TableHead>
                      <TableHead>Organization</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredUsers.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell>
                          <Checkbox
                            checked={selectedUsers.includes(user.id)}
                            onCheckedChange={() => handleSelectUser(user.id)}
                          />
                        </TableCell>
                        <TableCell className="font-medium">
                          {user.full_name || <span className="text-muted-foreground">No name</span>}
                        </TableCell>
                        <TableCell>{user.email}</TableCell>
                        <TableCell>
                          {user.role_name ? (
                            <Badge variant="outline">{user.role_name}</Badge>
                          ) : (
                            <span className="text-muted-foreground text-sm">No role</span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {user.organization_name || "N/A"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-between items-center pt-4 border-t">
            <div className="text-sm text-muted-foreground">
              {selectedUsers.length > 0 && selectedRole && (
                <span>
                  Ready to assign <strong>{roles.find(r => r.role_code === selectedRole)?.role_name}</strong> to{" "}
                  <strong>{selectedUsers.length}</strong> user(s)
                </span>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleAssign}
                disabled={!selectedRole || selectedUsers.length === 0 || bulkAssign.isPending}
              >
                {bulkAssign.isPending ? "Assigning..." : `Assign to ${selectedUsers.length} User(s)`}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
