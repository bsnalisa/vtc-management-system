import {
  LayoutDashboard,
  Users,
  GraduationCap,
  DollarSign,
  FileText,
  ClipboardCheck,
  ClipboardList,
  Calendar,
  BarChart3,
  Shield,
  Package,
  Building,
  Briefcase,
  Wrench,
  MessageSquare,
  BookOpen,
  UserCircle,
  Settings,
  CreditCard,
  Home,
  History,
  DoorClosed,
  LucideIcon,
  Landmark,
  ShieldCheck,
  Award,
  HelpCircle,
  AlertTriangle,
  Clock,
  LifeBuoy,
  Activity,
  ServerCog,
  ArrowUpCircle,
  Trash2,
} from "lucide-react";

export interface NavItem {
  title: string;
  url: string;
  icon: LucideIcon;
  children?: NavItem[];
  /** Optional sidebar heading. Consecutive items with the same section are grouped under it. */
  section?: string;
}

// Admin Navigation (system configuration and support)
export const adminNavItems: NavItem[] = [
  { title: "Dashboard", url: "/admin-dashboard", icon: LayoutDashboard },
  { title: "User Management", url: "/users", icon: Users },
  { title: "Training Modules", url: "/training-modules", icon: BookOpen },
  { title: "Trainee List", url: "/trainees", icon: Users },
  { title: "Trainer Management", url: "/trainers", icon: GraduationCap },
  { title: "Class Management", url: "/classes", icon: DoorClosed },
  { title: "Delivery Plans", url: "/delivery-plans", icon: Calendar },
  { title: "Logbook Review", url: "/logbook-review", icon: ClipboardCheck },
  { title: "Reports", url: "/reports", icon: FileText },
  { title: "Analytics", url: "/analytics", icon: BarChart3 },
  { title: "Role Management", url: "/roles", icon: Shield },
  { title: "Role Activity", url: "/role-activity", icon: BarChart3 },
  { title: "Organization Settings", url: "/organization-settings", icon: Settings },
  { title: "Proof of Registration", url: "/proof-of-registration-settings", icon: FileText },
  { title: "Identity Registry", url: "/identity-registry", icon: Shield },
  { title: "RPL & Exemptions", url: "/assessment-requests", icon: FileText },
  { title: "Assessment Development", url: "/assessment-development", icon: ClipboardList },
  { title: "Assessment Sittings", url: "/assessment-sittings", icon: ClipboardCheck },
  { title: "Resource Centre", url: "/library", icon: BookOpen },
  { title: "Graduation & Surveys", url: "/graduation", icon: GraduationCap },
  { title: "Support Tickets", url: "/support-tickets", icon: MessageSquare },
  { title: "Escalated Tickets", url: "/escalated-tickets", icon: ArrowUpCircle },
  { title: "Test Data Reset", url: "/test-data-reset", icon: Trash2 },
  { title: "My Approvals", url: "/my-approvals", icon: ClipboardCheck },
  { title: "Workflows", url: "/workflows", icon: Settings },
  { title: "Reporting Confirmations", url: "/reporting-confirmations", icon: ShieldCheck },
  { title: "Role Factory", url: "/role-factory", icon: Settings },
  { title: "Academic Calendar", url: "/academic-calendar", icon: Calendar },
  { title: "Course Catalogue", url: "/course-catalogue", icon: BookOpen },
  { title: "Learning Space", url: "/learning", icon: BookOpen },
  { title: "Deferral Requests", url: "/deferral-requests", icon: ClipboardList },
  { title: "Transcripts", url: "/transcripts", icon: FileText },
  { title: "Bank Reconciliation", url: "/bank-reconciliation", icon: CreditCard },
  { title: "Accounting Export", url: "/accounting-export", icon: DollarSign },
  { title: "Moodle", url: "/moodle", icon: GraduationCap },
  { title: "Registration Windows", url: "/registration-windows", icon: Calendar },
  { title: "Certification Reports", url: "/reports/certification", icon: FileText },
  { title: "Module Reports", url: "/reports/modules", icon: BarChart3 },
  { title: "Document Settings", url: "/document-settings", icon: FileText },
  { title: "My Leave & HR", url: "/my-hr", icon: Calendar },
];

// Organization Admin Navigation (Technical & Administrative Only - No Academic Functions)
export const organizationAdminNavItems: NavItem[] = [
  { title: "Dashboard", url: "/organization-admin-dashboard", icon: LayoutDashboard, section: "Dashboard" },
  { title: "Support Tickets", url: "/support-tickets", icon: LifeBuoy, section: "Support Services" },
  { title: "Escalations to Super Admin", url: "/support-tickets?tab=escalated", icon: ArrowUpCircle, section: "Support Services" },
  { title: "System Diagnostics", url: "/system-status", icon: ServerCog, section: "Support Services" },
  { title: "User Accounts", url: "/users", icon: Users, section: "User Management" },
  { title: "Roles & Permissions", url: "/roles", icon: Shield, section: "User Management" },
  { title: "Organization Settings", url: "/organization-settings", icon: Settings, section: "Centre Setup" },
  { title: "Modules", url: "/modules-management", icon: BookOpen, section: "Centre Setup" },
  { title: "Registration Windows", url: "/registration-windows", icon: Calendar, section: "Centre Setup" },
  { title: "Academic Calendar", url: "/academic-calendar", icon: Calendar, section: "Centre Setup" },
  { title: "Document Settings", url: "/document-settings", icon: FileText, section: "Centre Setup" },
  { title: "Proof of Registration", url: "/proof-of-registration-settings", icon: FileText, section: "Centre Setup" },
  { title: "Workflows", url: "/workflows", icon: Settings, section: "Centre Setup" },
  { title: "Reporting Structure", url: "/reporting-structure", icon: Users, section: "Centre Setup" },
  { title: "Custom Roles", url: "/role-assignments", icon: ShieldCheck, section: "Centre Setup" },
  { title: "Moodle", url: "/moodle", icon: GraduationCap, section: "Centre Setup" },
  { title: "Activity Logs", url: "/role-activity", icon: Activity, section: "System Monitoring" },
  { title: "Audit Trail", url: "/system-logs", icon: History, section: "System Monitoring" },
  { title: "My Approvals", url: "/my-approvals", icon: ClipboardCheck, section: "My Work" },
  { title: "My Leave & HR", url: "/my-hr", icon: Calendar, section: "My Work" },
];

// Centre Manager Navigation: grouped by the duties in the job description. The Centre Manager
// oversees; pages outside "Leadership" and "Financial Management" are view-only because creating
// or changing those records belongs to other roles (e.g. classes to the Head of Training).
export const centreManagerNavItems: NavItem[] = [
  { title: "Dashboard", url: "/centre-manager-dashboard", icon: LayoutDashboard, section: "Leadership" },
  { title: "My Approvals", url: "/my-approvals", icon: ClipboardCheck, section: "Leadership" },
  { title: "Centre Office", url: "/pa-dashboard", icon: Briefcase, section: "Leadership" },
  { title: "Centre Targets", url: "/centre-targets", icon: Landmark, section: "Leadership" },
  { title: "Finance Approvals", url: "/finance-approvals", icon: ClipboardCheck, section: "Financial Management" },
  { title: "Requisition Template", url: "/requisition-template", icon: ClipboardList, section: "Financial Management" },
  { title: "Classes & Facilities", url: "/classes", icon: DoorClosed, section: "Quality of Training" },
  { title: "Trainees", url: "/trainees", icon: Users, section: "Quality of Training" },
  { title: "Transfer Requests", url: "/transfers", icon: ClipboardCheck, section: "Quality of Training" },
  { title: "Transcripts", url: "/transcripts", icon: FileText, section: "Quality of Training" },
  { title: "Certification Reports", url: "/reports/certification", icon: FileText, section: "Quality of Training" },
  { title: "Graduation & Surveys", url: "/graduation", icon: GraduationCap, section: "Quality of Training" },
  { title: "Trainers", url: "/trainers", icon: GraduationCap, section: "Staff Management (view only)" },
  { title: "My Leave & HR", url: "/my-hr", icon: Calendar, section: "Staff Management (view only)" },
  { title: "Reports", url: "/reports", icon: FileText, section: "Administration" },
  { title: "Reporting Structure", url: "/reporting-structure", icon: Users, section: "Administration" },
  { title: "Support Tickets", url: "/support-tickets", icon: MessageSquare, section: "Administration" },
];

// Head of Training Navigation (Academic Command Center)
export const headOfTrainingNavItems: NavItem[] = [
  { title: "Dashboard", url: "/head-of-training-dashboard", icon: LayoutDashboard },
  { title: "Transfer Requests", url: "/transfers", icon: ClipboardCheck },
  { title: "Trade Management", url: "/trade-management", icon: Briefcase },
  { title: "Qualification Approvals", url: "/qualification-approvals", icon: ClipboardCheck },
  { title: "Template Approvals", url: "/assessment-template-approvals", icon: ClipboardList },
  { title: "Trainer Management", url: "/trainers", icon: GraduationCap },
  { title: "Trainer Workload", url: "/trainer-workload", icon: BarChart3 },
  { title: "Class Management", url: "/classes", icon: DoorClosed },
  { title: "Timetable Approvals", url: "/timetable-approvals", icon: Calendar },
  { title: "Gradebook Oversight", url: "/gradebook-review", icon: BookOpen },
  { title: "Qualification Results", url: "/qualification-results", icon: BarChart3 },
  { title: "Assessment Review", url: "/assessment-results", icon: ClipboardCheck },
  { title: "Assessment Governance", url: "/assessment-governance", icon: Shield },
  { title: "Trainee List", url: "/trainees", icon: Users },
  { title: "Delivery Plans", url: "/delivery-plans", icon: Calendar },
  { title: "Logbook Review", url: "/logbook-review", icon: ClipboardCheck },
  { title: "Reports", url: "/reports", icon: FileText },
  { title: "My Approvals", url: "/my-approvals", icon: ClipboardCheck },
  { title: "Academic Calendar", url: "/academic-calendar", icon: Calendar },
  { title: "Course Catalogue", url: "/course-catalogue", icon: BookOpen },
  { title: "Learning Space", url: "/learning", icon: BookOpen },
  { title: "Deferral Requests", url: "/deferral-requests", icon: ClipboardList },
  { title: "Transcripts", url: "/transcripts", icon: FileText },
  { title: "Moodle", url: "/moodle", icon: GraduationCap },
  { title: "Registration Windows", url: "/registration-windows", icon: Calendar },
  { title: "Certification Reports", url: "/reports/certification", icon: FileText },
  { title: "Module Reports", url: "/reports/modules", icon: BarChart3 },
  { title: "My Leave & HR", url: "/my-hr", icon: Calendar },
];

// Trainer Navigation
export const trainerNavItems: NavItem[] = [
  { title: "Dashboard", url: "/trainer-dashboard", icon: LayoutDashboard },
  { title: "My Classes", url: "/classes", icon: DoorClosed },
  { title: "Gradebooks", url: "/gradebooks", icon: BookOpen },
  { title: "Attendance", url: "/attendance", icon: ClipboardCheck },
  { title: "Timetable", url: "/timetable", icon: Calendar },
  { title: "Delivery Plans", url: "/delivery-plans", icon: Calendar },
  { title: "Logbook Review", url: "/logbook-review", icon: ClipboardCheck },
  { title: "Reports", url: "/reports", icon: FileText },
  { title: "Messages", url: "/messages", icon: MessageSquare },
  { title: "My Approvals", url: "/my-approvals", icon: ClipboardCheck },
  { title: "Academic Calendar", url: "/academic-calendar", icon: Calendar },
  { title: "Course Catalogue", url: "/course-catalogue", icon: BookOpen },
  { title: "Learning Space", url: "/learning", icon: BookOpen },
  { title: "My Leave & HR", url: "/my-hr", icon: Calendar },
];

// --------------------- Trainee Navigation ---------------------
export const traineeNavItems: NavItem[] = [
  { title: "Dashboard", url: "/trainee-dashboard", icon: LayoutDashboard },
  { title: "My Profile", url: "/profile", icon: UserCircle },
  { title: "Registration", url: "/trainee/registration", icon: ClipboardList },
  { title: "Transfer to another VTC", url: "/trainee/transfer", icon: ClipboardList },
  { title: "Documents", url: "/trainee/application/documents", icon: FileText },
  { title: "Admission Status", url: "/trainee/application/status", icon: FileText },
  { title: "Hostel", url: "/trainee/hostel", icon: Building },
  { title: "Exam Timetable", url: "/trainee/exams/timetable", icon: BookOpen },
  { title: "Results", url: "/trainee/exams/results", icon: BookOpen },
  { title: "Fee Statement", url: "/trainee/finance", icon: DollarSign },
  { title: "Payments", url: "/trainee/payments", icon: CreditCard },
  { title: "Calendar & Events", url: "/trainee/events", icon: Calendar },
  { title: "Industrial Logbook", url: "/trainee/logbook", icon: BookOpen },
  { title: "Assessment Requests", url: "/trainee/requests", icon: ClipboardCheck },
  { title: "Library", url: "/library", icon: BookOpen },
  { title: "Feedback & Suggestions", url: "/trainee/feedback", icon: MessageSquare },
  { title: "Academic Calendar", url: "/academic-calendar", icon: Calendar },
  { title: "Course Catalogue", url: "/course-catalogue", icon: BookOpen },
  { title: "Learning Space", url: "/learning", icon: BookOpen },
  { title: "Deferral", url: "/trainee/deferral", icon: ClipboardList },
  { title: "Transcript", url: "/trainee/transcript", icon: FileText },
  { title: "Class Timetable", url: "/trainee/timetable", icon: Calendar },
];

// HOD Navigation
export const hodNavItems: NavItem[] = [
  { title: "Dashboard", url: "/hod-dashboard", icon: LayoutDashboard },
  { title: "Department Overview", url: "/classes", icon: DoorClosed },
  { title: "Delivery Plans", url: "/delivery-plans", icon: Calendar },
  { title: "Reports", url: "/reports", icon: FileText },
  { title: "Analytics", url: "/analytics", icon: BarChart3 },
  { title: "Performance", url: "/assessment-results", icon: BarChart3 },
  { title: "My Approvals", url: "/my-approvals", icon: ClipboardCheck },
  { title: "My Leave & HR", url: "/my-hr", icon: Calendar },
];

// Assessment Coordinator Navigation
export const assessmentCoordinatorNavItems: NavItem[] = [
  { title: "Dashboard", url: "/assessment-coordinator-dashboard", icon: LayoutDashboard },
  { title: "Qualifications", url: "/qualifications", icon: GraduationCap },
  { title: "Assessment Templates", url: "/assessment-templates", icon: ClipboardList },
  { title: "Summative Assessment", url: "/summative-assessment", icon: ClipboardCheck },
  { title: "Results & Gradebooks", url: "/qualification-results", icon: BarChart3 },
  { title: "Governance & Cycles", url: "/assessment-governance", icon: Shield },
  { title: "Timetable", url: "/timetable", icon: Calendar },
  { title: "Exam Publishing", url: "/exam-timetable-publishing", icon: Calendar },
  { title: "RPL & Exemptions", url: "/assessment-requests", icon: FileText },
  { title: "Assessment Development", url: "/assessment-development", icon: ClipboardList },
  { title: "Assessment Sittings", url: "/assessment-sittings", icon: ClipboardCheck },
  { title: "Course Enrollment", url: "/enrollments", icon: ClipboardCheck },
  { title: "Reports", url: "/reports", icon: FileText },
  { title: "My Approvals", url: "/my-approvals", icon: ClipboardCheck },
  { title: "Certification Reports", url: "/reports/certification", icon: FileText },
  { title: "My Leave & HR", url: "/my-hr", icon: Calendar },
];

// Debtor Officer Navigation (Financial Operations Only - Separate Routes)
export const debtorOfficerNavItems: NavItem[] = [
  { title: "Overview", url: "/debtor-officer-dashboard", icon: LayoutDashboard },
  { title: "Application Fees", url: "/debtors/application-fees", icon: FileText },
  { title: "Registration Fees", url: "/debtors/registration-fees", icon: GraduationCap },
  { title: "Cleared Payments", url: "/debtors/cleared-payments", icon: History },
  { title: "Trainee Accounts", url: "/debtors/accounts", icon: DollarSign },
  { title: "Fee Configuration", url: "/debtors/config", icon: Settings },
  { title: "Adjustments", url: "/debtors/adjustments", icon: ClipboardCheck },
  { title: "My Approvals", url: "/my-approvals", icon: ClipboardCheck },
  { title: "Bank Reconciliation", url: "/bank-reconciliation", icon: CreditCard },
  { title: "Accounting Export", url: "/accounting-export", icon: DollarSign },
  { title: "My Leave & HR", url: "/my-hr", icon: Calendar },
];

// Registration Officer Navigation
export const registrationOfficerNavItems: NavItem[] = [
  { title: "Dashboard", url: "/registration-officer-dashboard", icon: LayoutDashboard },
  { title: "Transfer Requests", url: "/transfers", icon: ClipboardCheck },
  { title: "Applications Inbox", url: "/applications-inbox", icon: FileText },
  { title: "Online Applications", url: "/online-applications", icon: ClipboardList },
  { title: "Admission Results", url: "/applications", icon: ClipboardCheck },
  { title: "Register Trainee", url: "/trainees/register", icon: Users },
  { title: "Trainee List", url: "/trainees", icon: Users },
  { title: "Historical Trainees", url: "/historical-trainees", icon: Users },
  { title: "Entry Requirements", url: "/entry-requirements", icon: ClipboardList },
  { title: "Grading Scale", url: "/grading-scale", icon: BarChart3 },
  { title: "Reports", url: "/reports", icon: FileText },
  { title: "My Approvals", url: "/my-approvals", icon: ClipboardCheck },
  { title: "Academic Calendar", url: "/academic-calendar", icon: Calendar },
  { title: "Course Catalogue", url: "/course-catalogue", icon: BookOpen },
  { title: "Deferral Requests", url: "/deferral-requests", icon: ClipboardList },
  { title: "Transcripts", url: "/transcripts", icon: FileText },
  { title: "Registration Windows", url: "/registration-windows", icon: Calendar },
  { title: "Certification Reports", url: "/reports/certification", icon: FileText },
  { title: "My Leave & HR", url: "/my-hr", icon: Calendar },
];

// Stock Control Officer Navigation
export const stockControlNavItems: NavItem[] = [
  { title: "Dashboard", url: "/stock-control-officer-dashboard", icon: LayoutDashboard },
  { title: "Stock Management", url: "/stock", icon: Package },
  { title: "Stock Movements", url: "/stock", icon: Package },
  { title: "Categories", url: "/stock", icon: Package },
  { title: "Reports", url: "/reports", icon: FileText },
  { title: "My Approvals", url: "/my-approvals", icon: ClipboardCheck },
  { title: "My Leave & HR", url: "/my-hr", icon: Calendar },
];

// Asset Maintenance Coordinator Navigation
export const assetMaintenanceNavItems: NavItem[] = [
  { title: "Dashboard", url: "/asset-maintenance-coordinator-dashboard", icon: LayoutDashboard },
  { title: "Asset Management", url: "/assets", icon: Package },
  { title: "Asset Requests", url: "/asset-requests", icon: ClipboardCheck },
  { title: "Maintenance", url: "/assets", icon: Wrench },
  { title: "Depreciation", url: "/assets", icon: BarChart3 },
  { title: "Reports", url: "/reports", icon: FileText },
  { title: "My Approvals", url: "/my-approvals", icon: ClipboardCheck },
  { title: "My Leave & HR", url: "/my-hr", icon: Calendar },
];

// Procurement Officer Navigation
export const procurementNavItems: NavItem[] = [
  { title: "Dashboard", url: "/procurement-officer-dashboard", icon: LayoutDashboard },
  { title: "Purchase Orders", url: "/purchase-orders", icon: FileText },
  { title: "Requisition Template", url: "/requisition-template", icon: ClipboardList },
  { title: "Receiving Reports", url: "/receiving-reports", icon: FileText },
  { title: "Suppliers", url: "/suppliers", icon: Users },
  { title: "My Approvals", url: "/my-approvals", icon: ClipboardCheck },
  { title: "My Leave & HR", url: "/my-hr", icon: Calendar },
];

// Placement Officer Navigation
export const placementOfficerNavItems: NavItem[] = [
  { title: "Dashboard", url: "/placement-officer-dashboard", icon: LayoutDashboard },
  { title: "Alumni Management", url: "/alumni", icon: Users },
  { title: "Graduation & Surveys", url: "/graduation", icon: GraduationCap },
  { title: "Logbook Review", url: "/logbook-review", icon: ClipboardCheck },
  { title: "My Approvals", url: "/my-approvals", icon: ClipboardCheck },
  { title: "My Leave & HR", url: "/my-hr", icon: Calendar },
];

export const liaisonOfficerNavItems: NavItem[] = [
  { title: "Dashboard", url: "/liaison-officer-dashboard", icon: LayoutDashboard },
  { title: "Industry Partners", url: "/liaison/partners", icon: Briefcase },
  { title: "Messages", url: "/messages", icon: MessageSquare },
  { title: "Staff Training", url: "/onboarding", icon: BookOpen },
  { title: "Support Tickets", url: "/support-tickets", icon: FileText },
  { title: "My Profile", url: "/profile", icon: UserCircle },
  { title: "My Leave & HR", url: "/my-hr", icon: Calendar },
];

export const resourceCenterNavItems: NavItem[] = [
  { title: "Dashboard", url: "/resource-center-coordinator-dashboard", icon: LayoutDashboard },
  { title: "Resource Catalogue", url: "/library?tab=catalogue", icon: BookOpen },
  { title: "Resource Loans", url: "/library?tab=circulation", icon: ClipboardList },
  { title: "Staff Training", url: "/onboarding", icon: BookOpen },
  { title: "Messages", url: "/messages", icon: MessageSquare },
  { title: "Support Tickets", url: "/support-tickets", icon: FileText },
  { title: "My Profile", url: "/profile", icon: UserCircle },
  { title: "My Leave & HR", url: "/my-hr", icon: Calendar },
];

// Hostel Coordinator Navigation
export const hostelCoordinatorNavItems: NavItem[] = [
  { title: "Dashboard", url: "/hostel-coordinator-dashboard", icon: LayoutDashboard },
  { title: "Hostel Management", url: "/hostel", icon: Building },
  { title: "Allocations", url: "/hostel", icon: Users },
  { title: "Fees", url: "/hostel", icon: DollarSign },
  { title: "Maintenance", url: "/hostel", icon: Wrench },
  { title: "My Approvals", url: "/my-approvals", icon: ClipboardCheck },
  { title: "My Leave & HR", url: "/my-hr", icon: Calendar },
];

// Projects Coordinator Navigation
export const projectsCoordinatorNavItems: NavItem[] = [
  { title: "Dashboard", url: "/projects-coordinator-dashboard", icon: LayoutDashboard },
  { title: "Projects", url: "/projects", icon: Briefcase },
  { title: "Milestones", url: "/projects/milestones", icon: ClipboardCheck },
  { title: "Reports", url: "/reports", icon: FileText },
  { title: "My Approvals", url: "/my-approvals", icon: ClipboardCheck },
  { title: "My Leave & HR", url: "/my-hr", icon: Calendar },
];

// HR Officer Navigation
export const hrOfficerNavItems: NavItem[] = [
  { title: "Dashboard", url: "/hr-officer-dashboard", icon: LayoutDashboard },
  { title: "Employees", url: "/hr/employees", icon: Users },
  { title: "Leave Management", url: "/hr/leave", icon: Calendar },
  { title: "Recruitment", url: "/hr/recruitment", icon: Briefcase },
  { title: "Performance", url: "/hr/performance", icon: BarChart3 },
  { title: "Staff Establishment", url: "/staff-establishment", icon: Users },
  { title: "Reports", url: "/reports", icon: FileText },
  { title: "My Approvals", url: "/my-approvals", icon: ClipboardCheck },
  { title: "My Leave & HR", url: "/my-hr", icon: Calendar },
];

// Subject Matter Expert Navigation
export const smeNavItems: NavItem[] = [
  { title: "Dashboard", url: "/sme-dashboard", icon: LayoutDashboard },
  { title: "Assessment Development", url: "/assessment-development", icon: ClipboardList },
  { title: "My Approvals", url: "/my-approvals", icon: ClipboardCheck },
  { title: "My Leave & HR", url: "/my-hr", icon: Calendar },
];

// Printing & Distribution Officer Navigation
export const printingOfficerNavItems: NavItem[] = [
  { title: "Dashboard", url: "/printing-dashboard", icon: LayoutDashboard },
  { title: "Assessment Sittings", url: "/assessment-sittings", icon: ClipboardCheck },
  { title: "My Approvals", url: "/my-approvals", icon: ClipboardCheck },
  { title: "My Leave & HR", url: "/my-hr", icon: Calendar },
];

// Finance and administration line and the Centre Manager's office (dedicated dashboards follow)
export const financeAdminNavItems: NavItem[] = [
  { title: "My Approvals", url: "/my-approvals", icon: ClipboardCheck },
  { title: "My Leave & HR", url: "/my-hr", icon: Calendar },
];

export const paNavItems: NavItem[] = [
  { title: "Dashboard", url: "/pa-dashboard", icon: LayoutDashboard },
  { title: "Centre Targets", url: "/centre-targets", icon: Landmark },
  { title: "My Approvals", url: "/my-approvals", icon: ClipboardCheck },
  { title: "My Leave & HR", url: "/my-hr", icon: Calendar },
];

export const headOfFinanceAdminNavItems: NavItem[] = [
  { title: "Dashboard", url: "/head-of-finance-admin-dashboard", icon: LayoutDashboard },
  { title: "Approval Centre", url: "/finance-approvals", icon: ClipboardCheck },
  { title: "My Approvals", url: "/my-approvals", icon: ClipboardCheck },
  { title: "Requisition Template", url: "/requisition-template", icon: ClipboardList },
  { title: "Creditors", url: "/creditors-officer-dashboard", icon: FileText },
  { title: "Debtor Adjustments", url: "/debtors/adjustments", icon: DollarSign },
  { title: "NSFAF Funding", url: "/loan-officer-dashboard?tab=reconciliation", icon: Landmark },
  { title: "Asset Requests", url: "/asset-requests", icon: Package },
  { title: "Suppliers", url: "/suppliers", icon: Users },
  { title: "Bank Reconciliation", url: "/bank-reconciliation", icon: CreditCard },
  { title: "Accounting Export", url: "/accounting-export", icon: DollarSign },
  { title: "Reports", url: "/reports", icon: FileText },
  { title: "My Leave & HR", url: "/my-hr", icon: Calendar },
];

export const accountantNavItems: NavItem[] = [
  { title: "Dashboard", url: "/accountant-dashboard", icon: LayoutDashboard },
  { title: "My Approvals", url: "/my-approvals", icon: ClipboardCheck },
  { title: "Creditors", url: "/creditors-officer-dashboard", icon: FileText },
  { title: "Debtor Adjustments", url: "/debtors/adjustments", icon: DollarSign },
  { title: "NSFAF Funding", url: "/loan-officer-dashboard?tab=reconciliation", icon: Landmark },
  { title: "Bank Reconciliation", url: "/bank-reconciliation", icon: CreditCard },
  { title: "Accounting Export", url: "/accounting-export", icon: DollarSign },
  { title: "Reports", url: "/reports", icon: FileText },
  { title: "My Leave & HR", url: "/my-hr", icon: Calendar },
];

export const loanOfficerNavItems: NavItem[] = [
  { title: "Dashboard", url: "/loan-officer-dashboard?tab=overview", icon: LayoutDashboard, section: "Overview" },
  { title: "Funding Register", url: "/loan-officer-dashboard?tab=register", icon: Users, section: "Trainee Funding" },
  { title: "Funding Applications", url: "/loan-officer-dashboard?tab=applications", icon: FileText, section: "Trainee Funding" },
  { title: "Document Verification", url: "/loan-officer-dashboard?tab=documents", icon: ClipboardCheck, section: "Trainee Funding" },
  { title: "Awards and Agreements", url: "/loan-officer-dashboard?tab=awards", icon: Award, section: "Trainee Funding" },
  { title: "Registration and Progression", url: "/loan-officer-dashboard?tab=progression", icon: GraduationCap, section: "Trainee Funding" },
  { title: "Funding Payments", url: "/loan-officer-dashboard?tab=payments", icon: DollarSign, section: "Financial Monitoring" },
  { title: "Reconciliation", url: "/loan-officer-dashboard?tab=reconciliation", icon: Landmark, section: "Financial Monitoring" },
  { title: "NSFAF Correspondence", url: "/loan-officer-dashboard?tab=correspondence", icon: MessageSquare, section: "Communication and Support" },
  { title: "Trainee Enquiries", url: "/loan-officer-dashboard?tab=enquiries", icon: HelpCircle, section: "Communication and Support" },
  { title: "Appeals and Exceptions", url: "/loan-officer-dashboard?tab=appeals", icon: AlertTriangle, section: "Communication and Support" },
  { title: "Follow-ups", url: "/loan-officer-dashboard?tab=followups", icon: Clock, section: "Communication and Support" },
  { title: "Funding Reports", url: "/loan-officer-dashboard?tab=reports", icon: BarChart3, section: "Reporting" },
  { title: "Audit Trail", url: "/loan-officer-dashboard?tab=audit", icon: History, section: "Reporting" },
  { title: "My Approvals", url: "/my-approvals", icon: ClipboardCheck, section: "Administration" },
  { title: "Profile and Settings", url: "/profile", icon: Settings, section: "Administration" },
  { title: "My Leave & HR", url: "/my-hr", icon: Calendar, section: "Administration" },
];

export const creditorsOfficerNavItems: NavItem[] = [
  { title: "Dashboard", url: "/creditors-officer-dashboard", icon: LayoutDashboard },
  { title: "Suppliers", url: "/suppliers", icon: Users },
  { title: "My Approvals", url: "/my-approvals", icon: ClipboardCheck },
  { title: "Reports", url: "/reports", icon: FileText },
  { title: "My Leave & HR", url: "/my-hr", icon: Calendar },
];

// Librarian Navigation
export const librarianNavItems: NavItem[] = [
  { title: "Dashboard", url: "/resource-center", icon: LayoutDashboard },
  { title: "Resource Centre", url: "/library", icon: BookOpen },
  { title: "Reports", url: "/reports", icon: FileText },
  { title: "My Approvals", url: "/my-approvals", icon: ClipboardCheck },
  { title: "Module Reports", url: "/reports/modules", icon: BarChart3 },
  { title: "My Leave & HR", url: "/my-hr", icon: Calendar },
];

// Head of Trainee Support Navigation
export const headOfTraineeSupportNavItems: NavItem[] = [
  { title: "Dashboard", url: "/trainee-support-dashboard", icon: LayoutDashboard },
  { title: "Pending Approvals", url: "/trainee-support/pending-approvals", icon: ClipboardCheck },
  { title: "Transfer Requests", url: "/transfers", icon: ClipboardCheck },
  { title: "Trainee List", url: "/trainees", icon: Users },
  { title: "Entry Requirements", url: "/entry-requirements", icon: ClipboardList },
  { title: "Trainee Affairs", url: "/trainee-affairs", icon: ClipboardList },
  { title: "Graduation & Surveys", url: "/graduation", icon: GraduationCap },
  { title: "Officer Activity", url: "/trainee-support/officer-activity", icon: BarChart3 },
  { title: "Reports", url: "/reports", icon: FileText },
  { title: "My Approvals", url: "/my-approvals", icon: ClipboardCheck },
  { title: "Module Reports", url: "/reports/modules", icon: BarChart3 },
  { title: "My Leave & HR", url: "/my-hr", icon: Calendar },
];

// BDL (Blended Distance Learning) Coordinator Navigation
export const bdlCoordinatorNavItems: NavItem[] = [
  { title: "Dashboard", url: "/bdl-coordinator-dashboard", icon: LayoutDashboard },
  { title: "Blended Courses", url: "/bdl/courses", icon: BookOpen },
  { title: "Learning Materials", url: "/bdl/materials", icon: FileText },
  { title: "Virtual Sessions", url: "/bdl/sessions", icon: Calendar },
  { title: "Trainee Progress", url: "/bdl/progress", icon: BarChart3 },
  { title: "Reports", url: "/reports", icon: FileText },
  { title: "My Approvals", url: "/my-approvals", icon: ClipboardCheck },
  { title: "My Leave & HR", url: "/my-hr", icon: Calendar },
];

// RPL (Recognition of Prior Learning) Coordinator Navigation
export const rplCoordinatorNavItems: NavItem[] = [
  { title: "Dashboard", url: "/rpl-coordinator-dashboard", icon: LayoutDashboard },
  { title: "Applications", url: "/rpl/applications", icon: FileText },
  { title: "Portfolio Assessment", url: "/rpl/portfolio", icon: ClipboardCheck },
  { title: "Assessment Schedule", url: "/rpl/schedule", icon: Calendar },
  { title: "Credit Mapping", url: "/rpl/credits", icon: GraduationCap },
  { title: "RPL & Exemptions", url: "/assessment-requests", icon: FileText },
  { title: "Reports", url: "/reports", icon: FileText },
  { title: "My Approvals", url: "/my-approvals", icon: ClipboardCheck },
  { title: "My Leave & HR", url: "/my-hr", icon: Calendar },
];
