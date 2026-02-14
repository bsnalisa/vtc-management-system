import { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Search, Loader2, KeyRound } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface UserEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: {
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
  } | null;
  roles: Array<{
    role_code: string;
    role_name: string;
    is_system_role: boolean;
    description?: string | null;
  }>;
  onSave: (data: {
    userId: string;
    firstname: string;
    surname: string;
    phone: string;
    role: string;
    resetPassword?: boolean;
  }) => Promise<void>;
  isLoading?: boolean;
}

export const UserEditDialog = ({ 
  open, 
  onOpenChange, 
  user, 
  roles, 
  onSave,
  isLoading = false
}: UserEditDialogProps) => {
  const { toast } = useToast();
  const [firstname, setFirstname] = useState("");
  const [surname, setSurname] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState("");
  const [roleSearchQuery, setRoleSearchQuery] = useState("");
  const [resettingPassword, setResettingPassword] = useState(false);

  useEffect(() => {
    if (user) {
      setFirstname(user.firstname || "");
      setSurname(user.surname || "");
      setPhone(user.phone || "");
      setRole(user.user_roles?.[0]?.role || "");
    }
  }, [user]);

  const filteredRoles = useMemo(() => {
    const activeRoles = roles.filter((r) => r.role_code && r.role_code.trim() !== '');
    if (!roleSearchQuery) return activeRoles;
    
    const query = roleSearchQuery.toLowerCase();
    return activeRoles.filter(
      (role) =>
        role.role_name.toLowerCase().includes(query) ||
        role.role_code.toLowerCase().includes(query) ||
        role.description?.toLowerCase().includes(query)
    );
  }, [roles, roleSearchQuery]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    await onSave({
      userId: user.user_id,
      firstname,
      surname,
      phone,
      role,
    });
  };

  const handleResetPassword = async () => {
    if (!user) return;
    setResettingPassword(true);
    try {
      await onSave({
        userId: user.user_id,
        firstname,
        surname,
        phone,
        role,
        resetPassword: true,
      });
      toast({
        title: "Password Reset",
        description: `Password has been reset to default. User will be required to change it on next login.`,
      });
    } catch (error) {
      // Error handled by parent
    } finally {
      setResettingPassword(false);
    }
  };

  if (!user) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit User</DialogTitle>
          <DialogDescription>
            Update user information for {user.email}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="edit-firstname">First Name</Label>
              <Input
                id="edit-firstname"
                value={firstname}
                onChange={(e) => setFirstname(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-surname">Last Name</Label>
              <Input
                id="edit-surname"
                value={surname}
                onChange={(e) => setSurname(e.target.value)}
                required
              />
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="edit-email">Email</Label>
            <Input
              id="edit-email"
              type="email"
              value={user.email || ""}
              disabled
              className="bg-muted cursor-not-allowed"
            />
            <p className="text-xs text-muted-foreground">
              Email cannot be changed
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-phone">Phone</Label>
            <Input
              id="edit-phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-role">Role</Label>
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
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a role" />
                </SelectTrigger>
                <SelectContent>
                  {filteredRoles.map((r) => (
                    <SelectItem key={r.role_code} value={r.role_code}>
                      <div className="flex items-center gap-2">
                        <span>{r.role_name}</span>
                        {r.is_system_role && (
                          <Badge variant="outline" className="text-xs">
                            System
                          </Badge>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="border-t pt-4 mt-2">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Reset Password</p>
                <p className="text-xs text-muted-foreground">
                  Reset to default password (Password1). User must change on next login.
                </p>
              </div>
              <Button 
                type="button" 
                variant="outline" 
                size="sm"
                onClick={handleResetPassword}
                disabled={resettingPassword || isLoading}
              >
                {resettingPassword ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <KeyRound className="mr-2 h-4 w-4" />
                )}
                Reset
              </Button>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
