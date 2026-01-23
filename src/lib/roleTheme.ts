import { UserRole } from "@/hooks/useUserRole";

export const getRoleThemeClass = (role: UserRole): string => {
  const themeMap: Record<string, string> = {
    super_admin: "role-super-admin",
    organization_admin: "role-admin",
    admin: "role-admin",
    registration_officer: "role-registration",
    debtor_officer: "role-debtor",
    hod: "role-hod",
    assessment_coordinator: "role-assessment",
    stock_control_officer: "role-stock",
    asset_maintenance_coordinator: "role-asset",
    procurement_officer: "role-procurement",
    placement_officer: "role-placement",
    trainer: "role-trainer",
    trainee: "role-trainee",
  };

  return role ? themeMap[role] || "" : "";
};

export const getRoleColor = (role: UserRole): string => {
  const colorMap: Record<string, string> = {
    super_admin: "bg-role-super-admin",
    organization_admin: "bg-role-admin",
    admin: "bg-role-admin",
    registration_officer: "bg-role-registration",
    debtor_officer: "bg-role-debtor",
    hod: "bg-role-hod",
    assessment_coordinator: "bg-role-assessment",
    stock_control_officer: "bg-role-stock",
    asset_maintenance_coordinator: "bg-role-asset",
    procurement_officer: "bg-role-procurement",
    placement_officer: "bg-role-placement",
    trainer: "bg-role-trainer",
    trainee: "bg-role-trainee",
  };

  return role ? colorMap[role] || "bg-primary" : "bg-primary";
};
