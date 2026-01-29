import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import LandingPage from "./pages/LandingPage";
import Auth from "./pages/Auth";
import ResetPassword from "./pages/ResetPassword";
import Dashboard from "./pages/Dashboard";
import AdminDashboard from "./pages/AdminDashboard";
import OrganizationAdminDashboard from "./pages/OrganizationAdminDashboard";
import HeadOfTrainingDashboard from "./pages/HeadOfTrainingDashboard";
import TrainerDashboard from "./pages/TrainerDashboard";
import RegistrationOfficerDashboard from "./pages/RegistrationOfficerDashboard";
import ApplicationManagement from "./pages/ApplicationManagement";
import DebtorOfficerDashboard from "./pages/DebtorOfficerDashboard";
import HODDashboard from "./pages/HODDashboard";
import AssessmentCoordinatorDashboard from "./pages/AssessmentCoordinatorDashboard";
import StockControlOfficerDashboard from "./pages/StockControlOfficerDashboard";
import AssetMaintenanceCoordinatorDashboard from "./pages/AssetMaintenanceCoordinatorDashboard";
import HostelCoordinatorDashboard from "./pages/HostelCoordinatorDashboard";
import TraineeDashboard from "./pages/TraineeDashboard";
import UserManagement from "./pages/UserManagement";
import TraineeRegistration from "./pages/TraineeRegistration";
import TraineeList from "./pages/TraineeList";
import TrainerManagement from "./pages/TrainerManagement";
import AttendanceRegister from "./pages/AttendanceRegister";
import FeeManagement from "./pages/FeeManagement";
import Reports from "./pages/Reports";
import CourseEnrollment from "./pages/CourseEnrollment";
import AssessmentResults from "./pages/AssessmentResults";
import ClassManagement from "./pages/ClassManagement";
import TimetableManagement from "./pages/TimetableManagement";
import Announcements from "./pages/Announcements";
import SuperAdminDashboard from "./pages/SuperAdminDashboard";
import OrganizationManagement from "./pages/OrganizationManagement";
import PackageManagement from "./pages/PackageManagement";
import SuperAdminUserManagement from "./pages/SuperAdminUserManagement";
import SuperAdminPackageAssignment from "./pages/SuperAdminPackageAssignment";
import SuperAdminModulesManagement from "./pages/SuperAdminModulesManagement";
import SuperAdminPackagesManagement from "./pages/SuperAdminPackagesManagement";
import SystemConfig from "./pages/SystemConfig";
import SystemLogs from "./pages/SystemLogs";
import SuperAdminAuditLogs from "./pages/SuperAdminAuditLogs";
import SetupWizard from "./pages/SetupWizard";
import DocumentGeneration from "./pages/DocumentGeneration";
import Messages from "./pages/Messages";
import Analytics from "./pages/Analytics";
import UserProfile from "./pages/UserProfile";
import AssetManagement from "./pages/AssetManagement";
import StockManagement from "./pages/StockManagement";
import ProcurementOfficerDashboard from "./pages/ProcurementOfficerDashboard";
import SupplierManagement from "./pages/SupplierManagement";
import PurchaseRequisitions from "./pages/PurchaseRequisitions";
import PurchaseOrders from "./pages/PurchaseOrders";
import ReceivingReports from "./pages/ReceivingReports";
import PermissionsMatrix from "./pages/PermissionsMatrix";
import RoleManagement from "./pages/RoleManagement";
import AlumniManagement from "./pages/AlumniManagement";
import HostelManagement from "./pages/HostelManagement";
import PlacementOfficerDashboard from "./pages/PlacementOfficerDashboard";
import StaffOnboarding from "./pages/StaffOnboarding";
import TrainingModules from "./pages/TrainingModules";
import OrganizationSettings from "./pages/OrganizationSettings";
import SupportTickets from "./pages/SupportTickets";
import RoleActivityDashboard from "./pages/RoleActivityDashboard";
import ModulesManagement from "./pages/ModulesManagement";
import NotFound from "./pages/NotFound";
import ProtectedRoute from "./components/ProtectedRoute";
import ErrorBoundary from "./components/ErrorBoundary";
import { OrganizationProvider } from "./hooks/useOrganizationContext";
import { withRoleAccess } from "./components/withRoleAccess";
import TraineeDetail from "./pages/TraineeDetail";
import HeadOfTraineeSupportDashboard from "./pages/HeadOfTraineeSupportDashboard";
import ProjectsCoordinatorDashboard from "./pages/ProjectsCoordinatorDashboard";
import HROfficerDashboard from "./pages/HROfficerDashboard";
import BDLCoordinatorDashboard from "./pages/BDLCoordinatorDashboard";
import RPLCoordinatorDashboard from "./pages/RPLCoordinatorDashboard";
import PendingApprovals from "./pages/PendingApprovals";
import EntryRequirementsManagement from "./pages/EntryRequirementsManagement";
import CourseManagement from "./pages/CourseManagement";
import QualificationManagement from "./pages/QualificationManagement";
import QualificationApprovals from "./pages/QualificationApprovals";
import TradeManagement from "./pages/TradeManagement";
import TraineeRegistrationPage from "./pages/trainee/TraineeRegistrationPage";
import TraineeDocumentsPage from "./pages/trainee/TraineeDocumentsPage";
import TraineeAdmissionStatusPage from "./pages/trainee/TraineeAdmissionStatusPage";
import TraineeHostelPage from "./pages/trainee/TraineeHostelPage";
import TraineeExamTimetablePage from "./pages/trainee/TraineeExamTimetablePage";
import TraineeResultsPage from "./pages/trainee/TraineeResultsPage";
import TraineeFinancePage from "./pages/trainee/TraineeFinancePage";
import TraineePaymentsPage from "./pages/trainee/TraineePaymentsPage";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

// Wrap dashboards with role access control
const ProtectedAdminDashboard = withRoleAccess(AdminDashboard, {
  requiredRoles: ["admin"],
});
const ProtectedOrganizationAdminDashboard = withRoleAccess(OrganizationAdminDashboard, {
  requiredRoles: ["organization_admin"],
});
const ProtectedHeadOfTrainingDashboard = withRoleAccess(HeadOfTrainingDashboard, {
  requiredRoles: ["head_of_training"],
});
const ProtectedTrainerDashboard = withRoleAccess(TrainerDashboard, {
  requiredRoles: ["trainer"],
});
const ProtectedRegistrationOfficerDashboard = withRoleAccess(RegistrationOfficerDashboard, {
  requiredRoles: ["registration_officer"],
});
const ProtectedDebtorOfficerDashboard = withRoleAccess(DebtorOfficerDashboard, {
  requiredRoles: ["debtor_officer"],
});
const ProtectedHODDashboard = withRoleAccess(HODDashboard, {
  requiredRoles: ["hod"],
});
const ProtectedAssessmentCoordinatorDashboard = withRoleAccess(AssessmentCoordinatorDashboard, {
  requiredRoles: ["assessment_coordinator"],
});
const ProtectedStockControlOfficerDashboard = withRoleAccess(StockControlOfficerDashboard, {
  requiredRoles: ["stock_control_officer"],
});
const ProtectedAssetMaintenanceCoordinatorDashboard = withRoleAccess(AssetMaintenanceCoordinatorDashboard, {
  requiredRoles: ["asset_maintenance_coordinator"],
});
const ProtectedTraineeDashboard = withRoleAccess(TraineeDashboard, {
  requiredRoles: ["trainee"],
});
const ProtectedProcurementDashboard = withRoleAccess(ProcurementOfficerDashboard, {
  requiredRoles: ["procurement_officer"],
});
const ProtectedHostelCoordinatorDashboard = withRoleAccess(HostelCoordinatorDashboard, {
  requiredRoles: ["hostel_coordinator", "admin"],
});
const ProtectedHeadOfTraineeSupportDashboard = withRoleAccess(HeadOfTraineeSupportDashboard, {
  requiredRoles: ["head_of_trainee_support"],
});
const ProtectedProjectsCoordinatorDashboard = withRoleAccess(ProjectsCoordinatorDashboard, {
  requiredRoles: ["projects_coordinator"],
});
const ProtectedHROfficerDashboard = withRoleAccess(HROfficerDashboard, {
  requiredRoles: ["hr_officer"],
});
const ProtectedBDLCoordinatorDashboard = withRoleAccess(BDLCoordinatorDashboard, {
  requiredRoles: ["bdl_coordinator"],
});
const ProtectedRPLCoordinatorDashboard = withRoleAccess(RPLCoordinatorDashboard, {
  requiredRoles: ["rpl_coordinator"],
});

// Wrap functional pages with role access control
const ProtectedUserManagement = withRoleAccess(UserManagement, {
  requiredRoles: ["admin", "organization_admin"],
});
const ProtectedTraineeRegistration = withRoleAccess(TraineeRegistration, {
  requiredRoles: ["registration_officer", "admin", "head_of_training"],
});
const ProtectedApplicationManagement = withRoleAccess(ApplicationManagement, {
  requiredRoles: ["registration_officer", "admin", "head_of_training"],
});
const ProtectedTrainerManagement = withRoleAccess(TrainerManagement, {
  requiredRoles: ["admin", "head_of_training", "hod"],
});
const ProtectedFeeManagement = withRoleAccess(FeeManagement, {
  requiredRoles: ["debtor_officer", "admin"],
});
const ProtectedClassManagement = withRoleAccess(ClassManagement, {
  requiredRoles: ["admin", "head_of_training", "hod"],
});
const ProtectedTimetableManagement = withRoleAccess(TimetableManagement, {
  requiredRoles: ["admin", "head_of_training", "hod"],
});
const ProtectedAnnouncements = withRoleAccess(Announcements, {
  requiredRoles: ["admin", "organization_admin"],
});
const ProtectedAnalytics = withRoleAccess(Analytics, {
  requiredRoles: ["admin", "head_of_training", "hod"],
});
const ProtectedAssetManagement = withRoleAccess(AssetManagement, {
  requiredRoles: ["asset_maintenance_coordinator", "admin"],
});
const ProtectedStockManagement = withRoleAccess(StockManagement, {
  requiredRoles: ["stock_control_officer", "admin"],
});
const ProtectedSupplierManagement = withRoleAccess(SupplierManagement, {
  requiredRoles: ["procurement_officer"],
});
const ProtectedPurchaseRequisitions = withRoleAccess(PurchaseRequisitions, {
  requiredRoles: ["procurement_officer"],
});
const ProtectedPurchaseOrders = withRoleAccess(PurchaseOrders, {
  requiredRoles: ["procurement_officer"],
});
const ProtectedReceivingReports = withRoleAccess(ReceivingReports, {
  requiredRoles: ["procurement_officer"],
});

// Super admin pages
const ProtectedSuperAdminDashboard = withRoleAccess(SuperAdminDashboard, {
  requiredRoles: ["super_admin"],
});
const ProtectedOrganizationManagement = withRoleAccess(OrganizationManagement, {
  requiredRoles: ["super_admin"],
});
const ProtectedSuperAdminUserManagement = withRoleAccess(SuperAdminUserManagement, {
  requiredRoles: ["super_admin"],
});
const ProtectedSuperAdminPackageAssignment = withRoleAccess(SuperAdminPackageAssignment, {
  requiredRoles: ["super_admin"],
});
const ProtectedSuperAdminPackagesManagement = withRoleAccess(SuperAdminPackagesManagement, {
  requiredRoles: ["super_admin"],
});
const ProtectedSuperAdminModulesManagement = withRoleAccess(SuperAdminModulesManagement, {
  requiredRoles: ["super_admin"],
});
const ProtectedPackageManagement = withRoleAccess(PackageManagement, {
  requiredRoles: ["super_admin"],
});
const ProtectedPermissionsMatrix = withRoleAccess(PermissionsMatrix, {
  requiredRoles: ["super_admin"],
});
const ProtectedRoleManagement = withRoleAccess(RoleManagement, {
  requiredRoles: ["super_admin"],
});
const ProtectedSuperAdminAuditLogs = withRoleAccess(SuperAdminAuditLogs, {
  requiredRoles: ["super_admin"],
});
const ProtectedRoleActivityDashboard = withRoleAccess(RoleActivityDashboard, {
  requiredRoles: ["admin", "organization_admin"],
});
const ProtectedAlumniManagement = withRoleAccess(AlumniManagement, {
  requiredRoles: ["admin", "super_admin", "placement_officer"],
});
const ProtectedHostelManagement = withRoleAccess(HostelManagement, {
  requiredRoles: ["hostel_coordinator", "admin"],
});
const ProtectedTrainingModules = withRoleAccess(TrainingModules, {
  requiredRoles: ["admin", "head_of_training"],
});
const ProtectedModulesManagement = withRoleAccess(ModulesManagement, {
  requiredRoles: ["organization_admin"],
});
const ProtectedTraineeDetail = withRoleAccess(TraineeDetail, {
  requiredRoles: ["registration_officer", "admin", "head_of_trainee_support", "head_of_training"],
});
const ProtectedPendingApprovals = withRoleAccess(PendingApprovals, {
  requiredRoles: ["head_of_trainee_support"],
});
const ProtectedEntryRequirements = withRoleAccess(EntryRequirementsManagement, {
  requiredRoles: ["registration_officer", "admin", "head_of_trainee_support"],
});
const ProtectedCourseManagement = withRoleAccess(CourseManagement, {
  requiredRoles: ["head_of_training", "admin"],
});

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <OrganizationProvider>
          <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/admin-dashboard" element={<ProtectedRoute><ProtectedAdminDashboard /></ProtectedRoute>} />
          <Route path="/organization-admin-dashboard" element={<ProtectedRoute><ProtectedOrganizationAdminDashboard /></ProtectedRoute>} />
          <Route path="/head-of-training-dashboard" element={<ProtectedRoute><ProtectedHeadOfTrainingDashboard /></ProtectedRoute>} />
          <Route path="/trainer-dashboard" element={<ProtectedRoute><ProtectedTrainerDashboard /></ProtectedRoute>} />
          <Route path="/trainee-dashboard" element={<ProtectedRoute><ProtectedTraineeDashboard /></ProtectedRoute>} />
          <Route path="/hod-dashboard" element={<ProtectedRoute><ProtectedHODDashboard /></ProtectedRoute>} />
          <Route path="/assessment-coordinator-dashboard" element={<ProtectedRoute><ProtectedAssessmentCoordinatorDashboard /></ProtectedRoute>} />
          <Route path="/debtor-officer-dashboard" element={<ProtectedRoute><ProtectedDebtorOfficerDashboard /></ProtectedRoute>} />
          <Route path="/registration-officer-dashboard" element={<ProtectedRoute><ProtectedRegistrationOfficerDashboard /></ProtectedRoute>} />
          <Route path="/stock-control-officer-dashboard" element={<ProtectedRoute><ProtectedStockControlOfficerDashboard /></ProtectedRoute>} />
          <Route path="/asset-maintenance-coordinator-dashboard" element={<ProtectedRoute><ProtectedAssetMaintenanceCoordinatorDashboard /></ProtectedRoute>} />
          <Route path="/procurement-officer-dashboard" element={<ProtectedRoute><ProtectedProcurementDashboard /></ProtectedRoute>} />
          <Route path="/placement-officer-dashboard" element={<ProtectedRoute><PlacementOfficerDashboard /></ProtectedRoute>} />
          <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/dashboard/admin" element={<ProtectedRoute><ProtectedAdminDashboard /></ProtectedRoute>} />
          <Route path="/dashboard/trainer" element={<ProtectedRoute><ProtectedTrainerDashboard /></ProtectedRoute>} />
          <Route path="/dashboard/registration" element={<ProtectedRoute><ProtectedRegistrationOfficerDashboard /></ProtectedRoute>} />
          <Route path="/dashboard/debtor" element={<ProtectedRoute><ProtectedDebtorOfficerDashboard /></ProtectedRoute>} />
          <Route path="/dashboard/hod" element={<ProtectedRoute><ProtectedHODDashboard /></ProtectedRoute>} />
          <Route path="/dashboard/assessment" element={<ProtectedRoute><ProtectedAssessmentCoordinatorDashboard /></ProtectedRoute>} />
          <Route path="/dashboard/stock" element={<ProtectedRoute><ProtectedStockControlOfficerDashboard /></ProtectedRoute>} />
          <Route path="/dashboard/assets" element={<ProtectedRoute><ProtectedAssetMaintenanceCoordinatorDashboard /></ProtectedRoute>} />
          <Route path="/dashboard/procurement" element={<ProtectedRoute><ProtectedProcurementDashboard /></ProtectedRoute>} />
          <Route path="/dashboard/trainee" element={<ProtectedRoute><ProtectedTraineeDashboard /></ProtectedRoute>} />
          <Route path="/hostel-coordinator-dashboard" element={<ProtectedRoute><ProtectedHostelCoordinatorDashboard /></ProtectedRoute>} />
          <Route path="/projects-coordinator-dashboard" element={<ProtectedRoute><ProtectedProjectsCoordinatorDashboard /></ProtectedRoute>} />
          <Route path="/hr-officer-dashboard" element={<ProtectedRoute><ProtectedHROfficerDashboard /></ProtectedRoute>} />
          <Route path="/bdl-coordinator-dashboard" element={<ProtectedRoute><ProtectedBDLCoordinatorDashboard /></ProtectedRoute>} />
          <Route path="/rpl-coordinator-dashboard" element={<ProtectedRoute><ProtectedRPLCoordinatorDashboard /></ProtectedRoute>} />
          <Route path="/trainee-support-dashboard" element={<ProtectedRoute><ProtectedHeadOfTraineeSupportDashboard /></ProtectedRoute>} />
          <Route path="/trainee-support/pending-approvals" element={<ProtectedRoute><ProtectedPendingApprovals /></ProtectedRoute>} />
          <Route path="/trainee-support/officer-activity" element={<ProtectedRoute><ProtectedHeadOfTraineeSupportDashboard /></ProtectedRoute>} />
          <Route path="/users" element={<ProtectedRoute><ProtectedUserManagement /></ProtectedRoute>} />
          <Route path="/applications" element={<ProtectedRoute><ProtectedApplicationManagement /></ProtectedRoute>} />
          <Route path="/trainees/register" element={<ProtectedRoute><ProtectedTraineeRegistration /></ProtectedRoute>} />
          <Route path="/trainees" element={<ProtectedRoute><TraineeList /></ProtectedRoute>} />
          <Route path="/trainees/:id" element={<ProtectedRoute><ProtectedTraineeDetail /></ProtectedRoute>} />
          <Route path="/trainers" element={<ProtectedRoute><ProtectedTrainerManagement /></ProtectedRoute>} />
          <Route path="/attendance" element={<ProtectedRoute><AttendanceRegister /></ProtectedRoute>} />
          <Route path="/fees" element={<ProtectedRoute><ProtectedFeeManagement /></ProtectedRoute>} />
          <Route path="/reports" element={<ProtectedRoute><Reports /></ProtectedRoute>} />
          <Route path="/enrollments" element={<ProtectedRoute><CourseEnrollment /></ProtectedRoute>} />
          <Route path="/assessment-results" element={<ProtectedRoute><AssessmentResults /></ProtectedRoute>} />
          <Route path="/classes" element={<ProtectedRoute><ProtectedClassManagement /></ProtectedRoute>} />
          <Route path="/timetable" element={<ProtectedRoute><ProtectedTimetableManagement /></ProtectedRoute>} />
          <Route path="/announcements" element={<ProtectedRoute><ProtectedAnnouncements /></ProtectedRoute>} />
          <Route path="/super-admin" element={<ProtectedRoute><ProtectedSuperAdminDashboard /></ProtectedRoute>} />
          <Route path="/super-admin/organizations" element={<ProtectedRoute><ProtectedOrganizationManagement /></ProtectedRoute>} />
          <Route path="/super-admin/packages" element={<ProtectedRoute><ProtectedSuperAdminPackagesManagement /></ProtectedRoute>} />
          <Route path="/super-admin/package-assignments" element={<ProtectedRoute><ProtectedSuperAdminPackageAssignment /></ProtectedRoute>} />
          <Route path="/super-admin/modules" element={<ProtectedRoute><ProtectedSuperAdminModulesManagement /></ProtectedRoute>} />
          <Route path="/super-admin/users" element={<ProtectedRoute><ProtectedSuperAdminUserManagement /></ProtectedRoute>} />
          <Route path="/super-admin/permissions" element={<ProtectedRoute><ProtectedPermissionsMatrix /></ProtectedRoute>} />
          <Route path="/super-admin/roles" element={<ProtectedRoute><ProtectedRoleManagement /></ProtectedRoute>} />
          <Route path="/super-admin/analytics" element={<ProtectedRoute><ProtectedAnalytics /></ProtectedRoute>} />
          <Route path="/super-admin/config" element={<ProtectedRoute><SystemConfig /></ProtectedRoute>} />
          <Route path="/super-admin/logs" element={<ProtectedRoute><SystemLogs /></ProtectedRoute>} />
          <Route path="/super-admin/audit-logs" element={<ProtectedRoute><ProtectedSuperAdminAuditLogs /></ProtectedRoute>} />
          <Route path="/packages" element={<ProtectedRoute><ProtectedPackageManagement /></ProtectedRoute>} />
          <Route path="/suppliers" element={<ProtectedRoute><ProtectedSupplierManagement /></ProtectedRoute>} />
          <Route path="/purchase-requisitions" element={<ProtectedRoute><ProtectedPurchaseRequisitions /></ProtectedRoute>} />
          <Route path="/purchase-orders" element={<ProtectedRoute><ProtectedPurchaseOrders /></ProtectedRoute>} />
          <Route path="/receiving-reports" element={<ProtectedRoute><ProtectedReceivingReports /></ProtectedRoute>} />
          <Route path="/stock" element={<ProtectedRoute><ProtectedStockManagement /></ProtectedRoute>} />
          <Route path="/assets" element={<ProtectedRoute><ProtectedAssetManagement /></ProtectedRoute>} />
          <Route path="/analytics" element={<ProtectedRoute><ProtectedAnalytics /></ProtectedRoute>} />
          <Route path="/documents" element={<ProtectedRoute><DocumentGeneration /></ProtectedRoute>} />
          <Route path="/messages" element={<ProtectedRoute><Messages /></ProtectedRoute>} />
          <Route path="/alumni" element={<ProtectedRoute><ProtectedAlumniManagement /></ProtectedRoute>} />
          <Route path="/hostel" element={<ProtectedRoute><ProtectedHostelManagement /></ProtectedRoute>} />
          <Route path="/dashboard/placement" element={<ProtectedRoute><PlacementOfficerDashboard /></ProtectedRoute>} />
          <Route path="/setup" element={<SetupWizard />} />
          <Route path="/profile" element={<ProtectedRoute><UserProfile /></ProtectedRoute>} />
          <Route path="/onboarding" element={<ProtectedRoute><StaffOnboarding /></ProtectedRoute>} />
          <Route path="/training-modules" element={<ProtectedRoute><ProtectedTrainingModules /></ProtectedRoute>} />
          <Route path="/entry-requirements" element={<ProtectedRoute><ProtectedEntryRequirements /></ProtectedRoute>} />
          <Route path="/course-management" element={<ProtectedRoute><ProtectedCourseManagement /></ProtectedRoute>} />
          <Route path="/roles" element={<ProtectedRoute><RoleManagement /></ProtectedRoute>} />
          <Route path="/role-activity" element={<ProtectedRoute><ProtectedRoleActivityDashboard /></ProtectedRoute>} />
          <Route path="/organization-settings" element={<ProtectedRoute><OrganizationSettings /></ProtectedRoute>} />
          <Route path="/modules-management" element={<ProtectedRoute><ProtectedModulesManagement /></ProtectedRoute>} />
          <Route path="/support-tickets" element={<ProtectedRoute><SupportTickets /></ProtectedRoute>} />
          <Route path="/system-logs" element={<ProtectedRoute><SystemLogs /></ProtectedRoute>} />
          <Route path="/qualifications" element={<ProtectedRoute><QualificationManagement /></ProtectedRoute>} />
          <Route path="/qualification-approvals" element={<ProtectedRoute><QualificationApprovals /></ProtectedRoute>} />
          <Route path="/trade-management" element={<ProtectedRoute><TradeManagement /></ProtectedRoute>} />
          {/* Trainee Portal Routes */}
          <Route path="/trainee/registration" element={<ProtectedRoute><TraineeRegistrationPage /></ProtectedRoute>} />
          <Route path="/trainee/application/documents" element={<ProtectedRoute><TraineeDocumentsPage /></ProtectedRoute>} />
          <Route path="/trainee/application/status" element={<ProtectedRoute><TraineeAdmissionStatusPage /></ProtectedRoute>} />
          <Route path="/trainee/hostel" element={<ProtectedRoute><TraineeHostelPage /></ProtectedRoute>} />
          <Route path="/trainee/exams/timetable" element={<ProtectedRoute><TraineeExamTimetablePage /></ProtectedRoute>} />
          <Route path="/trainee/exams/results" element={<ProtectedRoute><TraineeResultsPage /></ProtectedRoute>} />
          <Route path="/trainee/finance" element={<ProtectedRoute><TraineeFinancePage /></ProtectedRoute>} />
          <Route path="/trainee/payments" element={<ProtectedRoute><TraineePaymentsPage /></ProtectedRoute>} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
          </Routes>
        </OrganizationProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
