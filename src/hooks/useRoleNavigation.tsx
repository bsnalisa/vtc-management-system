import { useUserRole, UserRole } from "@/hooks/useUserRole";
import {
  adminNavItems,
  organizationAdminNavItems,
  headOfTrainingNavItems,
  trainerNavItems,
  traineeNavItems,
  hodNavItems,
  assessmentCoordinatorNavItems,
  debtorOfficerNavItems,
  registrationOfficerNavItems,
  stockControlNavItems,
  assetMaintenanceNavItems,
  procurementNavItems,
  placementOfficerNavItems,
  hostelCoordinatorNavItems,
  headOfTraineeSupportNavItems,
  projectsCoordinatorNavItems,
  hrOfficerNavItems,
  bdlCoordinatorNavItems,
  rplCoordinatorNavItems,
} from "@/lib/navigationConfig";
import { getRoleDashboardPath, getRoleDisplayName } from "@/lib/roleUtils";

export const useRoleNavigation = () => {
  const { role, loading } = useUserRole();

  const getNavItems = () => {
    switch (role) {
      case "super_admin":
        return adminNavItems; // Super admin uses admin nav when in org context
      case "organization_admin":
        return organizationAdminNavItems;
      case "admin":
        return adminNavItems;
      case "head_of_training":
        return headOfTrainingNavItems;
      case "trainer":
        return trainerNavItems;
      case "trainee":
        return traineeNavItems;
      case "hod":
        return hodNavItems;
      case "assessment_coordinator":
        return assessmentCoordinatorNavItems;
      case "debtor_officer":
        return debtorOfficerNavItems;
      case "registration_officer":
        return registrationOfficerNavItems;
      case "stock_control_officer":
        return stockControlNavItems;
      case "asset_maintenance_coordinator":
        return assetMaintenanceNavItems;
      case "procurement_officer":
        return procurementNavItems;
      case "placement_officer":
        return placementOfficerNavItems;
      case "hostel_coordinator":
        return hostelCoordinatorNavItems;
      case "head_of_trainee_support":
        return headOfTraineeSupportNavItems;
      case "projects_coordinator":
        return projectsCoordinatorNavItems;
      case "hr_officer":
        return hrOfficerNavItems;
      case "bdl_coordinator":
        return bdlCoordinatorNavItems;
      case "rpl_coordinator":
        return rplCoordinatorNavItems;
      default:
        return adminNavItems;
    }
  };

  const getGroupLabel = () => {
    switch (role) {
      case "super_admin":
        return "Administration";
      case "organization_admin":
        return "Organization";
      case "admin":
        return "Administration";
      case "head_of_training":
        return "Training Management";
      case "trainer":
        return "Trainer Tools";
      case "trainee":
        return "My Portal";
      case "hod":
        return "Department Management";
      case "assessment_coordinator":
        return "Assessment";
      case "debtor_officer":
        return "Finance";
      case "registration_officer":
        return "Registration";
      case "stock_control_officer":
        return "Stock Control";
      case "asset_maintenance_coordinator":
        return "Asset Management";
      case "procurement_officer":
        return "Procurement";
      case "placement_officer":
        return "Placement Services";
      case "hostel_coordinator":
        return "Hostel Management";
      case "head_of_trainee_support":
        return "Trainee Support";
      case "projects_coordinator":
        return "Projects";
      case "hr_officer":
        return "Human Resources";
      case "bdl_coordinator":
        return "Distance Learning";
      case "rpl_coordinator":
        return "RPL Management";
      default:
        return "Navigation";
    }
  };

  const getDashboardPath = () => getRoleDashboardPath(role);
  const getRoleDisplay = () => getRoleDisplayName(role);

  return {
    role,
    loading,
    navItems: getNavItems(),
    groupLabel: getGroupLabel(),
    dashboardPath: getDashboardPath(),
    roleDisplayName: getRoleDisplay(),
  };
};

// Helper to check if user has access to a specific page
export const usePageAccess = (allowedRoles: UserRole[]) => {
  const { role, loading } = useUserRole();
  
  const hasAccess = loading 
    ? false 
    : role === "super_admin" || allowedRoles.includes(role as UserRole);
  
  return { hasAccess, loading, role };
};
