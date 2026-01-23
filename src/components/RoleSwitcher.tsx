import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronDown } from "lucide-react";
import { useUserRole, UserRole } from "@/hooks/useUserRole";
import { useUserRoles } from "@/hooks/useUserRoles";
import { getRoleDisplayName, getRoleDashboardPath } from "@/lib/roleUtils";
import { getRoleColor } from "@/lib/roleTheme";

export const RoleSwitcher = () => {
  const navigate = useNavigate();
  const { role: currentRole } = useUserRole();
  const { roles, hasMultipleRoles } = useUserRoles();

  if (!hasMultipleRoles || !currentRole) {
    return null;
  }

  const handleRoleSwitch = (role: UserRole) => {
    const path = getRoleDashboardPath(role);
    navigate(path);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <div className={`w-2 h-2 rounded-full ${getRoleColor(currentRole)}`} />
          <span className="hidden sm:inline">{getRoleDisplayName(currentRole)}</span>
          <ChevronDown className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Switch Role</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {roles.map((role) => (
          <DropdownMenuItem
            key={role}
            onClick={() => handleRoleSwitch(role)}
            className="gap-2"
            disabled={role === currentRole}
          >
            <div className={`w-2 h-2 rounded-full ${getRoleColor(role)}`} />
            <span>{getRoleDisplayName(role)}</span>
            {role === currentRole && (
              <span className="ml-auto text-xs text-muted-foreground">Current</span>
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
