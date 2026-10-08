import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Suspense, lazy } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
const PublicHome = lazy(() => import("./pages/PublicHome"));
import Auth from "./pages/Auth";
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const OrganizationAdminDashboard = lazy(() => import("./pages/OrganizationAdminDashboard"));
const HeadOfTrainingDashboard = lazy(() => import("./pages/HeadOfTrainingDashboard"));
const TrainerDashboard = lazy(() => import("./pages/TrainerDashboard"));
const RegistrationOfficerDashboard = lazy(() => import("./pages/RegistrationOfficerDashboard"));
const ApplicationManagement = lazy(() => import("./pages/ApplicationManagement"));
const DebtorOfficerDashboard = lazy(() => import("./pages/DebtorOfficerDashboard"));
const HODDashboard = lazy(() => import("./pages/HODDashboard"));
const AssessmentCoordinatorDashboard = lazy(() => import("./pages/AssessmentCoordinatorDashboard"));
const StockControlOfficerDashboard = lazy(() => import("./pages/StockControlOfficerDashboard"));
const AssetMaintenanceCoordinatorDashboard = lazy(() => import("./pages/AssetMaintenanceCoordinatorDashboard"));
const HostelCoordinatorDashboard = lazy(() => import("./pages/HostelCoordinatorDashboard"));
const TraineeDashboard = lazy(() => import("./pages/TraineeDashboard"));
const UserManagement = lazy(() => import("./pages/UserManagement"));
const TraineeRegistration = lazy(() => import("./pages/TraineeRegistration"));
const TraineeList = lazy(() => import("./pages/TraineeList"));
const TrainerManagement = lazy(() => import("./pages/TrainerManagement"));
const AttendanceRegister = lazy(() => import("./pages/AttendanceRegister"));
const FeeManagement = lazy(() => import("./pages/FeeManagement"));
const Reports = lazy(() => import("./pages/Reports"));
const CourseEnrollment = lazy(() => import("./pages/CourseEnrollment"));
const AssessmentResults = lazy(() => import("./pages/AssessmentResults"));
const ClassManagement = lazy(() => import("./pages/ClassManagement"));
const TimetableManagement = lazy(() => import("./pages/TimetableManagement"));
const Announcements = lazy(() => import("./pages/Announcements"));
const SuperAdminDashboard = lazy(() => import("./pages/SuperAdminDashboard"));
const OrganizationManagement = lazy(() => import("./pages/OrganizationManagement"));
const PackageManagement = lazy(() => import("./pages/PackageManagement"));
const SuperAdminUserManagement = lazy(() => import("./pages/SuperAdminUserManagement"));
const SuperAdminPackageAssignment = lazy(() => import("./pages/SuperAdminPackageAssignment"));
const SuperAdminModulesManagement = lazy(() => import("./pages/SuperAdminModulesManagement"));
const SuperAdminPackagesManagement = lazy(() => import("./pages/SuperAdminPackagesManagement"));
const SystemConfig = lazy(() => import("./pages/SystemConfig"));
const SystemLogs = lazy(() => import("./pages/SystemLogs"));
const SuperAdminAuditLogs = lazy(() => import("./pages/SuperAdminAuditLogs"));
const SetupWizard = lazy(() => import("./pages/SetupWizard"));
const DocumentGeneration = lazy(() => import("./pages/DocumentGeneration"));
const Messages = lazy(() => import("./pages/Messages"));
const Analytics = lazy(() => import("./pages/Analytics"));
const UserProfile = lazy(() => import("./pages/UserProfile"));
const AssetManagement = lazy(() => import("./pages/AssetManagement"));
const StockManagement = lazy(() => import("./pages/StockManagement"));
const ProcurementOfficerDashboard = lazy(() => import("./pages/ProcurementOfficerDashboard"));
const SupplierManagement = lazy(() => import("./pages/SupplierManagement"));
const PurchaseRequisitions = lazy(() => import("./pages/PurchaseRequisitions"));
const PurchaseOrders = lazy(() => import("./pages/PurchaseOrders"));
const ReceivingReports = lazy(() => import("./pages/ReceivingReports"));
const PermissionsMatrix = lazy(() => import("./pages/PermissionsMatrix"));
const RoleManagement = lazy(() => import("./pages/RoleManagement"));
const AlumniManagement = lazy(() => import("./pages/AlumniManagement"));
const HostelManagement = lazy(() => import("./pages/HostelManagement"));
const PlacementOfficerDashboard = lazy(() => import("./pages/PlacementOfficerDashboard"));
const StaffOnboarding = lazy(() => import("./pages/StaffOnboarding"));
const TrainingModules = lazy(() => import("./pages/TrainingModules"));
const OrganizationSettings = lazy(() => import("./pages/OrganizationSettings"));
const SupportTickets = lazy(() => import("./pages/SupportTickets"));
const TraineeAffairs = lazy(() => import("./pages/TraineeAffairs"));
const Library = lazy(() => import("./pages/Library"));
const AcademicCalendar = lazy(() => import("./pages/AcademicCalendar"));
const DeferralRequests = lazy(() => import("./pages/DeferralRequests"));
const TraineeDeferralPage = lazy(() => import("./pages/trainee/TraineeDeferralPage"));
const CourseCatalogue = lazy(() => import("./pages/CourseCatalogue"));
const SupervisorSignoff = lazy(() => import("./pages/SupervisorSignoff"));
const PublicRplApplication = lazy(() => import("./pages/PublicRplApplication"));
const TraineeTranscriptPage = lazy(() => import("./pages/trainee/TraineeTranscriptPage"));
const Transcripts = lazy(() => import("./pages/Transcripts"));
const BankReconciliation = lazy(() => import("./pages/BankReconciliation"));
const AccountingExport = lazy(() => import("./pages/AccountingExport"));
const LearningSpace = lazy(() => import("./pages/LearningSpace"));
const RegistrationWindows = lazy(() => import("./pages/RegistrationWindows"));
const CertificationReports = lazy(() => import("./pages/CertificationReports"));
const ModuleReports = lazy(() => import("./pages/ModuleReports"));
const TraineeTimetablePage = lazy(() => import("./pages/trainee/TraineeTimetablePage"));
const MoodleIntegration = lazy(() => import("./pages/MoodleIntegration"));

const AssessmentRequests = lazy(() => import("./pages/AssessmentRequests"));
const AssessmentDevelopment = lazy(() => import("./pages/AssessmentDevelopment"));
const AssessmentSittings = lazy(() => import("./pages/AssessmentSittings"));
const DeliveryPlans = lazy(() => import("./pages/DeliveryPlans"));
const Workflows = lazy(() => import("./pages/Workflows"));
const MyApprovals = lazy(() => import("./pages/MyApprovals"));
const WorkflowAction = lazy(() => import("./pages/WorkflowAction"));
const LogbookReview = lazy(() => import("./pages/LogbookReview"));
const TraineeLogbookPage = lazy(() => import("./pages/trainee/TraineeLogbookPage"));
const TraineeEventsPage = lazy(() => import("./pages/trainee/TraineeEventsPage"));
const SmeRegistration = lazy(() => import("./pages/SmeRegistration"));
const TraineeRequestsPage = lazy(() => import("./pages/trainee/TraineeRequestsPage"));
const GraduationSurveys = lazy(() => import("./pages/GraduationSurveys"));
const SurveyResponse = lazy(() => import("./pages/SurveyResponse"));
const GraduationRsvp = lazy(() => import("./pages/GraduationRsvp"));
const RoleActivityDashboard = lazy(() => import("./pages/RoleActivityDashboard"));
const ModulesManagement = lazy(() => import("./pages/ModulesManagement"));
import NotFound from "./pages/NotFound";
import ProtectedRoute from "./components/ProtectedRoute";
import ErrorBoundary from "./components/ErrorBoundary";
import { OrganizationProvider } from "./hooks/useOrganizationContext";
import { withRoleAccess } from "./components/withRoleAccess";
const TraineeDetail = lazy(() => import("./pages/TraineeDetail"));
const HeadOfTraineeSupportDashboard = lazy(() => import("./pages/HeadOfTraineeSupportDashboard"));
const ProjectsCoordinatorDashboard = lazy(() => import("./pages/ProjectsCoordinatorDashboard"));
const HROfficerDashboard = lazy(() => import("./pages/HROfficerDashboard"));
const BDLCoordinatorDashboard = lazy(() => import("./pages/BDLCoordinatorDashboard"));
const RPLCoordinatorDashboard = lazy(() => import("./pages/RPLCoordinatorDashboard"));
import RoleWorkspace, { ServicesDashboard, roleWorkspaces } from "./pages/RoleWorkspace";
const PendingApprovals = lazy(() => import("./pages/PendingApprovals"));
const EntryRequirementsManagement = lazy(() => import("./pages/EntryRequirementsManagement"));

const QualificationManagement = lazy(() => import("./pages/QualificationManagement"));
const QualificationApprovals = lazy(() => import("./pages/QualificationApprovals"));
const TradeManagement = lazy(() => import("./pages/TradeManagement"));
const AssessmentTemplateManagement = lazy(() => import("./pages/AssessmentTemplateManagement"));
const AssessmentTemplateApprovals = lazy(() => import("./pages/AssessmentTemplateApprovals"));
const TrainerWorkload = lazy(() => import("./pages/TrainerWorkload"));
const HistoricalTrainees = lazy(() => import("./pages/HistoricalTrainees"));
const ApplicationsInbox = lazy(() => import("./pages/ApplicationsInbox"));
const OnlineApplicationsInbox = lazy(() => import("./pages/OnlineApplicationsInbox"));
const GradingScale = lazy(() => import("./pages/GradingScale"));
const TraineeRegistrationPage = lazy(() => import("./pages/trainee/TraineeRegistrationPage"));
const TraineeDocumentsPage = lazy(() => import("./pages/trainee/TraineeDocumentsPage"));
const TraineeAdmissionStatusPage = lazy(() => import("./pages/trainee/TraineeAdmissionStatusPage"));
const TraineeHostelPage = lazy(() => import("./pages/trainee/TraineeHostelPage"));
const TraineeFeedbackPage = lazy(() => import("./pages/trainee/TraineeFeedbackPage"));
const TraineeExamTimetablePage = lazy(() => import("./pages/trainee/TraineeExamTimetablePage"));
const ExamTimetablePublishing = lazy(() => import("./pages/ExamTimetablePublishing"));
const TraineeResultsPage = lazy(() => import("./pages/trainee/TraineeResultsPage"));
const TraineeFinancePage = lazy(() => import("./pages/trainee/TraineeFinancePage"));
const TraineePaymentsPage = lazy(() => import("./pages/trainee/TraineePaymentsPage"));
const FirstLoginPasswordChange = lazy(() => import("./pages/FirstLoginPasswordChange"));
const GradebookManagement = lazy(() => import("./pages/GradebookManagement"));
const GradebookDetail = lazy(() => import("./pages/GradebookDetail"));
const GradebookApproval = lazy(() => import("./pages/GradebookApproval"));
const GradebookReview = lazy(() => import("./pages/GradebookReview"));
const SummativeAssessment = lazy(() => import("./pages/SummativeAssessment"));
const QualificationResultsPage = lazy(() => import("./pages/QualificationResultsPage"));
const AssessmentGovernance = lazy(() => import("./pages/AssessmentGovernance"));
const ApplicationFees = lazy(() => import("./pages/debtors/ApplicationFees"));
const RegistrationFees = lazy(() => import("./pages/debtors/RegistrationFees"));
const ClearedPayments = lazy(() => import("./pages/debtors/ClearedPayments"));
const TraineeAccountsPage = lazy(() => import("./pages/debtors/TraineeAccounts"));
const FeeConfiguration = lazy(() => import("./pages/debtors/FeeConfiguration"));

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
const ProtectedLiaisonDashboard = withRoleAccess(() => <ServicesDashboard service="liaison" />, { requiredRoles: ["liaison_officer"] });
const ProtectedResourceDashboard = withRoleAccess(() => <ServicesDashboard service="resources" />, { requiredRoles: ["resource_center_coordinator"] });
const workspaceRoutes = Object.keys(roleWorkspaces).map(path => {
  const requiredRoles = path.startsWith("/hr/") ? ["hr_officer" as const] : path.startsWith("/bdl/") ? ["bdl_coordinator" as const] : path.startsWith("/rpl/") ? ["rpl_coordinator" as const] : path.startsWith("/liaison/") ? ["liaison_officer" as const] : path.startsWith("/resource-center/") ? ["resource_center_coordinator" as const] : ["projects_coordinator" as const];
  return { path, Component: withRoleAccess(RoleWorkspace, { requiredRoles }) };
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
  requiredRoles: ["admin", "head_of_training", "hod", "trainer"],
});
const ProtectedTimetableManagement = withRoleAccess(TimetableManagement, {
  requiredRoles: ["admin", "head_of_training", "assessment_coordinator", "hod", "trainer"],
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
const ProtectedGraduationSurveys = withRoleAccess(GraduationSurveys, {
  requiredRoles: ["admin", "organization_admin", "head_of_training", "head_of_trainee_support", "registration_officer", "placement_officer"],
});
const ProtectedAssessmentRequests = withRoleAccess(AssessmentRequests, {
  requiredRoles: ["admin", "organization_admin", "assessment_coordinator", "rpl_coordinator", "head_of_training", "registration_officer"],
});
const ProtectedAssessmentDevelopment = withRoleAccess(AssessmentDevelopment, {
  requiredRoles: ["admin", "organization_admin", "assessment_coordinator", "rpl_coordinator", "head_of_training", "registration_officer", "subject_matter_expert"],
});
const ProtectedAssessmentSittings = withRoleAccess(AssessmentSittings, {
  requiredRoles: ["admin", "organization_admin", "assessment_coordinator", "rpl_coordinator", "head_of_training", "registration_officer", "printing_distribution_officer"],
});
const ProtectedDeliveryPlans = withRoleAccess(DeliveryPlans, {
  requiredRoles: ["admin", "organization_admin", "head_of_training", "hod", "assessment_coordinator", "trainer"],
});
const ProtectedLogbookReview = withRoleAccess(LogbookReview, {
  requiredRoles: ["admin", "organization_admin", "head_of_training", "hod", "placement_officer", "trainer"],
});
const ProtectedWorkflows = withRoleAccess(Workflows, {
  requiredRoles: ["admin", "organization_admin"],
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
const ProtectedTraineeAffairs = withRoleAccess(TraineeAffairs, {
  requiredRoles: ["admin", "organization_admin", "head_of_trainee_support", "registration_officer"],
});
const ProtectedEntryRequirements = withRoleAccess(EntryRequirementsManagement, {
  requiredRoles: ["registration_officer", "admin", "head_of_trainee_support"],
});

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <OrganizationProvider>
          <Suspense fallback={<div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">Loading...</div>}>
          <Routes>
          <Route path="/" element={<PublicHome />} />
          <Route path="/apply" element={<PublicHome />} />
          <Route path="/apply/:slug" element={<PublicHome />} />

          <Route path="/sme-registration/:slug" element={<SmeRegistration />} />
          <Route path="/workflow/action/:token" element={<WorkflowAction />} />
          <Route path="/survey/:token" element={<SurveyResponse />} />
          <Route path="/graduation/rsvp/:token" element={<GraduationRsvp />} />
          <Route path="/logbook/sign/:token" element={<SupervisorSignoff />} />
          <Route path="/rpl-application/:slug" element={<PublicRplApplication />} />

          <Route path="/auth" element={<Auth />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/first-login" element={<FirstLoginPasswordChange />} />
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
          <Route path="/liaison-officer-dashboard" element={<ProtectedRoute><ProtectedLiaisonDashboard /></ProtectedRoute>} />
          <Route path="/resource-center-coordinator-dashboard" element={<ProtectedRoute><ProtectedResourceDashboard /></ProtectedRoute>} />
          {workspaceRoutes.map(({ path, Component }) => <Route key={path} path={path} element={<ProtectedRoute><Component key={path} /></ProtectedRoute>} />)}
          <Route path="/hr" element={<ProtectedRoute><ProtectedHROfficerDashboard /></ProtectedRoute>} />
          <Route path="/bdl" element={<ProtectedRoute><ProtectedBDLCoordinatorDashboard /></ProtectedRoute>} />
          <Route path="/rpl" element={<ProtectedRoute><ProtectedRPLCoordinatorDashboard /></ProtectedRoute>} />
          <Route path="/liaison" element={<ProtectedRoute><ProtectedLiaisonDashboard /></ProtectedRoute>} />
          <Route path="/resource-center" element={<ProtectedRoute><ProtectedResourceDashboard /></ProtectedRoute>} />
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
          <Route path="/gradebooks" element={<ProtectedRoute><GradebookManagement /></ProtectedRoute>} />
          <Route path="/gradebooks/:id" element={<ProtectedRoute><GradebookDetail /></ProtectedRoute>} />
          <Route path="/gradebook-approval" element={<ProtectedRoute><GradebookApproval /></ProtectedRoute>} />
          <Route path="/gradebook-review" element={<ProtectedRoute><GradebookReview /></ProtectedRoute>} />
          <Route path="/summative-assessment" element={<ProtectedRoute><SummativeAssessment /></ProtectedRoute>} />
          <Route path="/qualification-results" element={<ProtectedRoute><QualificationResultsPage /></ProtectedRoute>} />
          <Route path="/assessment-governance" element={<ProtectedRoute><AssessmentGovernance /></ProtectedRoute>} />
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
          
          <Route path="/roles" element={<ProtectedRoute><RoleManagement /></ProtectedRoute>} />
          <Route path="/role-activity" element={<ProtectedRoute><ProtectedRoleActivityDashboard /></ProtectedRoute>} />
          <Route path="/organization-settings" element={<ProtectedRoute><OrganizationSettings /></ProtectedRoute>} />
          <Route path="/modules-management" element={<ProtectedRoute><ProtectedModulesManagement /></ProtectedRoute>} />
          <Route path="/trainee-affairs" element={<ProtectedRoute><ProtectedTraineeAffairs /></ProtectedRoute>} />
          <Route path="/graduation" element={<ProtectedRoute><ProtectedGraduationSurveys /></ProtectedRoute>} />
          <Route path="/assessment-requests" element={<ProtectedRoute><ProtectedAssessmentRequests /></ProtectedRoute>} />
          <Route path="/assessment-development" element={<ProtectedRoute><ProtectedAssessmentDevelopment /></ProtectedRoute>} />
          <Route path="/assessment-sittings" element={<ProtectedRoute><ProtectedAssessmentSittings /></ProtectedRoute>} />
          <Route path="/delivery-plans" element={<ProtectedRoute><ProtectedDeliveryPlans /></ProtectedRoute>} />
          <Route path="/logbook-review" element={<ProtectedRoute><ProtectedLogbookReview /></ProtectedRoute>} />
          <Route path="/workflows" element={<ProtectedRoute><ProtectedWorkflows /></ProtectedRoute>} />
          <Route path="/my-approvals" element={<ProtectedRoute><MyApprovals /></ProtectedRoute>} />
          <Route path="/library" element={<ProtectedRoute><Library /></ProtectedRoute>} />
          <Route path="/support-tickets" element={<ProtectedRoute><SupportTickets /></ProtectedRoute>} />
          <Route path="/system-logs" element={<ProtectedRoute><SystemLogs /></ProtectedRoute>} />
          <Route path="/qualifications" element={<ProtectedRoute><QualificationManagement /></ProtectedRoute>} />
          <Route path="/qualification-approvals" element={<ProtectedRoute><QualificationApprovals /></ProtectedRoute>} />
          <Route path="/trade-management" element={<ProtectedRoute><TradeManagement /></ProtectedRoute>} />
          <Route path="/assessment-templates" element={<ProtectedRoute><AssessmentTemplateManagement /></ProtectedRoute>} />
          <Route path="/assessment-template-approvals" element={<ProtectedRoute><AssessmentTemplateApprovals /></ProtectedRoute>} />
          <Route path="/trainer-workload" element={<ProtectedRoute><TrainerWorkload /></ProtectedRoute>} />
          <Route path="/timetable-approvals" element={<ProtectedRoute><ProtectedTimetableManagement /></ProtectedRoute>} />
          <Route path="/historical-trainees" element={<ProtectedRoute><HistoricalTrainees /></ProtectedRoute>} />
          <Route path="/applications-inbox" element={<ProtectedRoute><ApplicationsInbox /></ProtectedRoute>} />
          <Route path="/online-applications" element={<ProtectedRoute><OnlineApplicationsInbox /></ProtectedRoute>} />
          <Route path="/grading-scale" element={<ProtectedRoute><GradingScale /></ProtectedRoute>} />
          <Route path="/exam-timetable-publishing" element={<ProtectedRoute><ExamTimetablePublishing /></ProtectedRoute>} />
          {/* Trainee Portal Routes */}
          <Route path="/trainee/registration" element={<ProtectedRoute><TraineeRegistrationPage /></ProtectedRoute>} />
          <Route path="/trainee/application/documents" element={<ProtectedRoute><TraineeDocumentsPage /></ProtectedRoute>} />
          <Route path="/trainee/application/status" element={<ProtectedRoute><TraineeAdmissionStatusPage /></ProtectedRoute>} />
          <Route path="/trainee/requests" element={<ProtectedRoute><TraineeRequestsPage /></ProtectedRoute>} />
          <Route path="/trainee/logbook" element={<ProtectedRoute><TraineeLogbookPage /></ProtectedRoute>} />
          <Route path="/academic-calendar" element={<ProtectedRoute><AcademicCalendar /></ProtectedRoute>} />
          <Route path="/deferral-requests" element={<ProtectedRoute><DeferralRequests /></ProtectedRoute>} />
          <Route path="/trainee/deferral" element={<ProtectedRoute><TraineeDeferralPage /></ProtectedRoute>} />
          <Route path="/course-catalogue" element={<ProtectedRoute><CourseCatalogue /></ProtectedRoute>} />
          <Route path="/trainee/transcript" element={<ProtectedRoute><TraineeTranscriptPage /></ProtectedRoute>} />
          <Route path="/transcripts" element={<ProtectedRoute><Transcripts /></ProtectedRoute>} />
          <Route path="/bank-reconciliation" element={<ProtectedRoute><BankReconciliation /></ProtectedRoute>} />
          <Route path="/accounting-export" element={<ProtectedRoute><AccountingExport /></ProtectedRoute>} />
          <Route path="/learning" element={<ProtectedRoute><LearningSpace /></ProtectedRoute>} />
          <Route path="/moodle" element={<ProtectedRoute><MoodleIntegration /></ProtectedRoute>} />
          <Route path="/registration-windows" element={<ProtectedRoute><RegistrationWindows /></ProtectedRoute>} />
          <Route path="/reports/certification" element={<ProtectedRoute><CertificationReports /></ProtectedRoute>} />
          <Route path="/reports/modules" element={<ProtectedRoute><ModuleReports /></ProtectedRoute>} />
          <Route path="/trainee/timetable" element={<ProtectedRoute><TraineeTimetablePage /></ProtectedRoute>} />
          <Route path="/trainee/events" element={<ProtectedRoute><TraineeEventsPage /></ProtectedRoute>} />
          <Route path="/trainee/feedback" element={<ProtectedRoute><TraineeFeedbackPage /></ProtectedRoute>} />
          <Route path="/trainee/hostel" element={<ProtectedRoute><TraineeHostelPage /></ProtectedRoute>} />
          <Route path="/trainee/exams/timetable" element={<ProtectedRoute><TraineeExamTimetablePage /></ProtectedRoute>} />
          <Route path="/trainee/exams/results" element={<ProtectedRoute><TraineeResultsPage /></ProtectedRoute>} />
          <Route path="/trainee/finance" element={<ProtectedRoute><TraineeFinancePage /></ProtectedRoute>} />
          <Route path="/trainee/payments" element={<ProtectedRoute><TraineePaymentsPage /></ProtectedRoute>} />
          {/* Debtor Officer Routes */}
          <Route path="/debtors/application-fees" element={<ProtectedRoute><ApplicationFees /></ProtectedRoute>} />
          <Route path="/debtors/registration-fees" element={<ProtectedRoute><RegistrationFees /></ProtectedRoute>} />
          <Route path="/debtors/cleared-payments" element={<ProtectedRoute><ClearedPayments /></ProtectedRoute>} />
          <Route path="/debtors/accounts" element={<ProtectedRoute><TraineeAccountsPage /></ProtectedRoute>} />
          <Route path="/debtors/config" element={<ProtectedRoute><FeeConfiguration /></ProtectedRoute>} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
          </Routes>
          </Suspense>
        </OrganizationProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
