import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CustomRole, useCreateCustomRole, useUpdateCustomRole } from "@/hooks/useRoleManagement";
import { useOrganizationContext } from "@/hooks/useOrganizationContext";
import { useUserRole } from "@/hooks/useUserRole";
import { Shield, Info } from "lucide-react";

const roleSchema = z.object({
  role_code: z.string().min(2).max(50),
  role_name: z.string().min(2).max(100),
  description: z.string().optional(),
  active: z.boolean().default(true),
  is_system_role: z.boolean().default(false),
});

type RoleFormData = z.infer<typeof roleSchema>;

interface RoleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  role?: CustomRole | null;
}

export function RoleDialog({ open, onOpenChange, role }: RoleDialogProps) {
  const { organizationId } = useOrganizationContext();
  const { role: userRole } = useUserRole();
  const isSuperAdmin = userRole === 'super_admin';
  const createRole = useCreateCustomRole();
  const updateRole = useUpdateCustomRole();

  const form = useForm<RoleFormData>({
    resolver: zodResolver(roleSchema),
    defaultValues: {
      role_code: "",
      role_name: "",
      description: "",
      active: true,
      is_system_role: false,
    },
  });

  useEffect(() => {
    if (role) {
      form.reset({
        role_code: role.role_code,
        role_name: role.role_name,
        description: role.description || "",
        active: role.active,
        is_system_role: role.is_system_role,
      });
    } else {
      form.reset({
        role_code: "",
        role_name: "",
        description: "",
        active: true,
        is_system_role: false,
      });
    }
  }, [role, form]);

  const onSubmit = async (data: RoleFormData) => {
    try {
      if (role) {
        await updateRole.mutateAsync({
          id: role.id,
          role_code: data.role_code,
          role_name: data.role_name,
          description: data.description,
          active: data.active,
          is_system_role: data.is_system_role,
        });
      } else {
        // For new roles: Super Admin creates system roles, Org Admin creates custom roles
        await createRole.mutateAsync({
          role_code: data.role_code,
          role_name: data.role_name,
          description: data.description,
          active: data.active,
          is_system_role: isSuperAdmin && data.is_system_role,
          organization_id: isSuperAdmin && data.is_system_role ? null : organizationId,
        });
      }
      onOpenChange(false);
      form.reset();
    } catch (error) {
      console.error("Error saving role:", error);
    }
  };

  const isSystemRole = form.watch("is_system_role");
  const isEditing = !!role;
  const isEditingSystemRole = isEditing && role?.is_system_role;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            {isEditing ? "Edit Role" : "Create New Role"}
          </DialogTitle>
          <DialogDescription>
            {isSuperAdmin 
              ? "Create system-wide roles or custom VTC-specific roles" 
              : "Create custom roles for your VTC"}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Role Type Indicator */}
            {(isSystemRole || isEditingSystemRole) && (
              <div className="flex items-center gap-2 p-3 bg-primary/10 border border-primary/20 rounded-md">
                <Info className="h-4 w-4 text-primary" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-primary">System Role</p>
                  <p className="text-xs text-muted-foreground">
                    Available across all VTCs in the system
                  </p>
                </div>
                <Badge variant="default">System</Badge>
              </div>
            )}

            {!isSystemRole && !isEditingSystemRole && !isSuperAdmin && (
              <div className="flex items-center gap-2 p-3 bg-secondary/50 border border-border rounded-md">
                <Info className="h-4 w-4 text-muted-foreground" />
                <div className="flex-1">
                  <p className="text-sm font-medium">Custom VTC Role</p>
                  <p className="text-xs text-muted-foreground">
                    Only available within your VTC
                  </p>
                </div>
                <Badge variant="secondary">Custom</Badge>
              </div>
            )}

            {/* System Role Toggle - Only for Super Admin on new roles */}
            {isSuperAdmin && !isEditing && (
              <FormField
                control={form.control}
                name="is_system_role"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">System Role</FormLabel>
                      <FormDescription>
                        Make this role available across all VTCs
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            )}

            <FormField
              control={form.control}
              name="role_code"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Role Code</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="e.g., hostel_clerk" 
                      {...field} 
                      disabled={isEditingSystemRole && !isSuperAdmin}
                    />
                  </FormControl>
                  <FormDescription>
                    Unique identifier (lowercase, underscores only)
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="role_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Role Name *</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Workshop Supervisor" {...field} />
                  </FormControl>
                  <FormDescription>
                    Display name for the role
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Describe the role's responsibilities..."
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="active"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                  <div className="space-y-0.5">
                    <FormLabel>Active</FormLabel>
                    <FormDescription>
                      Is this role currently available for assignment?
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      disabled={role?.is_system_role}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button 
                type="submit"
                disabled={createRole.isPending || updateRole.isPending}
              >
                {createRole.isPending || updateRole.isPending
                  ? "Saving..."
                  : role
                  ? "Update Role"
                  : "Create Role"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
