import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import {
  CustomRole,
  AVAILABLE_MODULES,
  useRolePermissions,
  useUpsertRolePermission,
  ModuleDefinition,
} from "@/hooks/useRoleManagement";
import { toast } from "sonner";

interface PermissionsEditorProps {
  role: CustomRole;
}

interface PermissionState {
  can_view: boolean;
  can_create: boolean;
  can_edit: boolean;
  can_delete: boolean;
}

export function PermissionsEditor({ role }: PermissionsEditorProps) {
  const { data: permissions, isLoading } = useRolePermissions(role.role_code);
  const upsertPermission = useUpsertRolePermission();
  const [permissionStates, setPermissionStates] = useState<Record<string, PermissionState>>({});
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    if (permissions) {
      const states: Record<string, PermissionState> = {};
      permissions.forEach((perm) => {
        states[perm.module_code] = {
          can_view: perm.can_view,
          can_create: perm.can_create,
          can_edit: perm.can_edit,
          can_delete: perm.can_delete,
        };
      });
      setPermissionStates(states);
      setHasChanges(false);
    }
  }, [permissions]);

  const handlePermissionChange = (moduleCode: string, permission: keyof PermissionState, value: boolean) => {
    setPermissionStates((prev) => ({
      ...prev,
      [moduleCode]: {
        ...prev[moduleCode],
        [permission]: value,
        // Auto-enable view when enabling any other permission
        ...(permission !== "can_view" && value ? { can_view: true } : {}),
      },
    }));
    setHasChanges(true);
  };

  const handleSaveAll = async () => {
    try {
      const updates = Object.entries(permissionStates).map(([moduleCode, perms]) => ({
        role_code: role.role_code,
        module_code: moduleCode,
        ...perms,
      }));

      await Promise.all(updates.map((update) => upsertPermission.mutateAsync(update)));
      setHasChanges(false);
      toast.success("All permissions saved successfully");
    } catch (error) {
      console.error("Error saving permissions:", error);
    }
  };

  const groupedModules = AVAILABLE_MODULES.reduce((acc, module) => {
    if (!acc[module.category]) {
      acc[module.category] = [];
    }
    acc[module.category].push(module);
    return acc;
  }, {} as Record<string, ModuleDefinition[]>);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold">Module Permissions</h3>
          <p className="text-sm text-muted-foreground">
            Configure what {role.role_name} can access and do
          </p>
        </div>
        {hasChanges && (
          <Button onClick={handleSaveAll} disabled={upsertPermission.isPending}>
            {upsertPermission.isPending ? "Saving..." : "Save All Changes"}
          </Button>
        )}
      </div>

      {Object.entries(groupedModules).map(([category, modules]) => (
        <Card key={category}>
          <CardHeader>
            <CardTitle className="text-base">{category}</CardTitle>
            <CardDescription>
              Modules in the {category.toLowerCase()} category
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[250px]">Module</TableHead>
                    <TableHead className="text-center">View</TableHead>
                    <TableHead className="text-center">Create</TableHead>
                    <TableHead className="text-center">Edit</TableHead>
                    <TableHead className="text-center">Delete</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {modules.map((module) => {
                    const perms = permissionStates[module.code] || {
                      can_view: false,
                      can_create: false,
                      can_edit: false,
                      can_delete: false,
                    };

                    return (
                      <TableRow key={module.code}>
                        <TableCell>
                          <div>
                            <div className="font-medium">{module.name}</div>
                            <div className="text-sm text-muted-foreground">
                              {module.description}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <Checkbox
                            checked={perms.can_view}
                            onCheckedChange={(checked) =>
                              handlePermissionChange(module.code, "can_view", checked as boolean)
                            }
                            disabled={role.is_system_role}
                          />
                        </TableCell>
                        <TableCell className="text-center">
                          <Checkbox
                            checked={perms.can_create}
                            onCheckedChange={(checked) =>
                              handlePermissionChange(module.code, "can_create", checked as boolean)
                            }
                            disabled={role.is_system_role}
                          />
                        </TableCell>
                        <TableCell className="text-center">
                          <Checkbox
                            checked={perms.can_edit}
                            onCheckedChange={(checked) =>
                              handlePermissionChange(module.code, "can_edit", checked as boolean)
                            }
                            disabled={role.is_system_role}
                          />
                        </TableCell>
                        <TableCell className="text-center">
                          <Checkbox
                            checked={perms.can_delete}
                            onCheckedChange={(checked) =>
                              handlePermissionChange(module.code, "can_delete", checked as boolean)
                            }
                            disabled={role.is_system_role}
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      ))}

      {role.is_system_role && (
        <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4">
          <p className="text-sm text-yellow-800">
            <strong>System Role:</strong> This is a built-in role. Permissions can be viewed but not modified.
          </p>
        </div>
      )}
    </div>
  );
}
