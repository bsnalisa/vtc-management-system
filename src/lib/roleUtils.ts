import { UserRole } from "@/hooks/useUserRole";

export const getRoleDisplayName = (role: UserRole): string => {
  const roleMap: Record<string, string> = {
    super_admin: "Super Admin",
    organization_admin: "Organization Admin",
    admin: "Admin",
    head_of_training: "Head of Training",
    trainer: "Trainer",
    registration_officer: "Registration Officer",
    debtor_officer: "Debtor Officer",
    hod: "Head of Department",
    assessment_coordinator: "Assessment Coordinator",
    stock_control_officer: "Stock Control Officer",
    asset_maintenance_coordinator: "Asset Maintenance Coordinator",
    procurement_officer: "Procurement Officer",
    placement_officer: "Placement Officer",
    hostel_coordinator: "Hostel Coordinator",
    head_of_trainee_support: "Head of Trainee Support",
    projects_coordinator: "Projects Coordinator",
    hr_officer: "HR Officer",
    bdl_coordinator: "BDL Coordinator",
    rpl_coordinator: "RPL Coordinator",
    trainee: "Trainee",
  };

  return role ? roleMap[role] || role : "";
};

export const getRoleDashboardPath = (role: UserRole): string => {
  const pathMap: Record<string, string> = {
    super_admin: "/super-admin",
    organization_admin: "/organization-admin-dashboard",
    admin: "/admin-dashboard",
    head_of_training: "/head-of-training-dashboard",
    trainer: "/trainer-dashboard",
    registration_officer: "/registration-officer-dashboard",
    debtor_officer: "/debtor-officer-dashboard",
    hod: "/hod-dashboard",
    assessment_coordinator: "/assessment-coordinator-dashboard",
    stock_control_officer: "/stock-control-officer-dashboard",
    asset_maintenance_coordinator: "/asset-maintenance-coordinator-dashboard",
    procurement_officer: "/procurement-officer-dashboard",
    placement_officer: "/placement-officer-dashboard",
    hostel_coordinator: "/hostel-coordinator-dashboard",
    head_of_trainee_support: "/trainee-support-dashboard",
    projects_coordinator: "/projects-coordinator-dashboard",
    hr_officer: "/hr-officer-dashboard",
    bdl_coordinator: "/bdl-coordinator-dashboard",
    rpl_coordinator: "/rpl-coordinator-dashboard",
    trainee: "/trainee-dashboard",
  };

  return role ? pathMap[role] || "/" : "/";
};
